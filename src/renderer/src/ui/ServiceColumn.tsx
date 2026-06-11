import type { BackendProjectType, BackendDetection, ProjectConfig, ServiceStatus } from '../../../shared/types';
import { PROJECT_TYPE_LABELS, TECH_TAG_LABELS } from '../../../shared/types';
import StatusBadge from './StatusBadge';
import RunStopButton from './RunStopButton';
import { BACKEND_COLORS, BACKEND_FG, BackendTypeLogo } from '../features/backend/backendPresentation';
import { normalizeUrl, portOfUrl as portOf, isLocalhost } from '../features/backend/urlUtils';

type BackendProjectConfig = Omit<ProjectConfig, 'type'> & { type: BackendProjectType };

type Props = {
  index: number;
  project: BackendProjectConfig;
  status: { status: ServiceStatus; lastExitCode: number | null };
  busy: boolean;
  detection: BackendDetection | null;
  selectedProfileName: string | null;
  onSelectProfile: (name: string | null) => void;
  localIp: string | null;
  onRun: () => void;
  onBuild: () => void;
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
  detection, selectedProfileName, onSelectProfile,
  localIp, onRun, onBuild, onStop, onKillPort,
}: Props) {
  const profiles = detection?.profiles ?? [];
  const activeProfile =
    profiles.find((p) => p.name === selectedProfileName) ?? profiles[0] ?? null;
  const urls = (activeProfile?.urls ?? []).map(normalizeUrl);
  const primaryUrl = urls[0] ?? null;
  const primaryPort = primaryUrl ? portOf(primaryUrl) : null;
  const canBuild = !!detection?.buildCommand;

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
          {primaryUrl ?? (profiles.length === 0 ? 'detecting…' : 'no URL declared')}
        </div>
      </header>

      {/* Profile dropdown (auto-detected per language) */}
      {profiles.length > 0 && (
        <select
          className="mobile-selector"
          value={activeProfile?.name ?? ''}
          disabled={busy}
          onChange={(e) => onSelectProfile(e.target.value || null)}
          title="Run profile / environment"
        >
          {profiles.map((p) => {
            const suffix = p.detail
              ? ` — ${p.detail}`
              : p.urls[0]
                ? ` — ${portOf(normalizeUrl(p.urls[0])) ?? p.urls[0]}`
                : '';
            return (
              <option key={p.name} value={p.name}>{p.name}{suffix}</option>
            );
          })}
        </select>
      )}

      <div className="column-actions">
        <RunStopButton status={status.status} busy={busy} onRun={onRun} onStop={onStop} />
        <button
          className="btn"
          onClick={onBuild}
          disabled={busy || !canBuild}
          title={canBuild ? `Build (${detection?.buildCommand})` : 'No build command for this project type'}
        >
          🔨 Build
        </button>
        <button
          className="btn kill-port"
          onClick={onKillPort}
          disabled={busy || primaryPort == null}
          title={primaryPort != null ? `Kill any process on :${primaryPort}` : 'No port declared for this profile'}
        >
          ✖ Kill Port
        </button>
      </div>
      <div className="column-status">
        <StatusBadge status={status.status} lastExitCode={status.lastExitCode} />
      </div>

      {/* Detected application URLs */}
      {urls.length > 0 && (
        <div className="column-links">
          {urls.map((url) => {
            const port = portOf(url);
            return (
              <div key={url} className="column-link-stack">
                <button
                  className="column-link-btn"
                  onClick={() => window.launcher.openExternal(url)}
                  title="Internal — open in browser"
                >
                  <span className="column-link-icon">⬡</span>
                  <span>{url}</span>
                </button>
                {localIp && isLocalhost(url) && port != null && (
                  <button
                    className="column-link-btn column-link-external"
                    onClick={() => window.launcher.openExternal(`http://${localIp}:${port}`)}
                    title="Local network — accessible from other devices"
                  >
                    <span className="column-link-icon">↗</span>
                    <span className="column-link-url">http://{localIp}:{port}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* User-defined external / hosted links */}
      {project.externalUrls.length > 0 && (
        <div className="column-links column-links--external">
          {project.externalUrls.map((link) => (
            <button
              key={link.id}
              className="column-link-btn column-link-external column-link-named"
              onClick={() => window.launcher.openExternal(link.url)}
              title={link.url}
            >
              <span className="column-link-icon">⇗</span>
              <span className="column-link-text">
                <span className="column-link-name">{link.name || 'Link'}</span>
                <span className="column-link-url">{link.url}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
