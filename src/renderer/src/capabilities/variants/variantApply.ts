import type {
  AndroidBuildConfig,
  DetectedVariants,
  FlutterEntryPoint,
  IosBuildConfig,
} from '../../../../shared/types';

const cap = (s: string): string => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1));
const lower = (s: string): string => (s.length === 0 ? s : s[0].toLowerCase() + s.slice(1));

function ensureOneDefault<T extends { isDefault: boolean }>(list: T[]): T[] {
  if (list.length === 0 || list.some((x) => x.isDefault)) return list;
  return list.map((x, i) => (i === 0 ? { ...x, isDefault: true } : x));
}

/** Split a Gradle variant ("prodRelease") into flavor + buildType using the known build types. */
function splitVariant(variant: string, buildTypes: string[]): { flavor: string | null; buildType: string } {
  const sorted = [...buildTypes].sort((a, b) => b.length - a.length);
  for (const bt of sorted) {
    const v = variant.toLowerCase();
    const b = bt.toLowerCase();
    if (v === b) return { flavor: null, buildType: b };
    if (v.endsWith(b) && variant.length > bt.length) {
      return { flavor: lower(variant.slice(0, variant.length - bt.length)), buildType: b };
    }
  }
  return { flavor: null, buildType: variant.toLowerCase() };
}

/**
 * Merge detected Android variants into the existing config list.
 * Existing configs with a matching name are preserved (keeps custom flags + minify).
 */
export function applyAndroidDetection(
  existing: AndroidBuildConfig[],
  d: DetectedVariants,
): AndroidBuildConfig[] {
  const buildTypes = d.androidBuildTypes.length ? d.androidBuildTypes : ['debug', 'release'];
  const variants = d.androidVariants.length ? d.androidVariants : buildTypes;
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

  const result: AndroidBuildConfig[] = [];
  for (const v of variants) {
    const name = cap(v);
    const found = byName.get(name.toLowerCase());
    if (found) {
      result.push(found);
      continue;
    }
    const { flavor, buildType } = splitVariant(v, buildTypes);
    const isRelease = buildType.includes('release');
    result.push({
      id: crypto.randomUUID(),
      name,
      buildType,
      flavor,
      isDefault: false,
      debuggable: !isRelease,
      signingConfig: null,
      minify: { enabled: isRelease, proguardFiles: [] },
      customFlags: [],
    });
  }
  // Preserve any existing custom configs not represented by detection.
  for (const c of existing) {
    if (!result.some((r) => r.id === c.id)) result.push(c);
  }
  return ensureOneDefault(result);
}

/** Merge detected Flutter entry points (by target file) into the existing list. */
export function applyFlutterDetection(
  existing: FlutterEntryPoint[],
  d: DetectedVariants,
): FlutterEntryPoint[] {
  const byTarget = new Map(existing.map((e) => [e.target, e]));
  const result: FlutterEntryPoint[] = [];
  for (const ep of d.flutterEntryPoints) {
    const found = byTarget.get(ep.target);
    if (found) {
      result.push(found);
      continue;
    }
    result.push({
      id: crypto.randomUUID(),
      name: ep.name,
      target: ep.target,
      flavor: null,
      dartDefines: [],
      extraFlags: [],
      isDefault: false,
    });
  }
  for (const e of existing) {
    if (!result.some((r) => r.id === e.id)) result.push(e);
  }
  return ensureOneDefault(result);
}

/** Build iOS configs from detected schemes × configurations, preserving matching existing configs. */
export function applyIosDetection(existing: IosBuildConfig[], d: DetectedVariants): IosBuildConfig[] {
  const schemes = d.iosSchemes;
  const configurations = d.iosConfigurations.length ? d.iosConfigurations : ['Debug', 'Release'];
  if (schemes.length === 0) return existing;

  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  const result: IosBuildConfig[] = [];
  for (const scheme of schemes) {
    for (const conf of configurations) {
      const name = schemes.length > 1 ? `${scheme} · ${conf}` : conf;
      const found = byName.get(name.toLowerCase());
      if (found) {
        result.push(found);
        continue;
      }
      result.push({
        id: crypto.randomUUID(),
        name,
        scheme,
        configuration: conf,
        isDefault: false,
        customFlags: [],
      });
    }
  }
  for (const c of existing) {
    if (!result.some((r) => r.id === c.id)) result.push(c);
  }
  return ensureOneDefault(result);
}
