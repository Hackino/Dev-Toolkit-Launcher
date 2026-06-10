import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ExitEvent,
  ProjectConfig,
  RunProfile,
  ServiceStatus,
  StatusSnapshot,
  WorkspaceConfig,
} from '../../../shared/types';

type Statuses = Record<string, ServiceStatus>;     // projectPath → status
type ExitCodes = Record<string, number | null>;    // projectPath → exit code

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceConfig[]>([]);
  const [projects, setProjects] = useState<Record<string, ProjectConfig[]>>({}); // wsId → projects
  const [profiles, setProfiles] = useState<Record<string, RunProfile[]>>({}); // projectId → profiles
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Statuses>({});
  const [exitCodes, setExitCodes] = useState<ExitCodes>({});

  const loadWorkspaces = useCallback(async () => {
    const list = await window.launcher.listWorkspaces();
    setWorkspaces(list);
    setActiveWorkspaceId((cur) => {
      if (cur && list.some((w) => w.id === cur)) return cur;
      return list[0]?.id ?? null;
    });
  }, []);

  const loadProjects = useCallback(async (workspaceId: string) => {
    const list = await window.launcher.listProjects(workspaceId);
    setProjects((prev) => ({ ...prev, [workspaceId]: list }));
  }, []);

  const reload = useCallback(async () => {
    const list = await window.launcher.listWorkspaces();
    setWorkspaces(list);
    setActiveWorkspaceId((cur) => {
      if (cur && list.some((w) => w.id === cur)) return cur;
      return list[0]?.id ?? null;
    });
    // Load projects for all workspaces
    await Promise.all(list.map((w) => window.launcher.listProjects(w.id).then((p) =>
      setProjects((prev) => ({ ...prev, [w.id]: p })),
    )));
    // Load all profiles in one shot
    const allProfiles = await window.launcher.listAllProfiles();
    const profilesMap: Record<string, RunProfile[]> = {};
    for (const p of allProfiles) {
      if (!profilesMap[p.projectId]) profilesMap[p.projectId] = [];
      profilesMap[p.projectId].push(p);
    }
    setProfiles(profilesMap);
  }, []);

  const refreshStatus = useCallback(async () => {
    const snap: StatusSnapshot[] = await window.launcher.statusSnapshot();
    setStatuses((prev) => {
      const next = { ...prev };
      for (const s of snap) next[s.projectPath] = s.status;
      return next;
    });
  }, []);

  // Initial load
  useEffect(() => { reload(); }, [reload]);

  // Poll status every 5 s
  useEffect(() => {
    const id = setInterval(refreshStatus, 5000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  // Live exit events
  useEffect(() => {
    const dispose = window.launcher.onExit((event: ExitEvent) => {
      setStatuses((prev) => ({ ...prev, [event.projectPath]: event.status }));
      setExitCodes((prev) => ({ ...prev, [event.projectPath]: event.code }));
    });
    return dispose;
  }, []);

  // Load projects when workspace switches
  useEffect(() => {
    if (!activeWorkspaceId) return;
    if (projects[activeWorkspaceId]) return; // already loaded
    loadProjects(activeWorkspaceId);
  }, [activeWorkspaceId, projects, loadProjects]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const activeProjects = activeWorkspaceId ? (projects[activeWorkspaceId] ?? []) : [];

  const statusOf = useCallback(
    (project: ProjectConfig): { status: ServiceStatus; lastExitCode: number | null } => ({
      status: statuses[project.path] ?? 'idle',
      lastExitCode: exitCodes[project.path] ?? null,
    }),
    [statuses, exitCodes],
  );

  return {
    workspaces,
    projects,
    profiles,
    activeWorkspace,
    activeWorkspaceId,
    activeProjects,
    setActiveWorkspaceId,
    reload,
    loadProjects,
    refreshStatus,
    statusOf,
  };
}

export type WorkspacesApi = ReturnType<typeof useWorkspaces>;
