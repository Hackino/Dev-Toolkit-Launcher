/**
 * Mobile asset capability — autodetect, validate, and import the file-based
 * artifacts a mobile project needs: Firebase config files (google-services.json,
 * GoogleService-Info.plist) and Android keystores. Shared by the Android, iOS,
 * Flutter, React Native, and Compose Multiplatform features.
 */
import { existsSync, readFileSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, basename, dirname, relative, isAbsolute } from 'node:path';
import type { MobilePlatform } from '../../../shared/types';

export type AssetKind = 'firebase-android' | 'firebase-ios' | 'firebase-desktop' | 'keystore';

export type AssetValidation = {
  valid: boolean;
  detail?: string;     // projectId / alias / human summary
  error?: string;
};

export type DetectedAssets = {
  firebaseAndroid: string | null;   // project-relative paths
  firebaseIos: string | null;
  firebaseDesktop: string | null;
  keystores: string[];
};

export type ImportAssetResult =
  | { ok: true; relPath: string; detail?: string }
  | { ok: false; error: string };

const MAX_SCAN_DEPTH = 4;
const SKIP_DIRS = new Set(['node_modules', '.git', 'build', '.gradle', 'Pods', 'DerivedData', '.idea', 'dist', 'out']);

// ─── Filesystem scanning ───────────────────────────────────────────────────────

function walk(root: string, matcher: (name: string, full: string) => boolean, depth = 0, acc: string[] = []): string[] {
  if (depth > MAX_SCAN_DEPTH) return acc;
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const full = join(root, name);
    let isDir = false;
    try { isDir = statSync(full).isDirectory(); } catch { continue; }
    if (isDir) {
      if (SKIP_DIRS.has(name)) continue;
      walk(full, matcher, depth + 1, acc);
    } else if (matcher(name, full)) {
      acc.push(full);
    }
  }
  return acc;
}

function toRel(projectPath: string, full: string): string {
  const rel = relative(projectPath, full);
  return rel.startsWith('..') ? full : rel.split('\\').join('/');
}

// ─── Detection ─────────────────────────────────────────────────────────────────

// Known conventional locations for google-services.json across project shapes:
// modern KMP (composeApp/), older KMP (androidApp/), native Android (app/),
// and Flutter / React Native (android/app/).
const ANDROID_GS_CANDIDATES = [
  'composeApp/google-services.json',
  'androidApp/google-services.json',
  'app/google-services.json',
  'android/app/google-services.json',
  'composeApp/src/androidMain/google-services.json',
  'androidApp/src/main/google-services.json',
];

// Known locations for GoogleService-Info.plist: KMP (iosApp/, iosApp/iosApp/),
// Flutter (ios/Runner/), native / React Native (ios/).
const IOS_GS_CANDIDATES = [
  'iosApp/iosApp/GoogleService-Info.plist',
  'iosApp/GoogleService-Info.plist',
  'ios/Runner/GoogleService-Info.plist',
  'ios/GoogleService-Info.plist',
];

const DESKTOP_GS_CANDIDATES = [
  'desktopApp/google-services.json',
  'desktopApp/src/jvmMain/resources/google-services.json',
];

function firstExisting(projectPath: string, candidates: string[]): string | null {
  for (const rel of candidates) {
    if (existsSync(join(projectPath, rel))) return rel.split('\\').join('/');
  }
  return null;
}

export function detectAssets(projectPath: string, _platform: MobilePlatform): DetectedAssets {
  // 1) Check known conventional locations first — this reliably classifies
  //    KMP (composeApp/) vs desktop, which a generic scan cannot.
  let firebaseAndroid = firstExisting(projectPath, ANDROID_GS_CANDIDATES);
  let firebaseIos = firstExisting(projectPath, IOS_GS_CANDIDATES);
  let firebaseDesktop = firstExisting(projectPath, DESKTOP_GS_CANDIDATES);

  // 2) Fall back to a recursive scan for anything still unresolved.
  if (!firebaseAndroid || !firebaseIos || !firebaseDesktop) {
    const androidMatches = walk(projectPath, (n) => n === 'google-services.json');
    const iosMatches = walk(projectPath, (n) => n === 'GoogleService-Info.plist');
    // Desktop only when the path clearly belongs to a desktop/JVM module.
    const isDesktop = (full: string) => /desktopapp|[/\\]desktop[/\\]|jvmmain/i.test(full);

    if (!firebaseDesktop) {
      const m = androidMatches.find(isDesktop);
      if (m) firebaseDesktop = toRel(projectPath, m);
    }
    if (!firebaseAndroid) {
      const m = androidMatches.find((p) => !isDesktop(p));
      if (m) firebaseAndroid = toRel(projectPath, m);
    }
    if (!firebaseIos && iosMatches[0]) firebaseIos = toRel(projectPath, iosMatches[0]);
  }

  const keystores = walk(projectPath, (n) => /\.(jks|keystore)$/i.test(n));

  return {
    firebaseAndroid,
    firebaseIos,
    firebaseDesktop,
    keystores: keystores.map((p) => toRel(projectPath, p)),
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────────

function resolveAbs(projectPath: string, p: string): string {
  return isAbsolute(p) ? p : join(projectPath, p);
}

export function validateFirebaseJson(absPath: string): AssetValidation {
  try {
    const raw = readFileSync(absPath, 'utf8').replace(/^﻿/, ''); // tolerate UTF-8 BOM
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const projectInfo = parsed.project_info as Record<string, unknown> | undefined;
    const clients = parsed.client as unknown[] | undefined;
    if (!projectInfo || !Array.isArray(clients)) {
      return { valid: false, error: 'Not a valid google-services.json (missing project_info/client).' };
    }
    const projectId = (projectInfo.project_id as string) ?? '(unknown)';
    return { valid: true, detail: `project: ${projectId}` };
  } catch (err) {
    if (err instanceof SyntaxError) return { valid: false, error: 'Invalid JSON.' };
    return { valid: false, error: (err as Error).message };
  }
}

export function validateFirebasePlist(absPath: string): AssetValidation {
  try {
    const raw = readFileSync(absPath, 'utf8').replace(/^﻿/, ''); // tolerate UTF-8 BOM
    if (!raw.includes('<plist') && !raw.includes('bplist')) {
      return { valid: false, error: 'Not a property-list file.' };
    }
    if (!/PROJECT_ID|BUNDLE_ID|GOOGLE_APP_ID/.test(raw)) {
      return { valid: false, error: 'Missing Firebase keys (PROJECT_ID / GOOGLE_APP_ID).' };
    }
    const m = raw.match(/<key>PROJECT_ID<\/key>\s*<string>([^<]+)<\/string>/);
    return { valid: true, detail: m ? `project: ${m[1]}` : 'GoogleService-Info.plist' };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

export function validateKeystore(absPath: string): AssetValidation {
  try {
    if (!existsSync(absPath)) return { valid: false, error: 'File not found.' };
    if (!/\.(jks|keystore|p12|pfx)$/i.test(absPath)) {
      return { valid: false, error: 'Expected a .jks / .keystore / .p12 file.' };
    }
    const fd = readFileSync(absPath);
    // JKS magic 0xFEEDFEED; PKCS#12 starts with a DER SEQUENCE 0x30.
    const isJks = fd.length >= 4 && fd[0] === 0xfe && fd[1] === 0xed && fd[2] === 0xfe && fd[3] === 0xed;
    const isP12 = fd.length >= 1 && fd[0] === 0x30;
    if (!isJks && !isP12) {
      return { valid: false, error: 'File does not look like a Java/PKCS#12 keystore.' };
    }
    return { valid: true, detail: isJks ? 'JKS keystore' : 'PKCS#12 keystore' };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

export function validateAsset(projectPath: string, relOrAbsPath: string, kind: AssetKind): AssetValidation {
  const abs = resolveAbs(projectPath, relOrAbsPath);
  switch (kind) {
    case 'firebase-android':
    case 'firebase-desktop':
      return validateFirebaseJson(abs);
    case 'firebase-ios':
      return validateFirebasePlist(abs);
    case 'keystore':
      return validateKeystore(abs);
  }
}

// ─── Import (validate + copy into the conventional location) ─────────────────────

function destinationFor(projectPath: string, kind: AssetKind, platform: MobilePlatform, srcName: string): string {
  switch (kind) {
    case 'firebase-android': {
      // Flutter / React Native keep Android under android/. Native Android uses app/.
      const flutterLike = existsSync(join(projectPath, 'android', 'app'));
      return flutterLike ? join('android', 'app', 'google-services.json') : join('app', 'google-services.json');
    }
    case 'firebase-ios': {
      const runner = existsSync(join(projectPath, 'ios', 'Runner'));
      if (runner) return join('ios', 'Runner', 'GoogleService-Info.plist');
      if (existsSync(join(projectPath, 'ios'))) return join('ios', 'GoogleService-Info.plist');
      return 'GoogleService-Info.plist';
    }
    case 'firebase-desktop':
      return join('desktopApp', 'google-services.json');
    case 'keystore':
      // Keep the original filename at the project root.
      return basename(srcName);
  }
}

export function importAsset(
  projectPath: string,
  srcPath: string,
  kind: AssetKind,
  platform: MobilePlatform,
): ImportAssetResult {
  try {
    if (!existsSync(srcPath)) return { ok: false, error: 'Dropped file no longer exists.' };
    const validation = validateAsset(projectPath, srcPath, kind);
    if (!validation.valid) return { ok: false, error: validation.error ?? 'Validation failed.' };

    const destRel = destinationFor(projectPath, kind, platform, srcPath);
    const destAbs = join(projectPath, destRel);

    // Only copy when the source isn't already at the destination.
    if (resolveAbs(projectPath, srcPath) !== destAbs) {
      mkdirSync(dirname(destAbs), { recursive: true });
      copyFileSync(srcPath, destAbs);
    }
    return { ok: true, relPath: destRel.split('\\').join('/'), detail: validation.detail };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
