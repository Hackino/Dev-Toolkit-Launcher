import { useEffect, useState } from 'react';
import type { BackendProjectType, ProjectConfig, MobilePlatform } from '../../shared/types';
import { isMobileType } from '../../shared/category';
import { isMultiPlatform, columnTargetsFor, type MobileColumnTarget } from './features/mobileColumnTargets';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useTerminals } from './hooks/useTerminals';
import { useDevices } from './hooks/useDevices';
import { useMobile } from './hooks/useMobile';
import { useBackendProfiles } from './hooks/useBackendProfiles';
import { portOfUrl } from './features/backend/urlUtils';
import ServiceColumn from './ui/ServiceColumn';
import MobileServiceColumn from './ui/MobileServiceColumn';
import TerminalDock from './ui/TerminalDock';
import WorkspaceTabs from './ui/WorkspaceTabs';
import WorkspaceManager from './app/WorkspaceManager';

type BackendProjectConfig = Omit<ProjectConfig, 'type'> & { type: BackendProjectType };

export default function App() {
  const {
    workspaces,
    projects,
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
  const { detections } = useBackendProfiles(allProjectsList);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [managerOpen, setManagerOpen] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, string | null>>({});
  const [localIp, setLocalIp] = useState<string | null>(null);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);
  useEffect(() => { window.launcher.getLocalIp().then(setLocalIp); }, []);

  // Resolve the active detected profile for a backend project.
  const activeProfileOf = (project: ProjectConfig) => {
    const det = detections[project.path];
    const name = selectedProfiles[project.id] ?? null;
    return (name ? det?.profiles.find((p) => p.name === name) : null) ?? det?.profiles[0] ?? null;
  };

  const handleStart = async (project: ProjectConfig) => {
    const profile = activeProfileOf(project);
    setBusy((b) => ({ ...b, [project.path]: true }));
    terminals.openOrFocus(project, null);
    const result = await window.launcher.startService({
      projectPath: project.path,
      profileName: profile?.name ?? null,
    });
    if (!result.ok) {
      terminals.writeLine(project.path, 'stderr', `✖ start failed: ${result.error}`);
    }
    setBusy((b) => ({ ...b, [project.path]: false }));
    refreshStatus();
  };

  const handleBuild = async (project: ProjectConfig) => {
    const profile = activeProfileOf(project);
    const buildKey = `${project.path}::build`;
    terminals.openTerminal(buildKey, `${project.name} · build`);
    const result = await window.launcher.buildService({
      projectPath: project.path,
      profileName: profile?.name ?? null,
    });
    if (!result.ok) {
      terminals.writeLine(buildKey, 'stderr', `✖ build failed: ${result.error}`);
    }
  };

  const handleStop = async (project: ProjectConfig) => {
    setBusy((b) => ({ ...b, [project.path]: true }));
    terminals.writeLine(project.path, 'launcher', 'Stop requested…');
    const result = await window.launcher.stopService({ projectPath: project.path });
    if (!result.ok) {
      terminals.writeLine(project.path, 'stderr', `✖ stop failed: ${result.error}`);
    }
    setBusy((b) => ({ ...b, [project.path]: false }));
    refreshStatus();
  };

  const handleKillPort = async (project: ProjectConfig) => {
    const profile = activeProfileOf(project);
    const port = profile?.urls[0] ? portOfUrl(profile.urls[0]) : null;
    setBusy((b) => ({ ...b, [project.path]: true }));
    terminals.openOrFocus(project, null);
    terminals.writeLine(
      project.path,
      'launcher',
      port != null ? `Kill-port requested for :${port}…` : 'Kill-port requested but no port is known.',
    );
    const result = await window.launcher.killServicePort({ projectPath: project.path, port });
    if (!result.ok) {
      terminals.writeLine(project.path, 'stderr', `✖ kill-port failed: ${result.error}`);
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
        // Fan out multi-platform mobile projects (Flutter / RN / KMP) into one
        // column per platform target; everything else is a single column.
        type Spec =
          | { kind: 'mobile'; project: ProjectConfig; target: MobileColumnTarget | null }
          | { kind: 'backend'; project: ProjectConfig };
        const specs: Spec[] = [];
        for (const project of activeProjects) {
          if (isMobileType(project.type)) {
            const mp = project.type as MobilePlatform;
            const md = mobileData[project.path];
            const targets = isMultiPlatform(mp) ? columnTargetsFor(mp, md?.config ?? null) : [];
            if (targets.length > 0) {
              for (const target of targets) specs.push({ kind: 'mobile', project, target });
            } else {
              specs.push({ kind: 'mobile', project, target: null });
            }
          } else {
            specs.push({ kind: 'backend', project });
          }
        }

        const totalCols = Math.max(specs.length, 6);
        const emptyCols = specs.length < 6 ? 6 - specs.length : 0;
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
                {specs.map((spec, i) => {
                  if (spec.kind === 'mobile') {
                    const { project, target } = spec;
                    const md = mobileData[project.path];
                    const runKey = `${project.path}${target ? `::${target.key}` : ''}`;
                    const termLabel = target ? `${project.name} · ${target.label}` : project.name;
                    const tab = terminals.tabs.find((t) => t.projectPath === runKey);
                    return (
                      <MobileServiceColumn
                        key={`${project.id}:${target?.key ?? 'main'}`}
                        index={i + 1}
                        project={project}
                        target={target}
                        runKey={runKey}
                        terminalLabel={termLabel}
                        mobileConfig={md?.config ?? null}
                        firebase={md?.firebase ?? []}
                        devices={deviceMap[project.path] ?? []}
                        status={{ status: tab?.status ?? 'idle', lastExitCode: tab?.lastExitCode ?? null }}
                        busy={!!busy[project.path]}
                        lastBuild={md?.lastBuild ?? null}
                        onOpenTerminal={terminals.openTerminal}
                        onLog={terminals.writeLine}
                        onEdit={() => setManagerOpen(true)}
                      />
                    );
                  }
                  const { project } = spec;
                  return (
                    <ServiceColumn
                      key={project.id}
                      index={i + 1}
                      project={project as BackendProjectConfig}
                      status={statusOf(project)}
                      busy={!!busy[project.path]}
                      detection={detections[project.path] ?? null}
                      selectedProfileName={selectedProfiles[project.id] ?? null}
                      onSelectProfile={(name) =>
                        setSelectedProfiles((prev) => ({ ...prev, [project.id]: name }))
                      }
                      localIp={localIp}
                      onRun={() => handleStart(project)}
                      onBuild={() => handleBuild(project)}
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
