import { ipcMain } from 'electron';
import { dirname } from 'node:path';
import type { BackendDetectArgs } from '../../../shared/types';
import { ProjectRepository } from '../../capabilities/persistence/ProjectRepository';
import { FeatureRegistry } from '../../features/registry';
import { detectBackendProfiles, portOfUrl } from '../../capabilities/detection/backendProfiles';
import {
  startService,
  stopService,
  killServicePort,
  statusSnapshot,
} from '../../capabilities/process/backendProcess';
import { runMobileTask } from '../../capabilities/process/mobileProcess';

/** Spawn working directory for a project path (a .csproj points at its folder). */
function workingDir(projectPath: string): string {
  return projectPath.endsWith('.csproj') ? dirname(projectPath) : projectPath;
}

export function registerServiceIpc() {
  // ─── Profile detection ──────────────────────────────────────────────────────
  ipcMain.handle('service:detectProfiles', (_e, args: BackendDetectArgs) => {
    try {
      let type = args.type;
      if (!type) {
        const project = ProjectRepository.findByPath(args.projectPath);
        type = project?.type;
      }
      if (!type) throw new Error('Project type is required to detect profiles.');
      return detectBackendProfiles(args.projectPath, type);
    } catch (err) {
      return { profiles: [], buildCommand: null, warnings: [String(err)] };
    }
  });

  // ─── Start (runs a detected profile) ─────────────────────────────────────────
  ipcMain.handle(
    'service:start',
    async (_e, args: { projectPath: string; profileName?: string | null }) => {
      const project = ProjectRepository.findByPath(args.projectPath);
      if (!project) return { ok: false, error: `project not found for path: ${args.projectPath}` };

      const feature = FeatureRegistry.get(project.type);
      const detection = detectBackendProfiles(project.path, project.type);
      const profile =
        (args.profileName ? detection.profiles.find((p) => p.name === args.profileName) : null) ??
        detection.profiles[0] ??
        null;

      if (!profile) {
        return { ok: false, error: 'No runnable profile detected for this project.' };
      }

      const runCommand = feature.resolveRunCommand(project.path, profile.runCommand);
      const port = profile.urls.length > 0 ? portOfUrl(profile.urls[0]) : null;

      return startService({
        projectPath: project.path,
        cwd: workingDir(project.path),
        port,
        runCommand,
        env: { ...project.env, ...profile.env },
      });
    },
  );

  // ─── Build (one-shot, streams to its own terminal) ───────────────────────────
  ipcMain.handle(
    'service:build',
    (_e, args: { projectPath: string; profileName?: string | null }) => {
      const project = ProjectRepository.findByPath(args.projectPath);
      if (!project) return { ok: false, error: `project not found for path: ${args.projectPath}` };

      const detection = detectBackendProfiles(project.path, project.type);
      if (!detection.buildCommand) {
        return { ok: false, error: 'No build command available for this project type.' };
      }
      return runMobileTask({
        taskKey: `${project.path}::build`,
        command: detection.buildCommand,
        displayCommand: detection.buildCommand,
        cwd: workingDir(project.path),
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
