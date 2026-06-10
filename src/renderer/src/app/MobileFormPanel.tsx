import { useEffect, useState } from 'react';
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
} from '../../../shared/types';
import { MOBILE_PLATFORM_LABELS } from '../../../shared/types';
import { PlatformLogo } from '../capabilities/logos/mobileLogos';
import { AndroidSettingsSection, DEFAULT_ANDROID_CONFIGS } from '../features/android/AndroidSettingsSection';
import { IosSettingsSection, DEFAULT_IOS_CONFIGS } from '../features/ios/IosSettingsSection';
import { FlutterSettingsSection, DEFAULT_FLUTTER_ENTRIES } from '../features/flutter/FlutterSettingsSection';
import { ComposeMultiplatformSection } from '../features/compose-multiplatform/ComposeMultiplatformSection';
import { GlobalFlagsSection } from '../capabilities/flags/GlobalFlagsSection';
import { FirebaseSection, DEFAULT_FIREBASE_STATE, type FirebaseFormState } from '../capabilities/firebase/FirebaseSection';
import { NativeBuildSection, DEFAULT_NATIVE_CONFIG } from '../capabilities/native/NativeBuildSection';
import { VersionPanel } from '../capabilities/versioning/VersionPanel';
import { mobileTabsFor, MOBILE_TAB_LABELS, showsIosFirebase, showsDesktopFirebase, type MobileTabKey } from '../features/registry';

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

type Tab = MobileTabKey;

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

  // Hydrate the form from the saved config + firebase when editing an existing project.
  useEffect(() => {
    if (!editingProject) return;
    let cancelled = false;
    (async () => {
      const [config, firebaseList] = await Promise.all([
        window.launcher.getMobileConfig(editingProject.id),
        window.launcher.listFirebaseConfigs(editingProject.id),
      ]);
      if (cancelled) return;

      const firebase: FirebaseFormState = {
        android: { ...DEFAULT_FIREBASE_STATE.android },
        ios: { ...DEFAULT_FIREBASE_STATE.ios },
        desktop: { ...DEFAULT_FIREBASE_STATE.desktop },
      };
      for (const f of firebaseList) {
        firebase[f.platform] = {
          enabled: f.enabled,
          configFilePath: f.configFilePath ?? '',
          appId: f.appId ?? '',
        };
      }

      setState((s) => ({
        ...s,
        ...(config
          ? {
              applicationId: config.applicationId ?? '',
              androidModule: config.androidModule ?? 'app',
              androidConfigs: config.androidBuildConfigs?.length ? config.androidBuildConfigs : s.androidConfigs,
              androidSigning: config.androidSigning ?? s.androidSigning,
              iosWorkspace: config.iosWorkspace ?? '',
              iosConfigs: config.iosBuildConfigs?.length ? config.iosBuildConfigs : s.iosConfigs,
              iosSigning: config.iosSigning ?? s.iosSigning,
              flutterEntries: config.flutterEntryPoints?.length ? config.flutterEntryPoints : s.flutterEntries,
              kmpModule: config.kmpModule ?? 'composeApp',
              kmpTargets: config.kmpTargets?.length ? config.kmpTargets : s.kmpTargets,
              kmpIdeHint: config.ideHint ?? '',
              native: config.native ?? s.native,
              globalFlags: config.globalFlags ?? [],
            }
          : {}),
        firebase,
      }));
    })();
    return () => { cancelled = true; };
  }, [editingProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const tabs = mobileTabsFor(state.platform, isEdit);

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

      // Persist every platform (including disabled) so toggles round-trip correctly.
      for (const fbPlatform of ['android', 'ios', 'desktop'] as const) {
        const entry = state.firebase[fbPlatform];
        await window.launcher.saveFirebaseConfig(projectId, {
          platform: fbPlatform,
          enabled: entry.enabled,
          configFilePath: entry.configFilePath || null,
          appId: entry.appId || null,
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
    <div className="wm-project-editor mobile-form">
      {/* Section tabs — always pinned at the top */}
      <div className="mobile-tabs mobile-tabs--pinned">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`mobile-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {MOBILE_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Scrollable body: name + path stay on top, active tab content below */}
      <div className="mobile-form-scroll">
        <div className="pf-body pf-body--mobile-head">
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

        {(activeTab === 'desktop' || activeTab === 'web') && (
          <div className="mobile-section">
            <div className="mobile-section-title">{activeTab === 'desktop' ? 'Desktop Target' : 'Web Target'}</div>
            <div className="mobile-section-hint">
              {activeTab === 'desktop'
                ? `Runs the JVM desktop app via :${state.kmpModule || 'composeApp'}:desktopRun. Add JVM/Gradle options in Global Flags.`
                : `Runs the Wasm web app via :${state.kmpModule || 'composeApp'}:wasmJsBrowserDevelopmentRun. Add web/Gradle options in Global Flags.`}
            </div>
            <GlobalFlagsSection
              platform={state.platform}
              flags={state.globalFlags}
              onChange={(v) => set('globalFlags', v)}
            />
          </div>
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
            projectPath={state.path}
            platform={state.platform}
            onChange={(v) => set('firebase', v)}
            showIos={showsIosFirebase(state.platform)}
            showDesktop={showsDesktopFirebase(state.platform)}
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
