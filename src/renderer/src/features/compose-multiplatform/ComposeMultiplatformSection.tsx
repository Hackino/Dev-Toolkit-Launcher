import type { KmpTarget } from '../../../../shared/types';
import { KMP_TARGET_LABELS } from '../../../../shared/types';
import { BuildConfigEditor } from '../../capabilities/buildConfig/BuildConfigEditor';
import type { BuildFlagEntry } from '../../../../shared/types';

const ALL_TARGETS: KmpTarget[] = ['android', 'ios', 'desktop', 'web'];

interface Props {
  module: string;
  targets: KmpTarget[];
  ideHint: string;
  globalFlags: BuildFlagEntry[];
  onModuleChange: (v: string) => void;
  onTargetsChange: (v: KmpTarget[]) => void;
  onIdeHintChange: (v: string) => void;
  onGlobalFlagsChange: (v: BuildFlagEntry[]) => void;
}

const IS_MACOS = navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Mac');

export function ComposeMultiplatformSection({
  module,
  targets,
  ideHint,
  globalFlags,
  onModuleChange,
  onTargetsChange,
  onIdeHintChange,
  onGlobalFlagsChange,
}: Props) {
  const toggleTarget = (t: KmpTarget) => {
    const next = targets.includes(t) ? targets.filter((x) => x !== t) : [...targets, t];
    onTargetsChange(next);
  };

  return (
    <div className="mobile-section">
      <div className="mobile-section-title">Compose Multiplatform (KMP)</div>

      <div className="pf-field pf-field--row">
        <label className="pf-field pf-field--inline">
          <span>Gradle module</span>
          <input
            type="text"
            className="pf-mono"
            placeholder="composeApp"
            value={module}
            onChange={(e) => onModuleChange(e.target.value)}
          />
        </label>
        <label className="pf-field pf-field--inline">
          <span>IDE hint</span>
          <select value={ideHint} onChange={(e) => onIdeHintChange(e.target.value)}>
            <option value="">Auto-detect</option>
            <option value="intellij">IntelliJ IDEA</option>
            <option value="android-studio">Android Studio</option>
          </select>
        </label>
      </div>

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

      <BuildConfigEditor
        entries={globalFlags}
        onChange={onGlobalFlagsChange}
        context="android"
        label="Global Gradle Flags"
        placeholder="No global flags. Add --parallel, --no-daemon, etc."
      />
    </div>
  );
}
