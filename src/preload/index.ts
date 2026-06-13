import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import type {
  AssetKind,
  BackendDetectArgs,
  DetectedVariants,
  IntrospectArgs,
  ExitEvent,
  FirebaseConfigInput,
  MobilePlatform,
  KillPortResult,
  LauncherApi,
  LogEvent,
  MobileBuildArgs,
  MobileBuildRecord,
  MobileConfig,
  MobileConfigInput,
  MobileDevice,
  MobileRunArgs,
  MobileScriptAction,
  MobileVersionInfo,
  ProjectConfig,
  ProjectCreateInput,
  ProjectType,
  ProjectTypeDefaults,
  ProjectUpdateInput,
  RunProfile,
  RunProfileCreateInput,
  RunProfileUpdateInput,
  StartResult,
  StatusSnapshot,
  StopResult,
  VariantDetectArgs,
  WorkspaceConfig,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from '../shared/types';

const api: LauncherApi = {
  // Workspace CRUD
  listWorkspaces: () =>
    ipcRenderer.invoke('workspaces:list') as Promise<WorkspaceConfig[]>,
  createWorkspace: (input: WorkspaceCreateInput) =>
    ipcRenderer.invoke('workspaces:create', input) as Promise<WorkspaceConfig>,
  updateWorkspace: (id: string, input: WorkspaceUpdateInput) =>
    ipcRenderer.invoke('workspaces:update', id, input) as Promise<WorkspaceConfig>,
  deleteWorkspace: (id: string) =>
    ipcRenderer.invoke('workspaces:delete', id) as Promise<void>,
  reorderWorkspaces: (ids: string[]) =>
    ipcRenderer.invoke('workspaces:reorder', ids) as Promise<void>,

  // Project CRUD
  listProjects: (workspaceId: string) =>
    ipcRenderer.invoke('projects:list', workspaceId) as Promise<ProjectConfig[]>,
  createProject: (input: ProjectCreateInput) =>
    ipcRenderer.invoke('projects:create', input) as Promise<ProjectConfig>,
  updateProject: (id: string, input: ProjectUpdateInput) =>
    ipcRenderer.invoke('projects:update', id, input) as Promise<ProjectConfig>,
  deleteProject: (id: string) =>
    ipcRenderer.invoke('projects:delete', id) as Promise<void>,
  reorderProjects: (workspaceId: string, ids: string[]) =>
    ipcRenderer.invoke('projects:reorder', workspaceId, ids) as Promise<void>,

  // Profile CRUD
  listProfiles: (projectId: string) =>
    ipcRenderer.invoke('profiles:list', projectId) as Promise<RunProfile[]>,
  listAllProfiles: () =>
    ipcRenderer.invoke('profiles:listAll') as Promise<RunProfile[]>,
  createProfile: (input: RunProfileCreateInput) =>
    ipcRenderer.invoke('profiles:create', input) as Promise<RunProfile>,
  updateProfile: (id: string, input: RunProfileUpdateInput) =>
    ipcRenderer.invoke('profiles:update', id, input) as Promise<RunProfile>,
  deleteProfile: (id: string) =>
    ipcRenderer.invoke('profiles:delete', id) as Promise<void>,

  // Mobile config CRUD
  getMobileConfig: (projectId: string) =>
    ipcRenderer.invoke('mobile:getConfig', projectId) as Promise<MobileConfig | null>,
  saveMobileConfig: (projectId: string, input: MobileConfigInput) =>
    ipcRenderer.invoke('mobile:saveConfig', projectId, input) as Promise<MobileConfig>,
  listFirebaseConfigs: (projectId: string) =>
    ipcRenderer.invoke('mobile:listFirebase', projectId) as ReturnType<LauncherApi['listFirebaseConfigs']>,
  saveFirebaseConfig: (projectId: string, input: FirebaseConfigInput) =>
    ipcRenderer.invoke('mobile:saveFirebase', projectId, input) as ReturnType<LauncherApi['saveFirebaseConfig']>,

  // Mobile build actions
  mobileBuild: (args: MobileBuildArgs) =>
    ipcRenderer.invoke('mobile:build', args) as ReturnType<LauncherApi['mobileBuild']>,
  mobileClean: (args: { projectPath: string }) =>
    ipcRenderer.invoke('mobile:clean', args) as ReturnType<LauncherApi['mobileClean']>,
  mobileRunOnDevice: (args: MobileRunArgs) =>
    ipcRenderer.invoke('mobile:runOnDevice', args) as ReturnType<LauncherApi['mobileRunOnDevice']>,
  mobileRunOnEmulator: (args: MobileRunArgs) =>
    ipcRenderer.invoke('mobile:runOnEmulator', args) as ReturnType<LauncherApi['mobileRunOnEmulator']>,
  mobileStopTask: (args: { projectPath: string }) =>
    ipcRenderer.invoke('mobile:stopTask', args) as ReturnType<LauncherApi['mobileStopTask']>,
  mobileGenerateRelease: (args: MobileBuildArgs) =>
    ipcRenderer.invoke('mobile:generateRelease', args) as ReturnType<LauncherApi['mobileGenerateRelease']>,
  mobileInstallApk: (args: { projectPath: string; deviceId: string; apkPath: string }) =>
    ipcRenderer.invoke('mobile:installApk', args) as ReturnType<LauncherApi['mobileInstallApk']>,
  mobileInstallArtifact: (args: { projectPath: string; deviceId: string; artifactPath: string }) =>
    ipcRenderer.invoke('mobile:installArtifact', args) as ReturnType<LauncherApi['mobileInstallArtifact']>,
  mobileAdbShell: (args: { projectPath: string; deviceId: string; command: string }) =>
    ipcRenderer.invoke('mobile:adbShell', args) as ReturnType<LauncherApi['mobileAdbShell']>,
  mobilePubGet: (args: { projectPath: string }) =>
    ipcRenderer.invoke('mobile:pubGet', args) as ReturnType<LauncherApi['mobilePubGet']>,
  mobileFlutterDoctor: (args: { projectPath: string }) =>
    ipcRenderer.invoke('mobile:flutterDoctor', args) as ReturnType<LauncherApi['mobileFlutterDoctor']>,
  mobileRunScript: (args: { projectPath: string; runKey?: string; action: MobileScriptAction }) =>
    ipcRenderer.invoke('mobile:runScript', args) as ReturnType<LauncherApi['mobileRunScript']>,
  mobileSendInput: (args: { projectPath: string; runKey?: string; input: string }) =>
    ipcRenderer.invoke('mobile:sendInput', args) as ReturnType<LauncherApi['mobileSendInput']>,
  mobileViewLogs: (args: { projectPath: string; deviceId?: string | null }) =>
    ipcRenderer.invoke('mobile:viewLogs', args) as ReturnType<LauncherApi['mobileViewLogs']>,

  // Mobile devices & utilities
  mobileListDevices: (args: { projectPath: string }) =>
    ipcRenderer.invoke('mobile:listDevices', args) as Promise<MobileDevice[]>,
  mobileListEmulators: (args: { projectPath: string }) =>
    ipcRenderer.invoke('mobile:listEmulators', args) as Promise<MobileDevice[]>,
  mobileOpenIde: (args: { projectPath: string }) =>
    ipcRenderer.invoke('mobile:openIde', args) as Promise<{ ok: boolean; error?: string }>,
  mobileGetVersionInfo: (args: { projectPath: string }) =>
    ipcRenderer.invoke('mobile:getVersionInfo', args) as Promise<MobileVersionInfo>,
  mobileSetVersionInfo: (args: { projectPath: string; info: MobileVersionInfo }) =>
    ipcRenderer.invoke('mobile:setVersionInfo', args) as Promise<{ ok: boolean; error?: string }>,
  mobilePickFile: (args: { defaultPath?: string; title?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('mobile:pickFile', args) as Promise<string | null>,
  mobileGetBuildRecord: (args: { projectPath: string }) =>
    ipcRenderer.invoke('mobile:getBuildRecord', args) as Promise<MobileBuildRecord | null>,
  mobileDetectVariants: (args: VariantDetectArgs) =>
    ipcRenderer.invoke('mobile:detectVariants', args) as Promise<DetectedVariants>,
  mobileIntrospect: (args: IntrospectArgs) =>
    ipcRenderer.invoke('mobile:introspect', args) as ReturnType<LauncherApi['mobileIntrospect']>,
  mobileDetectAssets: (args: { projectPath: string; platform: MobilePlatform }) =>
    ipcRenderer.invoke('mobile:detectAssets', args) as ReturnType<LauncherApi['mobileDetectAssets']>,
  mobileValidateAsset: (args: { projectPath: string; path: string; kind: AssetKind }) =>
    ipcRenderer.invoke('mobile:validateAsset', args) as ReturnType<LauncherApi['mobileValidateAsset']>,
  mobileImportAsset: (args: { projectPath: string; srcPath: string; kind: AssetKind; platform: MobilePlatform }) =>
    ipcRenderer.invoke('mobile:importAsset', args) as ReturnType<LauncherApi['mobileImportAsset']>,

  // Service control
  detectBackendProfiles: (args: BackendDetectArgs) =>
    ipcRenderer.invoke('service:detectProfiles', args) as ReturnType<LauncherApi['detectBackendProfiles']>,
  startService: (args: { projectPath: string; profileName?: string | null }) =>
    ipcRenderer.invoke('service:start', args) as Promise<StartResult>,
  buildService: (args: { projectPath: string; profileName?: string | null }) =>
    ipcRenderer.invoke('service:build', args) as ReturnType<LauncherApi['buildService']>,
  stopService: (args: { projectPath: string }) =>
    ipcRenderer.invoke('service:stop', args) as Promise<StopResult>,
  killServicePort: (args: { projectPath: string; port: number | null }) =>
    ipcRenderer.invoke('service:killPort', args) as Promise<KillPortResult>,
  statusSnapshot: () =>
    ipcRenderer.invoke('service:status') as Promise<StatusSnapshot[]>,

  // Utilities
  pickDirectory: (args: { defaultPath?: string; title?: string }) =>
    ipcRenderer.invoke('util:pickDirectory', args) as Promise<string | null>,
  openPath: (absolutePath: string) =>
    ipcRenderer.invoke('util:openPath', absolutePath) as Promise<void>,
  openExternal: (url: string) =>
    ipcRenderer.invoke('app:openExternal', url) as Promise<void>,
  getLocalIp: () =>
    ipcRenderer.invoke('util:localIp') as Promise<string | null>,
  getProjectTypeDefaults: (type: ProjectType) =>
    ipcRenderer.invoke('util:projectTypeDefaults', type) as Promise<ProjectTypeDefaults>,

  // Events
  onLog: (cb: (event: LogEvent) => void) => {
    const handler = (_: IpcRendererEvent, payload: LogEvent) => cb(payload);
    ipcRenderer.on('service:log', handler);
    return () => ipcRenderer.off('service:log', handler);
  },
  onExit: (cb: (event: ExitEvent) => void) => {
    const handler = (_: IpcRendererEvent, payload: ExitEvent) => cb(payload);
    ipcRenderer.on('service:exit', handler);
    return () => ipcRenderer.off('service:exit', handler);
  },

  // App
  relaunch: () => ipcRenderer.invoke('app:relaunch') as Promise<void>,

  // Resolve the absolute filesystem path of a dropped/selected File (Electron 33+
  // removed File.path; webUtils.getPathForFile is the supported replacement).
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('launcher', api);
