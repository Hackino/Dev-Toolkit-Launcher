import { useState } from 'react';
import type { AndroidBuildConfig, AndroidSigningConfig, MobilePlatform } from '../../../../shared/types';
import { BuildConfigEditor, MinifySection, type MinifyState } from '../../capabilities/buildConfig/BuildConfigEditor';
import { VariantDetector } from '../../capabilities/variants/VariantDetector';
import { applyAndroidDetection } from '../../capabilities/variants/variantApply';
import { FileDropField } from '../../capabilities/assets/FileDropField';
import { useIntrospection } from '../../capabilities/detection/useIntrospection';
import { DatalistInput } from '../../capabilities/detection/DatalistInput';

const KEYSTORE_FILTER = [{ name: 'Keystore', extensions: ['jks', 'keystore', 'p12', 'pfx'] }];

function newBuildConfig(name: string, buildType: string): AndroidBuildConfig {
  return {
    id: crypto.randomUUID(),
    name,
    buildType,
    flavor: null,
    isDefault: false,
    minify: { enabled: false, r8FullMode: false, proguardFiles: [] },
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
  signing: AndroidSigningConfig;
  projectPath: string;
  platform: MobilePlatform;
  onApplicationIdChange: (v: string) => void;
  onModuleChange: (v: string) => void;
  onConfigsChange: (v: AndroidBuildConfig[]) => void;
  onSigningChange: (v: AndroidSigningConfig) => void;
}

function BuildConfigItem({
  config,
  onUpdate,
  onRemove,
  canRemove,
}: {
  config: AndroidBuildConfig;
  onUpdate: (c: AndroidBuildConfig) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = <K extends keyof AndroidBuildConfig>(k: K, v: AndroidBuildConfig[K]) =>
    onUpdate({ ...config, [k]: v });

  const minifyState: MinifyState = {
    enabled: config.minify.enabled,
    r8FullMode: config.minify.r8FullMode,
    proguardFiles: config.minify.proguardFiles,
  };

  const activeFlags = config.customFlags.filter((f) => f.enabled).length;
  const advancedSummary = [
    config.minify.enabled ? 'R8 on' : null,
    activeFlags > 0 ? `${activeFlags} flag${activeFlags === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ') || 'none';

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
        <label className="mobile-default-check" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={config.isDefault}
            onChange={(e) => set('isDefault', e.target.checked)}
          />
          Default
        </label>
        {canRemove && (
          <button
            type="button"
            className="btn ghost pf-env-remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Remove"
          >✕</button>
        )}
      </div>

      {expanded && (
        <div className="mobile-card-body">
          <div className="pf-field pf-field--row">
            <label className="pf-field pf-field--inline">
              <span>Build type</span>
              <input
                type="text"
                value={config.buildType}
                placeholder="debug"
                onChange={(e) => set('buildType', e.target.value)}
              />
            </label>
            <label className="pf-field pf-field--inline">
              <span>Flavor <small>(optional)</small></span>
              <input
                type="text"
                value={config.flavor ?? ''}
                placeholder="e.g. staging"
                onChange={(e) => set('flavor', e.target.value || null)}
              />
            </label>
          </div>

          <button
            type="button"
            className="mobile-advanced-toggle"
            onClick={() => setShowAdvanced((s) => !s)}
          >
            <span className="mobile-card-chevron">{showAdvanced ? '▾' : '▸'}</span>
            <span>Advanced</span>
            <span className="mobile-advanced-summary">R8 / ProGuard · custom flags — {advancedSummary}</span>
          </button>

          {showAdvanced && (
            <div className="mobile-advanced-body">
              <MinifySection
                value={minifyState}
                onChange={(v) => onUpdate({ ...config, minify: v })}
              />

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
      )}
    </div>
  );
}

export function AndroidSettingsSection({
  applicationId,
  module,
  configs,
  signing,
  projectPath,
  platform,
  onApplicationIdChange,
  onModuleChange,
  onConfigsChange,
  onSigningChange,
}: Props) {
  const addConfig = () =>
    onConfigsChange([...configs, newBuildConfig(`Config ${configs.length + 1}`, 'release')]);

  const updateConfig = (id: string, c: AndroidBuildConfig) =>
    onConfigsChange(configs.map((x) => (x.id === id ? c : x)));

  const removeConfig = (id: string) =>
    onConfigsChange(configs.filter((x) => x.id !== id));

  const setSigning = <K extends keyof AndroidSigningConfig>(k: K, v: AndroidSigningConfig[K]) =>
    onSigningChange({ ...signing, [k]: v });

  const { data: introspect, loading: introspecting, detect } = useIntrospection(projectPath, platform, module);

  const applySigningFromGradle = () => {
    const sc = introspect?.signingConfigs.find((c) => /release/i.test(c.name)) ?? introspect?.signingConfigs[0];
    if (!sc) return;
    onSigningChange({
      keystorePath: sc.storeFile ?? signing.keystorePath,
      keyAlias: sc.keyAlias ?? signing.keyAlias,
      storePasswordEnv: sc.storePasswordEnv ?? signing.storePasswordEnv,
      keyPasswordEnv: sc.keyPasswordEnv ?? signing.keyPasswordEnv,
    });
  };

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
          title="Read module, application IDs, and signing from the project"
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
          <DatalistInput
            className="pf-mono"
            placeholder="com.example.app"
            value={applicationId}
            options={introspect?.applicationIds ?? []}
            onChange={onApplicationIdChange}
          />
        </label>
        <label className="pf-field pf-field--inline">
          <span>Gradle module</span>
          <DatalistInput
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
        <button type="button" className="btn ghost pf-env-add" onClick={addConfig}>+ Add</button>
      </div>

      {configs.map((c) => (
        <BuildConfigItem
          key={c.id}
          config={c}
          onUpdate={(updated) => updateConfig(c.id, updated)}
          onRemove={() => removeConfig(c.id)}
          canRemove={configs.length > 1}
        />
      ))}

      <div className="mobile-subsection-header" style={{ marginTop: 16 }}>
        <span>Keystore / Signing</span>
        {introspect && introspect.signingConfigs.length > 0 && (
          <button type="button" className="variant-detect-btn" onClick={applySigningFromGradle} title="Fill from the project's signingConfigs">
            ⚡ From build.gradle
          </button>
        )}
      </div>
      <FileDropField
        label="Keystore (.jks / .keystore)"
        value={signing.keystorePath ?? ''}
        projectPath={projectPath}
        platform={platform}
        kind="keystore"
        filters={KEYSTORE_FILTER}
        hint="Drop your release keystore here"
        onChange={(relPath) => setSigning('keystorePath', relPath || null)}
      />
      <div className="mobile-signing-grid">
        <label className="pf-field">
          <span>Key alias</span>
          <input
            type="text"
            className="pf-mono"
            placeholder="my-key-alias"
            value={signing.keyAlias ?? ''}
            onChange={(e) => setSigning('keyAlias', e.target.value || null)}
          />
        </label>
        <label className="pf-field">
          <span>Store password env var</span>
          <input
            type="text"
            className="pf-mono"
            placeholder="STORE_PASSWORD"
            value={signing.storePasswordEnv ?? ''}
            onChange={(e) => setSigning('storePasswordEnv', e.target.value || null)}
          />
        </label>
        <label className="pf-field">
          <span>Key password env var</span>
          <input
            type="text"
            className="pf-mono"
            placeholder="KEY_PASSWORD"
            value={signing.keyPasswordEnv ?? ''}
            onChange={(e) => setSigning('keyPasswordEnv', e.target.value || null)}
          />
        </label>
      </div>
      <div className="mobile-signing-note">
        Passwords are never stored. Enter the env variable name — the actual value is read from your environment at build time.
      </div>
    </div>
  );
}
