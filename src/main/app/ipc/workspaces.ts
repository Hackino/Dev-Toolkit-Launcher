import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { WorkspaceRepository } from '../../capabilities/persistence/WorkspaceRepository';
import { ProjectRepository } from '../../capabilities/persistence/ProjectRepository';
import { RunProfileRepository } from '../../capabilities/persistence/RunProfileRepository';
import { FeatureRegistry } from '../../features/registry';
import { ProjectService } from '../projectService';
import type {
  ProjectCreateInput,
  ProjectType,
  ProjectUpdateInput,
  RunProfileCreateInput,
  RunProfileUpdateInput,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from '../../../shared/types';

export function registerWorkspacesIpc() {
  // ── Workspace CRUD ──────────────────────────────────────────────────────────
  ipcMain.handle('workspaces:list', () => WorkspaceRepository.findAll());

  ipcMain.handle('workspaces:create', (_e, input: WorkspaceCreateInput) =>
    WorkspaceRepository.create(input),
  );

  ipcMain.handle('workspaces:update', (_e, id: string, input: WorkspaceUpdateInput) =>
    WorkspaceRepository.update(id, input),
  );

  ipcMain.handle('workspaces:delete', (_e, id: string) => WorkspaceRepository.delete(id));

  ipcMain.handle('workspaces:reorder', (_e, ids: string[]) => WorkspaceRepository.reorder(ids));

  // ── Project CRUD ────────────────────────────────────────────────────────────
  ipcMain.handle('projects:list', (_e, workspaceId: string) =>
    ProjectRepository.findByWorkspace(workspaceId),
  );

  ipcMain.handle('projects:create', (_e, input: ProjectCreateInput) =>
    ProjectService.create(input),
  );

  ipcMain.handle('projects:update', (_e, id: string, input: ProjectUpdateInput) =>
    ProjectRepository.update(id, input),
  );

  ipcMain.handle('projects:delete', (_e, id: string) => ProjectRepository.delete(id));

  ipcMain.handle('projects:reorder', (_e, workspaceId: string, ids: string[]) =>
    ProjectRepository.reorder(workspaceId, ids),
  );

  // ── Run Profile CRUD ────────────────────────────────────────────────────────
  ipcMain.handle('profiles:list', (_e, projectId: string) =>
    RunProfileRepository.list(projectId),
  );

  ipcMain.handle('profiles:listAll', () => RunProfileRepository.listAll());

  ipcMain.handle('profiles:create', (_e, input: RunProfileCreateInput) =>
    RunProfileRepository.create(input),
  );

  ipcMain.handle('profiles:update', (_e, id: string, input: RunProfileUpdateInput) =>
    RunProfileRepository.update(id, input),
  );

  ipcMain.handle('profiles:delete', (_e, id: string) => RunProfileRepository.delete(id));

  // ── Utilities ───────────────────────────────────────────────────────────────
  ipcMain.handle(
    'util:pickDirectory',
    async (event, args: { defaultPath?: string; title?: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(win ?? undefined!, {
        title: args?.title ?? 'Select folder',
        defaultPath: args?.defaultPath,
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0].replace(/\\/g, '/');
    },
  );

  ipcMain.handle('util:openPath', (_e, absolutePath: string) => shell.openPath(absolutePath));

  ipcMain.handle('util:localIp', () => {
    const { networkInterfaces } = require('node:os') as typeof import('node:os');
    const nets = networkInterfaces();
    for (const iface of Object.values(nets)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) return addr.address;
      }
    }
    return null;
  });

  ipcMain.handle('util:projectTypeDefaults', (_e, type: ProjectType) =>
    FeatureRegistry.defaults(type),
  );
}
