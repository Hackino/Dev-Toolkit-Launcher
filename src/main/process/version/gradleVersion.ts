import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

export type AndroidVersionInfo = { versionName: string | null; versionCode: number | null };

function findBuildGradle(projectPath: string, module = 'app'): string | null {
  const candidates = [
    join(projectPath, module, 'build.gradle.kts'),
    join(projectPath, module, 'build.gradle'),
  ];
  return candidates.find(existsSync) ?? null;
}

export function readGradleVersion(projectPath: string, module = 'app'): AndroidVersionInfo {
  const file = findBuildGradle(projectPath, module);
  if (!file) return { versionName: null, versionCode: null };

  const content = readFileSync(file, 'utf8');
  const nameMatch = content.match(/versionName\s*[=:]\s*["']([^"']+)["']/);
  const codeMatch = content.match(/versionCode\s*[=:]\s*(\d+)/);

  return {
    versionName: nameMatch?.[1] ?? null,
    versionCode: codeMatch ? Number(codeMatch[1]) : null,
  };
}

export function writeGradleVersion(
  projectPath: string,
  info: Partial<AndroidVersionInfo>,
  module = 'app',
): void {
  const file = findBuildGradle(projectPath, module);
  if (!file) throw new Error(`build.gradle not found in ${join(projectPath, module)}`);

  copyFileSync(file, `${file}.bak`);
  let content = readFileSync(file, 'utf8');

  if (info.versionName !== undefined && info.versionName !== null) {
    content = content.replace(
      /(versionName\s*[=:]\s*)["']([^"']+)["']/,
      `$1"${info.versionName}"`,
    );
  }
  if (info.versionCode !== undefined && info.versionCode !== null) {
    content = content.replace(
      /(versionCode\s*[=:]\s*)\d+/,
      `$1${info.versionCode}`,
    );
  }
  writeFileSync(file, content, 'utf8');
}
