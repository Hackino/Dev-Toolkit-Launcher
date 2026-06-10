import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readdirSync } from 'node:fs';

export type IosVersionInfo = { shortVersion: string | null; bundleVersion: string | null };

function findInfoPlist(projectPath: string): string | null {
  // Common locations for Info.plist
  const candidates = [
    join(projectPath, 'Info.plist'),
    join(projectPath, 'ios', 'Info.plist'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Search ios/ subdirectory one level deep
  const iosDir = join(projectPath, 'ios');
  if (existsSync(iosDir)) {
    try {
      for (const entry of readdirSync(iosDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const candidate = join(iosDir, entry.name, 'Info.plist');
          if (existsSync(candidate)) return candidate;
        }
      }
    } catch { /* ignore */ }
  }
  return null;
}

function readKey(content: string, key: string): string | null {
  const re = new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`);
  return content.match(re)?.[1] ?? null;
}

function replaceKey(content: string, key: string, value: string): string {
  return content.replace(
    new RegExp(`(<key>${key}</key>\\s*<string>)[^<]+(</string>)`),
    `$1${value}$2`,
  );
}

export function readPlistVersion(projectPath: string): IosVersionInfo {
  const file = findInfoPlist(projectPath);
  if (!file) return { shortVersion: null, bundleVersion: null };
  const content = readFileSync(file, 'utf8');
  return {
    shortVersion: readKey(content, 'CFBundleShortVersionString'),
    bundleVersion: readKey(content, 'CFBundleVersion'),
  };
}

export function writePlistVersion(
  projectPath: string,
  info: Partial<IosVersionInfo>,
): void {
  const file = findInfoPlist(projectPath);
  if (!file) throw new Error(`Info.plist not found in ${projectPath}`);
  copyFileSync(file, `${file}.bak`);
  let content = readFileSync(file, 'utf8');
  if (info.shortVersion !== undefined && info.shortVersion !== null) {
    content = replaceKey(content, 'CFBundleShortVersionString', info.shortVersion);
  }
  if (info.bundleVersion !== undefined && info.bundleVersion !== null) {
    content = replaceKey(content, 'CFBundleVersion', info.bundleVersion);
  }
  writeFileSync(file, content, 'utf8');
}
