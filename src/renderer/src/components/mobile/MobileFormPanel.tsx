import { useState } from 'react';
import type {
  MobilePlatform,
  AndroidBuildConfig,
  AndroidSigningConfig,
  IosBuildConfig,
  IosSigningConfig,
  FlutterEntryPoint,
  NativeBuildConfig,
  KmpTarget,
  BuildFlagEntry,
  ProjectConfig,
} from '../../../../shared/types';
import { MOBILE_PLATFORM_LABELS } from '../../../../shared/types';
import { PlatformLogo } from './mobileLogos';
import { AndroidSettingsSection, DEFAULT_ANDROID_CONFIGS } from './AndroidSettingsSection';
import { IosSettingsSection, DEFAULT_IOS_CONFIGS } from './IosSettingsSection';
import { FlutterSettingsSection, DEFAULT_FLUTTER_ENTRIES } from './FlutterSettingsSection';
import { ComposeMultiplatformSection } from './ComposeMultiplatformSection';
import { GlobalFlagsSection } from './GlobalFlagsSection';
import { FirebaseSection, DEFAULT_FIREBASE_STATE, type FirebaseFormState } from './FirebaseSection';
import { NativeBuildSection, DEFAULT_NATIVE_CONFIG } from './NativeBuildSection';
import { VersionPanel } from './VersionPanel';

const PLATFORMS: MobilePlatform[] = ['android', 'ios', 'flutter', 'react-native', 'compose-multiplatform'];

const DEFAULT_SIGNING: AndroidSigningConfig = {
  keystorePath: null, keyAlias: null, storePasswordEnv: null, keyPasswordEnv: null,
};
const DEFAULT_IOS_SIGNING: IosSigningConfig = {
  bundleId: null, teamId: null, signingStyle: 'automatic', certificateName: null, provisioningProfile: null, deploymentTarget: null,
};

type MobileState = {
  name: string;
  path: string;
  platform: MobilePlatform;
  applicationId: string;
  androidModule: string;
  androidConfigs: AndroidBuildConfig[];
  androidSigning: AndroidSigningConfig;
  iosWorkspace: string;
  iosConfigs: IosBuildConfig[];
  iosSigning: IosSigningConfig;
  flutterEntries: FlutterEntryPoint[];
  kmpModule: string;
  kmpTargets: KmpTarget[];
  kmpIdeHint: string;
  native: NativeBuildConfig;
  globalFlags: BuildFlagEntry[];
  firebase: FirebaseFormState;
};

function defaultState(platform: MobilePlatform): MobileState {
  return {
    name: '',
    path: '',
    platform,
    applicationId: '',
    androidModule: 'app',
    androidConfigs: DEFAULT_ANDROID_CONFIGS,
    androidSigning: DEFAULT_SIGNING,
    iosWorkspace: '',
    iosConfigs: DEFAULT_IOS_CONFIGS,
    iosSigning: DEFAULT_IOS_SIGNING,
    flutterEntries: DEFAULT_FLUTTER_ENTRIES,
    kmpModule: 'composeApp',
    kmpTargets: ['android'],
    kmpIdeHint: '',
    native: DEFAULT_NATIVE_CONFIG,
    globalFlags: [],
    firebase: DEFAULT_FIREBASE_STATE,
  };
}

type Tab = 'platform' | 'android' | 'ios' | 'flutter' | 'kmp' | 'global' | 'native' | 'firebase' | 'version';

function tabsForPlatform(platform: MobilePlatform, isEdit: boolean): Tab[] {
  const base: Tab[] = ['platform'];
  if (platform === 'android') return [...base, 'android', 'native', 'firebase', 'global', ...(isEdit ? ['version' as Tab] : [])];
  if (platform === 'ios') return [...base, 'ios', 'firebase', 'global', ...(isEdit ? ['version' as Tab] : [])];
  if (platform === 'flutter') return [...base, 'flutter', 'android', 'ios', 'firebase', 'global', ...(isEdit ? ['version' as Tab] : [])];
  if (platform === 'react-native') return [...base, 'android', 'ios', 'firebase', 'global', ...(isEdit ? ['version' as Tab] : [])];
  if (platform === 'compose-multiplatform') return [...base, 'kmp', 'android', 'native', 'firebase', 'global', ...(isEdit ? ['version' as Tab] : [])];
  return base;
}

const TAB_LABELS: Record<Tab, string> = {
  platform: 'Platform',
  android: 'Android',
  ios: 'iOS',
  flutter: 'Flutter',
  kmp: 'KMP',
  global: 'Global Flags',
  native: 'Native C++',
  firebase: 'Firebase',
  version: 'Version',
};

interface Props {
  workspaceId: string;
  editingProject?: ProjectConfig | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function MobileFormPanel({ workspaceId, editingProject, onSaved, onCancel }: Props) {
  const isEdit = !!editingProject;
  const [state, setState] = useState<MobileState>(() =>
    editingProject
      ? { ...defaultState(editingProject.type as MobilePlatform), name: editingProject.name, path: editingProject.path }
      : defaultState('android')
  );
  const [activeTab, setActiveTab] = useState<Tab>('platform');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof MobileState>(k: K, v: MobileState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const changePlatform = (p: MobilePlatform) => {
    setState((s) => ({ ...defaultState(p), name: s.name, path: s.path }));
    setActiveTab('platform');
  };

  const browseProjectPath = async () => {
    const picked = await window.launcher.pickDirectory({ title: 'Select mobile project folder' });
    if (picked) set('path', picked);
  };

  const tabs = tabsForPlatform(state.platform, isEdit);

  const save = async () => {
    if (!state.name.trim()) { setError('Project name is required'); return; }
    if (!state.path.trim()) { setError('Project path is required'); return; }
    setSaving(true);
    setError(null);
    try {
      let projectId: string;
      if (isEdit) {
        await window.launcher.updateProject(editingProject.id, {
          name: state.name.trim(),
          path: state.path.trim(),
        });
        projectId = editingProject.id;
      } else {
        const project = await window.launcher.createProject({
          workspaceId,
          name: state.name.trim(),
          type: state.platform,
          category: 'mobile',
          path: state.path.trim(),
          runCommand: '',
        });
        projectId = project.id;
      }

      await window.launcher.saveMobileConfig(projectId, {
        platform: state.platform,
        applicationId: state.applicationId || null,
        androidModule: state.androidModule || 'app',
        androidBuildConfigs: state.androidConfigs,
        androidSigning: state.androidSigning,
        iosWorkspace: state.iosWorkspace || null,
        iosBuildConfigs: state.iosConfigs,
        iosSigning: state.iosSigning,
        flutterEntryPoints: state.flutterEntries,
        native: state.native,
        kmpTargets: state.kmpTargets,
        kmpModule: state.kmpModule || 'composeApp',
        globalFlags: state.globalFlags,
        ideHint: state.kmpIdeHint || null,
      });

      if (state.firebase.android.enabled) {
        await window.launcher.saveFirebaseConfig(projectId, {
          platform: 'android',
          enabled: true,
          configFilePath: state.firebase.android.configFilePath || null,
          appId: state.firebase.android.appId || null,
        });
      }
      if (state.firebase.ios.enabled) {
        await window.launcher.saveFirebaseConfig(projectId, {
          platform: 'ios',
          enabled: true,
          configFilePath: state.firebase.ios.configFilePath || null,
          appId: state.firebase.ios.appId || null,
        });
      }

      onSaved();
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wm-project-editor">
      <div className="wm-pe-header">
        <h3>{isEdit ? 'Edit Mobile Project' : 'New Mobile Project'}</h3>
      </div>

      {/* Name & Path */}
      <div className="pf-body" style={{ paddingBottom: 0 }}>
        <label className="pf-field">
          <span>Name</span>
          <input
            type="text"
            value={state.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="My Mobile App"
            autoFocus
          />
        </label>
        <label className="pf-field">
          <span>Path</span>
          <div className="pf-row">
            <input
              type="text"
              value={state.path}
              onChange={(e) => set('path', e.target.value)}
              placeholder="/path/to/mobile/project"
            />
            <button type="button" className="btn ghost" onClick={browseProjectPath}>Browse…</button>
          </div>
        </label>
      </div>

      {/* Section tabs */}
      <div className="mobile-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`mobile-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mobile-tab-content">
        {activeTab === 'platform' && (
          <div className="mobile-section">
            <div className="mobile-section-title">Platform</div>
            <div className="platform-selector">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`platform-card ${state.platform === p ? 'active' : ''}`}
                  onClick={() => changePlatform(p)}
                >
                  <PlatformLogo platform={p} size={32} />
                  <span>{MOBILE_PLATFORM_LABELS[p]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'android' && (
          <AndroidSettingsSection
            applicationId={state.applicationId}
            module={state.androidModule}
            configs={state.androidConfigs}
            signing={state.androidSigning}
            projectPath={state.path}
            platform={state.platform}
            onApplicationIdChange={(v) => set('applicationId', v)}
            onModuleChange={(v) => set('androidModule', v)}
            onConfigsChange={(v) => set('androidConfigs', v)}
            onSigningChange={(v) => set('androidSigning', v)}
          />
        )}

        {activeTab === 'ios' && (
          <IosSettingsSection
            workspace={state.iosWorkspace}
            configs={state.iosConfigs}
            signing={state.iosSigning}
            projectPath={state.path}
            platform={state.platform}
            onWorkspaceChange={(v) => set('iosWorkspace', v)}
            onConfigsChange={(v) => set('iosConfigs', v)}
            onSigningChange={(v) => set('iosSigning', v)}
          />
        )}

        {activeTab === 'flutter' && (
          <FlutterSettingsSection
            entries={state.flutterEntries}
            projectPath={state.path}
            onChange={(v) => set('flutterEntries', v)}
          />
        )}

        {activeTab === 'kmp' && (
          <ComposeMultiplatformSection
            module={state.kmpModule}
            targets={state.kmpTargets}
            ideHint={state.kmpIdeHint}
            globalFlags={state.globalFlags}
            onModuleChange={(v) => set('kmpModule', v)}
            onTargetsChange={(v) => set('kmpTargets', v)}
            onIdeHintChange={(v) => set('kmpIdeHint', v)}
            onGlobalFlagsChange={(v) => set('globalFlags', v)}
          />
        )}

        {activeTab === 'global' && (
          <GlobalFlagsSection
            platform={state.platform}
            flags={state.globalFlags}
            onChange={(v) => set('globalFlags', v)}
          />
        )}

        {activeTab === 'native' && (
          <NativeBuildSection
            value={state.native}
            onChange={(v) => set('native', v)}
          />
        )}

        {activeTab === 'firebase' && (
          <FirebaseSection
            value={state.firebase}
            onChange={(v) => set('firebase', v)}
            showIos={state.platform === 'ios' || state.platform === 'flutter' || state.platform === 'react-native'}
          />
        )}

        {activeTab === 'version' && isEdit && (
          <VersionPanel projectPath={state.path} platform={state.platform} />
        )}
      </div>

      {error && <div className="wm-error">{error}</div>}

      <div className="wm-pe-actions">
        <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save' : 'Add Project'}
        </button>
      </div>
    </div>
  );
}
