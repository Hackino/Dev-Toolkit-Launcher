import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

export type FlutterVersionInfo = { version: string | null };

export function readPubspecVersion(projectPath: string): FlutterVersionInfo {
  const file = join(projectPath, 'pubspec.yaml');
  if (!existsSync(file)) return { version: null };
  const content = readFileSync(file, 'utf8');
  const match = content.match(/^version:\s*([^\s#\n]+)/m);
  return { version: match?.[1] ?? null };
}

export function writePubspecVersion(
  projectPath: string,
  info: Partial<FlutterVersionInfo>,
): void {
  const file = join(projectPath, 'pubspec.yaml');
  if (!existsSync(file)) throw new Error(`pubspec.yaml not found in ${projectPath}`);
  if (!info.version) return;
  copyFileSync(file, `${file}.bak`);
  const content = readFileSync(file, 'utf8');
  const updated = content.replace(/^(version:\s*)[^\s#\n]+/m, `$1${info.version}`);
  writeFileSync(file, updated, 'utf8');
}
