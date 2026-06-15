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

// Directories that hold non-deliverable, intermediate build products. The Android
// Gradle Plugin drops an `intermediary-bundle.aab` under `intermediates/` during a
// plain `assemble*` (APK) build — harvesting it made a normal Build look like it
// produced a bundle. Final, installable artifacts always live under `outputs/`.
const SKIP_DIRS = new Set(['intermediates', 'tmp', 'kotlin', 'generated', '.transforms']);

/** Build a regex matching files with any of the given extensions (no leading dot). */
function extsRegex(exts: string[]): RegExp {
  return new RegExp(`\\.(${exts.map((e) => e.replace(/^\./, '')).join('|')})$`, 'i');
}

type ArtifactHit = { path: string; mtime: number };

function findArtifacts(dir: string, re: RegExp, depth = 0, acc: ArtifactHit[] = []): ArtifactHit[] {
  if (depth > MAX_DEPTH) return acc;
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      findArtifacts(full, re, depth + 1, acc);
    } else if (re.test(name)) {
      acc.push({ path: full, mtime: st.mtimeMs });
    }
  }
  return acc;
}

/**
 * Artifacts of the given platform for the just-finished build. `exts` narrows the
 * match to a specific deliverable kind (['apk'] for a Build, ['aab'] for a
 * Bundle/release) so a Build never harvests a stray .aab and vice-versa.
 *
 * Prefers artifacts produced at/after `since` (the build start). If none are fresh —
 * which happens when Gradle reports the task UP-TO-DATE and never rewrites the
 * output — it falls back to the single newest match so the artifact still lands in
 * output/ instead of silently producing nothing.
 */
export function collectBuiltArtifacts(
  projectPath: string,
  platform: ArtifactPlatform,
  since: number,
  exts?: string[],
): string[] {
  const re = exts && exts.length ? extsRegex(exts) : ARTIFACT_RE[platform];
  const byPath = new Map<string, number>();
  for (const rel of BUILD_DIRS) {
    const base = join(projectPath, rel);
    if (base.endsWith(OUTPUT_DIR)) continue;
    if (existsSync(base)) for (const hit of findArtifacts(base, re)) byPath.set(hit.path, hit.mtime);
  }
  const hits = [...byPath.entries()].map(([path, mtime]) => ({ path, mtime }));
  if (hits.length === 0) return [];

  const fresh = hits.filter((h) => h.mtime >= since);
  if (fresh.length) return fresh.map((h) => h.path);

  // Nothing fresh — Gradle was UP-TO-DATE. Surface the newest existing artifact.
  const newest = hits.reduce((a, b) => (b.mtime > a.mtime ? b : a));
  return [newest.path];
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
export function harvestToOutput(
  projectPath: string,
  platform: ArtifactPlatform,
  since: number,
  exts?: string[],
): string[] {
  return copyArtifactsToOutput(projectPath, collectBuiltArtifacts(projectPath, platform, since, exts));
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
