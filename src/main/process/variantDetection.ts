import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  DetectedVariants,
  DetectedEntryPoint,
  MobilePlatform,
} from '../../shared/types';

const execFileAsync = promisify(execFile);
const DEEP_TIMEOUT_MS = 90_000;

// ─── Generic helpers ──────────────────────────────────────────────────────────

function readIfExists(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function emptyResult(): DetectedVariants {
  return {
    source: 'none',
    androidBuildTypes: [],
    androidFlavors: [],
    androidFlavorDimensions: [],
    androidVariants: [],
    flutterEntryPoints: [],
    iosSchemes: [],
    iosConfigurations: [],
    warnings: [],
  };
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

// ─── Gradle DSL parsing ───────────────────────────────────────────────────────

/**
 * Extract the balanced-brace body of a `blockName { … }` block.
 * Returns the inner text (without the outer braces), or null if not found.
 */
function extractBlock(source: string, blockName: string): string | null {
  const re = new RegExp(`(^|[^\\w.])${blockName}\\s*\\{`, 'm');
  const match = re.exec(source);
  if (!match) return null;
  const open = source.indexOf('{', match.index);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/**
 * Find the direct child container names within a buildTypes/productFlavors block.
 * Handles both Groovy (`staging {`) and Kotlin DSL
 * (`create("staging")`, `register("staging")`, `getByName("release")`, `maybeCreate("x")`).
 */
function childContainerNames(blockBody: string): string[] {
  const names: string[] = [];

  // Kotlin-DSL factory calls — anywhere in the block.
  const factoryRe = /(?:create|register|maybeCreate|getByName)\s*\(\s*["']([A-Za-z0-9_]+)["']/g;
  for (let m = factoryRe.exec(blockBody); m; m = factoryRe.exec(blockBody)) {
    names.push(m[1]);
  }

  // Groovy-style `name { … }` — only at depth 0 of the block body.
  let depth = 0;
  let i = 0;
  while (i < blockBody.length) {
    const ch = blockBody[i];
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth--; i++; continue; }
    if (depth === 0) {
      const slice = blockBody.slice(i);
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(slice);
      if (m && !['create', 'register', 'getByName', 'maybeCreate', 'all', 'each'].includes(m[1])) {
        names.push(m[1]);
        i += m[0].length;
        depth++;
        continue;
      }
    }
    i++;
  }

  return uniq(names);
}

function parseFlavorDimensions(android: string): string[] {
  const dims: string[] = [];
  // flavorDimensions "app", "env"  |  flavorDimensions += "env"  |  flavorDimensions.add("env")
  const re = /flavorDimensions(?:\s*\+?=|\s*\.add\s*\(|\s+)([^\n]+)/g;
  for (let m = re.exec(android); m; m = re.exec(android)) {
    const quoted = m[1].match(/["']([A-Za-z0-9_]+)["']/g);
    if (quoted) dims.push(...quoted.map((q) => q.replace(/["']/g, '')));
  }
  return uniq(dims);
}

// ─── Android source location ──────────────────────────────────────────────────

function findAndroidRoot(projectPath: string): string | null {
  const candidates = [
    projectPath,
    join(projectPath, 'android'), // flutter / react-native
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'gradlew')) || existsSync(join(dir, 'gradlew.bat'))) return dir;
    if (existsSync(join(dir, 'settings.gradle')) || existsSync(join(dir, 'settings.gradle.kts'))) return dir;
  }
  return null;
}

function findModuleGradleFile(projectPath: string, module: string): string | null {
  const mod = module || 'app';
  const roots = [projectPath, join(projectPath, 'android')];
  for (const root of roots) {
    for (const name of ['build.gradle.kts', 'build.gradle']) {
      const p = join(root, mod, name);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

// ─── Android static parse ─────────────────────────────────────────────────────

function parseAndroidStatic(projectPath: string, module: string, result: DetectedVariants): void {
  const gradleFile = findModuleGradleFile(projectPath, module);
  if (!gradleFile) {
    result.warnings.push(`No build.gradle found for module "${module || 'app'}".`);
    return;
  }
  const source = readIfExists(gradleFile);
  if (!source) return;

  const androidBlock = extractBlock(source, 'android') ?? source;

  const buildTypesBody = extractBlock(androidBlock, 'buildTypes');
  const buildTypes = buildTypesBody ? childContainerNames(buildTypesBody) : [];
  // Android always implicitly has debug + release.
  result.androidBuildTypes = uniq(['debug', 'release', ...buildTypes]);

  const flavorsBody = extractBlock(androidBlock, 'productFlavors');
  const flavors = flavorsBody ? childContainerNames(flavorsBody) : [];
  result.androidFlavors = uniq(flavors);
  result.androidFlavorDimensions = parseFlavorDimensions(androidBlock);

  // Variants = flavors × buildTypes (or just buildTypes when no flavors).
  if (result.androidFlavors.length > 0) {
    for (const flavor of result.androidFlavors) {
      for (const bt of result.androidBuildTypes) {
        result.androidVariants.push(`${flavor}${capitalize(bt)}`);
      }
    }
  } else {
    result.androidVariants = [...result.androidBuildTypes];
  }
}

// ─── Flutter static parse ─────────────────────────────────────────────────────

function parseFlutterEntryPoints(projectPath: string, result: DetectedVariants): void {
  const libDir = join(projectPath, 'lib');
  if (!existsSync(libDir)) {
    result.warnings.push('No lib/ directory found for Flutter entry points.');
    return;
  }
  const entries: DetectedEntryPoint[] = [];
  try {
    for (const file of readdirSync(libDir)) {
      if (/^main.*\.dart$/.test(file)) {
        const base = file.replace(/\.dart$/, '');
        const suffix = base.replace(/^main_?/, '');
        const name = suffix ? capitalize(suffix.replace(/[_-]+/g, ' ')) : 'Main';
        entries.push({ name, target: `lib/${file}` });
      }
    }
  } catch {
    /* ignore */
  }
  if (entries.length === 0) entries.push({ name: 'Main', target: 'lib/main.dart' });
  // Default main.dart first.
  entries.sort((a, b) => (a.target === 'lib/main.dart' ? -1 : b.target === 'lib/main.dart' ? 1 : 0));
  result.flutterEntryPoints = entries;
}

// ─── iOS static parse ─────────────────────────────────────────────────────────

function findIosRoot(projectPath: string): string | null {
  const candidates = [projectPath, join(projectPath, 'ios')];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    try {
      const hasXcode = readdirSync(dir).some(
        (f) => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'),
      );
      if (hasXcode) return dir;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function parseIosSchemesStatic(projectPath: string, result: DetectedVariants): void {
  const iosRoot = findIosRoot(projectPath);
  if (!iosRoot) {
    result.warnings.push('No .xcodeproj / .xcworkspace found for iOS schemes.');
    return;
  }
  const schemes: string[] = [];
  try {
    for (const entry of readdirSync(iosRoot)) {
      if (entry.endsWith('.xcodeproj') || entry.endsWith('.xcworkspace')) {
        const schemesDir = join(iosRoot, entry, 'xcshareddata', 'xcschemes');
        if (existsSync(schemesDir)) {
          for (const s of readdirSync(schemesDir)) {
            if (s.endsWith('.xcscheme')) schemes.push(s.replace(/\.xcscheme$/, ''));
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  result.iosSchemes = uniq(schemes);
  // Configurations are not reliably parseable from the pbxproj statically; offer the defaults.
  result.iosConfigurations = ['Debug', 'Release'];
}

// ─── Deep scan: Gradle ────────────────────────────────────────────────────────

async function deepScanAndroid(projectPath: string, module: string, result: DetectedVariants): Promise<void> {
  const root = findAndroidRoot(projectPath);
  if (!root) {
    result.warnings.push('Could not locate a Gradle root for deep scan.');
    return;
  }
  const isWin = process.platform === 'win32';
  const gradlew = isWin ? join(root, 'gradlew.bat') : join(root, 'gradlew');
  const useWrapper = existsSync(gradlew);
  const cmd = useWrapper ? gradlew : 'gradle';
  const mod = module || 'app';
  try {
    const { stdout } = await execFileAsync(
      cmd,
      [`:${mod}:tasks`, '--all', '--console=plain', '-q'],
      { cwd: root, timeout: DEEP_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 16 },
    );
    const variants = new Set<string>();
    const buildTypes = new Set<string>(result.androidBuildTypes);
    const re = /^assemble([A-Za-z0-9]+)\b/gm;
    for (let m = re.exec(stdout); m; m = re.exec(stdout)) {
      const variant = m[1];
      // Skip the bare "assemble" aggregate and test tasks.
      if (!variant || /AndroidTest$|UnitTest$/.test(variant)) continue;
      variants.add(variant[0].toLowerCase() + variant.slice(1));
    }
    if (variants.size > 0) {
      result.androidVariants = uniq([...variants]);
      result.source = 'gradle';
    }
    result.androidBuildTypes = uniq([...buildTypes]);
  } catch (err) {
    result.warnings.push(`Gradle deep scan failed: ${(err as Error).message.split('\n')[0]}`);
  }
}

// ─── Deep scan: xcodebuild ────────────────────────────────────────────────────

async function deepScanIos(projectPath: string, result: DetectedVariants): Promise<void> {
  if (process.platform !== 'darwin') {
    result.warnings.push('iOS deep scan requires macOS.');
    return;
  }
  const iosRoot = findIosRoot(projectPath);
  if (!iosRoot) {
    result.warnings.push('No Xcode project found for deep scan.');
    return;
  }
  try {
    const { stdout } = await execFileAsync('xcodebuild', ['-list', '-json'], {
      cwd: iosRoot,
      timeout: DEEP_TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 8,
    });
    const parsed = JSON.parse(stdout) as {
      project?: { schemes?: string[]; configurations?: string[] };
      workspace?: { schemes?: string[] };
    };
    const schemes = parsed.project?.schemes ?? parsed.workspace?.schemes ?? [];
    const configs = parsed.project?.configurations ?? [];
    if (schemes.length > 0) result.iosSchemes = uniq(schemes);
    if (configs.length > 0) result.iosConfigurations = uniq(configs);
    result.source = 'xcodebuild';
  } catch (err) {
    result.warnings.push(`xcodebuild scan failed: ${(err as Error).message.split('\n')[0]}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function detectVariants(
  projectPath: string,
  platform: MobilePlatform,
  module: string,
  deep: boolean,
): Promise<DetectedVariants> {
  const result = emptyResult();

  const usesAndroid =
    platform === 'android' ||
    platform === 'react-native' ||
    platform === 'flutter' ||
    platform === 'compose-multiplatform';
  const usesIos =
    platform === 'ios' || platform === 'react-native' || platform === 'flutter';

  if (usesAndroid) parseAndroidStatic(projectPath, module, result);
  if (platform === 'flutter') parseFlutterEntryPoints(projectPath, result);
  if (usesIos) parseIosSchemesStatic(projectPath, result);

  // Mark static success only if we found something.
  if (
    result.androidVariants.length > 0 ||
    result.flutterEntryPoints.length > 0 ||
    result.iosSchemes.length > 0
  ) {
    result.source = 'static';
  }

  if (deep) {
    const tasks: Promise<void>[] = [];
    if (usesAndroid) tasks.push(deepScanAndroid(projectPath, module, result));
    if (usesIos) tasks.push(deepScanIos(projectPath, result));
    await Promise.all(tasks);
  }

  return result;
}
