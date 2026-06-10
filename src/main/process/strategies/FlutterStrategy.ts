import type { IMobileStrategy, MobileCommandContext } from '../IProcessStrategy';
import { resolveFlags, mergeFlags } from '../buildFlagResolver';
import type { MobileConfig, FlutterEntryPoint } from '../../../shared/types';

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

function defaultEntry(ctx: MobileCommandContext): FlutterEntryPoint | null {
  const entries = ctx.config.flutterEntryPoints;
  if (!entries.length) return null;
  return entries.find((e) => e.isDefault) ?? entries[0];
}

export class FlutterStrategy implements IMobileStrategy {
  readonly platform = 'flutter' as const;
  readonly defaultRunCommand = 'flutter run';
  readonly defaultPort = null;

  resolveCommand(_projectPath: string, runCommand: string): string {
    return runCommand;
  }

  buildCommand(ctx: MobileCommandContext): string {
    // Determine output format based on platform context
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    const flags = entryFlags(ep, ctx.config.globalFlags);
    return ['flutter build apk', ...flags].join(' ');
  }

  cleanCommand(_ctx: MobileCommandContext): string {
    return 'flutter clean';
  }

  runOnDeviceCommand(ctx: MobileCommandContext, deviceId: string): string {
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    const flags = entryFlags(ep, ctx.config.globalFlags);
    return ['flutter run', `-d ${deviceId}`, ...flags].join(' ');
  }

  runOnEmulatorCommand(ctx: MobileCommandContext, deviceId: string): string {
    return this.runOnDeviceCommand(ctx, deviceId);
  }

  releaseCommand(ctx: MobileCommandContext): string {
    const ep = ctx.flutterEntryPoint ?? defaultEntry(ctx);
    const flags = entryFlags(ep, ctx.config.globalFlags);
    // Build both APK and iOS IPA if on macOS
    return ['flutter build appbundle --release', ...flags].join(' ');
  }

  logsCommand(_ctx: MobileCommandContext, deviceId: string | null): string {
    return deviceId ? `flutter logs -d ${deviceId}` : 'flutter logs';
  }

  ideCommand(projectPath: string, _config: MobileConfig): string | null {
    if (process.platform === 'darwin') return `open -a "Android Studio" "${projectPath}"`;
    return null;
  }

  expectedArtifactPath(ctx: MobileCommandContext): string | null {
    const { projectPath } = ctx;
    return `${projectPath}/build/app/outputs/flutter-apk/app-release.apk`;
  }
}
