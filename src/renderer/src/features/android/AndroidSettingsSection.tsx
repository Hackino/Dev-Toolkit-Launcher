import { useState, useEffect } from 'react';
import type { AndroidBuildConfig, AndroidBuildTypeInfo, MobilePlatform } from '../../../../shared/types';
import { BuildConfigEditor } from '../../capabilities/buildConfig/BuildConfigEditor';
import { VariantDetector } from '../../capabilities/variants/VariantDetector';
import { applyAndroidDetection } from '../../capabilities/variants/variantApply';
import { useIntrospection } from '../../capabilities/detection/useIntrospection';
import { SelectInput } from '../../capabilities/detection/SelectInput';

function newBuildConfig(name: string, buildType: string): AndroidBuildConfig {
  return {
    id: crypto.randomUUID(),
    name,
    buildType,
    flavor: null,
    isDefault: false,
    debuggable: buildType !== 'release',
    signingConfig: null,
    minify: { enabled: false, proguardFiles: [] },
    customFlags: [],
  };
}

export const DEFAULT_ANDROID_CONFIGS: AndroidBuildConfig[] = [
  { ...newBuildConfig('Debug', 'debug'), isDefault: true },
];

interface Props {
  applicationId: string;
  module: string;
  configs: AndroidBuildConfig[];
  projectPath: string;
  platform: MobilePlatform;
  onApplicationIdChange: (v: string) => void;
  onModuleChange: (v: string) => void;
  onConfigsChange: (v: AndroidBuildConfig[]) => void;
}

const sameFiles = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function BuildConfigItem({
  config,
  signingConfigNames,
  detected,
  onUpdate,
}: {
  config: AndroidBuildConfig;
  signingConfigNames: string[];
  detected: boolean;
  onUpdate: (c: AndroidBuildConfig) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const set = <K extends keyof AndroidBuildConfig>(k: K, v: AndroidBuildConfig[K]) =>
    onUpdate({ ...config, [k]: v });

  return (
    <div className="mobile-card">
      <div className="mobile-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="mobile-card-chevron">{expanded ? '▾' : '▸'}</span>
        <input
          className="mobile-card-name"
          type="text"
          value={config.name}
          placeholder="Config name"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      {expanded && (
        <div className="mobile-card-body">
          <div className="mobile-detected-note">
            {detected
              ? 'Detected from build.gradle — read-only.'
              : `No "${config.buildType}" build type detected in build.gradle.`}
          </div>

          <div className="pf-field pf-field--row">
            <label className="minify-opt minify-opt--readonly">
              <input type="checkbox" checked={config.debuggable} disabled readOnly />
              <span>Debuggable</span>
            </label>
            <label className="pf-field pf-field--inline">
              <span>Signing config <small>(detected)</small></span>
              <SelectInput
                className="pf-mono"
                placeholder="(none)"
                value={config.signingConfig ?? ''}
                options={signingConfigNames}
                onChange={(v) => set('signingConfig', v || null)}
                disabled
              />
            </label>
          </div>

          <div className="minify-section">
            <div className="minify-header">Minify / R8</div>
            <label className="minify-opt minify-opt--readonly">
              <input type="checkbox" checked={config.minify.enabled} disabled readOnly />
              <span>Enable R8</span>
            </label>
            <div className="minify-proguard">
              <div className="minify-files-header"><span>ProGuard files</span></div>
              {config.minify.proguardFiles.length > 0 ? (
                config.minify.proguardFiles.map((f, i) => (
                  <code key={i} className="pf-mono minify-file-readonly">{f}</code>
                ))
              ) : (
                <span className="pf-env-empty">None detected</span>
              )}
            </div>
          </div>

          <BuildConfigEditor
            entries={config.customFlags}
            onChange={(flags) => set('customFlags', flags)}
            context="android"
            label="Custom Gradle Flags"
            placeholder="No extra flags. Add -P props, --flags, or env vars."
          />
        </div>
      )}
    </div>
  );
}

export function AndroidSettingsSection({
  applicationId,
  module,
  configs,
  projectPath,
  platform,
  onApplicationIdChange,
  onModuleChange,
  onConfigsChange,
}: Props) {
  const updateConfig = (id: string, c: AndroidBuildConfig) =>
    onConfigsChange(configs.map((x) => (x.id === id ? c : x)));

  const { data: introspect, loading: introspecting, detect } = useIntrospection(projectPath, platform, module);
  const signingConfigNames = introspect?.signingConfigs.map((s) => s.name) ?? [];
  const byType = new Map<string, AndroidBuildTypeInfo>(
    (introspect?.buildTypeConfigs ?? []).map((b) => [b.name.toLowerCase(), b]),
  );

  // Auto-apply detected per-buildType settings onto each config, and auto-create
  // a card for every detected build type (e.g. release) so its proguard / minify /
  // signing show up without manual variant detection. All read-only in the UI.
  useEffect(() => {
    if (!introspect) return;
    const detected = introspect.buildTypeConfigs;
    if (detected.length === 0) return;
    let changed = false;

    const next = configs.map((c) => {
      const info = byType.get(c.buildType.toLowerCase());
      if (!info) return c;
      if (
        c.debuggable === info.debuggable &&
        c.signingConfig === info.signingConfig &&
        c.minify.enabled === info.minifyEnabled &&
        sameFiles(c.minify.proguardFiles, info.proguardFiles)
      ) {
        return c;
      }
      changed = true;
      return {
        ...c,
        debuggable: info.debuggable,
        signingConfig: info.signingConfig,
        minify: { enabled: info.minifyEnabled, proguardFiles: info.proguardFiles },
      };
    });

    // Add a card for any detected build type that has no card yet.
    const have = new Set(next.map((c) => c.buildType.toLowerCase()));
    for (const info of detected) {
      if (have.has(info.name.toLowerCase())) continue;
      changed = true;
      next.push({
        id: crypto.randomUUID(),
        name: info.name.charAt(0).toUpperCase() + info.name.slice(1),
        buildType: info.name,
        flavor: null,
        isDefault: false,
        debuggable: info.debuggable,
        signingConfig: info.signingConfig,
        minify: { enabled: info.minifyEnabled, proguardFiles: info.proguardFiles },
        customFlags: [],
      });
    }

    if (changed) onConfigsChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introspect]);

  return (
    <div className="mobile-section">
      <div className="mobile-section-title">Android Settings</div>

      <div className="variant-detect">
        <span className="variant-detect-label">⚡ Auto-detect settings</span>
        <div className="variant-detect-spacer" />
        <button
          type="button"
          className="variant-detect-btn variant-detect-btn--deep"
          disabled={!projectPath.trim() || introspecting}
          onClick={detect}
          title="Read module, application IDs, signing configs, and build types from the project"
        >
          <span className={introspecting ? 'variant-spin' : ''}>⟳</span> Detect
        </button>
        {!projectPath.trim() && <div className="variant-detect-status">Set the project path above to enable detection.</div>}
        {introspect && (
          <div className="variant-detect-status">
            {introspect.gradleModules.length} module(s) · {introspect.applicationIds.length} app id(s) · {introspect.signingConfigs.length} signing config(s)
          </div>
        )}
      </div>

      <div className="pf-field pf-field--row">
        <label className="pf-field pf-field--inline">
          <span>Application ID</span>
          <SelectInput
            className="pf-mono"
            placeholder="com.example.app"
            value={applicationId}
            options={introspect?.applicationIds ?? []}
            onChange={onApplicationIdChange}
          />
        </label>
        <label className="pf-field pf-field--inline">
          <span>Gradle module</span>
          <SelectInput
            className="pf-mono"
            placeholder="app"
            value={module}
            options={introspect?.gradleModules ?? []}
            onChange={onModuleChange}
          />
        </label>
      </div>

      <VariantDetector
        projectPath={projectPath}
        platform={platform}
        module={module}
        kind="android"
        onApply={(d) => onConfigsChange(applyAndroidDetection(configs, d))}
      />

      <div className="mobile-subsection-header">
        <span>Build Configurations</span>
      </div>

      {configs.map((c) => (
        <BuildConfigItem
          key={c.id}
          config={c}
          signingConfigNames={signingConfigNames}
          detected={byType.has(c.buildType.toLowerCase())}
          onUpdate={(updated) => updateConfig(c.id, updated)}
        />
      ))}
    </div>
  );
}
