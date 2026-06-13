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

function makeLineSplitter(onLine: (line: string) => void): { push: (chunk: Buffer) => void; flush: () => void } {
  let buf = '';
  return {
    push(chunk: Buffer) {
      buf += chunk.toString('utf8');
      // Split on CRLF, lone CR, or LF. Gradle / Flutter emit progress with carriage
      // returns (no newline); splitting only on '\n' buffered that output forever,
      // making a building app look frozen at "Launching ... in debug mode...".
      const parts = buf.split(/\r\n|\r|\n/);
      buf = parts.pop() ?? '';
      for (const line of parts) onLine(line);
    },
    flush() {
      if (buf) { onLine(buf); buf = ''; }
    },
  };
}

export type RunMobileTaskOptions = {
  taskKey: string;        // independent worker + terminal identity
  command: string;        // full shell command string
  displayCommand: string; // potentially redacted version for the log
  cwd: string;            // filesystem working directory (the real project path)
  env?: Record<string, string>;
  onComplete?: (code: number | null) => void;  // runs after the process exits
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

  const outSplit = makeLineSplitter((line) => emitLog(opts.taskKey, 'stdout', line));
  const errSplit = makeLineSplitter((line) => emitLog(opts.taskKey, 'stderr', line));
  child.stdout?.on('data', outSplit.push);
  child.stderr?.on('data', errSplit.push);

  child.on('error', (err) => {
    emitLog(opts.taskKey, 'launcher', `⚠ Process error: ${err.message}`);
  });

  child.on('close', (code) => {
    outSplit.flush();
    errSplit.flush();
    const status: ServiceStatus = code === 0 ? 'stopped' : 'crashed';
    record.status = status;
    record.child = null;
    emitExit(opts.taskKey, code, status);
    emitLog(opts.taskKey, 'launcher', `⏹ Process exited with code ${code ?? '?'}`);
    try { opts.onComplete?.(code); } catch (err) { emitLog(opts.taskKey, 'launcher', `⚠ Post-build step failed: ${String(err)}`); }
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
