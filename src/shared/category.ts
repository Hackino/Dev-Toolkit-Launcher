// Runtime helpers for ProjectType → ProjectCategory discrimination.
// Kept here (not in types.ts) because types.ts is "no runtime code".

import type { ProjectType, ProjectCategory, MobilePlatform } from './types';

const MOBILE_PLATFORMS: ReadonlySet<string> = new Set([
  'android',
  'ios',
  'flutter',
  'react-native',
  'compose-multiplatform',
]);

export function categoryOfType(t: ProjectType): ProjectCategory {
  return MOBILE_PLATFORMS.has(t) ? 'mobile' : 'backend';
}

export function isMobileType(t: ProjectType): t is MobilePlatform {
  return MOBILE_PLATFORMS.has(t);
}
