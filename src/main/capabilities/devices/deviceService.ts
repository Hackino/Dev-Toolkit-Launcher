import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { MobileDevice } from '../../../shared/types';

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 8000;

export async function listAndroidDevices(): Promise<MobileDevice[]> {
  try {
    const { stdout } = await execFileAsync('adb', ['devices', '-l'], { timeout: TIMEOUT_MS });
    const devices: MobileDevice[] = [];
    for (const line of stdout.split('\n').slice(1)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('*')) continue;
      const parts = trimmed.split(/\s+/);
      const id = parts[0];
      const state = parts[1] ?? 'unknown';
      if (!id) continue;
      const modelMatch = trimmed.match(/model:(\S+)/);
      const productMatch = trimmed.match(/product:(\S+)/);
      const name = modelMatch?.[1] ?? productMatch?.[1] ?? id;
      const kind: MobileDevice['kind'] = id.startsWith('emulator') ? 'emulator' : 'device';
      devices.push({ id, name, platform: 'android', kind, state });
    }
    return devices;
  } catch {
    return [];
  }
}

export async function listAndroidEmulators(): Promise<MobileDevice[]> {
  try {
    const { stdout } = await execFileAsync('emulator', ['-list-avds'], { timeout: TIMEOUT_MS });
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((avd) => ({
        id: avd,
        name: avd.replace(/_/g, ' '),
        platform: 'android' as const,
        kind: 'emulator' as const,
        state: 'available',
      }));
  } catch {
    return [];
  }
}

export async function listIosDevices(): Promise<MobileDevice[]> {
  if (process.platform !== 'darwin') return [];
  try {
    const { stdout } = await execFileAsync(
      'xcrun',
      ['xctrace', 'list', 'devices'],
      { timeout: TIMEOUT_MS },
    );
    const devices: MobileDevice[] = [];
    for (const line of stdout.split('\n')) {
      const match = line.match(/^(.+?)\s+\(([^)]+)\)\s+\(([^)]+)\)/);
      if (!match) continue;
      const [, name, _version, id] = match;
      if (!id || id.includes('simulator') || id.toLowerCase().includes('sim')) continue;
      devices.push({ id, name: name.trim(), platform: 'ios', kind: 'device', state: 'available' });
    }
    return devices;
  } catch {
    return [];
  }
}

export async function listIosSimulators(): Promise<MobileDevice[]> {
  if (process.platform !== 'darwin') return [];
  try {
    const { stdout } = await execFileAsync(
      'xcrun',
      ['simctl', 'list', 'devices', '--json'],
      { timeout: TIMEOUT_MS },
    );
    const json = JSON.parse(stdout) as { devices: Record<string, { udid: string; name: string; state: string }[]> };
    const result: MobileDevice[] = [];
    for (const [, sims] of Object.entries(json.devices)) {
      for (const sim of sims) {
        if (!sim.udid) continue;
        result.push({
          id: sim.udid,
          name: sim.name,
          platform: 'ios',
          kind: 'emulator',
          state: sim.state.toLowerCase(),
        });
      }
    }
    return result;
  } catch {
    return [];
  }
}

export async function listFlutterDevices(): Promise<MobileDevice[]> {
  try {
    const { stdout } = await execFileAsync('flutter', ['devices', '--machine'], { timeout: TIMEOUT_MS });
    const json = JSON.parse(stdout) as { id: string; name: string; targetPlatform: string; isDevice: boolean }[];
    return json.map((d) => ({
      id: d.id,
      name: d.name,
      platform: 'flutter' as const,
      kind: d.isDevice ? 'device' : 'emulator',
      state: 'available',
    }));
  } catch {
    return [];
  }
}
