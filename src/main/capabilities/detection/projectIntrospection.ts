/**
 * Project introspection — detects the values a mobile project already declares so
 * the settings UI can offer them as dropdowns instead of free text: Gradle
 * modules, application IDs, iOS bundle IDs, and Android signing configs.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MobilePlatform, MobileIntrospection, SigningConfigInfo } from '../../../shared/types';
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

// ─── Public API ─────────────────────────────────────────────────────────────────

export function introspectProject(
  projectPath: string,
  platform: MobilePlatform,
  module: string,
): MobileIntrospection {
  const warnings: string[] = [];
  const usesAndroid = platform !== 'ios';
  const usesIos = platform === 'ios' || platform === 'react-native' || platform === 'flutter';

  const result: MobileIntrospection = {
    gradleModules: [],
    applicationIds: [],
    bundleIds: [],
    signingConfigs: [],
    warnings,
  };

  try {
    if (usesAndroid) {
      result.gradleModules = parseGradleModules(projectPath);
      result.applicationIds = parseApplicationIds(projectPath, module);
      result.signingConfigs = parseSigningConfigs(projectPath, module);
    }
    if (usesIos) {
      result.bundleIds = parseBundleIds(projectPath);
    }
  } catch (err) {
    warnings.push(String(err));
  }

  if (
    result.gradleModules.length === 0 &&
    result.applicationIds.length === 0 &&
    result.bundleIds.length === 0 &&
    result.signingConfigs.length === 0
  ) {
    warnings.push('Nothing detected — check the project path and module.');
  }
  return result;
}
