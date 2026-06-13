import { useState, useCallback, useEffect } from 'react';
import type { MobileIntrospection, MobilePlatform } from '../../../../shared/types';

/**
 * On-demand project introspection: detects gradle modules, application IDs,
 * bundle IDs, signing configs, and iOS settings so the settings UI can offer
 * them as dropdowns. Auto-runs once a project path is available so the
 * detection-only dropdowns populate without a manual click.
 */
export function useIntrospection(projectPath: string, platform: MobilePlatform, module?: string) {
  const [data, setData] = useState<MobileIntrospection | null>(null);
  const [loading, setLoading] = useState(false);

  const detect = useCallback(async (): Promise<MobileIntrospection | null> => {
    if (!projectPath.trim()) return null;
    setLoading(true);
    try {
      const result = await window.launcher.mobileIntrospect({ projectPath, platform, module });
      setData(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, [projectPath, platform, module]);

  // Auto-detect when the project path (or module) changes so dropdowns stay populated.
  useEffect(() => {
    if (projectPath.trim()) void detect();
  }, [detect, projectPath]);

  return { data, loading, detect };
}
