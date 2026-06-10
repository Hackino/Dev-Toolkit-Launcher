import type { BackendProjectType, ProjectConfig, ProjectType, RunProfile, ServiceStatus } from '../../../shared/types';
import { PROJECT_TYPE_LABELS, TECH_TAG_LABELS } from '../../../shared/types';
import StatusBadge from './StatusBadge';
import RunStopButton from './RunStopButton';

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

const TYPE_COLORS: Record<BackendProjectType, string> = {
  'dotnet':      '#512bd4',
  'spring-boot': '#6db33f',
  'ktor':        '#e05522',
  'nextjs':      '#e8e8e8',
  'react':       '#20232a',
  'nodejs':      '#215732',
  'express':     '#3d3d3d',
  'nestjs':      '#e0234e',
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

const TYPE_FG: Record<BackendProjectType, string> = {
  'dotnet':      '#fff',
  'spring-boot': '#fff',
  'ktor':        '#fff',
  'nextjs':      '#111',
  'react':       '#61dafb',
  'nodejs':      '#6cc24a',
  'express':     '#bbb',
  'nestjs':      '#fff',
};

function TypeIcon({ type, color }: { type: BackendProjectType; color: string }) {
  switch (type) {
    case 'react':
      return (
        <g>
          <circle cx="24" cy="24" r="3.5" fill={color} />
          <ellipse cx="24" cy="24" rx="19" ry="7" stroke={color} strokeWidth="1.8" fill="none" />
          <ellipse cx="24" cy="24" rx="19" ry="7" stroke={color} strokeWidth="1.8" fill="none" transform="rotate(60 24 24)" />
          <ellipse cx="24" cy="24" rx="19" ry="7" stroke={color} strokeWidth="1.8" fill="none" transform="rotate(120 24 24)" />
        </g>
      );
    case 'dotnet':
      return (
        <text x="24" y="31" textAnchor="middle" fill={color} fontSize="14" fontWeight="800" fontFamily="system-ui, sans-serif">.NET</text>
      );
    case 'spring-boot':
      return (
        <g>
          <path
            d="M24 8 C14 12 10 20 10 26 C10 33 16 40 24 40 C32 40 38 33 38 26 C38 20 34 12 24 8Z"
            stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round"
          />
          <path d="M24 8 C28 18 30 30 24 40" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'ktor':
      return (
        <path
          d="M14 12 L14 36 M14 24 L28 12 M14 24 L30 36"
          stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
      );
    case 'nextjs':
      return (
        <path
          d="M13 36 L13 12 L35 36 L35 12"
          stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
      );
    case 'nodejs':
      return (
        <g>
          <path
            d="M24 8 L38 16 L38 32 L24 40 L10 32 L10 16Z"
            stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"
          />
          <text x="24" y="30" textAnchor="middle" fill={color} fontSize="14" fontWeight="800" fontFamily="system-ui, sans-serif">N</text>
        </g>
      );
    case 'express':
      return (
        <path
          d="M27 9 L18 27 L25 27 L21 39 L33 21 L26 21 Z"
          fill={color} strokeLinejoin="round"
        />
      );
    case 'nestjs':
      return (
        <path
          d="M13 36 L13 12 L24 30 L35 12 L35 36"
          stroke={color} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
      );
    default:
      return null;
  }
}

function TypeLogo({ type }: { type: BackendProjectType }) {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none" className="column-type-logo">
      <rect width="48" height="48" rx="10" fill={TYPE_COLORS[type]} />
      <TypeIcon type={type} color={TYPE_FG[type]} />
    </svg>
  );
}

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
          <TypeLogo type={project.type} />
          <div className="column-badges">
            <span
              className="column-type-name"
              style={{ background: TYPE_COLORS[project.type], color: TYPE_FG[project.type] }}
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
