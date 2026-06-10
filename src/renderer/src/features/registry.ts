/**
 * Renderer feature registry — composition root for the UI layer. Declares which
 * settings tabs each mobile platform exposes, so presentational/composition
 * components (MobileFormPanel) carry no per-platform switch logic. Adding a
 * platform tab = edit one declaration here.
 */
import type { MobilePlatform } from '../../../shared/types';

export type MobileTabKey =
  | 'platform'
  | 'android'
  | 'ios'
  | 'desktop'
  | 'web'
  | 'flutter'
  | 'kmp'
  | 'global'
  | 'native'
  | 'firebase'
  | 'version';

export const MOBILE_TAB_LABELS: Record<MobileTabKey, string> = {
  platform: 'Platform',
  android: 'Android',
  ios: 'iOS',
  desktop: 'Desktop',
  web: 'Web',
  flutter: 'Flutter',
  kmp: 'KMP',
  global: 'Global Flags',
  native: 'Native C++',
  firebase: 'Firebase',
  version: 'Version',
};

/** The settings tabs each platform composes (the `version` tab is appended in edit mode). */
const MOBILE_TABS: Record<MobilePlatform, MobileTabKey[]> = {
  'android': ['platform', 'android', 'native', 'firebase', 'global'],
  'ios': ['platform', 'ios', 'firebase', 'global'],
  'flutter': ['platform', 'flutter', 'android', 'ios', 'firebase', 'global'],
  'react-native': ['platform', 'android', 'ios', 'firebase', 'global'],
  'compose-multiplatform': ['platform', 'kmp', 'android', 'ios', 'desktop', 'web', 'native', 'firebase', 'global'],
};

export function mobileTabsFor(platform: MobilePlatform, isEdit: boolean): MobileTabKey[] {
  const tabs = MOBILE_TABS[platform];
  return isEdit ? [...tabs, 'version'] : tabs;
}

/** Whether a platform shows the iOS Firebase row (iOS-capable platforms only). */
export function showsIosFirebase(platform: MobilePlatform): boolean {
  return platform === 'ios' || platform === 'flutter' || platform === 'react-native' || platform === 'compose-multiplatform';
}

/** Whether a platform shows the Desktop Firebase row. */
export function showsDesktopFirebase(platform: MobilePlatform): boolean {
  return platform === 'compose-multiplatform';
}
