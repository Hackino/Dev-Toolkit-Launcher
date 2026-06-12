import { useState, useCallback } from 'react';
import type { MobileIntrospection, MobilePlatform } from '../../../../shared/types';

/**
 * On-demand project introspection: detects gradle modules, application IDs,
 * bundle IDs, and signing configs so the settings UI can offer them as dropdowns.
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

  return { data, loading, detect };
}
