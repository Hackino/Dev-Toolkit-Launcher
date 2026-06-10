// Shared types between main and renderer. No runtime code.

// ─── Project types ──────────────────────────────────────────────────────────

export type BackendProjectType =
  | 'dotnet'       // C# / ASP.NET Core  (dotnet run)
  | 'spring-boot'  // Java Spring Boot   (mvnw/gradlew)
  | 'ktor'         // Kotlin Ktor        (gradlew run)
  | 'nextjs'       // Next.js            (npm run dev)
  | 'react'        // React (Vite/CRA)   (npm run dev)
  | 'nodejs'       // Plain Node.js      (node . / npm start)
  | 'express'      // Express.js         (npm start)
  | 'nestjs';      // Nest.js            (npm run start:dev)

export type MobilePlatform =
  | 'android'             // Android Native (Kotlin/Java + Gradle)
  | 'ios'                 // iOS Native (Swift/ObjC + xcodebuild) — macOS only
  | 'flutter'             // Flutter/Dart
  | 'react-native'        // React Native
  | 'compose-multiplatform'; // Kotlin Multiplatform + Compose UI

export type ProjectType = BackendProjectType | MobilePlatform;

export type ProjectCategory = 'backend' | 'mobile';

export type KmpTarget = 'android' | 'ios' | 'desktop' | 'web';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  'dotnet':               '.NET',
  'spring-boot':          'Spring',
  'ktor':                 'Ktor',
  'nextjs':               'Next.js',
  'react':                'React',
  'nodejs':               'Node',
  'express':              'Express',
  'nestjs':               'Nest.js',
  'android':              'Android Native',
  'ios':                  'iOS Native',
  'flutter':              'Flutter',
  'react-native':         'React Native',
  'compose-multiplatform':'Compose Multiplatform',
};

export const MOBILE_PLATFORM_LABELS: Record<MobilePlatform, string> = {
  'android':              'Android Native',
  'ios':                  'iOS Native',
  'flutter':              'Flutter',
  'react-native':         'React Native',
  'compose-multiplatform':'Compose Multiplatform',
};

export const KMP_TARGET_LABELS: Record<KmpTarget, string> = {
  android: 'Android',
  ios:     'iOS',
  desktop: 'Desktop',
  web:     'Web (Wasm)',
};

export type TechTag = 'typescript' | 'javascript' | 'java' | 'kotlin' | 'csharp' | 'python' | 'docker';

export const TECH_TAG_LABELS: Record<TechTag, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  java:       'Java',
  kotlin:     'Kotlin',
  csharp:     'C#',
  python:     'Python',
  docker:     'Docker',
};

// ─── Data model ──────────────────────────────────────────────────────────────

export type WorkspaceConfig = {
  id: string;
  name: string;
  position: number;
  createdAt: number;
};

export type ProjectConfig = {
  id: string;
  workspaceId: string;
  name: string;
  type: ProjectType;
  category: ProjectCategory;
  path: string;             // absolute path (CWD for spawning)
  port: number | null;
  https: boolean;
  externalUrl: string | null;
  tags: string[];
  env: Record<string, string>;
  runCommand: string;       // shell command; overrideable by user
  buildCommand: string | null;
  position: number;
  createdAt: number;
};

// ─── Run profiles ────────────────────────────────────────────────────────────

export type RunProfile = {
  id: string;
  projectId: string;
  name: string;
  runCommand: string;
  port: number | null;
  https: boolean;
  externalUrl: string | null;
  position: number;
  createdAt: number;
};

export type RunProfileCreateInput = {
  projectId: string;
  name: string;
  runCommand: string;
  port?: number | null;
  https?: boolean;
  externalUrl?: string | null;
};

export type RunProfileUpdateInput = Partial<{
  name: string;
  runCommand: string;
  port: number | null;
  https: boolean;
  externalUrl: string | null;
  position: number;
}>;

// ─── Dynamic build flags ─────────────────────────────────────────────────────
// Universal extensible primitive. Users add/remove entries freely in the UI.
// Strategies assemble the final command from them at build time.

export type BuildFlagKind =
  | 'gradle-prop'         // -Pkey=value  (Android / KMP)
  | 'gradle-flag'         // --flag  (--no-daemon, --parallel)
  | 'gradle-system-prop'  // -Dkey=value
  | 'xcode-setting'       // xcodebuild KEY=VALUE
  | 'xcode-flag'          // xcodebuild -flag value
  | 'flutter-dart-define' // --dart-define=KEY=VALUE
  | 'flutter-flag'        // any other flutter CLI flag
  | 'env';                // extra env var injected into the spawned process

export type BuildFlagEntry = {
  id: string;
  key: string;
  value: string;            // empty string for boolean flags like --no-daemon
  enabled: boolean;         // can be toggled off without deleting
  kind: BuildFlagKind;
  description: string | null;
};

// ─── Android build configuration ─────────────────────────────────────────────

export type MinifyConfig = {
  enabled: boolean;
  r8FullMode: boolean;
  proguardFiles: string[];  // paths relative to project root, e.g. "proguard-rules.pro"
};

export type AndroidBuildConfig = {
  id: string;
  name: string;             // "Debug", "Release", "Staging-QA" — fully user-defined
  buildType: string;        // debug | release | <custom>
  flavor: string | null;
  isDefault: boolean;
  minify: MinifyConfig;
  customFlags: BuildFlagEntry[];
};

export type AndroidSigningConfig = {
  keystorePath: string | null;
  keyAlias: string | null;
  storePasswordEnv: string | null;  // env var NAME (not the actual password)
  keyPasswordEnv: string | null;
};

// ─── iOS build configuration ─────────────────────────────────────────────────

export type IosBuildConfig = {
  id: string;
  name: string;             // "Debug", "Release", "Staging" — fully user-defined
  scheme: string;
  configuration: string;    // Debug | Release | <custom xcconfig>
  isDefault: boolean;
  customFlags: BuildFlagEntry[];  // xcode-setting / xcode-flag entries
};

export type IosSigningStyle = 'automatic' | 'manual';

export type IosSigningConfig = {
  bundleId: string | null;
  teamId: string | null;
  signingStyle: IosSigningStyle;
  certificateName: string | null;
  provisioningProfile: string | null;
  deploymentTarget: string | null;   // "15.0"
};

// ─── Flutter entry points ─────────────────────────────────────────────────────
// A Flutter project can have multiple main entry points (main_dev.dart, main_prod.dart…)

export type FlutterEntryPoint = {
  id: string;
  name: string;               // "Development", "Production", "Staging"
  target: string;             // "lib/main.dart" | "lib/main_dev.dart"
  flavor: string | null;
  dartDefines: BuildFlagEntry[];  // flutter-dart-define entries
  extraFlags: BuildFlagEntry[];   // other flutter-flag entries
  isDefault: boolean;
};

// ─── Native C++ build ─────────────────────────────────────────────────────────

export type NativeBuildConfig = {
  enabled: boolean;
  cmakeListsPath: string | null;    // relative path to CMakeLists.txt
  ndkVersion: string | null;        // e.g. "26.1.10909125"
  abiFilters: string[];             // ["arm64-v8a","armeabi-v7a","x86_64"]
  cmakeFlags: BuildFlagEntry[];     // gradle-prop entries with cmake. prefix
};

// ─── Firebase config ─────────────────────────────────────────────────────────

export type FirebasePlatform = 'android' | 'ios';

export type FirebaseConfig = {
  id: string;
  projectId: string;
  platform: FirebasePlatform;
  enabled: boolean;
  configFilePath: string | null;  // google-services.json or GoogleService-Info.plist
  appId: string | null;
};

export type FirebaseConfigInput = {
  platform: FirebasePlatform;
  enabled: boolean;
  configFilePath?: string | null;
  appId?: string | null;
};

// ─── Mobile config (1:1 with a mobile project) ───────────────────────────────

export type MobileConfig = {
  projectId: string;
  platform: MobilePlatform;
  applicationId: string | null;

  // Android
  androidModule: string | null;           // gradle module, default "app"
  androidBuildConfigs: AndroidBuildConfig[];
  androidSigning: AndroidSigningConfig;

  // iOS
  iosWorkspace: string | null;
  iosBuildConfigs: IosBuildConfig[];
  iosSigning: IosSigningConfig;

  // Flutter
  flutterEntryPoints: FlutterEntryPoint[];

  // Native C++
  native: NativeBuildConfig;

  // Compose Multiplatform
  kmpTargets: KmpTarget[];
  kmpModule: string | null;               // gradle module, default "composeApp"

  // Global flags applied to ALL builds for this project
  globalFlags: BuildFlagEntry[];

  ideHint: string | null;
  createdAt: number;
};

export type MobileConfigInput = Partial<Omit<MobileConfig, 'projectId' | 'createdAt'>>;

// ─── Mobile runtime / action types ───────────────────────────────────────────

export type MobileVersionInfo = {
  android?: { versionName: string | null; versionCode: number | null };
  ios?: { shortVersion: string | null; bundleVersion: string | null };
  flutter?: { version: string | null };
};

export type MobileDevice = {
  id: string;
  name: string;
  platform: MobilePlatform;
  kind: 'device' | 'emulator';
  state: string;
};

export type MobileActionResult =
  | { ok: true; taskId: string }
  | { ok: false; error: string };

export type MobileReleaseResult =
  | { ok: true; artifactPath: string }
  | { ok: false; error: string };

export type MobileBuildRecord = {
  projectPath: string;
  lastBuildAt: number | null;
  lastArtifactPath: string | null;
  lastVariant: string | null;
  sizeBytes: number | null;
};

export type MobileBuildArgs = {
  projectPath: string;
  configId?: string | null;      // AndroidBuildConfig.id | IosBuildConfig.id
  entryPointId?: string | null;  // FlutterEntryPoint.id
  kmpTarget?: KmpTarget | null;
};

export type MobileRunArgs = MobileBuildArgs & { deviceId: string };

// ─── Variant / flavor detection ───────────────────────────────────────────────

export type DetectedEntryPoint = { name: string; target: string };

export type DetectedVariants = {
  // 'static' = parsed from gradle/xcode files; 'gradle'/'xcodebuild' = ran the toolchain
  source: 'static' | 'gradle' | 'xcodebuild' | 'none';
  androidBuildTypes: string[];          // debug, release, staging…
  androidFlavors: string[];             // dev, prod…
  androidFlavorDimensions: string[];    // app, env…
  androidVariants: string[];            // full names, e.g. "prodRelease"
  flutterEntryPoints: DetectedEntryPoint[];
  iosSchemes: string[];
  iosConfigurations: string[];          // Debug, Release…
  warnings: string[];
};

export type VariantDetectArgs = {
  projectPath: string;
  deep?: boolean;             // run the toolchain (gradle/xcodebuild) for ground-truth
  platform?: MobilePlatform;  // override (used during create, before the project is saved)
  module?: string;            // gradle module override (defaults to config or "app")
};

// ─── CRUD inputs ─────────────────────────────────────────────────────────────

export type WorkspaceCreateInput = { name: string };
export type WorkspaceUpdateInput = { name?: string; position?: number };

export type ProjectCreateInput = {
  workspaceId: string;
  name: string;
  type: ProjectType;
  category?: ProjectCategory;
  path: string;
  port?: number | null;
  https?: boolean;
  externalUrl?: string | null;
  tags?: string[];
  env?: Record<string, string>;
  runCommand?: string;        // defaults to type's default if omitted
  buildCommand?: string | null;
  mobile?: MobileConfigInput;
  firebase?: FirebaseConfigInput[];
};

export type ProjectUpdateInput = Partial<{
  name: string;
  type: ProjectType;
  category: ProjectCategory;
  path: string;
  port: number | null;
  https: boolean;
  externalUrl: string | null;
  tags: string[];
  env: Record<string, string>;
  runCommand: string;
  buildCommand: string | null;
  position: number;
}>;

export type ProjectTypeDefaults = {
  runCommand: string;
  port: number | null;
};

// ─── Runtime state ───────────────────────────────────────────────────────────

export type ServiceStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'crashed'
  | 'stopped';

export type StartResult =
  | { ok: true }
  | { ok: false; error: string };

export type StopResult =
  | { ok: true }
  | { ok: false; error: string };

export type KillPortResult =
  | { ok: true; killed: number[] }
  | { ok: false; error: string };

export type StatusSnapshot = {
  projectPath: string;
  port: number | null;
  status: ServiceStatus;
  pid: number | null;
  lastExitCode: number | null;
};

export type LogStream = 'stdout' | 'stderr' | 'launcher';

export type LogEvent = {
  projectPath: string;
  stream: LogStream;
  line: string;
  ts: number;
};

export type ExitEvent = {
  projectPath: string;
  code: number | null;
  status: ServiceStatus;
  ts: number;
};

// ─── Renderer API (contextBridge) ────────────────────────────────────────────

export type LauncherApi = {
  // Workspace CRUD
  listWorkspaces: () => Promise<WorkspaceConfig[]>;
  createWorkspace: (input: WorkspaceCreateInput) => Promise<WorkspaceConfig>;
  updateWorkspace: (id: string, input: WorkspaceUpdateInput) => Promise<WorkspaceConfig>;
  deleteWorkspace: (id: string) => Promise<void>;
  reorderWorkspaces: (ids: string[]) => Promise<void>;

  // Project CRUD
  listProjects: (workspaceId: string) => Promise<ProjectConfig[]>;
  createProject: (input: ProjectCreateInput) => Promise<ProjectConfig>;
  updateProject: (id: string, input: ProjectUpdateInput) => Promise<ProjectConfig>;
  deleteProject: (id: string) => Promise<void>;
  reorderProjects: (workspaceId: string, ids: string[]) => Promise<void>;

  // Profile CRUD
  listProfiles: (projectId: string) => Promise<RunProfile[]>;
  listAllProfiles: () => Promise<RunProfile[]>;
  createProfile: (input: RunProfileCreateInput) => Promise<RunProfile>;
  updateProfile: (id: string, input: RunProfileUpdateInput) => Promise<RunProfile>;
  deleteProfile: (id: string) => Promise<void>;

  // Mobile config CRUD
  getMobileConfig: (projectId: string) => Promise<MobileConfig | null>;
  saveMobileConfig: (projectId: string, input: MobileConfigInput) => Promise<MobileConfig>;
  listFirebaseConfigs: (projectId: string) => Promise<FirebaseConfig[]>;
  saveFirebaseConfig: (projectId: string, input: FirebaseConfigInput) => Promise<FirebaseConfig>;

  // Service control (backend — keyed by project.path)
  startService: (args: { projectPath: string; profileId?: string | null }) => Promise<StartResult>;
  stopService: (args: { projectPath: string }) => Promise<StopResult>;
  killServicePort: (args: { projectPath: string; port: number | null }) => Promise<KillPortResult>;
  statusSnapshot: () => Promise<StatusSnapshot[]>;

  // Mobile build actions (stream output via service:log channel)
  mobileBuild: (args: MobileBuildArgs) => Promise<MobileActionResult>;
  mobileClean: (args: { projectPath: string }) => Promise<MobileActionResult>;
  mobileRunOnDevice: (args: MobileRunArgs) => Promise<MobileActionResult>;
  mobileRunOnEmulator: (args: MobileRunArgs) => Promise<MobileActionResult>;
  mobileStopTask: (args: { projectPath: string }) => Promise<StopResult>;
  mobileGenerateRelease: (args: MobileBuildArgs) => Promise<MobileReleaseResult>;
  mobileInstallApk: (args: { projectPath: string; deviceId: string; apkPath: string }) => Promise<MobileActionResult>;
  mobileAdbShell: (args: { projectPath: string; deviceId: string; command: string }) => Promise<MobileActionResult>;
  mobilePubGet: (args: { projectPath: string }) => Promise<MobileActionResult>;
  mobileFlutterDoctor: (args: { projectPath: string }) => Promise<MobileActionResult>;
  mobileViewLogs: (args: { projectPath: string; deviceId?: string | null }) => Promise<MobileActionResult>;

  // Mobile devices & utilities
  mobileListDevices: (args: { projectPath: string }) => Promise<MobileDevice[]>;
  mobileListEmulators: (args: { projectPath: string }) => Promise<MobileDevice[]>;
  mobileOpenIde: (args: { projectPath: string }) => Promise<{ ok: boolean; error?: string }>;
  mobileGetVersionInfo: (args: { projectPath: string }) => Promise<MobileVersionInfo>;
  mobileSetVersionInfo: (args: { projectPath: string; info: MobileVersionInfo }) => Promise<{ ok: boolean; error?: string }>;
  mobilePickFile: (args: { defaultPath?: string; title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  mobileGetBuildRecord: (args: { projectPath: string }) => Promise<MobileBuildRecord | null>;
  mobileDetectVariants: (args: VariantDetectArgs) => Promise<DetectedVariants>;

  // Utilities
  pickDirectory: (args: { defaultPath?: string; title?: string }) => Promise<string | null>;
  openPath: (absolutePath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  getLocalIp: () => Promise<string | null>;
  getProjectTypeDefaults: (type: ProjectType) => Promise<ProjectTypeDefaults>;

  // Events
  onLog: (cb: (event: LogEvent) => void) => () => void;
  onExit: (cb: (event: ExitEvent) => void) => () => void;

  // App
  relaunch: () => Promise<void>;
};

declare global {
  interface Window {
    launcher: LauncherApi;
  }
}
