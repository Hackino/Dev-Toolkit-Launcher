import { join } from 'node:path';
import type { LanguageFeature, MobileCommands, MobileCommandContext } from '../../core/ports';
import type { KmpTarget, MobileConfig } from '../../../shared/types';
import { gradlewBin } from '../../capabilities/gradle/gradle';
import { androidSigningFlags } from '../../capabilities/signing/androidSigning';
import { resolveFlags } from '../../capabilities/buildflags/buildFlagResolver';

const IOS_NOT_MACOS = 'iOS builds require macOS.';

function gradleFlags(ctx: MobileCommandContext): string[] {
  return resolveFlags(ctx.config.globalFlags, ['gradle-prop', 'gradle-flag', 'gradle-system-prop']);
}

function modulePrefix(ctx: MobileCommandContext): string {
  return `:${ctx.config.kmpModule || 'composeApp'}:`;
}

function targetTask(ctx: MobileCommandContext, target: KmpTarget): string {
  const prefix = modulePrefix(ctx);
  switch (target) {
    case 'android': return `${prefix}assembleDebug`;
    case 'ios':
      if (process.platform !== 'darwin') throw new Error(IOS_NOT_MACOS);
      return `${prefix}iosSimulatorArm64Binaries`;
    case 'desktop': return `${prefix}desktopRun`;
    case 'web': return `${prefix}wasmJsBrowserDevelopmentRun`;
  }
}

function buildAndRunIos(ctx: MobileCommandContext, deviceId: string): string {
  const gw = gradlewBin(ctx.projectPath);
  const buildCmd = [gw, `${modulePrefix(ctx)}iosSimulatorArm64Binaries`, ...gradleFlags(ctx)].join(' ');
  const bundleDir = `${ctx.projectPath}/${ctx.config.kmpModule || 'composeApp'}/build/bin/iosSimulatorArm64/debugFramework`;
  const simCmd = [
    `xcrun simctl boot ${deviceId} 2>/dev/null || true`,
    `xcrun simctl install ${deviceId} "${bundleDir}"`,
    `xcrun simctl launch ${deviceId} ${ctx.config.applicationId ?? 'app'}`,
  ].join(' && ');
  return `${buildCmd} && ${simCmd}`;
}

const commands: MobileCommands = {
  platform: 'compose-multiplatform',

  buildCommand(ctx) {
    const target = ctx.kmpTarget ?? 'desktop';
    return [gradlewBin(ctx.projectPath), targetTask(ctx, target), ...gradleFlags(ctx)].join(' ');
  },

  cleanCommand(ctx) {
    return `${gradlewBin(ctx.projectPath)} clean`;
  },

  runOnDeviceCommand(ctx, deviceId) {
    const target = ctx.kmpTarget ?? 'android';
    if (target === 'ios') {
      if (process.platform !== 'darwin') throw new Error(IOS_NOT_MACOS);
      return buildAndRunIos(ctx, deviceId);
    }
    if (target === 'android') {
      const mod = ctx.config.androidModule || ctx.config.kmpModule || 'composeApp';
      const installCmd = [gradlewBin(ctx.projectPath), `:${mod}:installDebug`, ...gradleFlags(ctx)].join(' ');
      const appId = ctx.config.applicationId ?? '';
      if (!appId) return installCmd;
      const launch = `adb -s ${deviceId} shell monkey -p ${appId} -c android.intent.category.LAUNCHER 1`;
      const logcat = `adb -s ${deviceId} logcat --pid=$(adb -s ${deviceId} shell pidof ${appId} 2>/dev/null || echo 0)`;
      return `${installCmd} && ${launch} && echo "── following logcat for ${appId} (press Stop to end) ──" && sleep 2 && ${logcat}`;
    }
    return commands.buildCommand(ctx);
  },

  runOnEmulatorCommand(ctx, deviceId) {
    return commands.runOnDeviceCommand(ctx, deviceId);
  },

  releaseCommand(ctx) {
    const target = ctx.kmpTarget ?? 'desktop';
    if (target === 'android') {
      const mod = ctx.config.kmpModule || 'composeApp';
      const signingFlags = androidSigningFlags(ctx.config.androidSigning, ctx.resolvedEnv);
      return [gradlewBin(ctx.projectPath), `:${mod}:bundleRelease`, ...signingFlags, ...gradleFlags(ctx)].join(' ');
    }
    return commands.buildCommand(ctx);
  },

  logsCommand(ctx, deviceId) {
    const target = ctx.kmpTarget ?? 'desktop';
    if (target === 'ios' && process.platform === 'darwin') {
      return deviceId
        ? `xcrun simctl spawn ${deviceId} log stream --style compact`
        : 'xcrun simctl spawn booted log stream --style compact';
    }
    return deviceId ? `adb -s ${deviceId} logcat -v time` : 'adb logcat -v time';
  },

  ideCommand(projectPath: string, config: MobileConfig) {
    const hint = config.ideHint?.toLowerCase() ?? '';
    if (process.platform === 'darwin') {
      if (hint.includes('android')) return `open -a "Android Studio" "${projectPath}"`;
      return `open -a "IntelliJ IDEA" "${projectPath}"`;
    }
    return null;
  },

  expectedArtifactPath(ctx) {
    const target = ctx.kmpTarget ?? 'desktop';
    const mod = ctx.config.kmpModule || 'composeApp';
    if (target === 'android') {
      return join(ctx.projectPath, mod, 'build', 'outputs', 'apk', 'debug', `${mod}-debug.apk`);
    }
    return null;
  },
};

export const composeMultiplatformFeature: LanguageFeature = {
  type: 'compose-multiplatform',
  category: 'mobile',
  defaults: { runCommand: './gradlew :composeApp:desktopRun', port: null },
  resolveRunCommand(projectPath, runCommand) {
    return runCommand.replace('./gradlew', gradlewBin(projectPath));
  },
  mobile: commands,
};
