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
  | 'firebase';

export const MOBILE_TAB_LABELS: Record<MobileTabKey, string> = {
  platform: 'Platform',
  android: 'Android',
  ios: 'iOS',
  desktop: 'Desktop',
  web: 'Web',
  flutter: 'Flutter',
  kmp: 'KMP',
  firebase: 'Firebase',
};

/** The settings tabs each platform composes. */
const MOBILE_TABS: Record<MobilePlatform, MobileTabKey[]> = {
  'android': ['platform', 'android', 'firebase'],
  'ios': ['platform', 'ios', 'firebase'],
  'flutter': ['platform', 'flutter', 'android', 'ios', 'firebase'],
  'react-native': ['platform', 'android', 'ios', 'firebase'],
  'compose-multiplatform': ['platform', 'kmp', 'android', 'ios', 'desktop', 'web', 'firebase'],
};

export function mobileTabsFor(platform: MobilePlatform, _isEdit: boolean): MobileTabKey[] {
  return MOBILE_TABS[platform];
}

/** Whether a platform shows the Android Firebase row (any Android-capable platform). */
export function showsAndroidFirebase(platform: MobilePlatform): boolean {
  // An iOS-native project has no Android target, so Android Firebase is meaningless.
  return platform !== 'ios';
}

/** Whether a platform shows the iOS Firebase row (iOS-capable platforms only). */
export function showsIosFirebase(platform: MobilePlatform): boolean {
  return platform === 'ios' || platform === 'flutter' || platform === 'react-native' || platform === 'compose-multiplatform';
}

/** Whether a platform shows the Desktop Firebase row. */
export function showsDesktopFirebase(platform: MobilePlatform): boolean {
  return platform === 'compose-multiplatform';
}
