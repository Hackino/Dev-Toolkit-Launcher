import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type {
  ProjectConfig,
  MobileConfig,
  MobileDevice,
  MobilePlatform,
  ServiceStatus,
  FirebaseConfig,
  LogStream,
  MobileScriptAction,
  OutputArtifact,
} from '../../../shared/types';
import { MOBILE_PLATFORM_LABELS } from '../../../shared/types';
import { PlatformLogo, FirebaseLogo } from '../capabilities/logos/mobileLogos';
import type { MobileColumnTarget, ColumnTargetKind } from '../features/mobileColumnTargets';
import StatusBadge from './StatusBadge';

const IS_MACOS = navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Mac');

interface Props {
  index: number;
  project: ProjectConfig;
  /** For multi-platform projects (Flutter/RN/KMP), the platform this column represents. */
  target: MobileColumnTarget | null;
  /** Independent worker + terminal identity for this column. */
  runKey: string;
  terminalLabel: string;
  mobileConfig: MobileConfig | null;
  firebase: FirebaseConfig[];
  devices: MobileDevice[];
  status: { status: ServiceStatus; lastExitCode: number | null };
  busy: boolean;
  onDetectDevices: () => void;
  devicesDetecting: boolean;
  onOpenTerminal: (key: string, name: string) => void;
  onLog: (key: string, stream: LogStream, line: string) => void;
  onEdit?: () => void;
}

type ActionResult = { ok: boolean; error?: string; taskId?: string } | null;

function sizeDisplay(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ActionButton({
  label,
  onClick,
  disabled,
  title,
  variant = 'default',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
}) {
  return (
    <button
      type="button"
      className={`mobile-action-btn mobile-action-btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {label}
    </button>
  );
}

function AdvGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mobile-adv-group">
      <div className="mobile-adv-group-title">{title}</div>
      <div className="mobile-adv-buttons">{children}</div>
    </div>
  );
}

export default function MobileServiceColumn({
  index,
  project,
  target,
  runKey,
  terminalLabel,
  mobileConfig,
  firebase,
  devices,
  status,
  busy,
  onDetectDevices,
  devicesDetecting,
  onOpenTerminal,
  onLog,
}: Props) {
  const platform = project.type as MobilePlatform;
  const kind: ColumnTargetKind = target?.kind ?? (platform === 'ios' ? 'ios' : 'android');
  const isIos = kind === 'ios';
  const iosBlocked = isIos && !IS_MACOS;
  const isRunning = status.status === 'running' || status.status === 'starting';
  const usesDevices = kind === 'android' || kind === 'ios';

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [taskBusy, setTaskBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [installModal, setInstallModal] = useState<{ artifacts: OutputArtifact[]; selected: string | null } | null>(null);
  const [outputModal, setOutputModal] = useState<{ artifacts: OutputArtifact[] } | null>(null);

  // Set defaults from config
  useEffect(() => {
    if (!mobileConfig) return;
    if (!selectedConfigId) {
      const cfgs = isIos ? mobileConfig.iosBuildConfigs : mobileConfig.androidBuildConfigs;
      const def = cfgs.find((c) => c.isDefault) ?? cfgs[0];
      if (def) setSelectedConfigId(def.id);
    }
    if (!selectedEntryId) {
      const def = mobileConfig.flutterEntryPoints.find((e) => e.isDefault) ?? mobileConfig.flutterEntryPoints[0];
      if (def) setSelectedEntryId(def.id);
    }
  }, [mobileConfig]); // eslint-disable-line

  const run = useCallback(
    async (action: () => Promise<ActionResult>) => {
      if (taskBusy) return;
      setTaskBusy(true);
      // Each action streams to this column's own terminal; focus it first.
      onOpenTerminal(runKey, terminalLabel);
      try {
        const result = await action();
        // All errors are surfaced in the terminal — never popups / toasts / inline UI.
        if (result && !result.ok && result.error) {
          onLog(runKey, 'stderr', `✖ ${result.error}`);
        }
      } catch (e) {
        onLog(runKey, 'stderr', `✖ ${String(e)}`);
      } finally {
        setTaskBusy(false);
      }
    },
    [taskBusy, runKey, terminalLabel, onOpenTerminal, onLog],
  );

  const buildArgs = {
    projectPath: project.path,
    configId: selectedConfigId,
    entryPointId: selectedEntryId,
    kmpTarget: target?.kmpTarget ?? null,
    runKey,
  };
  const runArgs = { ...buildArgs, deviceId: selectedDeviceId ?? '' };

  const androidConfigs = mobileConfig?.androidBuildConfigs ?? [];
  const iosConfigs = mobileConfig?.iosBuildConfigs ?? [];
  const flutterEntries = mobileConfig?.flutterEntryPoints ?? [];
  const kindDevices = devices.filter((d) => (isIos ? d.platform === 'ios' : d.platform !== 'ios'));
  const activeDevice = kindDevices.find((d) => d.id === selectedDeviceId) ?? null;

  const fbAndroid = firebase.find((f) => f.platform === 'android');
  const fbIos = firebase.find((f) => f.platform === 'ios');
  const fbDesktop = firebase.find((f) => f.platform === 'desktop');

  // Action dispatch helpers
  const doRunDevice = () => run(() => window.launcher.mobileRunOnDevice(runArgs));
  const doRunEmu = () => run(() => window.launcher.mobileRunOnEmulator(runArgs));
  const doBuild = () => run(() => window.launcher.mobileBuild(buildArgs));
  const doRelease = () => run(() => window.launcher.mobileGenerateRelease(buildArgs));
  const doClean = () => run(() => window.launcher.mobileClean({ projectPath: project.path, runKey }));
  const primaryRun = kind === 'android' ? doRunDevice : doRunEmu;

  // Uninstall the app from the selected device — clears INSTALL_FAILED_VERSION_DOWNGRADE.
  const appId = mobileConfig?.applicationId ?? '';
  const doUninstall = () => {
    if (!selectedDeviceId || !appId) return;
    void run(() => window.launcher.mobileUninstall({ projectPath: project.path, deviceId: selectedDeviceId, packageId: appId, runKey }));
  };

  // Predefined tooling scripts (codegen, pods, gradle, …) stream to this terminal.
  const script = (action: MobileScriptAction) =>
    run(() => window.launcher.mobileRunScript({ projectPath: project.path, runKey, action }));

  // Hot reload / restart write a key to the running `flutter run` process's stdin.
  const sendKey = (input: string) => {
    onOpenTerminal(runKey, terminalLabel);
    void window.launcher.mobileSendInput({ projectPath: project.path, runKey, input });
  };

  // Install: open a custom dialog listing this platform's artifacts in output/
  // (Android: apk + aab, iOS: ipa), then install the selected one onto the device.
  const doInstall = async () => {
    if (!selectedDeviceId) return;
    const exts = isIos ? ['ipa'] : ['apk', 'aab'];
    const artifacts = await window.launcher.mobileListOutputArtifacts({ projectPath: project.path, exts });
    setInstallModal({ artifacts, selected: artifacts[0]?.path ?? null });
  };

  const confirmInstall = async () => {
    const artifactPath = installModal?.selected;
    setInstallModal(null);
    if (!artifactPath || !selectedDeviceId) return;
    await run(() =>
      window.launcher.mobileInstallArtifact({ projectPath: project.path, deviceId: selectedDeviceId, artifactPath, runKey }),
    );
  };

  // Output: open a dialog listing this project's builds in output/ for this platform.
  // Each row has a folder icon that reveals the artifact in Finder / Explorer.
  const doOpenOutput = async () => {
    const exts = isIos ? ['ipa'] : ['apk', 'aab'];
    const artifacts = await window.launcher.mobileListOutputArtifacts({ projectPath: project.path, exts });
    setOutputModal({ artifacts });
  };

  return (
    <section className={`column mobile-column ${expanded ? 'mobile-column--expanded' : ''}`} data-platform={platform} data-kind={kind}>
      {/* Header */}
      <div className="column-top">
        <div className="column-logo-group">
          <div className="mobile-logo-wrap">
            <PlatformLogo platform={platform} size={36} />
          </div>
          <div className="column-badges">
            <span className="column-type-name mobile-type-name">
              {MOBILE_PLATFORM_LABELS[platform]}
            </span>
            {target && (
              <span className="mobile-target-badge" data-kind={kind}>{target.label}</span>
            )}
          </div>
        </div>
        <div className="mobile-header-right">
          <button
            type="button"
            className="mobile-expand-btn"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse tools' : 'Expand to show more tools'}
            aria-label={expanded ? 'Collapse tools' : 'Expand tools'}
          >
            {expanded ? '⤡' : '⤢'}
          </button>
          <div className="column-index" data-n={index} />
        </div>
      </div>

      {/* iOS macOS warning */}
      {iosBlocked && (
        <div className="mobile-ios-banner">
          iOS builds require macOS. Actions are disabled on this system.
        </div>
      )}

      {/* Project name */}
      <header className="column-header">
        <h2 className="column-name" title={project.path}>{project.name}</h2>
        <div className="column-subtitle">
          {isIos
            ? (mobileConfig?.iosSigning?.bundleId ?? 'No bundle ID')
            : (mobileConfig?.applicationId ?? 'No application ID')}
        </div>
      </header>

      <div className="column-scroll">
      {/* Selectors row */}
      <div className="mobile-selectors">
        {/* Build configuration — shown for every platform (on top), incl. Flutter */}
        {kind === 'android' && androidConfigs.length > 0 && (
          <select
            className="mobile-selector"
            value={selectedConfigId ?? ''}
            onChange={(e) => setSelectedConfigId(e.target.value || null)}
            title="Build configuration"
          >
            {androidConfigs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {kind === 'ios' && iosConfigs.length > 0 && (
          <select
            className="mobile-selector"
            value={selectedConfigId ?? ''}
            onChange={(e) => setSelectedConfigId(e.target.value || null)}
            disabled={iosBlocked}
            title="Build configuration"
          >
            {iosConfigs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {/* Flutter entry point */}
        {platform === 'flutter' && flutterEntries.length > 0 && (
          <select
            className="mobile-selector"
            value={selectedEntryId ?? ''}
            onChange={(e) => setSelectedEntryId(e.target.value || null)}
            title="Entry point"
          >
            {flutterEntries.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        )}

        {/* Device selector + manual detect (android / ios columns only) */}
        {usesDevices && (
          <div className="mobile-device-row">
            <select
              className="mobile-selector mobile-selector--device"
              value={selectedDeviceId ?? ''}
              onChange={(e) => setSelectedDeviceId(e.target.value || null)}
              disabled={iosBlocked}
              title="Target device"
            >
              <option value="">{kindDevices.length === 0 ? 'No devices — click ⟳' : 'No device'}</option>
              {kindDevices.filter((d) => d.kind === 'device').length > 0 && (
                <optgroup label="Devices">
                  {kindDevices.filter((d) => d.kind === 'device').map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.state})</option>
                  ))}
                </optgroup>
              )}
              {kindDevices.filter((d) => d.kind === 'emulator').length > 0 && (
                <optgroup label="Emulators / Simulators">
                  {kindDevices.filter((d) => d.kind === 'emulator').map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              className="mobile-device-detect"
              onClick={onDetectDevices}
              disabled={iosBlocked || devicesDetecting}
              title="Detect connected devices"
              aria-label="Detect devices"
            >
              <span className={devicesDetecting ? 'variant-spin' : ''}>⟳</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary actions row */}
      <div className="mobile-actions mobile-actions--row1">
        {isIos ? (
          <>
            <ActionButton
              label="▶ Simulator"
              disabled={taskBusy || iosBlocked || !selectedDeviceId}
              title={!selectedDeviceId ? 'Select a simulator first' : 'Build & launch on the selected simulator'}
              onClick={doRunEmu}
            />
            <ActionButton label="📱 Device" disabled={taskBusy || iosBlocked || !selectedDeviceId} onClick={doRunDevice} />
            <ActionButton label="📦 Archive" disabled={taskBusy || iosBlocked} onClick={doRelease} variant="primary" />
            <ActionButton label="🧹 Clean" disabled={taskBusy || iosBlocked} onClick={doClean} />
          </>
        ) : (
          <>
            <ActionButton
              label="▶ Run"
              disabled={taskBusy || !selectedDeviceId}
              title={!selectedDeviceId ? 'Select a device first' : 'Run on selected device'}
              onClick={primaryRun}
            />
            <ActionButton label="🔨 Build" disabled={taskBusy} onClick={doBuild} />
            <ActionButton label="📦 Bundle" disabled={taskBusy} title="Build an .aab for the selected variant" onClick={doRelease} variant="primary" />
            <ActionButton label="🧹 Clean" disabled={taskBusy} onClick={doClean} />
          </>
        )}
      </div>

      {/* Secondary actions row */}
      <div className="mobile-actions mobile-actions--row2">
        <ActionButton
          label="📂 Output"
          disabled={taskBusy}
          title={`Browse this project's built ${isIos ? '.ipa' : '.apk / .aab'} files in output/`}
          onClick={doOpenOutput}
        />
        {usesDevices && (
          <ActionButton
            label="📥 Install"
            disabled={taskBusy || !selectedDeviceId || iosBlocked}
            title={!selectedDeviceId ? 'Select a device first' : `Pick a${isIos ? 'n .ipa' : 'n .apk / .aab'} from output/ to install`}
            onClick={doInstall}
          />
        )}
        {kind === 'android' && (
          <ActionButton
            label="🗑 Uninstall"
            disabled={taskBusy || !selectedDeviceId || !appId}
            title={!selectedDeviceId ? 'Select a device first' : !appId ? 'No application ID configured' : `Uninstall ${appId} from the device (fixes version-downgrade install errors)`}
            onClick={doUninstall}
          />
        )}
        {platform === 'flutter' && (
          <>
            <ActionButton label="📦 pub get" disabled={taskBusy} onClick={() => run(() => window.launcher.mobilePubGet({ projectPath: project.path, runKey }))} />
            <ActionButton label="♻ Gen" title="Clean + regenerate code (l10n, freezed, json_serializable)" disabled={taskBusy} onClick={() => script('gen-rebuild')} />
            {isRunning && (
              <>
                <ActionButton label="🔥 Reload" title="Hot reload (r)" onClick={() => sendKey('r\n')} />
                <ActionButton label="🔁 Restart" title="Hot restart (R)" onClick={() => sendKey('R\n')} />
              </>
            )}
          </>
        )}

        {isRunning && (
          <ActionButton
            label="■ Stop"
            variant="danger"
            disabled={!isRunning}
            onClick={() => run(() => window.launcher.mobileStopTask({ projectPath: project.path, runKey }))}
          />
        )}
      </div>

      {/* Status row */}
      <div className="column-status mobile-status">
        <StatusBadge status={status.status} lastExitCode={status.lastExitCode} />
        {taskBusy && <span className="mobile-busy-indicator">⏳</span>}
      </div>

      {/* Firebase status chips (only those relevant to this column's platform) */}
      {((kind === 'android' && fbAndroid?.enabled) ||
        (kind === 'ios' && fbIos?.enabled) ||
        (kind === 'desktop' && fbDesktop?.enabled)) && (
        <div className="mobile-firebase-row">
          <FirebaseLogo size={13} />
          {kind === 'android' && fbAndroid?.enabled && <span className="mobile-fb-chip mobile-fb-chip--android">Android</span>}
          {kind === 'ios' && fbIos?.enabled && <span className="mobile-fb-chip mobile-fb-chip--ios">iOS</span>}
          {kind === 'desktop' && fbDesktop?.enabled && <span className="mobile-fb-chip mobile-fb-chip--android">Desktop</span>}
        </div>
      )}

      {/* Signing status (android-capable columns) */}
      {kind === 'android' && mobileConfig?.androidSigning?.keystorePath && (
        <div className="mobile-signing-badge">
          🔑 Keystore configured
        </div>
      )}

      {/* Active device badge */}
      {activeDevice && (
        <div className="mobile-device-badge">
          {activeDevice.kind === 'emulator' ? '🖥' : '📱'} {activeDevice.name}
        </div>
      )}

      {/* Advanced tools (revealed when the column is expanded) */}
      {expanded && (
        <div className="mobile-advanced">
          {platform === 'flutter' && (
            <>
              <AdvGroup title="Code Generation">
                <ActionButton label="♻ Rebuild Gen" title="Clean + regenerate all generated code" disabled={taskBusy} onClick={() => script('gen-rebuild')} />
                <ActionButton label="Build Runner" disabled={taskBusy} onClick={() => script('gen-build')} />
                <ActionButton label="Watch" disabled={taskBusy} onClick={() => script('gen-watch')} />
                <ActionButton label="Clean Gen" disabled={taskBusy} onClick={() => script('gen-clean')} />
                <ActionButton label="Gen L10n" disabled={taskBusy} onClick={() => script('gen-l10n')} />
              </AdvGroup>
              <AdvGroup title="Assets">
                <ActionButton label="Icons" title="flutter_launcher_icons" disabled={taskBusy} onClick={() => script('icons')} />
                <ActionButton label="Splash" title="flutter_native_splash" disabled={taskBusy} onClick={() => script('splash')} />
              </AdvGroup>
              <AdvGroup title="Tooling">
                <ActionButton label="Format" disabled={taskBusy} onClick={() => script('format')} />
                <ActionButton label="Analyze" disabled={taskBusy} onClick={() => script('analyze')} />
                <ActionButton label="Test" disabled={taskBusy} onClick={() => script('test')} />
                <ActionButton label="Upgrade" disabled={taskBusy} onClick={() => script('pub-upgrade')} />
                <ActionButton label="Outdated" disabled={taskBusy} onClick={() => script('pub-outdated')} />
                <ActionButton label="🩺 Doctor" disabled={taskBusy} onClick={() => script('doctor')} />
              </AdvGroup>
            </>
          )}

          {kind === 'ios' && (
            <AdvGroup title="iOS / CocoaPods">
              <ActionButton label="Pod Install" disabled={taskBusy || iosBlocked} onClick={() => script('pod-install')} />
              <ActionButton label="Pod Update" disabled={taskBusy || iosBlocked} onClick={() => script('pod-update')} />
              <ActionButton label="Repo Update" disabled={taskBusy || iosBlocked} onClick={() => script('pod-repo-update')} />
              <ActionButton label="Open Xcode" disabled={taskBusy || iosBlocked} onClick={() => script('open-xcode')} />
              <ActionButton label="Clean Derived" disabled={taskBusy || iosBlocked} onClick={() => script('clean-derived')} />
            </AdvGroup>
          )}

          {kind === 'android' && (
            <AdvGroup title="Android / Gradle">
              <ActionButton label="Gradle Clean" disabled={taskBusy} onClick={() => script('gradle-clean')} />
              <ActionButton label="Dependencies" disabled={taskBusy} onClick={() => script('gradle-deps')} />
              <ActionButton label="Stop Daemon" disabled={taskBusy} onClick={() => script('gradle-stop')} />
            </AdvGroup>
          )}
        </div>
      )}
      </div>

      {/* Install dialog — lists artifacts from output/ for this platform */}
      {installModal && (
        <div className="install-modal-overlay" onClick={() => setInstallModal(null)}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <div className="install-modal-title">
              Install {isIos ? 'iOS app' : 'Android package'}
            </div>
            {installModal.artifacts.length === 0 ? (
              <div className="install-modal-empty">
                No artifacts found in <code>output/</code>.
                <span>Build or Bundle first to produce {isIos ? 'an .ipa' : 'an .apk / .aab'}.</span>
              </div>
            ) : (
              <div className="install-modal-list">
                {installModal.artifacts.map((a) => (
                  <label key={a.path} className={`install-modal-item ${installModal.selected === a.path ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={`artifact-${runKey}`}
                      checked={installModal.selected === a.path}
                      onChange={() => setInstallModal((m) => (m ? { ...m, selected: a.path } : m))}
                    />
                    <span className="install-modal-name" title={a.path}>{a.name}</span>
                    <span className="install-modal-size">{sizeDisplay(a.sizeBytes)}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="install-modal-actions">
              <button type="button" className="btn ghost" onClick={() => setInstallModal(null)}>Cancel</button>
              {installModal.artifacts.length > 0 && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={!installModal.selected}
                  onClick={confirmInstall}
                >
                  📥 Install
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Output dialog — lists this project's builds in output/ for this platform */}
      {outputModal && (
        <div className="install-modal-overlay" onClick={() => setOutputModal(null)}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <div className="install-modal-title">
              {isIos ? 'iOS builds' : 'Android builds'} in output/
            </div>
            {outputModal.artifacts.length === 0 ? (
              <div className="install-modal-empty">
                No artifacts found in <code>output/</code>.
                <span>Build or Bundle first to produce {isIos ? 'an .ipa' : 'an .apk / .aab'}.</span>
              </div>
            ) : (
              <div className="install-modal-list">
                {outputModal.artifacts.map((a) => (
                  <div key={a.path} className="install-modal-item">
                    <span className="install-modal-name" title={a.path}>{a.name}</span>
                    <span className="install-modal-size">{sizeDisplay(a.sizeBytes)}</span>
                    <button
                      type="button"
                      className="mobile-last-build-open btn ghost"
                      onClick={() => window.launcher.openPath(a.path)}
                      title="Show in Finder / Explorer"
                    >
                      📂
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="install-modal-actions">
              <button type="button" className="btn ghost" onClick={() => setOutputModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
