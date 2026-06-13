import { useState, useRef, useCallback, useMemo } from 'react';
import type { MobileDevice, ProjectConfig } from '../../../shared/types';
import { isMobileType } from '../../../shared/category';

const IOS_TYPES = ['ios', 'flutter', 'react-native', 'compose-multiplatform'];

export type DevicesApi = {
  devices: Record<string, MobileDevice[]>;
  refresh: () => Promise<void>;
  detecting: boolean;
};

/**
 * On-demand device detection. There is NO background polling — devices are listed
 * once, machine-globally (one adb + one xcrun call), only when `refresh()` is
 * called (the column's "Detect" button). The same result is shared across every
 * project since devices are not project-specific.
 */
export function useDevices(projects: ProjectConfig[]): DevicesApi {
  const [devices, setDevices] = useState<Record<string, MobileDevice[]>>({});
  const [detecting, setDetecting] = useState(false);
  const inFlight = useRef(false);

  const mobileProjects = useMemo(() => projects.filter((p) => isMobileType(p.type)), [projects]);
  const needAndroid = mobileProjects.some((p) => p.type !== 'ios');
  const needIos = mobileProjects.some((p) => IOS_TYPES.includes(p.type));

  const refresh = useCallback(async () => {
    if (inFlight.current || mobileProjects.length === 0) return;
    inFlight.current = true;
    setDetecting(true);
    try {
      const all = await window.launcher.mobileListAllDevices({ android: needAndroid, ios: needIos });
      const map: Record<string, MobileDevice[]> = {};
      for (const p of mobileProjects) map[p.path] = all;
      setDevices(map);
    } catch {
      // ignore — detection errors leave the previous list in place
    } finally {
      inFlight.current = false;
      setDetecting(false);
    }
  }, [needAndroid, needIos, mobileProjects]);

  return { devices, refresh, detecting };
}
