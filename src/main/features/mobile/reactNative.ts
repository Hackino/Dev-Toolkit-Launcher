import { join } from 'node:path';
import type { LanguageFeature, MobileCommands, MobileCommandContext } from '../../core/ports';
import type { MobileConfig } from '../../../shared/types';
import { gradlewBin } from '../../capabilities/gradle/gradle';
import { androidSigningFlags } from '../../capabilities/signing/androidSigning';
import { resolveFlags } from '../../capabilities/buildflags/buildFlagResolver';

const IOS_NOT_MACOS = 'iOS builds require macOS.';

function androidGradlew(projectPath: string): string {
  // React Native keeps its Android project under android/.
  return gradlewBin(projectPath, 'android');
}

function gradleFlags(ctx: MobileCommandContext): string[] {
  return resolveFlags(ctx.config.globalFlags, ['gradle-prop', 'gradle-flag', 'gradle-system-prop', 'flutter-flag']);
}

const commands: MobileCommands = {
  platform: 'react-native',

  buildCommand(ctx) {
    if (ctx.kmpTarget === 'ios') {
      if (process.platform !== 'darwin') throw new Error(IOS_NOT_MACOS);
      return 'npx react-native build-ios --mode Debug';
    }
    const gw = androidGradlew(ctx.projectPath);
    return [`cd android && ${gw}`, 'assembleDebug', ...gradleFlags(ctx)].join(' ');
  },

  cleanCommand(ctx) {
    if (ctx.kmpTarget === 'ios') return 'cd ios && xcodebuild clean';
    return `cd android && ${androidGradlew(ctx.projectPath)} clean`;
  },

  runOnDeviceCommand(ctx, deviceId) {
    if (ctx.kmpTarget === 'ios') return reactNativeRunIos(ctx, deviceId);
    return ['npx react-native run-android', `--deviceId ${deviceId}`, ...gradleFlags(ctx)].join(' ');
  },

  runOnEmulatorCommand(ctx, deviceId) {
    if (ctx.kmpTarget === 'ios') return reactNativeRunIos(ctx);
    return commands.runOnDeviceCommand(ctx, deviceId);
  },

  releaseCommand(ctx) {
    if (ctx.kmpTarget === 'ios') {
      if (process.platform !== 'darwin') throw new Error(IOS_NOT_MACOS);
      return 'npx react-native build-ios --mode Release';
    }
    const gw = androidGradlew(ctx.projectPath);
    const signingFlags = androidSigningFlags(ctx.config.androidSigning, ctx.resolvedEnv);
    return [`cd android && ${gw}`, 'bundleRelease', ...signingFlags, ...gradleFlags(ctx)].join(' ');
  },

  logsCommand(ctx, deviceId) {
    if (ctx.kmpTarget === 'ios') {
      return deviceId
        ? `xcrun simctl spawn ${deviceId} log stream --style compact`
        : 'xcrun simctl spawn booted log stream --style compact';
    }
    return deviceId ? `adb -s ${deviceId} logcat -v time` : 'adb logcat -v time';
  },

  ideCommand(projectPath: string, _config: MobileConfig) {
    if (process.platform === 'darwin') return `open -a "Android Studio" "${projectPath}"`;
    return null;
  },

  expectedArtifactPath(ctx) {
    return join(ctx.projectPath, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  },
};

/** iOS run path for React Native (macOS only) — used by the IPC layer when targeting iOS. */
export function reactNativeRunIos(ctx: MobileCommandContext, deviceId?: string): string {
  if (process.platform !== 'darwin') throw new Error(IOS_NOT_MACOS);
  const extraFlags = resolveFlags(ctx.config.globalFlags, ['flutter-flag']);
  const udidFlag = deviceId ? `--udid ${deviceId}` : '--simulator';
  return ['npx react-native run-ios', udidFlag, ...extraFlags].join(' ');
}

export const reactNativeFeature: LanguageFeature = {
  type: 'react-native',
  category: 'mobile',
  defaults: { runCommand: 'npx react-native start', port: 8081 },
  resolveRunCommand: (_projectPath, runCommand) => runCommand,
  mobile: commands,
};
