import { join } from 'node:path';
import type { IMobileStrategy, MobileCommandContext } from '../IProcessStrategy';
import { resolveFlags, mergeFlags } from '../buildFlagResolver';
import type { MobileConfig } from '../../../shared/types';

const IOS_NOT_MACOS = 'iOS builds require macOS. This action is disabled on non-macOS systems.';

function guardMacos(): void {
  if (process.platform !== 'darwin') {
    throw new Error(IOS_NOT_MACOS);
  }
}

function buildSettings(ctx: MobileCommandContext): string[] {
  const cfg = ctx.iosBuildConfig;
  const combined = mergeFlags(ctx.config.globalFlags, cfg?.customFlags ?? []);
  return resolveFlags(combined, ['xcode-setting', 'xcode-flag']);
}

function xcodebuildBase(ctx: MobileCommandContext): string {
  const cfg = ctx.iosBuildConfig;
  const workspace = ctx.config.iosWorkspace;
  const scheme = cfg?.scheme ?? 'App';
  const configuration = cfg?.configuration ?? 'Debug';

  if (workspace) {
    return `xcodebuild -workspace "${join(ctx.projectPath, workspace)}" -scheme "${scheme}" -configuration "${configuration}"`;
  }
  return `xcodebuild -scheme "${scheme}" -configuration "${configuration}"`;
}

export class IosStrategy implements IMobileStrategy {
  readonly platform = 'ios' as const;
  readonly defaultRunCommand = 'xcodebuild -scheme App -configuration Debug build';
  readonly defaultPort = null;

  resolveCommand(_projectPath: string, runCommand: string): string {
    if (process.platform !== 'darwin') {
      throw new Error(IOS_NOT_MACOS);
    }
    return runCommand;
  }

  buildCommand(ctx: MobileCommandContext): string {
    guardMacos();
    const settings = buildSettings(ctx);
    return [xcodebuildBase(ctx), 'build', ...settings].join(' ');
  }

  cleanCommand(ctx: MobileCommandContext): string {
    guardMacos();
    return [xcodebuildBase(ctx), 'clean'].join(' ');
  }

  runOnEmulatorCommand(ctx: MobileCommandContext, deviceId: string): string {
    guardMacos();
    const cfg = ctx.iosBuildConfig;
    const scheme = cfg?.scheme ?? 'App';
    const workspace = ctx.config.iosWorkspace;
    const settings = buildSettings(ctx);
    const dest = `platform=iOS Simulator,id=${deviceId}`;
    const base = workspace
      ? `xcodebuild -workspace "${join(ctx.projectPath, workspace)}" -scheme "${scheme}"`
      : `xcodebuild -scheme "${scheme}"`;
    return [base, `-destination "${dest}"`, 'run', ...settings].join(' ');
  }

  runOnDeviceCommand(ctx: MobileCommandContext, deviceId: string): string {
    guardMacos();
    const cfg = ctx.iosBuildConfig;
    const scheme = cfg?.scheme ?? 'App';
    const workspace = ctx.config.iosWorkspace;
    const settings = buildSettings(ctx);
    const dest = `platform=iOS,id=${deviceId}`;
    const base = workspace
      ? `xcodebuild -workspace "${join(ctx.projectPath, workspace)}" -scheme "${scheme}"`
      : `xcodebuild -scheme "${scheme}"`;
    return [base, `-destination "${dest}"`, 'run', ...settings].join(' ');
  }

  releaseCommand(ctx: MobileCommandContext): string {
    guardMacos();
    const cfg = ctx.iosBuildConfig;
    const scheme = cfg?.scheme ?? 'App';
    const workspace = ctx.config.iosWorkspace;
    const signing = ctx.config.iosSigning;
    const settings = buildSettings(ctx);
    const archivePath = join(ctx.projectPath, 'build', `${scheme}.xcarchive`);
    const exportPath = join(ctx.projectPath, 'build', 'export');

    const base = workspace
      ? `xcodebuild -workspace "${join(ctx.projectPath, workspace)}" -scheme "${scheme}" -configuration Release`
      : `xcodebuild -scheme "${scheme}" -configuration Release`;

    const signingFlags: string[] = [];
    if (signing.teamId) signingFlags.push(`DEVELOPMENT_TEAM=${signing.teamId}`);
    if (signing.signingStyle === 'manual' && signing.certificateName) {
      signingFlags.push(`CODE_SIGN_IDENTITY="${signing.certificateName}"`);
    }
    if (signing.bundleId) signingFlags.push(`PRODUCT_BUNDLE_IDENTIFIER=${signing.bundleId}`);

    const archiveCmd = [base, 'archive', `-archivePath "${archivePath}"`, ...settings, ...signingFlags].join(' ');
    const exportCmd = `xcodebuild -exportArchive -archivePath "${archivePath}" -exportPath "${exportPath}" -exportOptionsPlist "${join(ctx.projectPath, 'ExportOptions.plist')}"`;

    return `${archiveCmd} && ${exportCmd}`;
  }

  logsCommand(_ctx: MobileCommandContext, deviceId: string | null): string {
    guardMacos();
    if (deviceId) {
      return `xcrun simctl spawn ${deviceId} log stream --style compact --predicate 'process contains "app"'`;
    }
    return 'xcrun simctl spawn booted log stream --style compact';
  }

  ideCommand(projectPath: string, config: MobileConfig): string | null {
    if (process.platform !== 'darwin') return null;
    if (config.iosWorkspace) {
      return `open "${join(projectPath, config.iosWorkspace)}"`;
    }
    return `open -a Xcode "${projectPath}"`;
  }

  expectedArtifactPath(ctx: MobileCommandContext): string | null {
    const scheme = ctx.iosBuildConfig?.scheme ?? 'App';
    return join(ctx.projectPath, 'build', 'export', `${scheme}.ipa`);
  }
}
