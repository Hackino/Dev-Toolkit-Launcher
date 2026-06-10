import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { ExitEvent, LogEvent, LogStream, ProjectConfig, RunProfile, ServiceStatus } from '../../../shared/types';

export type TerminalTab = {
  projectPath: string;
  projectName: string;
  port: number | null;
  status: ServiceStatus;
  lastExitCode: number | null;
  profileName: string | null;
};

type TermEntry = {
  term: Terminal;
  fit: FitAddon;
  container: HTMLDivElement;
};

// Terminal ANSI color codes
const ANSI = {
  reset:   '\x1b[0m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  orange:  '\x1b[38;5;208m',  // 256-color orange for launching/building
  cyan:    '\x1b[36m',
};

function colorize(stream: LogStream, line: string): string {
  switch (stream) {
    case 'stderr':
      return `${ANSI.red}${line}${ANSI.reset}`;
    case 'launcher':
      return `${ANSI.dim}${ANSI.cyan}[launcher]${ANSI.reset} ${line}`;
    default:
      return line;
  }
}

function makeTerm(): TermEntry {
  const container = document.createElement('div');
  container.className = 'xterm-host';
  const term = new Terminal({
    convertEol: true,
    cursorBlink: false,
    disableStdin: true,
    scrollback: 5000,
    fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
    fontSize: 13,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      selectionBackground: '#264f78',
    },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(container);

  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true;
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (ctrl && (key === 'c' || event.key === 'Insert')) {
      if (term.hasSelection()) {
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel).catch(() => undefined);
        return false;
      }
    }
    if (ctrl && key === 'a') { term.selectAll(); return false; }
    return true;
  });

  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!term.hasSelection()) return;
    const sel = term.getSelection();
    if (sel) navigator.clipboard.writeText(sel).catch(() => undefined);
  });

  return { term, fit, container };
}

export function useTerminals() {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const termsRef = useRef<Map<string, TermEntry>>(new Map());
  const tabsRef = useRef<TerminalTab[]>([]);
  tabsRef.current = tabs;

  const ensureTerm = useCallback((projectPath: string): TermEntry => {
    let entry = termsRef.current.get(projectPath);
    if (!entry) {
      entry = makeTerm();
      termsRef.current.set(projectPath, entry);
    }
    return entry;
  }, []);

  const openOrFocus = useCallback(
    (project: ProjectConfig, profile: RunProfile | null = null) => {
      const entry = ensureTerm(project.path);
      const existingIdx = tabsRef.current.findIndex((t) => t.projectPath === project.path);
      const nextTab: TerminalTab = {
        projectPath: project.path,
        projectName: project.name,
        port: profile?.port ?? project.port,
        status: 'starting',
        lastExitCode: null,
        profileName: profile?.name ?? null,
      };
      if (existingIdx >= 0) {
        entry.term.reset();
        setTabs((prev) => {
          const next = [...prev];
          next[existingIdx] = nextTab;
          return next;
        });
        setActiveIdx(existingIdx);
      } else {
        setTabs((prev) => [...prev, nextTab]);
        setActiveIdx(tabsRef.current.length);
      }
      const label = profile ? `${project.name} [${profile.name}]` : project.name;
      entry.term.writeln(`${ANSI.orange}[launcher]${ANSI.reset} starting ${label}…`);
    },
    [ensureTerm],
  );

  /**
   * Open or focus a terminal by an arbitrary key + display name. Used by mobile
   * columns so each platform target gets its own independent terminal (keyed by
   * its runKey), routing the matching log/exit events to it.
   */
  const openTerminal = useCallback(
    (key: string, name: string, opts: { port?: number | null } = {}) => {
      ensureTerm(key);
      const existingIdx = tabsRef.current.findIndex((t) => t.projectPath === key);
      const nextTab: TerminalTab = {
        projectPath: key,
        projectName: name,
        port: opts.port ?? null,
        status: 'starting',
        lastExitCode: null,
        profileName: null,
      };
      if (existingIdx >= 0) {
        setTabs((prev) => {
          const next = [...prev];
          next[existingIdx] = { ...next[existingIdx], projectName: name, status: 'starting' };
          return next;
        });
        setActiveIdx(existingIdx);
      } else {
        setTabs((prev) => [...prev, nextTab]);
        setActiveIdx(tabsRef.current.length);
      }
    },
    [ensureTerm],
  );

  const close = useCallback((projectPath: string) => {
    const entry = termsRef.current.get(projectPath);
    if (entry) {
      entry.term.dispose();
      termsRef.current.delete(projectPath);
    }
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.projectPath === projectPath);
      if (idx < 0) return prev;
      const next = prev.filter((_, i) => i !== idx);
      setActiveIdx((cur) => {
        if (next.length === 0) return -1;
        if (cur === idx) return Math.min(idx, next.length - 1);
        if (cur > idx) return cur - 1;
        return cur;
      });
      return next;
    });
  }, []);

  const writeLine = useCallback(
    (projectPath: string, stream: LogStream, line: string) => {
      const entry = ensureTerm(projectPath);
      entry.term.writeln(colorize(stream, line));
    },
    [ensureTerm],
  );

  useEffect(() => {
    const offLog = window.launcher.onLog((event: LogEvent) => {
      if (!termsRef.current.has(event.projectPath)) return;
      const entry = termsRef.current.get(event.projectPath)!;
      entry.term.writeln(colorize(event.stream, event.line));
    });
    const offExit = window.launcher.onExit((event: ExitEvent) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.projectPath === event.projectPath
            ? { ...t, status: event.status, lastExitCode: event.code }
            : t,
        ),
      );
    });
    return () => { offLog(); offExit(); };
  }, []);

  const attachActive = useCallback((mount: HTMLDivElement | null) => {
    if (!mount) return;
    while (mount.firstChild) mount.removeChild(mount.firstChild);
    if (activeIdx < 0) return;
    const active = tabsRef.current[activeIdx];
    if (!active) return;
    const entry = termsRef.current.get(active.projectPath);
    if (!entry) return;
    mount.appendChild(entry.container);
    requestAnimationFrame(() => {
      try { entry.fit.fit(); } catch { /* no-op */ }
    });
  }, [activeIdx]);

  useEffect(() => {
    const handler = () => {
      if (activeIdx < 0) return;
      const active = tabsRef.current[activeIdx];
      if (!active) return;
      const entry = termsRef.current.get(active.projectPath);
      if (!entry) return;
      try { entry.fit.fit(); } catch { /* no-op */ }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [activeIdx]);

  return { tabs, activeIdx, setActiveIdx, openOrFocus, openTerminal, close, writeLine, attachActive };
}

export type TerminalsApi = ReturnType<typeof useTerminals>;
