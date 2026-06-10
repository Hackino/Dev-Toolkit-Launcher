/**
 * Core ports — the contracts every feature and capability is wired through.
 * This module has ZERO dependencies on capabilities or features (Dependency
 * Inversion): inner layers define interfaces, outer layers implement them.
 */
import type {
  ProjectType,
  ProjectCategory,
  MobilePlatform,
  MobileConfig,
  AndroidBuildConfig,
  IosBuildConfig,
  FlutterEntryPoint,
  KmpTarget,
} from '../../shared/types';

// ─── Mobile command context ────────────────────────────────────────────────────

export type MobileCommandContext = {
  projectPath: string;
  config: MobileConfig;
  androidBuildConfig: AndroidBuildConfig | null;
  iosBuildConfig: IosBuildConfig | null;
  flutterEntryPoint: FlutterEntryPoint | null;
  kmpTarget: KmpTarget | null;
  /** Resolved signing env vars (only populated for release builds). */
  resolvedEnv: Record<string, string>;
};

/**
 * The mobile build surface a mobile feature must implement. Each method returns
 * a shell command string (CWD = project path). Features assemble these by
 * composing capabilities (gradle, xcode, signing, build-flags) — never by
 * calling another feature.
 */
export interface MobileCommands {
  readonly platform: MobilePlatform;
  buildCommand(ctx: MobileCommandContext): string;
  cleanCommand(ctx: MobileCommandContext): string;
  runOnDeviceCommand(ctx: MobileCommandContext, deviceId: string): string;
  runOnEmulatorCommand(ctx: MobileCommandContext, deviceId: string): string;
  releaseCommand(ctx: MobileCommandContext): string;
  logsCommand(ctx: MobileCommandContext, deviceId: string | null): string;
  ideCommand(projectPath: string, config: MobileConfig): string | null;
  expectedArtifactPath(ctx: MobileCommandContext): string | null;
}

// ─── Language feature contract ──────────────────────────────────────────────────

/**
 * One feature per language/runtime in the tool. Features depend only on the
 * core + capabilities layers, never on each other. The composition root
 * (feature registry) is the only place that knows the full set of features.
 */
export interface LanguageFeature {
  readonly type: ProjectType;
  readonly category: ProjectCategory;
  readonly defaults: { runCommand: string; port: number | null };

  /**
   * Resolve the final shell command for a long-lived run (backend/web), e.g.
   * prepending an install step or rewriting a wrapper path.
   */
  resolveRunCommand(projectPath: string, runCommand: string): string;

  /** Present only for mobile-category features. */
  readonly mobile?: MobileCommands;
}

/** A feature that is guaranteed to expose mobile commands. */
export type MobileFeature = LanguageFeature & { readonly mobile: MobileCommands };

export function isMobileFeature(f: LanguageFeature): f is MobileFeature {
  return f.mobile !== undefined;
}
