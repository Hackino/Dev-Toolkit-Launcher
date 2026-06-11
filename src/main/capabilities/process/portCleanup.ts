import { execSync } from 'node:child_process';

export type PortKillResult = {
  killed: number[];
  errors: string[];
};

const isWindows = process.platform === 'win32';

// Find every process LISTENING on the given TCP port and force-kill it
// (along with its children). Cross-platform: uses netstat/taskkill on
// Windows and lsof/kill on macOS and Linux.
export function killPort(port: number): PortKillResult {
  if (!Number.isFinite(port) || port <= 0) {
    return { killed: [], errors: [`invalid port: ${port}`] };
  }

  return isWindows ? killPortWindows(port) : killPortUnix(port);
}

// --- Windows ---------------------------------------------------------------
//
// netstat output has subtly different column counts depending on locale and
// IPv6 entries, so we use a generous regex rather than splitting by index.
function killPortWindows(port: number): PortKillResult {
  const killed: number[] = [];
  const errors: string[] = [];

  let netstatOut: string;
  try {
    netstatOut = execSync('netstat -ano -p TCP', { encoding: 'utf8' });
  } catch (e) {
    return { killed, errors: [`netstat failed: ${(e as Error).message}`] };
  }

  const pids = new Set<number>();
  for (const line of netstatOut.split(/\r?\n/)) {
    // Match  "  TCP    0.0.0.0:5001    0.0.0.0:0    LISTENING    12345"
    // and the IPv6 variant "  TCP    [::]:5001    [::]:0    LISTENING    12345"
    const m = line.match(/^\s*TCP\s+\S+?:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    if (!m) continue;
    if (Number(m[1]) !== port) continue;
    pids.add(Number(m[2]));
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      killed.push(pid);
    } catch (e) {
      errors.push(`pid ${pid}: ${(e as Error).message}`);
    }
  }

  return { killed, errors };
}

// --- macOS / Linux ---------------------------------------------------------
//
// lsof reports one PID per line for sockets in the LISTEN state. We send
// SIGTERM first for a graceful shutdown, then SIGKILL anything still bound.
function killPortUnix(port: number): PortKillResult {
  const killed: number[] = [];
  const errors: string[] = [];

  const pids = listenerPids(port);
  if (pids.length === 0) return { killed, errors };

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ESRCH') errors.push(`pid ${pid} SIGTERM: ${err.message}`);
    }
  }

  // Give graceful shutdown a brief window, then force-kill survivors.
  try {
    execSync('sleep 0.3', { stdio: 'ignore' });
  } catch {
    /* sleep is best-effort */
  }
  const survivors = listenerPids(port);
  for (const pid of survivors) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ESRCH') errors.push(`pid ${pid} SIGKILL: ${err.message}`);
    }
  }

  for (const pid of pids) killed.push(pid);
  return { killed, errors };
}

function listenerPids(port: number): number[] {
  let out: string;
  try {
    // -t = terse (PIDs only), restricted to listening TCP sockets on this port.
    out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // lsof exits non-zero when nothing matches — treat as "no listeners".
    return [];
  }

  const pids = new Set<number>();
  for (const line of out.split(/\r?\n/)) {
    const pid = Number(line.trim());
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}
