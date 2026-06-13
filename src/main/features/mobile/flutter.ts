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
    return commands.runOnDeviceCommand(ctx, deviceId);
  },

  releaseCommand(ctx) {
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    return [`flutter ${buildSubcommand(ctx.kmpTarget, true)}`, ...entryFlags(ep, ctx.config.globalFlags)].join(' ');
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
