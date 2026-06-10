/**
 * Android signing capability — turns a stored signing config + resolved env
 * secrets into the `-Pandroid.injected.signing.*` Gradle flags. Shared by the
 * Android, React Native, and Compose Multiplatform features.
 *
 * Passwords are never persisted; they arrive here only via `resolvedEnv`,
 * populated from `process.env` at release time.
 */
import type { AndroidSigningConfig } from '../../../shared/types';

export function androidSigningFlags(
  signing: AndroidSigningConfig,
  resolvedEnv: Record<string, string>,
): string[] {
  const flags: string[] = [];
  const storePass = signing.storePasswordEnv ? resolvedEnv[signing.storePasswordEnv] : null;
  const keyPass = signing.keyPasswordEnv ? resolvedEnv[signing.keyPasswordEnv] : null;

  if (signing.keystorePath) flags.push(`-Pandroid.injected.signing.store.file=${signing.keystorePath}`);
  if (signing.keyAlias) flags.push(`-Pandroid.injected.signing.key.alias=${signing.keyAlias}`);
  if (storePass) flags.push(`-Pandroid.injected.signing.store.password=${storePass}`);
  if (keyPass) flags.push(`-Pandroid.injected.signing.key.password=${keyPass}`);

  return flags;
}
