import { useEffect, useState } from 'react';
import type { BackendProjectType, ProjectConfig } from '../../shared/types';
import { isMobileType } from '../../shared/category';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useTerminals } from './hooks/useTerminals';
import { useDevices } from './hooks/useDevices';
import { useMobile } from './hooks/useMobile';
import ServiceColumn from './components/ServiceColumn';
import MobileServiceColumn from './components/MobileServiceColumn';
import TerminalDock from './components/TerminalDock';
import WorkspaceTabs from './components/WorkspaceTabs';
import WorkspaceManager from './components/WorkspaceManager';

type BackendProjectConfig = Omit<ProjectConfig, 'type'> & { type: BackendProjectType };

export default function App() {
  const {
    workspaces,
    projects,
    profiles,
    activeWorkspace,
    activeWorkspaceId,
    activeProjects,
    setActiveWorkspaceId,
    reload,
    refreshStatus,
    statusOf,
  } = useWorkspaces();

  const terminals = useTerminals();
  const allProjectsList = Object.values(projects).flat();
  const deviceMap = useDevices(allProjectsList);
  const mobileData = useMobile(allProjectsList);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [managerOpen, setManagerOpen] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, string | null>>({});
  const [localIp, setLocalIp] = useState<string | null>(null);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);
  useEffect(() => { window.launcher.getLocalIp().then(setLocalIp); }, []);

  const handleStart = async (project: ProjectConfig) => {
    const profileId = selectedProfiles[project.id] ?? null;
    const profile = profileId
      ? (profiles[project.id] ?? []).find((p) => p.id === profileId) ?? null
      : null;
    setBusy((b) => ({ ...b, [project.path]: true }));
    terminals.openOrFocus(project, profile);
    const result = await window.launcher.startService({ projectPath: project.path, profileId });
    if (!result.ok) {
      terminals.writeLine(project.path, 'launcher', `start failed: ${result.error}`);
    }
    setBusy((b) => ({ ...b, [project.path]: false }));
    refreshStatus();
  };

  const handleStop = async (project: ProjectConfig) => {
    setBusy((b) => ({ ...b, [project.path]: true }));
    terminals.writeLine(project.path, 'launcher', 'Stop requested…');
    const result = await window.launcher.stopService({ projectPath: project.path });
    if (!result.ok) {
      terminals.writeLine(project.path, 'launcher', `stop failed: ${result.error}`);
    }
    setBusy((b) => ({ ...b, [project.path]: false }));
    refreshStatus();
  };

  const handleKillPort = async (project: ProjectConfig) => {
    const profileId = selectedProfiles[project.id] ?? null;
    const profile = profileId
      ? (profiles[project.id] ?? []).find((p) => p.id === profileId) ?? null
      : null;
    const port = profile?.port ?? project.port;
    setBusy((b) => ({ ...b, [project.path]: true }));
    terminals.openOrFocus(project, profile);
    terminals.writeLine(
      project.path,
      'launcher',
      port != null ? `Kill-port requested for :${port}…` : 'Kill-port requested but no port is known.',
    );
    const result = await window.launcher.killServicePort({ projectPath: project.path, port });
    if (!result.ok) {
      terminals.writeLine(project.path, 'launcher', `kill-port failed: ${result.error}`);
    }
    setBusy((b) => ({ ...b, [project.path]: false }));
    refreshStatus();
  };

  // project count per workspace for the tab badges
  const projectCounts: Record<string, number> = {};
  for (const [wsId, list] of Object.entries(projects)) {
    projectCounts[wsId] = list.length;
  }

  // All projects across workspaces (needed by terminal dock for project name lookup)
  const allProjects: ProjectConfig[] = allProjectsList;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Dev Launcher</h1>
        <div className="app-header-actions">
          <button className="btn ghost" onClick={() => window.launcher.relaunch()} title="Restart the app">
            ⟳ Reload
          </button>
          <button
            className="btn ghost"
            onClick={() => setManagerOpen(true)}
            title="Manage workspaces &amp; projects"
          >
            ⚙ Manage
          </button>
        </div>
      </header>

      <WorkspaceTabs
        workspaces={workspaces}
        projectCounts={projectCounts}
        activeId={activeWorkspaceId}
        onSelect={setActiveWorkspaceId}
      />

      {(() => {
        const totalCols = Math.max(activeProjects.length, 6);
        const emptyCols = activeProjects.length < 6 ? 6 - activeProjects.length : 0;
        return (
          <div
            className="columns"
            style={{ gridTemplateColumns: `repeat(${totalCols}, calc(100% / 5.5))` }}
          >
            {workspaces.length === 0 ? (
              <div className="empty" style={{ gridColumn: '1 / -1' }}>
                No workspaces yet.{' '}
                <button className="btn-link" onClick={() => setManagerOpen(true)}>
                  Click Manage to add your first workspace and projects.
                </button>
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="empty" style={{ gridColumn: '1 / -1' }}>
                No projects in <strong>{activeWorkspace?.name ?? 'this workspace'}</strong>.{' '}
                <button className="btn-link" onClick={() => setManagerOpen(true)}>
                  Click Manage to add projects.
                </button>
              </div>
            ) : (
              <>
                {activeProjects.map((project, i) => {
                  if (isMobileType(project.type)) {
                    const md = mobileData[project.path];
                    return (
                      <MobileServiceColumn
                        key={project.id}
                        index={i + 1}
                        project={project}
                        mobileConfig={md?.config ?? null}
                        firebase={md?.firebase ?? []}
                        devices={deviceMap[project.path] ?? []}
                        status={statusOf(project)}
                        busy={!!busy[project.path]}
                        lastBuild={md?.lastBuild ?? null}
                        onEdit={() => setManagerOpen(true)}
                      />
                    );
                  }
                  return (
                    <ServiceColumn
                      key={project.id}
                      index={i + 1}
                      project={project as BackendProjectConfig}
                      status={statusOf(project)}
                      busy={!!busy[project.path]}
                      profiles={profiles[project.id] ?? []}
                      selectedProfileId={selectedProfiles[project.id] ?? null}
                      onSelectProfile={(id) =>
                        setSelectedProfiles((prev) => ({ ...prev, [project.id]: id }))
                      }
                      localIp={localIp}
                      onRun={() => handleStart(project)}
                      onStop={() => handleStop(project)}
                      onKillPort={() => handleKillPort(project)}
                    />
                  );
                })}
                {Array.from({ length: emptyCols }).map((_, i) => (
                  <div key={`empty-${i}`} className="column column-empty" />
                ))}
              </>
            )}
          </div>
        );
      })()}

      <TerminalDock
        api={terminals}
        onCloseRequestStop={(projectPath) => {
          const p = allProjects.find((x) => x.path === projectPath);
          if (p) handleStop(p);
        }}
      />

      <WorkspaceManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onChanged={reload}
      />
    </div>
  );
}
