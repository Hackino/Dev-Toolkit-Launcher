import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  ExitEvent,
  KillPortResult,
  LauncherApi,
  LogEvent,
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

  // Service control
  startService: (args: { projectPath: string; profileId?: string | null }) =>
    ipcRenderer.invoke('service:start', args) as Promise<StartResult>,
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
};

contextBridge.exposeInMainWorld('launcher', api);
