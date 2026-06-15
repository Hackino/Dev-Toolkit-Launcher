import type { LanguageFeature, MobileCommands, MobileCommandContext } from '../../core/ports';
import type { MobileConfig, FlutterEntryPoint } from '../../../shared/types';
import { resolveFlags } from '../../capabilities/buildflags/buildFlagResolver';

function defaultEntry(ctx: MobileCommandContext): FlutterEntryPoint | null {
  const entries = ctx.config.flutterEntryPoints;
  if (!entries.length) return null;
  return entries.find((e) => e.isDefault) ?? entries[0];
}

function entryFlags(ep: FlutterEntryPoint | null, globalFlags: MobileConfig['globalFlags']): string[] {
  const flags: string[] = [];
  if (ep) {
    flags.push(`-t ${ep.target}`);
    if (ep.flavor) flags.push(`--flavor ${ep.flavor}`);
    flags.push(...resolveFlags(ep.dartDefines, ['flutter-dart-define']));
    flags.push(...resolveFlags(ep.extraFlags, ['flutter-flag']));
  }
  flags.push(...resolveFlags(globalFlags, ['flutter-flag', 'flutter-dart-define']));
  return flags;
}

function desktopFlutterTarget(): 'macos' | 'windows' | 'linux' {
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'win32') return 'windows';
  return 'linux';
}

/** Build mode selected via the column's build-configuration dropdown. */
function selectedMode(ctx: MobileCommandContext): 'debug' | 'profile' | 'release' {
  const raw =
    ctx.kmpTarget === 'ios'
      ? (ctx.iosBuildConfig?.configuration ?? ctx.iosBuildConfig?.name ?? '')
      : (ctx.androidBuildConfig?.buildType ?? ctx.androidBuildConfig?.name ?? '');
  const v = raw.toLowerCase();
  if (v.includes('release')) return 'release';
  if (v.includes('profile')) return 'profile';
  return 'debug';
}

/** `flutter build <sub>` for the column's target (android by default). */
function buildSubcommand(target: MobileCommandContext['kmpTarget'], release: boolean): string {
  switch (target) {
    case 'ios': return release ? 'build ipa --release' : 'build ios --no-codesign';
    case 'web': return release ? 'build web --release' : 'build web';
    case 'desktop': return `build ${desktopFlutterTarget()}${release ? ' --release' : ''}`;
    case 'android':
    default: return release ? 'build appbundle --release' : 'build apk';
  }
}

/** Distributable `flutter build` subcommand for the Archive/Bundle action (per target). */
function packageSubcommand(target: MobileCommandContext['kmpTarget']): string {
  switch (target) {
    case 'ios': return 'build ipa';
    case 'web': return 'build web';
    case 'desktop': return `build ${desktopFlutterTarget()}`;
    case 'android':
    default: return 'build appbundle';
  }
}

/** `--debug` / `--profile` / `--release` flag for the column's selected mode. */
function modeFlag(mode: 'debug' | 'profile' | 'release'): string {
  return mode === 'debug' ? '--debug' : mode === 'profile' ? '--profile' : '--release';
}

const commands: MobileCommands = {
  platform: 'flutter',

  buildCommand(ctx) {
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    // The build-config dropdown decides debug vs release for the Build button.
    const release = selectedMode(ctx) === 'release';
    return [`flutter ${buildSubcommand(ctx.kmpTarget, release)}`, ...entryFlags(ep, ctx.config.globalFlags)].join(' ');
  },

  cleanCommand() {
    return 'flutter clean';
  },

  runOnDeviceCommand(ctx, deviceId) {
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    const mode = selectedMode(ctx);
    const modeFlag = mode === 'release' ? '--release' : mode === 'profile' ? '--profile' : '';
    return ['flutter run', modeFlag, `-d ${deviceId}`, ...entryFlags(ep, ctx.config.globalFlags)]
      .filter(Boolean)
      .join(' ');
  },

  runOnEmulatorCommand(ctx, deviceId) {
    const runCmd = commands.runOnDeviceCommand(ctx, deviceId);
    // An iOS simulator must be booted before Flutter's underlying xcodebuild can
    // resolve its destination — otherwise it reports "only macOS" destinations and
    // the build fails. Boot it (idempotent) and open Simulator.app first.
    if (ctx.kmpTarget === 'ios' && process.platform === 'darwin') {
      const boot = `{ xcrun simctl boot ${deviceId} >/dev/null 2>&1 || true; }`;
      return `${boot} && open -a Simulator && ${runCmd}`;
    }
    return runCmd;
  },

  releaseCommand(ctx) {
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    // Archive/Bundle honours the selected build configuration (debug/profile/release)
    // instead of always forcing --release.
    return [`flutter ${packageSubcommand(ctx.kmpTarget)} ${modeFlag(selectedMode(ctx))}`, ...entryFlags(ep, ctx.config.globalFlags)].join(' ');
  },

  logsCommand(_ctx, deviceId) {
    return deviceId ? `flutter logs -d ${deviceId}` : 'flutter logs';
  },

  ideCommand(projectPath: string, _config: MobileConfig) {
    if (process.platform === 'darwin') return `open -a "Android Studio" "${projectPath}"`;
    return null;
  },

  expectedArtifactPath(ctx) {
    return `${ctx.projectPath}/build/app/outputs/flutter-apk/app-release.apk`;
  },
};

export const flutterFeature: LanguageFeature = {
  type: 'flutter',
  category: 'mobile',
  defaults: { runCommand: 'flutter run', port: null },
  resolveRunCommand: (_projectPath, runCommand) => runCommand,
  mobile: commands,
};
