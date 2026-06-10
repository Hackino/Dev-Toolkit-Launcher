import type {
  MobilePlatform,
  MobileConfig,
  AndroidBuildConfig,
  IosBuildConfig,
  FlutterEntryPoint,
  KmpTarget,
} from '../../shared/types';

export interface IProcessStrategy {
  /** Shell command to run the project (CWD = project.path). */
  readonly defaultRunCommand: string;

  /** Default HTTP port for this project type (null if not applicable). */
  readonly defaultPort: number | null;

  /**
   * Resolve the final shell command for a specific project path and user-supplied
   * run command. Strategies may prepend install steps, adjust paths, etc.
   */
  resolveCommand(projectPath: string, runCommand: string): string;
}

// ─── Mobile strategy context ──────────────────────────────────────────────────

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

// ─── Mobile strategy interface ────────────────────────────────────────────────

export interface IMobileStrategy extends IProcessStrategy {
  readonly platform: MobilePlatform;

  /** Assemble a build command from the context (debug by default). */
  buildCommand(ctx: MobileCommandContext): string;

  /** Assemble a clean command. */
  cleanCommand(ctx: MobileCommandContext): string;

  /** Run on a connected physical device. */
  runOnDeviceCommand(ctx: MobileCommandContext, deviceId: string): string;

  /** Run on an emulator/simulator. */
  runOnEmulatorCommand(ctx: MobileCommandContext, deviceId: string): string;

  /** Generate a signed release artifact. resolvedEnv must contain signing credentials. */
  releaseCommand(ctx: MobileCommandContext): string;

  /** Stream device/build logs. */
  logsCommand(ctx: MobileCommandContext, deviceId: string | null): string;

  /** Open the project in the platform IDE, or null if not supported. */
  ideCommand(projectPath: string, config: MobileConfig): string | null;

  /** Expected artifact path after a successful build, or null if unknown. */
  expectedArtifactPath(ctx: MobileCommandContext): string | null;
}
