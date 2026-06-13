/**
 * Mobile build artifact handling — after a build/bundle/archive completes, find
 * the freshly produced .apk/.aab/.ipa in the toolchain's output dirs and copy it
 * into a single, predictable `<projectRoot>/output/` folder.
 */
import { existsSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { OutputArtifact } from '../../../shared/types';

export type ArtifactPlatform = 'android' | 'ios';

const ARTIFACT_RE: Record<ArtifactPlatform, RegExp> = {
  android: /\.(apk|aab)$/i,
  ios: /\.ipa$/i,
};

// Toolchain build dirs to scan (relative to the project root), covering native
// Android, Flutter, React Native, and KMP layouts.
const BUILD_DIRS = [
  'build',
  'app/build',
  'android/app/build',
  'android/build',
  'composeApp/build',
  'shared/build',
  'ios/build',
];

const OUTPUT_DIR = 'output';
const MAX_DEPTH = 10;

function findArtifacts(dir: string, re: RegExp, since: number, depth = 0, acc: string[] = []): string[] {
  if (depth > MAX_DEPTH) return acc;
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      findArtifacts(full, re, since, depth + 1, acc);
    } else if (re.test(name) && st.mtimeMs >= since) {
      acc.push(full);
    }
  }
  return acc;
}

/** Artifacts of the given platform produced at/after `since` (a build start time). */
export function collectBuiltArtifacts(projectPath: string, platform: ArtifactPlatform, since: number): string[] {
  const re = ARTIFACT_RE[platform];
  const found = new Set<string>();
  for (const rel of BUILD_DIRS) {
    const base = join(projectPath, rel);
    if (base.endsWith(OUTPUT_DIR)) continue;
    if (existsSync(base)) for (const f of findArtifacts(base, re, since)) found.add(f);
  }
  return [...found];
}

/** Copy artifacts into `<projectRoot>/output/`; returns the destination paths. */
export function copyArtifactsToOutput(projectPath: string, artifacts: string[]): string[] {
  if (artifacts.length === 0) return [];
  const outDir = join(projectPath, OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });
  const copied: string[] = [];
  for (const src of artifacts) {
    const dest = join(outDir, basename(src));
    try {
      if (src !== dest) copyFileSync(src, dest);
      copied.push(dest);
    } catch { /* ignore individual copy failures */ }
  }
  return copied;
}

/** Collect freshly-built artifacts and copy them into output/ in one step. */
export function harvestToOutput(projectPath: string, platform: ArtifactPlatform, since: number): string[] {
  return copyArtifactsToOutput(projectPath, collectBuiltArtifacts(projectPath, platform, since));
}

/** List artifacts already sitting in `<projectRoot>/output/`, filtered by extension. */
export function listOutputArtifacts(projectPath: string, exts: string[]): OutputArtifact[] {
  const outDir = join(projectPath, OUTPUT_DIR);
  if (!existsSync(outDir)) return [];
  const re = new RegExp(`\\.(${exts.map((e) => e.replace(/^\./, '')).join('|')})$`, 'i');
  const rows: (OutputArtifact & { mtime: number })[] = [];
  try {
    for (const name of readdirSync(outDir)) {
      if (!re.test(name)) continue;
      const full = join(outDir, name);
      try {
        const st = statSync(full);
        if (st.isFile()) rows.push({ name, path: full, sizeBytes: st.size, mtime: st.mtimeMs });
      } catch { /* skip */ }
    }
  } catch { /* output/ unreadable */ }
  rows.sort((a, b) => b.mtime - a.mtime);
  return rows.map(({ name, path, sizeBytes }) => ({ name, path, sizeBytes }));
}
