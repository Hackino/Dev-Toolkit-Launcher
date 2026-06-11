import { useEffect, useRef } from 'react';
import type { TerminalsApi } from '../hooks/useTerminals';
import TerminalScrollbar from './TerminalScrollbar';

type Props = {
  api: TerminalsApi;
  onCloseRequestStop: (projectPath: string) => void;
};

export default function TerminalDock({ api, onCloseRequestStop }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.attachActive(mountRef.current);
  }, [api, api.activeIdx, api.tabs.length]);

  const onClose = (projectPath: string, isRunning: boolean) => {
    if (isRunning) {
      onCloseRequestStop(projectPath);
    }
    api.close(projectPath);
  };

  return (
    <div className="terminal-dock">
      <div className="terminal-tabbar">
        <span className="terminal-label">TERMINAL</span>
        {api.tabs.length === 0 ? (
          <span className="terminal-hint">(start a service to open a terminal tab)</span>
        ) : (
          <ul className="terminal-tabs">
            {api.tabs.map((t, i) => {
              const isActive = i === api.activeIdx;
              const isRunning = t.status === 'running' || t.status === 'starting';
              const portText = t.port != null ? `:${t.port}` : '';
              return (
                <li
                  key={t.projectPath}
                  className={`terminal-tab status-${t.status} ${isActive ? 'active' : ''}`}
                  onClick={() => api.setActiveIdx(i)}
                >
                  <span className="status-dot" aria-hidden="true" />
                  <span className="terminal-tab-label" title={t.projectPath}>
                    {t.projectName}
                    {t.profileName && (
                      <span className="terminal-tab-profile">[{t.profileName}]</span>
                    )}
                    {portText && <span className="terminal-tab-meta">{portText}</span>}
                  </span>
                  <button
                    className="terminal-tab-close"
                    title={isRunning ? 'Stop & close' : 'Close tab'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(t.projectPath, isRunning);
                    }}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="terminal-body-wrap">
        <div className="terminal-body" ref={mountRef} />
        <TerminalScrollbar term={api.activeTerm} />
      </div>
    </div>
  );
}
