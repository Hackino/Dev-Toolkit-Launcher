import type { MobilePlatform, KmpTarget, MobileConfig } from '../../../shared/types';

/**
 * Multi-platform mobile projects (Flutter, React Native, Compose Multiplatform)
 * are spread into one column per platform/target instead of switching with a
 * dropdown. This module declares the targets a project fans out into.
 */
export type ColumnTargetKind = 'android' | 'ios' | 'desktop' | 'web';

export type MobileColumnTarget = {
  key: string;                 // unique within the project (used in the React key)
  label: string;              // 'Android' | 'iOS' | 'Desktop' | 'Web'
  kind: ColumnTargetKind;
  kmpTarget: KmpTarget;        // value sent to the backend to pick the platform build
};

const MULTI_PLATFORM: MobilePlatform[] = ['flutter', 'react-native', 'compose-multiplatform'];

export function isMultiPlatform(platform: MobilePlatform): boolean {
  return MULTI_PLATFORM.includes(platform);
}

const KIND_LABEL: Record<ColumnTargetKind, string> = {
  android: 'Android',
  ios: 'iOS',
  desktop: 'Desktop',
  web: 'Web',
};

/** The per-platform columns a multi-platform project should render. */
export function columnTargetsFor(platform: MobilePlatform, config: MobileConfig | null): MobileColumnTarget[] {
  if (platform === 'compose-multiplatform') {
    const targets = config?.kmpTargets?.length ? config.kmpTargets : (['android'] as KmpTarget[]);
    return targets.map((t) => ({ key: t, label: KIND_LABEL[t], kind: t, kmpTarget: t }));
  }
  if (platform === 'flutter' || platform === 'react-native') {
    return [
      { key: 'android', label: 'Android', kind: 'android', kmpTarget: 'android' },
      { key: 'ios', label: 'iOS', kind: 'ios', kmpTarget: 'ios' },
    ];
  }
  // Single-platform (android / ios native) — handled as a single column without a target.
  return [];
}
