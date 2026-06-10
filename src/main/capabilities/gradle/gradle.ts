/**
 * Gradle capability — shared by every feature that drives a Gradle build
 * (Android, React Native, Compose Multiplatform, Spring Boot, Ktor). Features
 * compose this; they never reach into each other.
 */
import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve the Gradle wrapper invocation for a project root, making the unix
 * wrapper executable when present. Falls back to a system `gradle`.
 *
 * @param root  directory containing the wrapper (project root or a subdir)
 * @param prefix optional path prefix to prepend (e.g. "android")
 */
export function gradlewBin(root: string, prefix = ''): string {
  const dir = prefix ? join(root, prefix) : root;
  const winWrapper = join(dir, 'gradlew.bat');
  const unixWrapper = join(dir, 'gradlew');

  if (process.platform === 'win32' && existsSync(winWrapper)) {
    return prefix ? join(prefix, 'gradlew.bat') : 'gradlew.bat';
  }
  if (existsSync(unixWrapper)) {
    try { chmodSync(unixWrapper, 0o755); } catch { /* ignore */ }
    return prefix ? join(prefix, 'gradlew') : './gradlew';
  }
  return 'gradle';
}

export function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}
