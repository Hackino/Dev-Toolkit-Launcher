/**
 * Backend/web profile detection — discovers the runnable profiles/environments a
 * project declares, their application URLs (only when explicitly declared), and a
 * build command. The renderer shows these as a dropdown so the user never types a
 * run/build command, port, or protocol.
 *
 * Run-command finalization (gradle wrapper rewrite, `npm install` prepend) is NOT
 * done here — it stays in the feature's `resolveRunCommand`, applied at start time.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import type { ProjectType, BackendProfile, BackendDetection } from '../../../shared/types';
import { readIfExists } from './variantDetection';

function empty(): BackendDetection {
  return { profiles: [], buildCommand: null, warnings: [] };
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

// ─── dotnet ─────────────────────────────────────────────────────────────────────

const CSPROJ_SKIP = new Set(['bin', 'obj', 'node_modules', '.git', '.vs', '.idea', 'packages']);

/** Depth-limited search for the first .csproj under a directory. */
function findCsprojShallow(dir: string, depth: number): string | null {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  const direct = entries.find((f) => f.endsWith('.csproj'));
  if (direct) return join(dir, direct);
  if (depth <= 0) return null;
  for (const name of entries) {
    if (CSPROJ_SKIP.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    try {
      if (statSync(full).isDirectory()) {
        const hit = findCsprojShallow(full, depth - 1);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Resolve the .csproj for a given path. Accepts either the .csproj file directly
 * or a project **root folder** (the .csproj — and its Properties/launchSettings.json
 * — are auto-detected). Prefers a csproj matching the folder name, then any direct
 * child, then a shallow recursive search.
 */
function resolveCsproj(projectPath: string): string | null {
  if (projectPath.endsWith('.csproj')) return existsSync(projectPath) ? projectPath : null;
  let isDir = false;
  try {
    isDir = statSync(projectPath).isDirectory();
  } catch {
    return null;
  }
  if (!isDir) return null;

  const named = join(projectPath, `${basename(projectPath)}.csproj`);
  if (existsSync(named)) return named;

  return findCsprojShallow(projectPath, 2);
}

function detectDotnet(projectPath: string): BackendDetection {
  const result = empty();
  const csproj = resolveCsproj(projectPath);
  if (!csproj) {
    result.warnings.push('No .csproj found — point the path at the project file.');
    return result;
  }
  const quoted = `"${csproj}"`;
  result.buildCommand = `dotnet build ${quoted}`;

  const launch = readIfExists(join(dirname(csproj), 'Properties', 'launchSettings.json'));
  if (!launch) {
    result.profiles.push({ name: 'Default', runCommand: `dotnet run --project ${quoted}`, urls: [], env: {} });
    result.warnings.push('No Properties/launchSettings.json — using a single Default profile.');
    return result;
  }

  try {
    const parsed = JSON.parse(launch) as {
      profiles?: Record<string, { commandName?: string; applicationUrl?: string; environmentVariables?: Record<string, string> }>;
    };
    for (const [name, p] of Object.entries(parsed.profiles ?? {})) {
      if (p.commandName && p.commandName !== 'Project') continue; // skip IIS Express etc.
      const urls = (p.applicationUrl ?? '')
        .split(';')
        .map((u) => u.trim())
        .filter(Boolean);
      result.profiles.push({
        name,
        runCommand: `dotnet run --project ${quoted} --launch-profile "${name}"`,
        urls,
        env: p.environmentVariables ?? {},
      });
    }
  } catch {
    result.warnings.push('launchSettings.json could not be parsed.');
  }
  if (result.profiles.length === 0) {
    result.profiles.push({ name: 'Default', runCommand: `dotnet run --project ${quoted}`, urls: [], env: {} });
  }
  return result;
}

// ─── node family ─────────────────────────────────────────────────────────────────

function portFromScript(script: string): number | null {
  const m =
    script.match(/(?:--port|-p)[ =](\d{2,5})/) ??
    script.match(/PORT[ =](\d{2,5})/);
  return m ? Number(m[1]) : null;
}

/**
 * Decide whether an npm script starts a long-running server (something you'd
 * "Run" and open on localhost) vs a one-shot task (build, lint, test, typecheck…
 * which just exit). One-shot scripts are filtered out of the run dropdown — the
 * `build` script remains available via the Build button.
 */
const ONE_SHOT_NAMES = new Set([
  'build', 'lint', 'format', 'fmt', 'typecheck', 'type-check', 'tsc', 'clean',
  'test', 'tests', 'coverage', 'e2e', 'unit', 'integration', 'prepare',
  'prepublish', 'prepublishonly', 'prebuild', 'postbuild', 'preinstall',
  'postinstall', 'eject', 'analyze', 'check', 'validate', 'export', 'generate',
  'codegen', 'ci', 'release', 'deploy', 'storybook', 'build-storybook', 'docs', 'bundle',
]);

function isRunnableScript(name: string, body: string): boolean {
  const n = name.toLowerCase();
  const b = body.toLowerCase();

  // One-shot by name (build / lint / test / typecheck / format / clean groups)
  if (ONE_SHOT_NAMES.has(n) || /^(build|lint|test|format|typecheck|type-check|clean|coverage)[:.-]/.test(n)) {
    return false;
  }
  // One-shot by command — unless it also clearly runs a server
  if (/\b(next build|vite build|nest build|tsc(\s|$)|eslint\b|prettier\b|jest\b|vitest run|playwright test|rimraf|rm -rf)\b/.test(b)
      && !/\b(dev|serve|start|watch|preview)\b/.test(b)) {
    return false;
  }
  // Long-running by name (dev / start / serve / preview / watch, or :dev/:prod suffixes)
  if (/^(dev|start|serve|preview|watch)\b/.test(n) || /[:.-](dev|serve|start|watch|prod|preview)$/.test(n)) {
    return true;
  }
  // Long-running by command
  if (/\b(next (dev|start)|vite(?!\s+build)|vite preview|nest start|nuxt (dev|start)|astro (dev|preview)|remix (dev|serve)|nodemon|ts-node|tsx\s+watch|react-scripts start|node\s|serve\b|http-server|webpack serve|webpack-dev-server|concurrently)\b/.test(b)) {
    return true;
  }
  // Ambiguous custom script → keep (better than hiding a real run script).
  return true;
}

function detectNode(projectPath: string): BackendDetection {
  const result = empty();
  const pkgRaw = readIfExists(join(projectPath, 'package.json'));
  if (!pkgRaw) {
    result.warnings.push('No package.json found in the project directory.');
    return result;
  }
  try {
    const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    const entries = Object.entries(scripts);
    const runnable = entries.filter(([name, body]) => isRunnableScript(name, body));
    // Fall back to all scripts if the heuristic filtered everything out.
    const shown = runnable.length > 0 ? runnable : entries;

    for (const [name, body] of shown) {
      const port = portFromScript(body);
      result.profiles.push({
        name,
        runCommand: `npm run ${name}`,
        detail: body,                 // show the underlying script (e.g. "next dev --port 3100")
        urls: port ? [`http://localhost:${port}`] : [],
        env: {},
      });
    }
    if (scripts.build) result.buildCommand = 'npm run build';
  } catch {
    result.warnings.push('package.json could not be parsed.');
  }
  if (result.profiles.length === 0) {
    result.warnings.push('No runnable scripts found in package.json.');
  }
  return result;
}

// ─── spring boot ───────────────────────────────────────────────────────────────

function readServerPort(text: string | null): number | null {
  if (!text) return null;
  // application.properties: server.port=8081   |   yaml: "  port: 8081" under server:
  const prop = text.match(/^\s*server\.port\s*[=:]\s*(\d{2,5})/m);
  if (prop) return Number(prop[1]);
  const yaml = text.match(/server:\s*[\s\S]*?\n\s*port:\s*(\d{2,5})/);
  if (yaml) return Number(yaml[1]);
  return null;
}

function springProfileNames(resourcesDir: string): string[] {
  if (!existsSync(resourcesDir)) return [];
  try {
    return uniq(
      readdirSync(resourcesDir)
        .map((f) => f.match(/^application-([A-Za-z0-9_]+)\.(properties|ya?ml)$/)?.[1])
        .filter((n): n is string => !!n),
    );
  } catch {
    return [];
  }
}

function detectSpring(projectPath: string): BackendDetection {
  const result = empty();
  const hasGradle = existsSync(join(projectPath, 'build.gradle')) || existsSync(join(projectPath, 'build.gradle.kts'));
  const hasMaven = existsSync(join(projectPath, 'pom.xml'));
  const useMaven = hasMaven && !hasGradle;

  result.buildCommand = useMaven ? './mvnw package' : './gradlew build';

  const resources = join(projectPath, 'src', 'main', 'resources');
  const basePort =
    readServerPort(readIfExists(join(resources, 'application.properties'))) ??
    readServerPort(readIfExists(join(resources, 'application.yml'))) ??
    readServerPort(readIfExists(join(resources, 'application.yaml')));

  const profileNames = ['default', ...springProfileNames(resources)];
  for (const name of profileNames) {
    const profilePort =
      name === 'default'
        ? basePort
        : readServerPort(readIfExists(join(resources, `application-${name}.properties`))) ??
          readServerPort(readIfExists(join(resources, `application-${name}.yml`))) ??
          readServerPort(readIfExists(join(resources, `application-${name}.yaml`))) ??
          basePort;
    const run = useMaven
      ? `./mvnw spring-boot:run${name === 'default' ? '' : ` -Dspring-boot.run.profiles=${name}`}`
      : `./gradlew bootRun${name === 'default' ? '' : ` --args='--spring.profiles.active=${name}'`}`;
    result.profiles.push({
      name,
      runCommand: run,
      detail: run,
      urls: profilePort ? [`http://localhost:${profilePort}`] : [],
      env: {},
    });
  }
  return result;
}

// ─── ktor ────────────────────────────────────────────────────────────────────────

function ktorPort(projectPath: string): number | null {
  const resources = join(projectPath, 'src', 'main', 'resources');
  const conf = readIfExists(join(resources, 'application.conf'));
  if (conf) {
    const m = conf.match(/port\s*[=:]\s*(\d{2,5})/);
    if (m) return Number(m[1]);
  }
  const yaml = readIfExists(join(resources, 'application.yaml')) ?? readIfExists(join(resources, 'application.yml'));
  if (yaml) {
    const m = yaml.match(/port:\s*(\d{2,5})/);
    if (m) return Number(m[1]);
  }
  return null;
}

function detectKtor(projectPath: string): BackendDetection {
  const result = empty();
  const hasGradle =
    existsSync(join(projectPath, 'build.gradle')) || existsSync(join(projectPath, 'build.gradle.kts'));
  const hasMaven = existsSync(join(projectPath, 'pom.xml'));
  const useMaven = hasMaven && !hasGradle;

  result.buildCommand = useMaven ? './mvnw package' : './gradlew build';
  const port = ktorPort(projectPath);
  // Maven Ktor projects have no single run goal like Spring's; the config-based
  // entrypoint is EngineMain, run via exec:java after a compile.
  const runCommand = useMaven
    ? './mvnw compile exec:java -Dexec.mainClass=io.ktor.server.netty.EngineMain'
    : './gradlew run';
  result.profiles.push({
    name: 'run',
    runCommand,
    detail: runCommand,
    urls: port ? [`http://localhost:${port}`] : [],
    env: {},
  });
  return result;
}

// ─── dispatch ────────────────────────────────────────────────────────────────────

export function detectBackendProfiles(projectPath: string, type: ProjectType): BackendDetection {
  switch (type) {
    case 'dotnet':
      return detectDotnet(projectPath);
    case 'spring-boot':
      return detectSpring(projectPath);
    case 'ktor':
      return detectKtor(projectPath);
    case 'nextjs':
    case 'react':
    case 'nodejs':
    case 'express':
    case 'nestjs':
      return detectNode(projectPath);
    default:
      return empty();
  }
}

/** Parse a port out of a detected URL (for kill-port). */
export function portOfUrl(url: string): number | null {
  const m = url.match(/:(\d{2,5})(?:\/|$)/);
  if (m) return Number(m[1]);
  try {
    const u = new URL(url);
    if (u.port) return Number(u.port);
    return u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : null;
  } catch {
    return null;
  }
}
