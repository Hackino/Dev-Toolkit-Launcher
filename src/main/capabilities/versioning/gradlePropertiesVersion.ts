import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

export type GradlePropertiesVersionInfo = { version: string | null; versionCode: number | null };

function findGradleProperties(projectPath: string): string | null {
  const candidates = [
    join(projectPath, 'gradle.properties'),
    join(projectPath, 'gradle', 'gradle.properties'),
  ];
  return candidates.find(existsSync) ?? null;
}

export function readGradlePropertiesVersion(projectPath: string): GradlePropertiesVersionInfo {
  const file = findGradleProperties(projectPath);
  if (!file) return { version: null, versionCode: null };
  const content = readFileSync(file, 'utf8');
  const versionMatch = content.match(/^version\s*=\s*([^\s#\n]+)/m);
  const codeMatch = content.match(/^versionCode\s*=\s*(\d+)/m);
  return {
    version: versionMatch?.[1] ?? null,
    versionCode: codeMatch ? Number(codeMatch[1]) : null,
  };
}

export function writeGradlePropertiesVersion(
  projectPath: string,
  info: Partial<GradlePropertiesVersionInfo>,
): void {
  const file = findGradleProperties(projectPath);
  if (!file) throw new Error(`gradle.properties not found in ${projectPath}`);
  copyFileSync(file, `${file}.bak`);
  let content = readFileSync(file, 'utf8');
  if (info.version !== undefined && info.version !== null) {
    content = content.replace(/^(version\s*=\s*)[^\s#\n]+/m, `$1${info.version}`);
  }
  if (info.versionCode !== undefined && info.versionCode !== null) {
    content = content.replace(/^(versionCode\s*=\s*)\d+/m, `$1${info.versionCode}`);
  }
  writeFileSync(file, content, 'utf8');
}
