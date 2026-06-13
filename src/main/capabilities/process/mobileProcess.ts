import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import treeKill from 'tree-kill';
import type { BrowserWindow } from 'electron';
import type { ServiceStatus, StopResult } from '../../../shared/types';

export type MobileTaskRecord = {
  child: ChildProcess | null;
  taskKey: string;
  status: ServiceStatus;
  pid: number | null;
};

// Keyed by taskKey — the independent worker identity. For multi-platform projects
// each platform target gets its own key, so platforms never interfere.
const tasks = new Map<string, MobileTaskRecord>();

let _window: BrowserWindow | null = null;

export function attachMobileToWindow(win: BrowserWindow): void {
  _window = win;
}

// The log/exit events route to a terminal by their `projectPath` field; for mobile
// we put the taskKey there so each worker streams to its own terminal.
function emitLog(taskKey: string, stream: 'stdout' | 'stderr' | 'launcher', line: string): void {
  _window?.webContents.send('service:log', {
    projectPath: taskKey,
    stream,
    line,
    ts: Date.now(),
  });
}

function emitExit(taskKey: string, code: number | null, status: ServiceStatus): void {
  _window?.webContents.send('service:exit', {
    projectPath: taskKey,
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
  taskKey: string;        // independent worker + terminal identity
  command: string;        // full shell command string
  displayCommand: string; // potentially redacted version for the log
  cwd: string;            // filesystem working directory (the real project path)
  env?: Record<string, string>;
};

export function runMobileTask(opts: RunMobileTaskOptions): { ok: true; taskId: string } | { ok: false; error: string } {
  // Stop only the task for THIS key (this platform target), never siblings.
  const existing = tasks.get(opts.taskKey);
  if (existing?.child && existing.status === 'running') {
    treeKill(existing.child.pid!, 'SIGTERM');
  }

  const record: MobileTaskRecord = {
    child: null,
    taskKey: opts.taskKey,
    status: 'starting',
    pid: null,
  };
  tasks.set(opts.taskKey, record);

  emitLog(opts.taskKey, 'launcher', `▶ ${opts.displayCommand}`);

  let child: ChildProcess;
  try {
    child = spawn(opts.command, [], {
      cwd: opts.cwd,
      shell: true,
      env: { ...process.env, ...opts.env },
    });
  } catch (err) {
    tasks.delete(opts.taskKey);
    emitLog(opts.taskKey, 'launcher', `⚠ Failed to start: ${String(err)}`);
    emitExit(opts.taskKey, -1, 'crashed');
    return { ok: false, error: String(err) };
  }

  record.child = child;
  record.pid = child.pid ?? null;
  record.status = 'running';

  child.stdout?.on('data', makeLineSplitter((line) => emitLog(opts.taskKey, 'stdout', line)));
  child.stderr?.on('data', makeLineSplitter((line) => emitLog(opts.taskKey, 'stderr', line)));

  child.on('error', (err) => {
    emitLog(opts.taskKey, 'launcher', `⚠ Process error: ${err.message}`);
  });

  child.on('close', (code) => {
    const status: ServiceStatus = code === 0 ? 'stopped' : 'crashed';
    record.status = status;
    record.child = null;
    emitExit(opts.taskKey, code, status);
    emitLog(opts.taskKey, 'launcher', `⏹ Process exited with code ${code ?? '?'}`);
  });

  return { ok: true, taskId: opts.taskKey };
}

/** Write to the stdin of a running task (e.g. Flutter hot reload 'r' / restart 'R'). */
export function sendMobileTaskInput(taskKey: string, input: string): { ok: boolean; error?: string } {
  const record = tasks.get(taskKey);
  if (!record?.child || record.status !== 'running') {
    return { ok: false, error: 'No running task to send input to.' };
  }
  try {
    record.child.stdin?.write(input);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function stopMobileTask(taskKey: string): StopResult {
  const record = tasks.get(taskKey);
  if (!record?.child) return { ok: false, error: 'No active mobile task' };

  treeKill(record.child.pid!, 'SIGTERM', (err) => {
    if (err) emitLog(taskKey, 'launcher', `⚠ Stop error: ${err.message}`);
  });
  record.status = 'stopped';
  return { ok: true };
}

export function getMobileTaskStatus(taskKey: string): ServiceStatus {
  return tasks.get(taskKey)?.status ?? 'idle';
}

export function stopAllMobileSync(): void {
  for (const [, record] of tasks) {
    if (record.child?.pid) {
      try { treeKill(record.child.pid, 'SIGKILL'); } catch { /* ignore */ }
    }
  }
}
