/**
 * Project introspection — detects the values a mobile project already declares so
 * the settings UI can offer them as dropdowns instead of free text: Gradle
 * modules, application IDs, iOS bundle IDs, and Android signing configs.
 */
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type {
  MobilePlatform,
  MobileIntrospection,
  SigningConfigInfo,
  KmpTarget,
  AndroidBuildTypeInfo,
} from '../../../shared/types';
import {
  readIfExists,
  extractBlock,
  findAndroidRoot,
  findModuleGradleFile,
  findIosRoot,
} from './variantDetection';

function uniq(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

// ─── Gradle modules (settings.gradle) ──────────────────────────────────────────

function parseGradleModules(projectPath: string): string[] {
  const root = findAndroidRoot(projectPath) ?? projectPath;
  const source =
    readIfExists(join(root, 'settings.gradle.kts')) ?? readIfExists(join(root, 'settings.gradle'));
  if (!source) return [];
  const modules: string[] = [];
  // include(":app", ":core")  |  include ':app'
  const re = /include\s*\(?\s*((?:["'][^"']+["']\s*,?\s*)+)\)?/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const quoted = m[1].match(/["']([^"']+)["']/g) ?? [];
    for (const q of quoted) {
      const name = q.replace(/["']/g, '').replace(/^:/, '').split(':').pop();
      if (name) modules.push(name);
    }
  }
  return uniq(modules);
}

// ─── Application modules (com.android.application only) ─────────────────────────

// Matches the Android application plugin, including version-catalog aliases.
const APP_PLUGIN_RE = /com\.android\.application|(?:libs\.plugins\.)?android[.A-Za-z]*[Aa]pplication/;
// A library module never declares an applicationId; an app module always does.
const APPLICATION_ID_RE = /\bapplicationId\s*=?\s*["']/;
const LIBRARY_PLUGIN_RE = /com\.android\.library|(?:libs\.plugins\.)?android[.A-Za-z]*[Ll]ibrary/;

/** Resolve a module's build.gradle by its Gradle path ("app" or "features:app"). */
function moduleGradleSource(root: string, gradlePath: string): string | null {
  const dir = join(root, ...gradlePath.split(':'));
  return readIfExists(join(dir, 'build.gradle.kts')) ?? readIfExists(join(dir, 'build.gradle'));
}

function isApplicationSource(source: string): boolean {
  if (LIBRARY_PLUGIN_RE.test(source) && !APP_PLUGIN_RE.test(source)) return false;
  return APP_PLUGIN_RE.test(source) || APPLICATION_ID_RE.test(source);
}

/** Full Gradle module paths from settings.gradle (":features:app" → "features:app"). */
function parseGradleModulePaths(root: string): string[] {
  const source =
    readIfExists(join(root, 'settings.gradle.kts')) ?? readIfExists(join(root, 'settings.gradle'));
  if (!source) return [];
  const paths: string[] = [];
  const re = /include\s*\(?\s*((?:["'][^"']+["']\s*,?\s*)+)\)?/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const quoted = m[1].match(/["']([^"']+)["']/g) ?? [];
    for (const q of quoted) {
      const raw = q.replace(/["']/g, '').replace(/^:/, '');
      if (raw) paths.push(raw);
    }
  }
  return uniq(paths);
}

/** Gradle modules that are Android application modules (excludes libraries). */
function parseApplicationModules(projectPath: string): string[] {
  const root = findAndroidRoot(projectPath) ?? projectPath;
  const paths = parseGradleModulePaths(root);
  const apps: string[] = [];
  for (const p of paths) {
    const source = moduleGradleSource(root, p);
    if (source && isApplicationSource(source)) apps.push(p.split(':').pop() ?? p);
  }
  // Fall back to the full module list only if nothing could be classified.
  return apps.length > 0 ? uniq(apps) : parseGradleModules(projectPath);
}

// ─── Application IDs (build.gradle) ─────────────────────────────────────────────

function parseApplicationIds(projectPath: string, module: string): string[] {
  const gradleFile = findModuleGradleFile(projectPath, module);
  const source = gradleFile ? readIfExists(gradleFile) : null;
  if (!source) return [];

  const ids: string[] = [];
  const baseMatch = source.match(/applicationId\s*=?\s*["']([^"']+)["']/);
  const base = baseMatch?.[1] ?? null;
  if (base) ids.push(base);

  // Flavor-specific applicationId / applicationIdSuffix
  const flavorsBody = extractBlock(extractBlock(source, 'android') ?? source, 'productFlavors');
  if (flavorsBody) {
    const idRe = /applicationId\s*=?\s*["']([^"']+)["']/g;
    for (let m = idRe.exec(flavorsBody); m; m = idRe.exec(flavorsBody)) ids.push(m[1]);
    if (base) {
      const suffixRe = /applicationIdSuffix\s*=?\s*["']([^"']+)["']/g;
      for (let m = suffixRe.exec(flavorsBody); m; m = suffixRe.exec(flavorsBody)) {
        ids.push(`${base}${m[1].startsWith('.') ? '' : '.'}${m[1]}`);
      }
    }
  }
  return uniq(ids);
}

// ─── iOS bundle IDs (pbxproj) ───────────────────────────────────────────────────

function parseBundleIds(projectPath: string): string[] {
  const iosRoot = findIosRoot(projectPath);
  if (!iosRoot) return [];
  const ids: string[] = [];
  try {
    for (const entry of readdirSync(iosRoot)) {
      if (!entry.endsWith('.xcodeproj')) continue;
      const pbx = readIfExists(join(iosRoot, entry, 'project.pbxproj'));
      if (!pbx) continue;
      const re = /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*"?([^";]+)"?;/g;
      for (let m = re.exec(pbx); m; m = re.exec(pbx)) {
        const id = m[1].trim();
        // Skip Xcode variable placeholders / test targets.
        if (!id.includes('$') && !/\.(Tests|UITests)$/.test(id)) ids.push(id);
      }
    }
  } catch {
    /* ignore */
  }
  return uniq(ids);
}

// ─── Android signing configs (build.gradle) ─────────────────────────────────────

/** Detect an env-var or gradle-property reference for a password field. */
function passwordRef(raw: string): string | null {
  const env = raw.match(/System\.getenv\(\s*["']([^"']+)["']\s*\)/);
  if (env) return env[1];
  const prop = raw.match(/(?:project\.)?(?:findProperty|property)\(\s*["']([^"']+)["']\s*\)/);
  if (prop) return prop[1];
  const bracket = raw.match(/properties\[\s*["']([^"']+)["']\s*\]/);
  if (bracket) return bracket[1];
  return null;
}

function parseSigningConfigs(projectPath: string, module: string): SigningConfigInfo[] {
  const gradleFile = findModuleGradleFile(projectPath, module);
  const source = gradleFile ? readIfExists(gradleFile) : null;
  if (!source) return [];
  const android = extractBlock(source, 'android') ?? source;
  const signingBody = extractBlock(android, 'signingConfigs');
  if (!signingBody) return [];

  const configs: SigningConfigInfo[] = [];
  // Each child block: `release { … }` or `create("release") { … }`.
  const childRe = /(?:create\s*\(\s*["']([A-Za-z0-9_]+)["']\s*\)|([A-Za-z_][A-Za-z0-9_]*))\s*\{/g;
  for (let m = childRe.exec(signingBody); m; m = childRe.exec(signingBody)) {
    const name = m[1] ?? m[2];
    if (!name || ['getByName', 'maybeCreate'].includes(name)) continue;
    const body = extractBlock(signingBody.slice(m.index), name) ?? '';
    const storeFile = body.match(/storeFile\s+file\(\s*["']([^"']+)["']/)?.[1]
      ?? body.match(/storeFile\s*=\s*file\(\s*["']([^"']+)["']/)?.[1]
      ?? null;
    const keyAlias = body.match(/keyAlias\s*=?\s*["']([^"']+)["']/)?.[1] ?? null;
    const storePwLine = body.match(/storePassword[^\n]*/)?.[0] ?? '';
    const keyPwLine = body.match(/keyPassword[^\n]*/)?.[0] ?? '';
    configs.push({
      name,
      storeFile,
      keyAlias,
      storePasswordEnv: passwordRef(storePwLine),
      keyPasswordEnv: passwordRef(keyPwLine),
    });
  }
  return configs;
}

// ─── Android build types (per-buildType settings) ───────────────────────────────

/** Extract the balanced `{ … }` body that begins at the given `{` index. */
function bodyFromBrace(source: string, braceIdx: number): string {
  let depth = 0;
  for (let i = braceIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(braceIdx + 1, i);
    }
  }
  return '';
}

function buildTypeInfoFrom(name: string, body: string): AndroidBuildTypeInfo {
  const truthy = (re: RegExp) => re.test(body);
  const debuggable = truthy(/\b(?:isDebuggable\s*=\s*true|debuggable\s+true)\b/)
    ? true
    : truthy(/\b(?:isDebuggable\s*=\s*false|debuggable\s+false)\b/)
      ? false
      : name.toLowerCase() === 'debug';
  const minifyEnabled = truthy(/\b(?:isMinifyEnabled\s*=\s*true|minifyEnabled\s+true)\b/);
  const sc =
    body.match(/signingConfig\s*=?\s*signingConfigs\s*\.\s*getByName\s*\(\s*["']([^"']+)["']\s*\)/)?.[1] ??
    body.match(/signingConfig\s*=?\s*signingConfigs\s*\.\s*([A-Za-z0-9_]+)/)?.[1] ??
    null;
  const proguardFiles = uniq(
    (body.match(/["']([^"']+\.(?:pro|txt))["']/g) ?? []).map((s) => s.replace(/["']/g, '')),
  );
  return { name, debuggable, minifyEnabled, signingConfig: sc, proguardFiles };
}

function parseBuildTypes(projectPath: string, module: string): AndroidBuildTypeInfo[] {
  const gradleFile = findModuleGradleFile(projectPath, module);
  const source = gradleFile ? readIfExists(gradleFile) : null;
  const result: AndroidBuildTypeInfo[] = [];
  const seen = new Set<string>();

  if (source) {
    const android = extractBlock(source, 'android') ?? source;
    const btBody = extractBlock(android, 'buildTypes');
    if (btBody) {
      // Children: `release { … }`, `getByName("release") { … }`, `create("staging") { … }`.
      const childRe =
        /(?:create|register|maybeCreate|getByName)\s*\(\s*["']([A-Za-z0-9_]+)["']\s*\)\s*\{|([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
      for (let m = childRe.exec(btBody); m; m = childRe.exec(btBody)) {
        const name = m[1] ?? m[2];
        if (!name || ['create', 'register', 'maybeCreate', 'getByName', 'all', 'each'].includes(name)) continue;
        const braceIdx = btBody.indexOf('{', m.index);
        if (braceIdx === -1) continue;
        const body = bodyFromBrace(btBody, braceIdx);
        if (seen.has(name)) continue;
        seen.add(name);
        result.push(buildTypeInfoFrom(name, body));
      }
    }
  }

  // AGP always provides debug + release implicitly, even if not declared.
  for (const implicit of ['debug', 'release']) {
    if (!seen.has(implicit)) {
      result.push({
        name: implicit,
        debuggable: implicit === 'debug',
        minifyEnabled: false,
        signingConfig: implicit === 'debug' ? 'debug' : null,
        proguardFiles: [],
      });
    }
  }
  return result;
}

// ─── iOS workspace / project files ──────────────────────────────────────────────

function parseIosWorkspaces(projectPath: string): string[] {
  const iosRoot = findIosRoot(projectPath);
  if (!iosRoot) return [];
  const found: string[] = [];
  try {
    for (const entry of readdirSync(iosRoot)) {
      if (entry.endsWith('.xcworkspace') || entry.endsWith('.xcodeproj')) {
        const rel = relative(projectPath, join(iosRoot, entry)).split('\\').join('/');
        found.push(rel);
      }
    }
  } catch {
    /* ignore */
  }
  // Prefer .xcworkspace over .xcodeproj when both exist.
  found.sort((a, b) => (a.endsWith('.xcworkspace') ? -1 : b.endsWith('.xcworkspace') ? 1 : 0));
  return uniq(found);
}

// ─── iOS signing (pbxproj build settings) ───────────────────────────────────────

type IosSigningDetection = {
  teamIds: string[];
  deploymentTargets: string[];
  certificates: string[];
  provisioningProfiles: string[];
};

function parseIosSigning(projectPath: string): IosSigningDetection {
  const iosRoot = findIosRoot(projectPath);
  const out: IosSigningDetection = { teamIds: [], deploymentTargets: [], certificates: [], provisioningProfiles: [] };
  if (!iosRoot) return out;
  try {
    for (const entry of readdirSync(iosRoot)) {
      if (!entry.endsWith('.xcodeproj')) continue;
      const pbx = readIfExists(join(iosRoot, entry, 'project.pbxproj'));
      if (!pbx) continue;
      const collect = (re: RegExp): string[] => {
        const vals: string[] = [];
        for (let m = re.exec(pbx); m; m = re.exec(pbx)) {
          const v = m[1].trim().replace(/^"|"$/g, '').trim();
          if (v && !v.includes('$')) vals.push(v);
        }
        return vals;
      };
      out.teamIds.push(...collect(/DEVELOPMENT_TEAM\s*=\s*([^;]+);/g));
      out.deploymentTargets.push(...collect(/IPHONEOS_DEPLOYMENT_TARGET\s*=\s*([^;]+);/g));
      out.certificates.push(...collect(/CODE_SIGN_IDENTITY(?:\[[^\]]+\])?\s*=\s*([^;]+);/g));
      out.provisioningProfiles.push(...collect(/PROVISIONING_PROFILE_SPECIFIER(?:\[[^\]]+\])?\s*=\s*([^;]+);/g));
    }
  } catch {
    /* ignore */
  }
  return {
    teamIds: uniq(out.teamIds),
    deploymentTargets: uniq(out.deploymentTargets),
    // Drop the meaningless "" / "iPhone Developer" automatic placeholder noise but keep real identities.
    certificates: uniq(out.certificates.filter((c) => c.toLowerCase() !== 'iphone developer' || out.certificates.length === 1)),
    provisioningProfiles: uniq(out.provisioningProfiles),
  };
}

// ─── KMP build targets (build.gradle.kts kotlin{} block) ────────────────────────

function parseKmpTargets(projectPath: string, module: string): KmpTarget[] {
  const gradleFile = findModuleGradleFile(projectPath, module);
  const source = gradleFile ? readIfExists(gradleFile) : null;
  if (!source) return [];
  const targets: KmpTarget[] = [];
  // Targets may be declared as a call (`androidTarget()`) OR a block (`androidTarget { … }`),
  // so match either a `(` or a `{` after the target name.
  if (/\bandroidTarget\s*[({]|\bandroidLibrary\b|\bandroid\s*[({]/.test(source)) targets.push('android');
  if (/\bios(?:X64|Arm64|SimulatorArm64)\s*[({]|\bios\s*\(\s*\)/.test(source)) targets.push('ios');
  if (/\bjvm\s*[({]/.test(source)) targets.push('desktop');
  if (/\bwasmJs\s*[({]|\bjs\s*[({]/.test(source)) targets.push('web');
  return targets;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export function introspectProject(
  projectPath: string,
  platform: MobilePlatform,
  module: string,
): MobileIntrospection {
  const warnings: string[] = [];
  const usesAndroid = platform !== 'ios';
  const usesIos =
    platform === 'ios' ||
    platform === 'react-native' ||
    platform === 'flutter' ||
    platform === 'compose-multiplatform';

  const result: MobileIntrospection = {
    gradleModules: [],
    applicationIds: [],
    bundleIds: [],
    signingConfigs: [],
    buildTypeConfigs: [],
    kmpTargets: [],
    iosWorkspaces: [],
    iosTeamIds: [],
    iosDeploymentTargets: [],
    iosCertificates: [],
    iosProvisioningProfiles: [],
    warnings,
  };

  try {
    if (usesAndroid) {
      result.gradleModules = parseApplicationModules(projectPath);
      result.applicationIds = parseApplicationIds(projectPath, module);
      result.signingConfigs = parseSigningConfigs(projectPath, module);
      result.buildTypeConfigs = parseBuildTypes(projectPath, module);
    }
    if (usesIos) {
      result.bundleIds = parseBundleIds(projectPath);
      result.iosWorkspaces = parseIosWorkspaces(projectPath);
      const signing = parseIosSigning(projectPath);
      result.iosTeamIds = signing.teamIds;
      result.iosDeploymentTargets = signing.deploymentTargets;
      result.iosCertificates = signing.certificates;
      result.iosProvisioningProfiles = signing.provisioningProfiles;
    }
    if (platform === 'compose-multiplatform') {
      result.kmpTargets = parseKmpTargets(projectPath, module);
    }
  } catch (err) {
    warnings.push(String(err));
  }

  if (
    result.gradleModules.length === 0 &&
    result.applicationIds.length === 0 &&
    result.bundleIds.length === 0 &&
    result.signingConfigs.length === 0 &&
    result.iosWorkspaces.length === 0
  ) {
    warnings.push('Nothing detected — check the project path and module.');
  }
  return result;
}
