import type { KmpTarget } from '../../../../shared/types';
import { KMP_TARGET_LABELS } from '../../../../shared/types';
import { useIntrospection } from '../../capabilities/detection/useIntrospection';
import { SelectInput } from '../../capabilities/detection/SelectInput';

const ALL_TARGETS: KmpTarget[] = ['android', 'ios', 'desktop', 'web'];

interface Props {
  module: string;
  targets: KmpTarget[];
  projectPath: string;
  onModuleChange: (v: string) => void;
  onTargetsChange: (v: KmpTarget[]) => void;
}

const IS_MACOS = navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Mac');

export function ComposeMultiplatformSection({
  module,
  targets,
  projectPath,
  onModuleChange,
  onTargetsChange,
}: Props) {
  const { data: introspect, loading: introspecting, detect } = useIntrospection(projectPath, 'compose-multiplatform', module);

  const handleDetect = async () => {
    const result = await detect();
    if (result?.kmpTargets.length) {
      // Keep iOS only if this host can build it; otherwise apply detected set as-is.
      const applied = result.kmpTargets.filter((t) => t !== 'ios' || IS_MACOS);
      onTargetsChange(applied);
    }
  };

  const toggleTarget = (t: KmpTarget) => {
    const next = targets.includes(t) ? targets.filter((x) => x !== t) : [...targets, t];
    onTargetsChange(next);
  };

  return (
    <div className="mobile-section">
      <div className="mobile-section-title">Compose Multiplatform (KMP)</div>

      <div className="variant-detect">
        <span className="variant-detect-label">⚡ Auto-detect module &amp; targets</span>
        <div className="variant-detect-spacer" />
        <button
          type="button"
          className="variant-detect-btn variant-detect-btn--deep"
          disabled={!projectPath.trim() || introspecting}
          onClick={handleDetect}
          title="Read modules from settings.gradle and targets from the module's build.gradle.kts"
        >
          <span className={introspecting ? 'variant-spin' : ''}>⟳</span> Detect
        </button>
        {introspect && (
          <div className="variant-detect-status">
            {introspect.gradleModules.length} module(s), {introspect.kmpTargets.length} target(s)
          </div>
        )}
      </div>

      <label className="pf-field">
        <span>Gradle module</span>
        <SelectInput
          className="pf-mono"
          placeholder="composeApp"
          value={module}
          options={introspect?.gradleModules ?? []}
          onChange={onModuleChange}
        />
      </label>

      <div className="pf-field">
        <span>Build Targets</span>
        <div className="kmp-targets">
          {ALL_TARGETS.map((t) => {
            const isIos = t === 'ios';
            const disabled = isIos && !IS_MACOS;
            return (
              <label
                key={t}
                className={`kmp-target-chip ${targets.includes(t) ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                title={disabled ? 'iOS target requires macOS' : undefined}
              >
                <input
                  type="checkbox"
                  checked={targets.includes(t)}
                  disabled={disabled}
                  onChange={() => !disabled && toggleTarget(t)}
                />
                {KMP_TARGET_LABELS[t]}
                {disabled && <span className="kmp-disabled-note"> (macOS only)</span>}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
