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

/** A named external/hosted link shown in a service column. */
export type ExternalLink = { id: string; name: string; url: string };

export type ProjectConfig = {
  id: string;
  workspaceId: string;
  name: string;
  type: ProjectType;
  category: ProjectCategory;
  path: string;             // absolute path (CWD for spawning; .csproj for C#)
  port: number | null;      // legacy; backend ports are now detected per profile
  https: boolean;           // legacy; backend protocol is derived from detected URLs
  externalUrl: string | null; // legacy single link (migrated into externalUrls)
  externalUrls: ExternalLink[];
  tags: string[];
  env: Record<string, string>;
  runCommand: string;       // legacy; backend run comes from detected profiles
  buildCommand: string | null;
  position: number;
  createdAt: number;
};

// ─── Backend/web auto-detection ───────────────────────────────────────────────

/** A runnable profile/environment auto-detected from a backend project. */
export type BackendProfile = {
  name: string;
  runCommand: string;                 // raw command (finalized at run time)
  detail?: string;                    // human-readable command shown in the dropdown (e.g. "next dev --port 3100")
  urls: string[];                     // detected applicationUrls (scheme + port), may be empty
  env: Record<string, string>;        // profile-declared env (e.g. C# launchSettings)
};

export type BackendDetection = {
  profiles: BackendProfile[];
  buildCommand: string | null;
  warnings: string[];
};

export type BackendDetectArgs = { projectPath: string; type?: ProjectType };

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
  enabled: boolean;         // R8 / ProGuard code shrinking
  proguardFiles: string[];  // paths relative to project root, e.g. "proguard-rules.pro"
};

export type AndroidBuildConfig = {
  id: string;
  name: string;             // "Debug", "Release", "Staging-QA" — fully user-defined
  buildType: string;        // debug | release | <custom>
  flavor: string | null;
  isDefault: boolean;
  debuggable: boolean;      // builds the variant as debuggable
  signingConfig: string | null;  // name of the gradle signingConfig this variant uses
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

export type FirebasePlatform = 'android' | 'ios' | 'desktop';

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
  /**
   * Identifies the independent worker + terminal for this action. For
   * multi-platform projects each platform column has its own runKey
   * (`<projectPath>::<target>`) so platforms never affect each other. Defaults
   * to projectPath when omitted.
   */
  runKey?: string;
};

export type MobileRunArgs = MobileBuildArgs & { deviceId: string };

/** Common shape for mobile task actions that target a specific worker/terminal. */
export type MobileTaskRef = { projectPath: string; runKey?: string };

/** A built artifact sitting in the project's output/ folder. */
export type OutputArtifact = { name: string; path: string; sizeBytes: number };

/** Predefined one-shot tooling actions runnable from a mobile column. */
export type MobileScriptAction =
  | 'gen-rebuild' | 'gen-build' | 'gen-watch' | 'gen-clean' | 'gen-l10n'
  | 'icons' | 'splash' | 'format' | 'analyze' | 'test'
  | 'pub-get' | 'pub-upgrade' | 'pub-outdated' | 'doctor'
  | 'pod-install' | 'pod-update' | 'pod-repo-update' | 'open-xcode' | 'clean-derived'
  | 'gradle-clean' | 'gradle-deps' | 'gradle-stop';

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

// ─── Mobile asset detection / validation (firebase configs, keystores) ─────────

export type AssetKind = 'firebase-android' | 'firebase-ios' | 'firebase-desktop' | 'keystore';

export type AssetValidation = {
  valid: boolean;
  detail?: string;   // e.g. "project: my-app" / "JKS keystore"
  error?: string;
};

export type DetectedMobileAssets = {
  firebaseAndroid: string | null;   // project-relative paths
  firebaseIos: string | null;
  firebaseDesktop: string | null;
  keystores: string[];
};

export type ImportAssetResult =
  | { ok: true; relPath: string; detail?: string }
  | { ok: false; error: string };

// ─── Project introspection (detectable settings values) ────────────────────────

export type SigningConfigInfo = {
  name: string;
  storeFile: string | null;
  keyAlias: string | null;
  storePasswordEnv: string | null;   // referenced env var / gradle property, if any
  keyPasswordEnv: string | null;
};

/** Per-buildType settings parsed from the module's build.gradle (read-only in the UI). */
export type AndroidBuildTypeInfo = {
  name: string;                  // "debug", "release", "staging", …
  debuggable: boolean;
  minifyEnabled: boolean;
  signingConfig: string | null;  // referenced signingConfigs.<name>
  proguardFiles: string[];
};

export type MobileIntrospection = {
  gradleModules: string[];
  applicationIds: string[];
  bundleIds: string[];
  signingConfigs: SigningConfigInfo[];
  buildTypeConfigs: AndroidBuildTypeInfo[];  // detected per-buildType settings
  kmpTargets: KmpTarget[];        // KMP build targets declared in the module's build.gradle.kts
  iosWorkspaces: string[];        // detected .xcworkspace / .xcodeproj paths (relative to project root)
  iosTeamIds: string[];           // DEVELOPMENT_TEAM values from the Xcode project
  iosDeploymentTargets: string[]; // IPHONEOS_DEPLOYMENT_TARGET values
  iosCertificates: string[];      // CODE_SIGN_IDENTITY values
  iosProvisioningProfiles: string[]; // PROVISIONING_PROFILE_SPECIFIER values
  warnings: string[];
};

export type IntrospectArgs = {
  projectPath: string;
  platform?: MobilePlatform;
  module?: string;
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
  externalUrls?: ExternalLink[];
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
  externalUrls: ExternalLink[];
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
  detectBackendProfiles: (args: BackendDetectArgs) => Promise<BackendDetection>;
  startService: (args: { projectPath: string; profileName?: string | null }) => Promise<StartResult>;
  buildService: (args: { projectPath: string; profileName?: string | null }) => Promise<MobileActionResult>;
  stopService: (args: { projectPath: string }) => Promise<StopResult>;
  killServicePort: (args: { projectPath: string; port: number | null }) => Promise<KillPortResult>;
  statusSnapshot: () => Promise<StatusSnapshot[]>;

  // Mobile build actions (stream output via service:log channel)
  mobileBuild: (args: MobileBuildArgs) => Promise<MobileActionResult>;
  mobileClean: (args: MobileTaskRef) => Promise<MobileActionResult>;
  mobileRunOnDevice: (args: MobileRunArgs) => Promise<MobileActionResult>;
  mobileRunOnEmulator: (args: MobileRunArgs) => Promise<MobileActionResult>;
  mobileStopTask: (args: MobileTaskRef) => Promise<StopResult>;
  mobileGenerateRelease: (args: MobileBuildArgs) => Promise<MobileReleaseResult>;
  mobileInstallApk: (args: MobileTaskRef & { deviceId: string; apkPath: string }) => Promise<MobileActionResult>;
  /** Install an .apk or .aab onto a device. .aab is converted+installed via bundletool (auto-downloaded if missing). */
  mobileInstallArtifact: (args: MobileTaskRef & { deviceId: string; artifactPath: string }) => Promise<MobileActionResult>;
  mobileAdbShell: (args: MobileTaskRef & { deviceId: string; command: string }) => Promise<MobileActionResult>;
  mobileUninstall: (args: MobileTaskRef & { deviceId: string; packageId: string }) => Promise<MobileActionResult>;
  mobileListOutputArtifacts: (args: { projectPath: string; exts: string[] }) => Promise<OutputArtifact[]>;
  mobilePubGet: (args: MobileTaskRef) => Promise<MobileActionResult>;
  mobileFlutterDoctor: (args: MobileTaskRef) => Promise<MobileActionResult>;
  mobileViewLogs: (args: MobileTaskRef & { deviceId?: string | null }) => Promise<MobileActionResult>;
  mobileRunScript: (args: MobileTaskRef & { action: MobileScriptAction }) => Promise<MobileActionResult>;
  mobileSendInput: (args: MobileTaskRef & { input: string }) => Promise<{ ok: boolean; error?: string }>;

  // Mobile devices & utilities
  mobileListDevices: (args: { projectPath: string }) => Promise<MobileDevice[]>;
  mobileListEmulators: (args: { projectPath: string }) => Promise<MobileDevice[]>;
  mobileOpenIde: (args: MobileTaskRef) => Promise<{ ok: boolean; error?: string }>;
  mobileGetVersionInfo: (args: { projectPath: string }) => Promise<MobileVersionInfo>;
  mobileSetVersionInfo: (args: { projectPath: string; info: MobileVersionInfo }) => Promise<{ ok: boolean; error?: string }>;
  mobilePickFile: (args: { defaultPath?: string; title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  mobileGetBuildRecord: (args: { projectPath: string }) => Promise<MobileBuildRecord | null>;
  mobileDetectVariants: (args: VariantDetectArgs) => Promise<DetectedVariants>;
  mobileIntrospect: (args: IntrospectArgs) => Promise<MobileIntrospection>;
  mobileDetectAssets: (args: { projectPath: string; platform: MobilePlatform }) => Promise<DetectedMobileAssets>;
  mobileValidateAsset: (args: { projectPath: string; path: string; kind: AssetKind }) => Promise<AssetValidation>;
  mobileImportAsset: (args: { projectPath: string; srcPath: string; kind: AssetKind; platform: MobilePlatform }) => Promise<ImportAssetResult>;

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

  /** Absolute path of a dropped/selected File (Electron 33+ replacement for File.path). */
  getPathForFile: (file: File) => string;
};

declare global {
  interface Window {
    launcher: LauncherApi;
  }
}
