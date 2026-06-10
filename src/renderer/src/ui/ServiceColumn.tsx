import type { BackendProjectType, ProjectConfig, RunProfile, ServiceStatus } from '../../../shared/types';
import { PROJECT_TYPE_LABELS, TECH_TAG_LABELS } from '../../../shared/types';
import StatusBadge from './StatusBadge';
import RunStopButton from './RunStopButton';
import { BACKEND_COLORS, BACKEND_FG, BackendTypeLogo } from '../features/backend/backendPresentation';

type BackendProjectConfig = Omit<ProjectConfig, 'type'> & { type: BackendProjectType };

type Props = {
  index: number;
  project: BackendProjectConfig;
  status: { status: ServiceStatus; lastExitCode: number | null };
  busy: boolean;
  profiles: RunProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (id: string | null) => void;
  localIp: string | null;
  onRun: () => void;
  onStop: () => void;
  onKillPort: () => void;
};

const TAG_COLORS: Record<string, { bg: string; fg: string }> = {
  typescript: { bg: '#3178c6', fg: '#fff' },
  javascript: { bg: '#f7df1e', fg: '#000' },
  java:       { bg: '#e76f00', fg: '#fff' },
  kotlin:     { bg: '#7f52ff', fg: '#fff' },
  csharp:     { bg: '#68217a', fg: '#fff' },
  python:     { bg: '#3572a5', fg: '#fff' },
  docker:     { bg: '#2496ed', fg: '#fff' },
};

export default function ServiceColumn({
  index, project, status, busy,
  profiles, selectedProfileId, onSelectProfile,
  localIp, onRun, onStop, onKillPort,
}: Props) {
  const activeProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;
  const displayPort    = activeProfile?.port ?? project.port;
  const displayCmd     = activeProfile?.runCommand ?? project.runCommand;
  const displayHttps   = activeProfile?.https ?? project.https;
  const displayProto   = displayHttps ? 'https' : 'http';
  const manualExtUrl   = activeProfile?.externalUrl ?? project.externalUrl;

  return (
    <section className="column">
      <div className="column-top">
        <div className="column-logo-group">
          <BackendTypeLogo type={project.type} />
          <div className="column-badges">
            <span
              className="column-type-name"
              style={{ background: BACKEND_COLORS[project.type], color: BACKEND_FG[project.type] }}
            >
              {PROJECT_TYPE_LABELS[project.type]}
            </span>
            {project.tags.map((tag) => {
              const c = TAG_COLORS[tag];
              return c ? (
                <span key={tag} className="column-tag-badge" style={{ background: c.bg, color: c.fg }}>
                  {TECH_TAG_LABELS[tag as keyof typeof TECH_TAG_LABELS] ?? tag}
                </span>
              ) : null;
            })}
          </div>
        </div>
        <div className="column-index" data-n={index} />
      </div>

      <header className="column-header">
        <h2 className="column-name" title={project.path}>{project.name}</h2>
        <div className="column-subtitle">
          {displayPort != null
            ? <><span className="column-proto-badge">{displayProto}</span> {displayPort}</>
            : 'no port configured'}
        </div>
        <div className="column-run-cmd" title={displayCmd}>
          <span className="run-cmd-text">{displayCmd}</span>
        </div>
      </header>

      {profiles.length > 0 && (
        <div className="profile-radio-group">
          <label className="profile-radio-item">
            <input
              type="radio"
              name={`profile-${project.id}`}
              value=""
              checked={selectedProfileId === null}
              disabled={busy}
              onChange={() => onSelectProfile(null)}
            />
            <span className="profile-radio-label">Default</span>
            {project.port != null && (
              <span className="profile-radio-port">:{project.port}</span>
            )}
          </label>
          {profiles.map((p) => (
            <label key={p.id} className="profile-radio-item">
              <input
                type="radio"
                name={`profile-${project.id}`}
                value={p.id}
                checked={selectedProfileId === p.id}
                disabled={busy}
                onChange={() => onSelectProfile(p.id)}
              />
              <span className="profile-radio-label">{p.name}</span>
              {p.port != null && (
                <span className="profile-radio-port">:{p.port}</span>
              )}
            </label>
          ))}
        </div>
      )}

      <div className="column-actions">
        <RunStopButton status={status.status} busy={busy} onRun={onRun} onStop={onStop} />
        <button
          className="btn kill-port"
          onClick={onKillPort}
          disabled={busy || displayPort == null}
          title={
            displayPort != null
              ? `Kill any process on :${displayPort}`
              : 'No port configured for this project'
          }
        >
          ✖ Kill Port
        </button>
      </div>
      <div className="column-status">
        <StatusBadge status={status.status} lastExitCode={status.lastExitCode} />
      </div>

      {displayPort != null && (
        <div className="column-links">
          <button
            className="column-link-btn"
            onClick={() => window.launcher.openExternal(`${displayProto}://localhost:${displayPort}`)}
            title="Internal — open in browser"
          >
            <span className="column-link-icon">⬡</span>
            <span>{displayProto}://localhost:{displayPort}</span>
          </button>
          {localIp && (
            <button
              className="column-link-btn column-link-external"
              onClick={() => window.launcher.openExternal(`${displayProto}://${localIp}:${displayPort}`)}
              title="Local network — accessible from other devices"
            >
              <span className="column-link-icon">↗</span>
              <span className="column-link-url">{displayProto}://{localIp}:{displayPort}</span>
            </button>
          )}
          {manualExtUrl && (
            <button
              className="column-link-btn column-link-external"
              onClick={() => window.launcher.openExternal(manualExtUrl)}
              title={`External — ${manualExtUrl}`}
            >
              <span className="column-link-icon">⇗</span>
              <span className="column-link-url">{manualExtUrl}</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
