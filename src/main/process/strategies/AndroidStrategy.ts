import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { IMobileStrategy, MobileCommandContext } from '../IProcessStrategy';
import { resolveFlags, mergeFlags } from '../buildFlagResolver';
import type { MobileConfig } from '../../../shared/types';

function gradlew(projectPath: string): string {
  const win = join(projectPath, 'gradlew.bat');
  const unix = join(projectPath, 'gradlew');
  if (process.platform === 'win32' && existsSync(win)) return 'gradlew.bat';
  if (existsSync(unix)) {
    try { chmodSync(unix, 0o755); } catch { /* ignore */ }
    return './gradlew';
  }
  return 'gradle'; // fallback to system gradle
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function variantTaskSuffix(ctx: MobileCommandContext): string {
  const cfg = ctx.androidBuildConfig;
  if (!cfg) return 'Debug';
  const flavor = cfg.flavor ? capitalize(cfg.flavor) : '';
  const buildType = capitalize(cfg.buildType || 'debug');
  return `${flavor}${buildType}`;
}

function modulePrefix(ctx: MobileCommandContext): string {
  const mod = ctx.config.androidModule || 'app';
  return `:${mod}:`;
}

function buildFlags(ctx: MobileCommandContext): string[] {
  const cfg = ctx.androidBuildConfig;
  const combined = mergeFlags(ctx.config.globalFlags, cfg?.customFlags ?? []);
  const flags = resolveFlags(combined, ['gradle-prop', 'gradle-flag', 'gradle-system-prop']);

  if (cfg?.minify.enabled && cfg.minify.r8FullMode) {
    flags.push('-Pandroid.enableR8.fullMode=true');
  }
  if (cfg?.minify.proguardFiles?.length) {
    // Proguard files are referenced from build.gradle — we just pass minify flag
    flags.push(`-PminifyEnabled=${cfg.minify.enabled}`);
  }
  return flags;
}

export class AndroidStrategy implements IMobileStrategy {
  readonly platform = 'android' as const;
  readonly defaultRunCommand = './gradlew :app:assembleDebug';
  readonly defaultPort = null;

  resolveCommand(projectPath: string, runCommand: string): string {
    if (runCommand.startsWith('./gradlew') || runCommand.startsWith('gradlew')) {
      return runCommand.replace('./gradlew', gradlew(projectPath));
    }
    return runCommand;
  }

  buildCommand(ctx: MobileCommandContext): string {
    const gw = gradlew(ctx.projectPath);
    const task = `${modulePrefix(ctx)}assemble${variantTaskSuffix(ctx)}`;
    return [gw, task, ...buildFlags(ctx)].join(' ');
  }

  cleanCommand(ctx: MobileCommandContext): string {
    return `${gradlew(ctx.projectPath)} clean`;
  }

  runOnDeviceCommand(ctx: MobileCommandContext, deviceId: string): string {
    const gw = gradlew(ctx.projectPath);
    const task = `${modulePrefix(ctx)}install${variantTaskSuffix(ctx)}`;
    const appId = ctx.config.applicationId ?? '';
    const installCmd = [gw, task, ...buildFlags(ctx)].join(' ');
    // After install, launch via adb
    if (!appId) return installCmd;
    return `${installCmd} && adb -s ${deviceId} shell am start -n ${appId}/.MainActivity`;
  }

  runOnEmulatorCommand(ctx: MobileCommandContext, deviceId: string): string {
    return this.runOnDeviceCommand(ctx, deviceId);
  }

  releaseCommand(ctx: MobileCommandContext): string {
    const gw = gradlew(ctx.projectPath);
    const cfg = ctx.androidBuildConfig;
    const flavor = cfg?.flavor ? capitalize(cfg.flavor) : '';
    const task = `${modulePrefix(ctx)}bundle${flavor}Release`;
    const signingFlags: string[] = [];
    const signing = ctx.config.androidSigning;
    const storePass = signing.storePasswordEnv ? ctx.resolvedEnv[signing.storePasswordEnv] : null;
    const keyPass = signing.keyPasswordEnv ? ctx.resolvedEnv[signing.keyPasswordEnv] : null;
    if (signing.keystorePath) signingFlags.push(`-Pandroid.injected.signing.store.file=${signing.keystorePath}`);
    if (signing.keyAlias) signingFlags.push(`-Pandroid.injected.signing.key.alias=${signing.keyAlias}`);
    if (storePass) signingFlags.push(`-Pandroid.injected.signing.store.password=${storePass}`);
    if (keyPass) signingFlags.push(`-Pandroid.injected.signing.key.password=${keyPass}`);
    return [gw, task, ...buildFlags(ctx), ...signingFlags].join(' ');
  }

  logsCommand(_ctx: MobileCommandContext, deviceId: string | null): string {
    const base = deviceId ? `adb -s ${deviceId} logcat` : 'adb logcat';
    const appId = _ctx.config.applicationId;
    if (appId) return `${base} --pid=$(adb${deviceId ? ' -s ' + deviceId : ''} shell pidof ${appId} 2>/dev/null || echo 0)`;
    return `${base} -v time`;
  }

  ideCommand(projectPath: string, _config: MobileConfig): string | null {
    if (process.platform === 'darwin') return `open -a "Android Studio" "${projectPath}"`;
    if (process.platform === 'win32') return `start "" "studio64.exe" "${projectPath}"`;
    return `studio.sh "${projectPath}"`;
  }

  expectedArtifactPath(ctx: MobileCommandContext): string | null {
    const mod = ctx.config.androidModule || 'app';
    const variant = variantTaskSuffix(ctx).toLowerCase();
    return join(ctx.projectPath, mod, 'build', 'outputs', 'apk', variant, `${mod}-${variant}.apk`);
  }
}
