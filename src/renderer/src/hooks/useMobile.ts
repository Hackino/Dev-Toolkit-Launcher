import { useState, useEffect, useCallback } from 'react';
import type { FirebaseConfig, MobileBuildRecord, MobileConfig, ProjectConfig } from '../../../shared/types';
import { isMobileType } from '../../../shared/category';

export type MobileProjectData = {
  config: MobileConfig | null;
  firebase: FirebaseConfig[];
  lastBuild: MobileBuildRecord | null;
};

export function useMobile(projects: ProjectConfig[]): Record<string, MobileProjectData> {
  const [data, setData] = useState<Record<string, MobileProjectData>>({});

  const load = useCallback(async () => {
    const mobileProjects = projects.filter((p) => isMobileType(p.type));
    if (mobileProjects.length === 0) return;

    const results = await Promise.all(
      mobileProjects.map(async (p) => {
        const [config, firebase, lastBuild] = await Promise.all([
          window.launcher.getMobileConfig(p.id),
          window.launcher.listFirebaseConfigs(p.id),
          window.launcher.mobileGetBuildRecord({ projectPath: p.path }),
        ]);
        return [p.path, { config, firebase, lastBuild }] as const;
      }),
    );
    setData(Object.fromEntries(results));
  }, [projects]);

  useEffect(() => { load(); }, [load]);

  return data;
}
