import { ipcMain } from 'electron';
import { ProjectRepository } from '../../capabilities/persistence/ProjectRepository';
import { RunProfileRepository } from '../../capabilities/persistence/RunProfileRepository';
import { FeatureRegistry } from '../../features/registry';
import {
  startService,
  stopService,
  killServicePort,
  statusSnapshot,
} from '../../capabilities/process/backendProcess';

export function registerServiceIpc() {
  ipcMain.handle(
    'service:start',
    async (_e, args: { projectPath: string; profileId?: string | null }) => {
      const project = ProjectRepository.findByPath(args.projectPath);
      if (!project) return { ok: false, error: `project not found for path: ${args.projectPath}` };

      const strategy = FeatureRegistry.get(project.type);

      let runCommand: string;
      let port: number | null;

      if (args.profileId) {
        const profile = RunProfileRepository.findById(args.profileId);
        if (!profile) return { ok: false, error: `profile not found: ${args.profileId}` };
        runCommand = strategy.resolveRunCommand(project.path, profile.runCommand);
        port = profile.port;
      } else {
        runCommand = strategy.resolveRunCommand(project.path, project.runCommand);
        port = project.port;
      }

      return startService({
        projectPath: project.path,
        port,
        runCommand,
        env: project.env,
      });
    },
  );

  ipcMain.handle('service:stop', (_e, args: { projectPath: string }) => stopService(args));

  ipcMain.handle(
    'service:killPort',
    (_e, args: { projectPath: string; port: number | null }) => killServicePort(args),
  );

  ipcMain.handle('service:status', () => statusSnapshot());
}
