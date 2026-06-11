/** Helpers for working with detected backend application URLs. */

/** Wildcard hosts (+, *, 0.0.0.0) in declared URLs mean "any interface" → localhost. */
export function normalizeUrl(url: string): string {
  return url.replace(/:\/\/(\+|\*|0\.0\.0\.0)(?=[:/]|$)/, '://localhost');
}

export function portOfUrl(url: string): number | null {
  const m = url.match(/:(\d{2,5})(?:\/|$)/);
  if (m) return Number(m[1]);
  try {
    const u = new URL(normalizeUrl(url));
    return u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
}

export function isLocalhost(url: string): boolean {
  try {
    return new URL(normalizeUrl(url)).hostname === 'localhost';
  } catch {
    return false;
  }
}
