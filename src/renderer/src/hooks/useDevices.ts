import { useState, useEffect, useRef, useCallback } from 'react';
import type { MobileDevice, ProjectConfig } from '../../../shared/types';
import { isMobileType } from '../../../shared/category';

const POLL_INTERVAL = 4000;

export function useDevices(projects: ProjectConfig[]): Record<string, MobileDevice[]> {
  const [devices, setDevices] = useState<Record<string, MobileDevice[]>>({});
  const inFlight = useRef(false);

  const hasMobile = projects.some((p) => isMobileType(p.type));

  const poll = useCallback(async () => {
    if (inFlight.current || !hasMobile) return;
    inFlight.current = true;
    try {
      const mobileProjects = projects.filter((p) => isMobileType(p.type));
      const results = await Promise.all(
        mobileProjects.map(async (p) => {
          const devs = await window.launcher.mobileListDevices({ projectPath: p.path });
          return [p.path, devs] as const;
        }),
      );
      setDevices(Object.fromEntries(results));
    } catch {
      // silently ignore poll errors
    } finally {
      inFlight.current = false;
    }
  }, [projects, hasMobile]);

  useEffect(() => {
    if (!hasMobile) return;
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll, hasMobile]);

  return devices;
}
