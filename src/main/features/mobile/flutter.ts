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

const commands: MobileCommands = {
  platform: 'flutter',

  buildCommand(ctx) {
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    return ['flutter build apk', ...entryFlags(ep, ctx.config.globalFlags)].join(' ');
  },

  cleanCommand() {
    return 'flutter clean';
  },

  runOnDeviceCommand(ctx, deviceId) {
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    return ['flutter run', `-d ${deviceId}`, ...entryFlags(ep, ctx.config.globalFlags)].join(' ');
  },

  runOnEmulatorCommand(ctx, deviceId) {
    return commands.runOnDeviceCommand(ctx, deviceId);
  },

  releaseCommand(ctx) {
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    return ['flutter build appbundle --release', ...entryFlags(ep, ctx.config.globalFlags)].join(' ');
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
