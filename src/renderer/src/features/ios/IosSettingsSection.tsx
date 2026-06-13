import { useState } from 'react';
import type { IosBuildConfig, IosSigningConfig, IosSigningStyle, MobilePlatform } from '../../../../shared/types';
import { BuildConfigEditor } from '../../capabilities/buildConfig/BuildConfigEditor';
import { VariantDetector } from '../../capabilities/variants/VariantDetector';
import { applyIosDetection } from '../../capabilities/variants/variantApply';
import { useIntrospection } from '../../capabilities/detection/useIntrospection';
import { SelectInput } from '../../capabilities/detection/SelectInput';

function newIosConfig(name: string, scheme: string): IosBuildConfig {
  return {
    id: crypto.randomUUID(),
    name,
    scheme,
    configuration: name,
    isDefault: false,
    customFlags: [],
  };
}

export const DEFAULT_IOS_CONFIGS: IosBuildConfig[] = [
  { ...newIosConfig('Debug', 'MyApp'), isDefault: true },
];

const IS_MACOS = navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Mac');

interface Props {
  workspace: string;
  configs: IosBuildConfig[];
  signing: IosSigningConfig;
  projectPath: string;
  platform: MobilePlatform;
  onWorkspaceChange: (v: string) => void;
  onConfigsChange: (v: IosBuildConfig[]) => void;
  onSigningChange: (v: IosSigningConfig) => void;
}

function IosConfigItem({
  config,
  onUpdate,
  onRemove,
  canRemove,
}: {
  config: IosBuildConfig;
  onUpdate: (c: IosBuildConfig) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const set = <K extends keyof IosBuildConfig>(k: K, v: IosBuildConfig[K]) =>
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
          <BuildConfigEditor
            entries={config.customFlags}
            onChange={(flags) => set('customFlags', flags)}
            context="ios"
            label="Custom Xcode Flags"
            placeholder="No extra flags. Add build settings or xcodebuild flags."
          />
        </div>
      )}
    </div>
  );
}

export function IosSettingsSection({
  workspace,
  configs,
  signing,
  projectPath,
  platform,
  onWorkspaceChange,
  onConfigsChange,
  onSigningChange,
}: Props) {
  if (!IS_MACOS) {
    return (
      <div className="mobile-section">
        <div className="mobile-ios-warning">
          iOS configuration is available on macOS only. You can still view and edit settings, but iOS builds will be disabled when running on this platform.
        </div>
      </div>
    );
  }

  const addConfig = () =>
    onConfigsChange([...configs, newIosConfig(`Config ${configs.length + 1}`, 'MyApp')]);

  const updateConfig = (id: string, c: IosBuildConfig) =>
    onConfigsChange(configs.map((x) => (x.id === id ? c : x)));

  const removeConfig = (id: string) =>
    onConfigsChange(configs.filter((x) => x.id !== id));

  const setSigning = <K extends keyof IosSigningConfig>(k: K, v: IosSigningConfig[K]) =>
    onSigningChange({ ...signing, [k]: v });

  const { data: introspect, loading: introspecting, detect } = useIntrospection(projectPath, platform);

  return (
    <div className="mobile-section">
      <div className="mobile-section-title">iOS Settings</div>

      <div className="variant-detect">
        <span className="variant-detect-label">⚡ Auto-detect settings</span>
        <div className="variant-detect-spacer" />
        <button
          type="button"
          className="variant-detect-btn variant-detect-btn--deep"
          disabled={!projectPath.trim() || introspecting}
          onClick={detect}
          title="Read workspace, bundle IDs, and signing from the Xcode project"
        >
          <span className={introspecting ? 'variant-spin' : ''}>⟳</span> Detect
        </button>
        {introspect && (
          <div className="variant-detect-status">
            {introspect.iosWorkspaces.length} workspace(s) · {introspect.bundleIds.length} bundle id(s) · {introspect.iosTeamIds.length} team(s)
          </div>
        )}
      </div>

      <label className="pf-field">
        <span>Workspace / Project path <small>(detected — relative to project root)</small></span>
        <SelectInput
          className="pf-mono"
          placeholder="MyApp.xcworkspace"
          value={workspace}
          options={introspect?.iosWorkspaces ?? []}
          onChange={onWorkspaceChange}
        />
      </label>

      <VariantDetector
        projectPath={projectPath}
        platform={platform}
        kind="ios"
        onApply={(d) => onConfigsChange(applyIosDetection(configs, d))}
      />

      <div className="mobile-subsection-header">
        <span>Build Configurations</span>
        <button type="button" className="btn ghost pf-env-add" onClick={addConfig}>+ Add</button>
      </div>

      {configs.map((c) => (
        <IosConfigItem
          key={c.id}
          config={c}
          onUpdate={(updated) => updateConfig(c.id, updated)}
          onRemove={() => removeConfig(c.id)}
          canRemove={configs.length > 1}
        />
      ))}

      <div className="mobile-subsection-header" style={{ marginTop: 16 }}>
        <span>Signing</span>
      </div>
      <div className="mobile-signing-grid">
        <label className="pf-field">
          <span>Bundle ID</span>
          <SelectInput
            className="pf-mono"
            placeholder="com.example.app"
            value={signing.bundleId ?? ''}
            options={introspect?.bundleIds ?? []}
            onChange={(v) => setSigning('bundleId', v || null)}
          />
        </label>
        <label className="pf-field">
          <span>Team ID</span>
          <SelectInput
            className="pf-mono"
            placeholder="ABCDE12345"
            value={signing.teamId ?? ''}
            options={introspect?.iosTeamIds ?? []}
            onChange={(v) => setSigning('teamId', v || null)}
          />
        </label>
        <label className="pf-field">
          <span>Deployment Target</span>
          <SelectInput
            placeholder="15.0"
            value={signing.deploymentTarget ?? ''}
            options={introspect?.iosDeploymentTargets ?? []}
            onChange={(v) => setSigning('deploymentTarget', v || null)}
          />
        </label>
        <div className="pf-field">
          <span>Signing Style</span>
          <div className="pf-protocol">
            {(['automatic', 'manual'] as IosSigningStyle[]).map((s) => (
              <label key={s} className="pf-protocol-opt">
                <input
                  type="radio"
                  checked={signing.signingStyle === s}
                  onChange={() => setSigning('signingStyle', s)}
                />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </label>
            ))}
          </div>
        </div>
        {signing.signingStyle === 'manual' && (
          <>
            <label className="pf-field">
              <span>Certificate name</span>
              <SelectInput
                placeholder="iPhone Distribution: My Company"
                value={signing.certificateName ?? ''}
                options={introspect?.iosCertificates ?? []}
                onChange={(v) => setSigning('certificateName', v || null)}
              />
            </label>
            <label className="pf-field">
              <span>Provisioning profile</span>
              <SelectInput
                placeholder="MyApp_AppStore"
                value={signing.provisioningProfile ?? ''}
                options={introspect?.iosProvisioningProfiles ?? []}
                onChange={(v) => setSigning('provisioningProfile', v || null)}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
