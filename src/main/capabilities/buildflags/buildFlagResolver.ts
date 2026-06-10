import type { BuildFlagEntry, BuildFlagKind } from '../../../shared/types';

/**
 * Returns the CLI-formatted strings for all enabled flags of the given kinds.
 * Env-kind flags are NOT included here — use resolveEnvFlags() for those.
 */
export function resolveFlags(flags: BuildFlagEntry[], kinds: BuildFlagKind[]): string[] {
  const result: string[] = [];
  for (const flag of flags) {
    if (!flag.enabled) continue;
    if (!kinds.includes(flag.kind)) continue;
    result.push(formatFlag(flag));
  }
  return result;
}

/**
 * Returns env vars from 'env'-kind entries that are enabled.
 */
export function resolveEnvFlags(flags: BuildFlagEntry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const flag of flags) {
    if (!flag.enabled || flag.kind !== 'env') continue;
    if (flag.key) result[flag.key] = flag.value;
  }
  return result;
}

/**
 * Formats a single BuildFlagEntry into its CLI string representation.
 */
export function formatFlag(flag: BuildFlagEntry): string {
  switch (flag.kind) {
    case 'gradle-prop':
      return flag.value ? `-P${flag.key}=${flag.value}` : `-P${flag.key}`;
    case 'gradle-flag':
      return flag.key.startsWith('--') ? flag.key : `--${flag.key}`;
    case 'gradle-system-prop':
      return flag.value ? `-D${flag.key}=${flag.value}` : `-D${flag.key}`;
    case 'xcode-setting':
      return flag.value ? `${flag.key}=${flag.value}` : flag.key;
    case 'xcode-flag':
      return flag.value ? `${flag.key} ${flag.value}` : flag.key;
    case 'flutter-dart-define':
      return `--dart-define=${flag.key}=${flag.value}`;
    case 'flutter-flag':
      return flag.value ? `${flag.key} ${flag.value}` : flag.key;
    case 'env':
      return ''; // handled separately
  }
}

/** Merge multiple flag arrays, deduplicating by id. */
export function mergeFlags(...arrays: BuildFlagEntry[][]): BuildFlagEntry[] {
  const seen = new Set<string>();
  const result: BuildFlagEntry[] = [];
  for (const arr of arrays) {
    for (const f of arr) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        result.push(f);
      }
    }
  }
  return result;
}
