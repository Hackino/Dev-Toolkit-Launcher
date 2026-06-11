import { useState, useEffect, useCallback } from 'react';
import type { BackendDetection, ProjectConfig } from '../../../shared/types';
import { isMobileType } from '../../../shared/category';

/**
 * Auto-detects runnable profiles + build command for every backend/web project
 * (per language). Returns a map keyed by project path. Mirrors {@link useMobile}.
 */
export function useBackendProfiles(projects: ProjectConfig[]): {
  detections: Record<string, BackendDetection>;
  refresh: () => Promise<void>;
} {
  const [detections, setDetections] = useState<Record<string, BackendDetection>>({});

  const load = useCallback(async () => {
    const backend = projects.filter((p) => !isMobileType(p.type));
    if (backend.length === 0) return;
    const results = await Promise.all(
      backend.map(async (p) => {
        const detection = await window.launcher.detectBackendProfiles({ projectPath: p.path, type: p.type });
        return [p.path, detection] as const;
      }),
    );
    setDetections((prev) => ({ ...prev, ...Object.fromEntries(results) }));
  }, [projects]);

  useEffect(() => {
    void load();
  }, [load]);

  return { detections, refresh: load };
}
