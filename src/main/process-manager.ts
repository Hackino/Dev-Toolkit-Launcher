import { spawn, type ChildProcess } from 'node:child_process';
import { BrowserWindow } from 'electron';
import treeKill from 'tree-kill';
import type { ExitEvent, LogEvent, ServiceStatus, StatusSnapshot } from '../shared/types';
import { killPort } from './port-cleanup';

const treeKillFn = treeKill;

type ServiceRecord = {
  child: ChildProcess | null;
  port: number | null;
  status: ServiceStatus;
  lastExitCode: number | null;
  projectPath: string;
  stopRequested: boolean;
};

const services = new Map<string, ServiceRecord>(); // key: projectPath

let pushLog: ((event: LogEvent) => void) | null = null;
let pushExit: ((event: ExitEvent) => void) | null = null;

export function attachToWindow(win: BrowserWindow) {
  pushLog = (event) => {
    if (!win.isDestroyed()) win.webContents.send('service:log', event);
  };
  pushExit = (event) => {
    if (!win.isDestroyed()) win.webContents.send('service:exit', event);
  };
}

function emitLog(projectPath: string, stream: LogEvent['stream'], line: string) {
  pushLog?.({ projectPath, stream, line, ts: Date.now() });
}

function emitExit(projectPath: string, code: number | null, status: ServiceStatus) {
  pushExit?.({ projectPath, code, status, ts: Date.now() });
}

function makeLineSplitter(onLine: (line: string) => void) {
  let buffer = '';
  return (chunk: Buffer | string) => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      onLine(line);
    }
  };
}

export async function startService(args: {
  projectPath: string;
  port: number | null;
  runCommand: string;
  env: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = services.get(args.projectPath);
  if (existing?.status === 'running') return { ok: false, error: 'already running — stop first' };
  if (existing?.status === 'starting') return { ok: false, error: 'already starting' };

  const record: ServiceRecord = {
    child: null,
    port: args.port,
    status: 'starting',
    lastExitCode: null,
    projectPath: args.projectPath,
    stopRequested: false,
  };
  services.set(args.projectPath, record);

  // Port pre-cleanup
  if (args.port != null) {
    const sweep = killPort(args.port);
    for (const pid of sweep.killed) {
      emitLog(args.projectPath, 'launcher', `killed orphan PID ${pid} listening on :${args.port}`);
    }
    for (const err of sweep.errors) {
      emitLog(args.projectPath, 'launcher', `port-cleanup warning: ${err}`);
    }
  }

  emitLog(args.projectPath, 'launcher', `${args.runCommand}    (cwd: ${args.projectPath})`);

  let child: ChildProcess;
  try {
    child = spawn(args.runCommand, [], {
      cwd: args.projectPath,
      shell: true,
      env: { ...process.env, ...args.env },
      windowsHide: true,
    });
  } catch (e) {
    record.status = 'crashed';
    emitLog(args.projectPath, 'launcher', `spawn failed: ${(e as Error).message}`);
    emitExit(args.projectPath, -1, 'crashed');
    return { ok: false, error: (e as Error).message };
  }

  record.child = child;
  record.status = 'running';

  const onStdout = makeLineSplitter((line) => emitLog(args.projectPath, 'stdout', line));
  const onStderr = makeLineSplitter((line) => emitLog(args.projectPath, 'stderr', line));
  child.stdout?.on('data', onStdout);
  child.stderr?.on('data', onStderr);

  let exitEmitted = false;

  child.on('error', (err) => {
    emitLog(args.projectPath, 'launcher', `process error: ${err.message}`);
    if (!exitEmitted) {
      exitEmitted = true;
      record.status = 'crashed';
      record.child = null;
      emitExit(args.projectPath, -1, 'crashed');
    }
  });

  child.on('exit', (code, signal) => {
    if (exitEmitted) return;
    exitEmitted = true;
    record.lastExitCode = code;
    const nextStatus: ServiceStatus =
      code === 0 || record.stopRequested ? 'stopped' : 'crashed';
    record.status = nextStatus;
    record.child = null;
    emitLog(
      args.projectPath,
      'launcher',
      signal ? `process exited via signal ${signal}` : `process exited with code ${code}`,
    );
    emitExit(args.projectPath, code, nextStatus);
  });

  return { ok: true };
}

export async function stopService(args: {
  projectPath: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const record = services.get(args.projectPath);

  // No child process — just ensure status is not stuck as running/starting
  if (!record?.child) {
    if (record && (record.status === 'running' || record.status === 'starting')) {
      record.status = 'stopped';
      emitExit(args.projectPath, null, 'stopped');
    }
    return { ok: true };
  }

  record.stopRequested = true;
  const port = record.port;
  emitLog(args.projectPath, 'launcher', `stopping (tree-kill pid ${record.child.pid})…`);

  await new Promise<void>((resolve) => {
    if (!record.child?.pid) {
      record.child = null;
      return resolve();
    }
    treeKillFn(record.child.pid, 'SIGTERM', () => resolve());
  });

  if (port != null) {
    const sweep = killPort(port);
    for (const pid of sweep.killed) {
      emitLog(args.projectPath, 'launcher', `stop sweep: killed orphan PID ${pid} on :${port}`);
    }
  }

  // Safety net: if exit event never fired (e.g. invalid PID, no real process)
  if (record.status === 'running' || record.status === 'starting') {
    record.status = 'stopped';
    emitExit(args.projectPath, null, 'stopped');
  }

  return { ok: true };
}

export async function killServicePort(args: {
  projectPath: string;
  port: number | null;
}): Promise<{ ok: true; killed: number[] } | { ok: false; error: string }> {
  const record = services.get(args.projectPath);
  const port = record?.port ?? args.port;
  if (port == null) return { ok: false, error: 'no port to sweep' };

  if (record?.child?.pid) {
    emitLog(args.projectPath, 'launcher', `kill-port: tree-killing pid ${record.child.pid}`);
    await new Promise<void>((resolve) => {
      if (!record.child?.pid) return resolve();
      treeKillFn(record.child.pid, 'SIGTERM', () => resolve());
    });
  }

  const sweep = killPort(port);
  for (const pid of sweep.killed) {
    emitLog(args.projectPath, 'launcher', `kill-port: killed PID ${pid} on :${port}`);
  }
  for (const err of sweep.errors) {
    emitLog(args.projectPath, 'launcher', `kill-port warning: ${err}`);
  }
  if (sweep.killed.length === 0 && sweep.errors.length === 0) {
    emitLog(args.projectPath, 'launcher', `kill-port: nothing was listening on :${port}`);
  }
  return { ok: true, killed: sweep.killed };
}

export function statusSnapshot(): StatusSnapshot[] {
  return Array.from(services.entries()).map(([projectPath, r]) => ({
    projectPath,
    port: r.port,
    status: r.status,
    pid: r.child?.pid ?? null,
    lastExitCode: r.lastExitCode,
  }));
}

export function stopAllSync() {
  for (const r of services.values()) {
    if (r.child?.pid) {
      try { treeKillFn(r.child.pid, 'SIGTERM'); } catch { /* ignore */ }
    }
  }
}
