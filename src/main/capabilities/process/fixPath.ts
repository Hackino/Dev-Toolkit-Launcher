/**
 * macOS/Linux GUI apps launched from Finder/Dock inherit a minimal PATH that
 * excludes Homebrew, the Android SDK platform-tools (adb), Flutter, etc. — so
 * spawned tooling silently fails ("no devices", "command not found"). This loads
 * the user's real login-shell PATH and augments it with common SDK locations,
 * plus sets ANDROID_HOME when a standard SDK is found.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

function loginShellPath(): string | null {
  if (process.platform === 'win32') return null;
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    // -ilc → interactive login shell so the user's profile (PATH exports) load.
    const out = execSync(`${shell} -ilc 'echo -n __PATH__:"$PATH"' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 5000,
    });
    const m = out.match(/__PATH__:(.+)/);
    const value = m?.[1]?.trim();
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function detectAndroidSdk(): string | null {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(homedir(), 'Library', 'Android', 'sdk'), // macOS default
    join(homedir(), 'Android', 'Sdk'), // Linux default
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function fixPath(): void {
  if (process.platform === 'win32') return; // Windows GUI apps inherit PATH fine.

  // 1) Adopt the login-shell PATH when we can read it.
  const shellPath = loginShellPath();
  if (shellPath) process.env.PATH = shellPath;

  // 2) Make sure the Android SDK tooling + common bin dirs are present regardless.
  const sdk = detectAndroidSdk();
  if (sdk && !process.env.ANDROID_HOME) process.env.ANDROID_HOME = sdk;
  if (sdk && !process.env.ANDROID_SDK_ROOT) process.env.ANDROID_SDK_ROOT = sdk;

  const extra = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    join(homedir(), 'flutter', 'bin'),
    join(homedir(), 'development', 'flutter', 'bin'),
    join(homedir(), 'fvm', 'default', 'bin'),
  ];
  if (sdk) {
    extra.unshift(
      join(sdk, 'platform-tools'),
      join(sdk, 'emulator'),
      join(sdk, 'cmdline-tools', 'latest', 'bin'),
      join(sdk, 'tools', 'bin'),
    );
  }

  const parts = (process.env.PATH || '').split(':').filter(Boolean);
  for (const dir of extra) {
    if (existsSync(dir) && !parts.includes(dir)) parts.push(dir);
  }
  process.env.PATH = parts.join(':');
}
