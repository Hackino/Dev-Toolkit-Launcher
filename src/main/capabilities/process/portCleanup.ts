import { execSync } from 'node:child_process';

export type PortKillResult = {
  killed: number[];
  errors: string[];
};

// Windows-only: find any process currently LISTENING on the given TCP port
// and force-kill it (with /T to also kill its children).
//
// Implementation note: netstat output has subtly different column counts
// depending on locale and IPv6 entries, so we use a generous regex rather
// than splitting on whitespace by index.
export function killPort(port: number): PortKillResult {
  if (!Number.isFinite(port) || port <= 0) {
    return { killed: [], errors: [`invalid port: ${port}`] };
  }

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
