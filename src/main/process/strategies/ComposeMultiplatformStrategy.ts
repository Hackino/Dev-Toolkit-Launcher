import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { IMobileStrategy, MobileCommandContext } from '../IProcessStrategy';
import { resolveFlags } from '../buildFlagResolver';
import type { KmpTarget, MobileConfig } from '../../../shared/types';

const IOS_NOT_MACOS = 'iOS builds require macOS.';

function gradlew(projectPath: string): string {
  const unix = join(projectPath, 'gradlew');
  if (existsSync(unix)) {
    try { chmodSync(unix, 0o755); } catch { /* ignore */ }
    return './gradlew';
  }
  return 'gradle';
}

function globalFlags(ctx: MobileCommandContext): string[] {
  return resolveFlags(ctx.config.globalFlags, ['gradle-prop', 'gradle-flag', 'gradle-system-prop']);
}

function modulePrefix(ctx: MobileCommandContext): string {
  return `:${ctx.config.kmpModule || 'composeApp'}:`;
}

export class ComposeMultiplatformStrategy implements IMobileStrategy {
  readonly platform = 'compose-multiplatform' as const;
  readonly defaultRunCommand = './gradlew :composeApp:desktopRun';
  readonly defaultPort = null;

  resolveCommand(projectPath: string, runCommand: string): string {
    return runCommand.replace('./gradlew', gradlew(projectPath));
  }

  buildCommand(ctx: MobileCommandContext): string {
    const gw = gradlew(ctx.projectPath);
    const target = ctx.kmpTarget ?? 'desktop';
    const task = this._buildTask(ctx, target);
    return [gw, task, ...globalFlags(ctx)].join(' ');
  }

  cleanCommand(ctx: MobileCommandContext): string {
    return `${gradlew(ctx.projectPath)} clean`;
  }

  runOnDeviceCommand(ctx: MobileCommandContext, deviceId: string): string {
    const target = ctx.kmpTarget ?? 'android';
    if (target === 'ios') {
      if (process.platform !== 'darwin') throw new Error(IOS_NOT_MACOS);
      return this._buildAndRunIos(ctx, deviceId);
    }
    if (target === 'android') {
      const mod = ctx.config.androidModule || ctx.config.kmpModule || 'composeApp';
      const gw = gradlew(ctx.projectPath);
      const appId = ctx.config.applicationId ?? '';
      const installCmd = [gw, `:${mod}:installDebug`, ...globalFlags(ctx)].join(' ');
      if (appId) {
        return `${installCmd} && adb -s ${deviceId} shell am start -n ${appId}/.MainActivity`;
      }
      return installCmd;
    }
    return this.buildCommand(ctx);
  }

  runOnEmulatorCommand(ctx: MobileCommandContext, deviceId: string): string {
    return this.runOnDeviceCommand(ctx, deviceId);
  }

  releaseCommand(ctx: MobileCommandContext): string {
    const target = ctx.kmpTarget ?? 'desktop';
    const gw = gradlew(ctx.projectPath);
    if (target === 'android') {
      const mod = ctx.config.kmpModule || 'composeApp';
      const signing = ctx.config.androidSigning;
      const storePass = signing.storePasswordEnv ? ctx.resolvedEnv[signing.storePasswordEnv] : null;
      const keyPass = signing.keyPasswordEnv ? ctx.resolvedEnv[signing.keyPasswordEnv] : null;
      const signingFlags: string[] = [];
      if (signing.keystorePath) signingFlags.push(`-Pandroid.injected.signing.store.file=${signing.keystorePath}`);
      if (signing.keyAlias) signingFlags.push(`-Pandroid.injected.signing.key.alias=${signing.keyAlias}`);
      if (storePass) signingFlags.push(`-Pandroid.injected.signing.store.password=${storePass}`);
      if (keyPass) signingFlags.push(`-Pandroid.injected.signing.key.password=${keyPass}`);
      return [gw, `:${mod}:bundleRelease`, ...signingFlags, ...globalFlags(ctx)].join(' ');
    }
    return this.buildCommand(ctx);
  }

  logsCommand(_ctx: MobileCommandContext, deviceId: string | null): string {
    const target = _ctx.kmpTarget ?? 'desktop';
    if (target === 'ios' && process.platform === 'darwin') {
      return deviceId
        ? `xcrun simctl spawn ${deviceId} log stream --style compact`
        : 'xcrun simctl spawn booted log stream --style compact';
    }
    return deviceId ? `adb -s ${deviceId} logcat -v time` : 'adb logcat -v time';
  }

  ideCommand(projectPath: string, config: MobileConfig): string | null {
    const hint = config.ideHint?.toLowerCase() ?? '';
    if (process.platform === 'darwin') {
      if (hint.includes('android')) return `open -a "Android Studio" "${projectPath}"`;
      return `open -a "IntelliJ IDEA" "${projectPath}"`;
    }
    return null;
  }

  expectedArtifactPath(ctx: MobileCommandContext): string | null {
    const target = ctx.kmpTarget ?? 'desktop';
    const mod = ctx.config.kmpModule || 'composeApp';
    if (target === 'android') {
      return join(ctx.projectPath, mod, 'build', 'outputs', 'apk', 'debug', `${mod}-debug.apk`);
    }
    return null;
  }

  private _buildTask(ctx: MobileCommandContext, target: KmpTarget): string {
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

  private _buildAndRunIos(ctx: MobileCommandContext, deviceId: string): string {
    const gw = gradlew(ctx.projectPath);
    const prefix = modulePrefix(ctx);
    const buildCmd = [gw, `${prefix}iosSimulatorArm64Binaries`, ...globalFlags(ctx)].join(' ');
    const bundleDir = `${ctx.projectPath}/${ctx.config.kmpModule || 'composeApp'}/build/bin/iosSimulatorArm64/debugFramework`;
    // Boot simulator, install, launch
    const simCmd = [
      `xcrun simctl boot ${deviceId} 2>/dev/null || true`,
      `xcrun simctl install ${deviceId} "${bundleDir}"`,
      `xcrun simctl launch ${deviceId} ${ctx.config.applicationId ?? 'app'}`,
    ].join(' && ');
    return `${buildCmd} && ${simCmd}`;
  }
}
