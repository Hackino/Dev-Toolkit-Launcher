import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import treeKill from 'tree-kill';
import type { BrowserWindow } from 'electron';
import type { ServiceStatus, StopResult } from '../../shared/types';

export type MobileTaskRecord = {
  child: ChildProcess | null;
  projectPath: string;
  status: ServiceStatus;
  pid: number | null;
};

const tasks = new Map<string, MobileTaskRecord>();

let _window: BrowserWindow | null = null;

export function attachMobileToWindow(win: BrowserWindow): void {
  _window = win;
}

function emitLog(projectPath: string, stream: 'stdout' | 'stderr' | 'launcher', line: string): void {
  _window?.webContents.send('service:log', {
    projectPath,
    stream,
    line,
    ts: Date.now(),
  });
}

function emitExit(projectPath: string, code: number | null, status: ServiceStatus): void {
  _window?.webContents.send('service:exit', {
    projectPath,
    code,
    status,
    ts: Date.now(),
  });
}

function makeLineSplitter(onLine: (line: string) => void): (chunk: Buffer) => void {
  let buf = '';
  return (chunk: Buffer) => {
    buf += chunk.toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) onLine(line);
  };
}

export type RunMobileTaskOptions = {
  projectPath: string;
  command: string;       // full shell command string
  displayCommand: string; // potentially redacted version for the log
  cwd: string;
  env?: Record<string, string>;
};

export function runMobileTask(opts: RunMobileTaskOptions): { ok: true; taskId: string } | { ok: false; error: string } {
  // Stop any existing task for this project
  const existing = tasks.get(opts.projectPath);
  if (existing?.child && existing.status === 'running') {
    treeKill(existing.child.pid!, 'SIGTERM');
  }

  const record: MobileTaskRecord = {
    child: null,
    projectPath: opts.projectPath,
    status: 'starting',
    pid: null,
  };
  tasks.set(opts.projectPath, record);

  emitLog(opts.projectPath, 'launcher', `▶ ${opts.displayCommand}`);

  let child: ChildProcess;
  try {
    child = spawn(opts.command, [], {
      cwd: opts.cwd,
      shell: true,
      env: { ...process.env, ...opts.env },
    });
  } catch (err) {
    tasks.delete(opts.projectPath);
    return { ok: false, error: String(err) };
  }

  record.child = child;
  record.pid = child.pid ?? null;
  record.status = 'running';

  child.stdout?.on('data', makeLineSplitter((line) => emitLog(opts.projectPath, 'stdout', line)));
  child.stderr?.on('data', makeLineSplitter((line) => emitLog(opts.projectPath, 'stderr', line)));

  child.on('close', (code) => {
    const status: ServiceStatus = code === 0 ? 'stopped' : 'crashed';
    record.status = status;
    record.child = null;
    emitExit(opts.projectPath, code, status);
    emitLog(opts.projectPath, 'launcher', `⏹ Process exited with code ${code ?? '?'}`);
  });

  return { ok: true, taskId: opts.projectPath };
}

export function stopMobileTask(projectPath: string): StopResult {
  const record = tasks.get(projectPath);
  if (!record?.child) return { ok: false, error: 'No active mobile task' };

  treeKill(record.child.pid!, 'SIGTERM', (err) => {
    if (err) emitLog(projectPath, 'launcher', `⚠ Stop error: ${err.message}`);
  });
  record.status = 'stopped';
  return { ok: true };
}

export function getMobileTaskStatus(projectPath: string): ServiceStatus {
  return tasks.get(projectPath)?.status ?? 'idle';
}

export function stopAllMobileSync(): void {
  for (const [, record] of tasks) {
    if (record.child?.pid) {
      try { treeKill(record.child.pid, 'SIGKILL'); } catch { /* ignore */ }
    }
  }
}
