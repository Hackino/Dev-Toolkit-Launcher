import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import type { LanguageFeature, MobileCommands, MobileCommandContext } from '../../core/ports';
import type { MobileConfig } from '../../../shared/types';
import { resolveFlags, mergeFlags } from '../../capabilities/buildflags/buildFlagResolver';
import { findIosRoot } from '../../capabilities/detection/variantDetection';

const IOS_NOT_MACOS = 'iOS builds require macOS. This action is disabled on non-macOS systems.';

// Placeholder scheme names seeded into a fresh config — never real schemes, so we
// resolve the actual one from disk instead of trusting them.
const PLACEHOLDER_SCHEMES = new Set(['', 'MyApp', 'App']);

function guardMacos(): void {
  if (process.platform !== 'darwin') throw new Error(IOS_NOT_MACOS);
}

/** Shared scheme names inside an .xcodeproj/.xcworkspace container. */
function schemeNamesIn(container: string): string[] {
  try {
    const dir = join(container, 'xcshareddata', 'xcschemes');
    return readdirSync(dir).filter((f) => f.endsWith('.xcscheme')).map((f) => f.replace(/\.xcscheme$/, ''));
  } catch {
    return [];
  }
}

/**
 * The scheme to build. Uses the configured scheme when it's a real one; otherwise
 * (still the placeholder seed) resolves a shared scheme from the project/workspace
 * on disk so Run/Build/Archive work without a manual Detect+Save in settings.
 */
function resolveScheme(ctx: MobileCommandContext): string {
  const configured = ctx.iosBuildConfig?.scheme?.trim() ?? '';
  if (!PLACEHOLDER_SCHEMES.has(configured)) return configured;

  const containers: string[] = [];
  if (ctx.config.iosWorkspace) containers.push(join(ctx.projectPath, ctx.config.iosWorkspace));
  const root = findIosRoot(ctx.projectPath);
  if (root) {
    try {
      for (const e of readdirSync(root)) {
        if (e.endsWith('.xcworkspace') || e.endsWith('.xcodeproj')) containers.push(join(root, e));
      }
    } catch { /* ignore */ }
  }
  const found = [...new Set(containers.flatMap(schemeNamesIn))];
  return found[0] ?? (configured || 'Runner');
}

/** Guard against an empty device id producing a malformed `id=` destination. */
function requireDevice(deviceId: string): void {
  if (!deviceId?.trim()) throw new Error('Select a simulator or device first.');
}

function buildSettings(ctx: MobileCommandContext): string[] {
  const combined = mergeFlags(ctx.config.globalFlags, ctx.iosBuildConfig?.customFlags ?? []);
  return resolveFlags(combined, ['xcode-setting', 'xcode-flag']);
}

function workspaceArg(ctx: MobileCommandContext): string {
  const ws = ctx.config.iosWorkspace;
  if (!ws) return '';
  const full = join(ctx.projectPath, ws);
  // A native app (no CocoaPods) has only an .xcodeproj — xcodebuild needs -project
  // for it; -workspace is rejected ("is not a workspace file"). Only a real
  // .xcworkspace uses -workspace.
  if (ws.endsWith('.xcodeproj')) return `-project "${full}"`;
  return `-workspace "${full}"`;
}

function xcodebuildBase(ctx: MobileCommandContext): string {
  const scheme = resolveScheme(ctx);
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
    requireDevice(deviceId);
    // `xcodebuild` has no `run` action. Build into a known derivedDataPath, then
    // boot + install + launch the produced .app via simctl. The bundle id is read
    // from the built app's Info.plist so it works without extra configuration.
    const scheme = resolveScheme(ctx);
    const configuration = ctx.iosBuildConfig?.configuration ?? 'Debug';
    const derived = join(ctx.projectPath, 'build', 'dd');
    const products = join(derived, 'Build', 'Products');
    const build = [
      'xcodebuild', workspaceArg(ctx), `-scheme "${scheme}"`, `-configuration "${configuration}"`,
      '-sdk iphonesimulator', `-destination "id=${deviceId}"`, `-derivedDataPath "${derived}"`,
      ...buildSettings(ctx), 'build',
    ].filter(Boolean).join(' ');
    const findApp = `APP="$(/usr/bin/find "${products}" -maxdepth 2 -name '*.app' -type d | head -1)"`;
    const boot = `{ xcrun simctl boot ${deviceId} >/dev/null 2>&1 || true; }`;
    const install = `xcrun simctl install ${deviceId} "$APP"`;
    const launch = `xcrun simctl launch ${deviceId} "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")"`;
    return `${build} && ${boot} && open -a Simulator && ${findApp} && ${install} && ${launch}`;
  },

  runOnDeviceCommand(ctx, deviceId) {
    guardMacos();
    requireDevice(deviceId);
    // Build for the physical device (signed), then install + launch via devicectl.
    const scheme = resolveScheme(ctx);
    const configuration = ctx.iosBuildConfig?.configuration ?? 'Debug';
    const signing = ctx.config.iosSigning;
    const derived = join(ctx.projectPath, 'build', 'dd');
    const products = join(derived, 'Build', 'Products');
    const signingFlags: string[] = [];
    if (signing.teamId) signingFlags.push(`DEVELOPMENT_TEAM=${signing.teamId}`);
    if (signing.signingStyle === 'manual' && signing.certificateName) {
      signingFlags.push(`CODE_SIGN_IDENTITY="${signing.certificateName}"`);
    }
    const build = [
      'xcodebuild', workspaceArg(ctx), `-scheme "${scheme}"`, `-configuration "${configuration}"`,
      `-destination "id=${deviceId}"`, `-derivedDataPath "${derived}"`, '-allowProvisioningUpdates',
      ...buildSettings(ctx), ...signingFlags, 'build',
    ].filter(Boolean).join(' ');
    const findApp = `APP="$(/usr/bin/find "${products}" -maxdepth 2 -name '*.app' -type d | head -1)"`;
    const install = `xcrun devicectl device install app --device ${deviceId} "$APP"`;
    const launch = `xcrun devicectl device process launch --device ${deviceId} "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")"`;
    return `${build} && ${findApp} && ${install} && ${launch}`;
  },

  releaseCommand(ctx) {
    guardMacos();
    const scheme = resolveScheme(ctx);
    const signing = ctx.config.iosSigning;
    // Archive uses the selected build configuration (Debug / Release / custom),
    // not a hardcoded Release, so the config dropdown drives the archive.
    const configuration = ctx.iosBuildConfig?.configuration ?? 'Release';
    const archivePath = join(ctx.projectPath, 'build', `${scheme}.xcarchive`);
    const exportPath = join(ctx.projectPath, 'build', 'export');
    const base = [`xcodebuild`, workspaceArg(ctx), `-scheme "${scheme}"`, `-configuration "${configuration}"`]
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
