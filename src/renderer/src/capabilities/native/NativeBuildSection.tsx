import type { NativeBuildConfig } from '../../../../shared/types';
import { BuildConfigEditor } from '../buildConfig/BuildConfigEditor';

const COMMON_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'];

interface Props {
  value: NativeBuildConfig;
  onChange: (v: NativeBuildConfig) => void;
}

export const DEFAULT_NATIVE_CONFIG: NativeBuildConfig = {
  enabled: false,
  cmakeListsPath: null,
  ndkVersion: null,
  abiFilters: [],
  cmakeFlags: [],
};

export function NativeBuildSection({ value, onChange }: Props) {
  const set = <K extends keyof NativeBuildConfig>(k: K, v: NativeBuildConfig[K]) =>
    onChange({ ...value, [k]: v });

  const toggleAbi = (abi: string) => {
    const next = value.abiFilters.includes(abi)
      ? value.abiFilters.filter((a: string) => a !== abi)
      : [...value.abiFilters, abi];
    set('abiFilters', next);
  };

  return (
    <div className="mobile-section">
      <div className="mobile-section-title">
        <label className="mobile-toggle-label">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          />
          Native C++ Build (CMake / NDK)
        </label>
      </div>

      {value.enabled && (
        <>
          <div className="pf-field pf-field--row">
            <label className="pf-field pf-field--inline">
              <span>CMakeLists.txt path</span>
              <input
                type="text"
                className="pf-mono"
                placeholder="src/main/cpp/CMakeLists.txt"
                value={value.cmakeListsPath ?? ''}
                onChange={(e) => set('cmakeListsPath', e.target.value || null)}
              />
            </label>
            <label className="pf-field pf-field--inline">
              <span>NDK version</span>
              <input
                type="text"
                className="pf-mono"
                placeholder="26.1.10909125"
                value={value.ndkVersion ?? ''}
                onChange={(e) => set('ndkVersion', e.target.value || null)}
              />
            </label>
          </div>

          <div className="pf-field">
            <span>ABI Filters</span>
            <div className="kmp-targets">
              {COMMON_ABIS.map((abi) => (
                <label key={abi} className={`kmp-target-chip ${value.abiFilters.includes(abi) ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={value.abiFilters.includes(abi)}
                    onChange={() => toggleAbi(abi)}
                  />
                  {abi}
                </label>
              ))}
            </div>
          </div>

          <BuildConfigEditor
            entries={value.cmakeFlags}
            onChange={(flags) => set('cmakeFlags', flags)}
            context="android"
            label="CMake Flags"
            placeholder="No CMake flags. Add -DCMAKE_BUILD_TYPE=Release as gradle-prop entries."
          />
        </>
      )}
    </div>
  );
}
