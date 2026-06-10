import { join } from 'node:path';
import type { LanguageFeature, MobileCommands, MobileCommandContext } from '../../core/ports';
import type { MobileConfig } from '../../../shared/types';
import { resolveFlags, mergeFlags } from '../../capabilities/buildflags/buildFlagResolver';

const IOS_NOT_MACOS = 'iOS builds require macOS. This action is disabled on non-macOS systems.';

function guardMacos(): void {
  if (process.platform !== 'darwin') throw new Error(IOS_NOT_MACOS);
}

function buildSettings(ctx: MobileCommandContext): string[] {
  const combined = mergeFlags(ctx.config.globalFlags, ctx.iosBuildConfig?.customFlags ?? []);
  return resolveFlags(combined, ['xcode-setting', 'xcode-flag']);
}

function workspaceArg(ctx: MobileCommandContext): string {
  return ctx.config.iosWorkspace
    ? `-workspace "${join(ctx.projectPath, ctx.config.iosWorkspace)}"`
    : '';
}

function xcodebuildBase(ctx: MobileCommandContext): string {
  const scheme = ctx.iosBuildConfig?.scheme ?? 'App';
  const configuration = ctx.iosBuildConfig?.configuration ?? 'Debug';
  return [`xcodebuild`, workspaceArg(ctx), `-scheme "${scheme}"`, `-configuration "${configuration}"`]
    .filter(Boolean)
    .join(' ');
}

const commands: MobileCommands = {
  platform: 'ios',

  buildCommand(ctx) {
    guardMacos();
    return [xcodebuildBase(ctx), 'build', ...buildSettings(ctx)].join(' ');
  },

  cleanCommand(ctx) {
    guardMacos();
    return [xcodebuildBase(ctx), 'clean'].join(' ');
  },

  runOnEmulatorCommand(ctx, deviceId) {
    guardMacos();
    const scheme = ctx.iosBuildConfig?.scheme ?? 'App';
    const base = [`xcodebuild`, workspaceArg(ctx), `-scheme "${scheme}"`].filter(Boolean).join(' ');
    const dest = `platform=iOS Simulator,id=${deviceId}`;
    return [base, `-destination "${dest}"`, 'run', ...buildSettings(ctx)].join(' ');
  },

  runOnDeviceCommand(ctx, deviceId) {
    guardMacos();
    const scheme = ctx.iosBuildConfig?.scheme ?? 'App';
    const base = [`xcodebuild`, workspaceArg(ctx), `-scheme "${scheme}"`].filter(Boolean).join(' ');
    const dest = `platform=iOS,id=${deviceId}`;
    return [base, `-destination "${dest}"`, 'run', ...buildSettings(ctx)].join(' ');
  },

  releaseCommand(ctx) {
    guardMacos();
    const scheme = ctx.iosBuildConfig?.scheme ?? 'App';
    const signing = ctx.config.iosSigning;
    const archivePath = join(ctx.projectPath, 'build', `${scheme}.xcarchive`);
    const exportPath = join(ctx.projectPath, 'build', 'export');
    const base = [`xcodebuild`, workspaceArg(ctx), `-scheme "${scheme}"`, '-configuration Release']
      .filter(Boolean)
      .join(' ');

    const signingFlags: string[] = [];
    if (signing.teamId) signingFlags.push(`DEVELOPMENT_TEAM=${signing.teamId}`);
    if (signing.signingStyle === 'manual' && signing.certificateName) {
      signingFlags.push(`CODE_SIGN_IDENTITY="${signing.certificateName}"`);
    }
    if (signing.bundleId) signingFlags.push(`PRODUCT_BUNDLE_IDENTIFIER=${signing.bundleId}`);

    const archiveCmd = [base, 'archive', `-archivePath "${archivePath}"`, ...buildSettings(ctx), ...signingFlags].join(' ');
    const exportCmd = `xcodebuild -exportArchive -archivePath "${archivePath}" -exportPath "${exportPath}" -exportOptionsPlist "${join(ctx.projectPath, 'ExportOptions.plist')}"`;
    return `${archiveCmd} && ${exportCmd}`;
  },

  logsCommand(_ctx, deviceId) {
    guardMacos();
    if (deviceId) {
      return `xcrun simctl spawn ${deviceId} log stream --style compact --predicate 'process contains "app"'`;
    }
    return 'xcrun simctl spawn booted log stream --style compact';
  },

  ideCommand(projectPath: string, config: MobileConfig) {
    if (process.platform !== 'darwin') return null;
    if (config.iosWorkspace) return `open "${join(projectPath, config.iosWorkspace)}"`;
    return `open -a Xcode "${projectPath}"`;
  },

  expectedArtifactPath(ctx) {
    const scheme = ctx.iosBuildConfig?.scheme ?? 'App';
    return join(ctx.projectPath, 'build', 'export', `${scheme}.ipa`);
  },
};

export const iosFeature: LanguageFeature = {
  type: 'ios',
  category: 'mobile',
  defaults: { runCommand: 'xcodebuild -scheme App -configuration Debug build', port: null },
  resolveRunCommand(_projectPath, runCommand) {
    guardMacos();
    return runCommand;
  },
  mobile: commands,
};
