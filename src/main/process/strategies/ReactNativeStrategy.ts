import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { IMobileStrategy, MobileCommandContext } from '../IProcessStrategy';
import { resolveFlags, mergeFlags } from '../buildFlagResolver';
import type { MobileConfig } from '../../../shared/types';

const IOS_NOT_MACOS = 'iOS builds require macOS.';

function androidGradlew(projectPath: string): string {
  const win = join(projectPath, 'android', 'gradlew.bat');
  const unix = join(projectPath, 'android', 'gradlew');
  if (process.platform === 'win32' && existsSync(win)) return join('android', 'gradlew.bat');
  if (existsSync(unix)) {
    try { chmodSync(unix, 0o755); } catch { /* ignore */ }
    return join('android', 'gradlew');
  }
  return 'gradlew';
}

function globalFlags(ctx: MobileCommandContext): string[] {
  return resolveFlags(ctx.config.globalFlags, ['gradle-prop', 'gradle-flag', 'gradle-system-prop', 'flutter-flag']);
}

export class ReactNativeStrategy implements IMobileStrategy {
  readonly platform = 'react-native' as const;
  readonly defaultRunCommand = 'npx react-native start';
  readonly defaultPort = 8081; // Metro bundler

  resolveCommand(_projectPath: string, runCommand: string): string {
    return runCommand;
  }

  buildCommand(ctx: MobileCommandContext): string {
    // Default: build Android debug
    const gw = androidGradlew(ctx.projectPath);
    return [`cd android && ${gw}`, 'assembleDebug', ...globalFlags(ctx)].join(' ');
  }

  cleanCommand(ctx: MobileCommandContext): string {
    const gw = androidGradlew(ctx.projectPath);
    return `cd android && ${gw} clean`;
  }

  runOnDeviceCommand(ctx: MobileCommandContext, deviceId: string): string {
    const extraFlags = globalFlags(ctx);
    return ['npx react-native run-android', `--deviceId ${deviceId}`, ...extraFlags].join(' ');
  }

  runOnEmulatorCommand(ctx: MobileCommandContext, deviceId: string): string {
    // Android emulator
    return this.runOnDeviceCommand(ctx, deviceId);
  }

  runIos(ctx: MobileCommandContext, deviceId?: string): string {
    if (process.platform !== 'darwin') throw new Error(IOS_NOT_MACOS);
    const extraFlags = resolveFlags(ctx.config.globalFlags, ['flutter-flag']);
    const udidFlag = deviceId ? `--udid ${deviceId}` : '--simulator';
    return ['npx react-native run-ios', udidFlag, ...extraFlags].join(' ');
  }

  releaseCommand(ctx: MobileCommandContext): string {
    const gw = androidGradlew(ctx.projectPath);
    const signing = ctx.config.androidSigning;
    const storePass = signing.storePasswordEnv ? ctx.resolvedEnv[signing.storePasswordEnv] : null;
    const keyPass = signing.keyPasswordEnv ? ctx.resolvedEnv[signing.keyPasswordEnv] : null;
    const signingFlags: string[] = [];
    if (signing.keystorePath) signingFlags.push(`-Pandroid.injected.signing.store.file=${signing.keystorePath}`);
    if (signing.keyAlias) signingFlags.push(`-Pandroid.injected.signing.key.alias=${signing.keyAlias}`);
    if (storePass) signingFlags.push(`-Pandroid.injected.signing.store.password=${storePass}`);
    if (keyPass) signingFlags.push(`-Pandroid.injected.signing.key.password=${keyPass}`);
    return [`cd android && ${gw}`, 'bundleRelease', ...signingFlags, ...globalFlags(ctx)].join(' ');
  }

  logsCommand(_ctx: MobileCommandContext, deviceId: string | null): string {
    return deviceId ? `adb -s ${deviceId} logcat -v time` : 'adb logcat -v time';
  }

  ideCommand(projectPath: string, _config: MobileConfig): string | null {
    if (process.platform === 'darwin') return `open -a "Android Studio" "${projectPath}"`;
    return null;
  }

  expectedArtifactPath(ctx: MobileCommandContext): string | null {
    return join(ctx.projectPath, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  }
}
