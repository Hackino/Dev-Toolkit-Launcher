import { join } from 'node:path';
import type { LanguageFeature, MobileCommands, MobileCommandContext } from '../../core/ports';
import type { MobileConfig } from '../../../shared/types';
import { gradlewBin, capitalize } from '../../capabilities/gradle/gradle';
import { androidSigningFlags } from '../../capabilities/signing/androidSigning';
import { resolveFlags, mergeFlags } from '../../capabilities/buildflags/buildFlagResolver';

function variantSuffix(ctx: MobileCommandContext): string {
  const cfg = ctx.androidBuildConfig;
  if (!cfg) return 'Debug';
  const flavor = cfg.flavor ? capitalize(cfg.flavor) : '';
  return `${flavor}${capitalize(cfg.buildType || 'debug')}`;
}

function modulePrefix(ctx: MobileCommandContext): string {
  return `:${ctx.config.androidModule || 'app'}:`;
}

function buildFlags(ctx: MobileCommandContext): string[] {
  const cfg = ctx.androidBuildConfig;
  const combined = mergeFlags(ctx.config.globalFlags, cfg?.customFlags ?? []);
  const flags = resolveFlags(combined, ['gradle-prop', 'gradle-flag', 'gradle-system-prop']);
  if (cfg?.minify.proguardFiles?.length) flags.push(`-PminifyEnabled=${cfg.minify.enabled}`);
  return flags;
}

const commands: MobileCommands = {
  platform: 'android',

  buildCommand(ctx) {
    const task = `${modulePrefix(ctx)}assemble${variantSuffix(ctx)}`;
    return [gradlewBin(ctx.projectPath), task, ...buildFlags(ctx)].join(' ');
  },

  cleanCommand(ctx) {
    return `${gradlewBin(ctx.projectPath)} clean`;
  },

  runOnDeviceCommand(ctx, deviceId) {
    const task = `${modulePrefix(ctx)}install${variantSuffix(ctx)}`;
    const installCmd = [gradlewBin(ctx.projectPath), task, ...buildFlags(ctx)].join(' ');
    const appId = ctx.config.applicationId ?? '';
    if (!appId) return installCmd;
    // `monkey` launches the app's default LAUNCHER activity without needing to
    // know its class name (the old `am start -n appId/.MainActivity` guess broke
    // for any app whose entry activity isn't literally `.MainActivity`).
    const launch = `adb -s ${deviceId} shell monkey -p ${appId} -c android.intent.category.LAUNCHER 1`;
    // Keep the run alive by following the app's logcat (Stop ends it). Without
    // this the task exits right after launch and the column shows "disconnected".
    const logcat = `adb -s ${deviceId} logcat --pid=$(adb -s ${deviceId} shell pidof ${appId} 2>/dev/null || echo 0)`;
    return `${installCmd} && ${launch} && echo "── following logcat for ${appId} (press Stop to end) ──" && sleep 2 && ${logcat}`;
  },

  runOnEmulatorCommand(ctx, deviceId) {
    return commands.runOnDeviceCommand(ctx, deviceId);
  },

  releaseCommand(ctx) {
    // Bundle (.aab) for the currently selected variant (flavor + build type).
    const task = `${modulePrefix(ctx)}bundle${variantSuffix(ctx)}`;
    const signingFlags = androidSigningFlags(ctx.config.androidSigning, ctx.resolvedEnv);
    return [gradlewBin(ctx.projectPath), task, ...buildFlags(ctx), ...signingFlags].join(' ');
  },

  logsCommand(ctx, deviceId) {
    const base = deviceId ? `adb -s ${deviceId} logcat` : 'adb logcat';
    const appId = ctx.config.applicationId;
    if (appId) {
      const dev = deviceId ? ` -s ${deviceId}` : '';
      return `${base} --pid=$(adb${dev} shell pidof ${appId} 2>/dev/null || echo 0)`;
    }
    return `${base} -v time`;
  },

  ideCommand(projectPath: string, _config: MobileConfig) {
    if (process.platform === 'darwin') return `open -a "Android Studio" "${projectPath}"`;
    if (process.platform === 'win32') return `start "" "studio64.exe" "${projectPath}"`;
    return `studio.sh "${projectPath}"`;
  },

  expectedArtifactPath(ctx) {
    // Release builds produce an App Bundle (.aab) for the selected variant.
    const mod = ctx.config.androidModule || 'app';
    const variant = variantSuffix(ctx).toLowerCase();
    return join(ctx.projectPath, mod, 'build', 'outputs', 'bundle', variant, `${mod}-${variant}.aab`);
  },
};

export const androidFeature: LanguageFeature = {
  type: 'android',
  category: 'mobile',
  defaults: { runCommand: './gradlew :app:assembleDebug', port: null },
  resolveRunCommand(projectPath, runCommand) {
    if (runCommand.startsWith('./gradlew') || runCommand.startsWith('gradlew')) {
      return runCommand.replace('./gradlew', gradlewBin(projectPath));
    }
    return runCommand;
  },
  mobile: commands,
};
