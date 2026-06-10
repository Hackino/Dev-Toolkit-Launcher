import { useState } from 'react';
import type { DetectedVariants, MobilePlatform } from '../../../../shared/types';

export type DetectKind = 'android' | 'flutter' | 'ios';

interface Props {
  projectPath: string;
  platform: MobilePlatform;
  module?: string;
  kind: DetectKind;
  onApply: (detected: DetectedVariants) => void;
}

/**
 * Toolbar that auto-detects build variants / flavors / entry points for a mobile
 * project. "Detect" parses gradle/xcode/dart files instantly; "Deep scan" shells
 * out to the toolchain (gradle / xcodebuild) for ground-truth.
 */
export function VariantDetector({ projectPath, platform, module, kind, onApply }: Props) {
  const [loading, setLoading] = useState<null | 'static' | 'deep'>(null);
  const [result, setResult] = useState<DetectedVariants | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasPath = !!projectPath.trim();

  const run = async (deep: boolean) => {
    if (!hasPath) {
      setError('Set the project path first.');
      return;
    }
    setLoading(deep ? 'deep' : 'static');
    setError(null);
    try {
      const detected = await window.launcher.mobileDetectVariants({ projectPath, platform, module, deep });
      setResult(detected);
      onApply(detected);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const chips =
    kind === 'android'
      ? result?.androidVariants ?? []
      : kind === 'flutter'
        ? (result?.flutterEntryPoints ?? []).map((e) => e.name)
        : result?.iosSchemes ?? [];

  const noun = kind === 'flutter' ? 'entry points' : 'build variants';

  return (
    <div className="variant-detect">
      <span className="variant-detect-label">⚡ Auto-detect {noun}</span>
      <div className="variant-detect-spacer" />
      <button
        type="button"
        className="variant-detect-btn"
        disabled={!hasPath || loading !== null}
        onClick={() => run(false)}
        title="Parse project files instantly (no toolchain needed)"
      >
        <span className={loading === 'static' ? 'variant-spin' : ''}>⟳</span> Detect
      </button>
      <button
        type="button"
        className="variant-detect-btn variant-detect-btn--deep"
        disabled={!hasPath || loading !== null}
        onClick={() => run(true)}
        title="Run gradle / xcodebuild for ground-truth (slower)"
      >
        <span className={loading === 'deep' ? 'variant-spin' : ''}>⌖</span> Deep scan
      </button>

      {!hasPath && (
        <div className="variant-detect-status">Set the project path above to enable detection.</div>
      )}
      {error && <div className="variant-detect-status variant-detect-status--warn">{error}</div>}

      {result && (
        <>
          {chips.length > 0 && (
            <div className="variant-chip-row">
              {chips.map((c) => (
                <span key={c} className="variant-chip variant-chip--on">{c}</span>
              ))}
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="variant-detect-status variant-detect-status--warn">
              {result.warnings.join(' · ')}
            </div>
          )}
          {chips.length === 0 && result.warnings.length === 0 && (
            <div className="variant-detect-status">Nothing detected — add configs manually below.</div>
          )}
          {chips.length > 0 && (
            <div className="variant-detect-status">
              Applied {chips.length} {noun} from {result.source === 'static' ? 'project files' : result.source}.
            </div>
          )}
        </>
      )}
    </div>
  );
}
