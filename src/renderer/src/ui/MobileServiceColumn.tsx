import { useState, useEffect, useCallback } from 'react';
import type {
  ProjectConfig,
  MobileConfig,
  MobileDevice,
  MobilePlatform,
  ServiceStatus,
  MobileBuildRecord,
  FirebaseConfig,
  LogStream,
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
  lastBuild: MobileBuildRecord | null;
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
  lastBuild,
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

  // Set defaults from config
  useEffect(() => {
    if (!mobileConfig) return;
    if (!selectedConfigId) {
      const def = mobileConfig.androidBuildConfigs.find((c) => c.isDefault) ?? mobileConfig.androidBuildConfigs[0];
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

  // Install: pick an .apk/.aab from disk, then install onto the selected device.
  // .aab is converted + installed via bundletool (downloaded on first use).
  const doInstall = async () => {
    if (!selectedDeviceId) return;
    const file = await window.launcher.mobilePickFile({
      title: 'Select APK or AAB to install',
      defaultPath: lastBuild?.lastArtifactPath ?? undefined,
      filters: [
        { name: 'Android package', extensions: ['apk', 'aab'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!file) return;
    await run(() =>
      window.launcher.mobileInstallArtifact({ projectPath: project.path, deviceId: selectedDeviceId, artifactPath: file, runKey }),
    );
  };

  return (
    <section className="column mobile-column" data-platform={platform} data-kind={kind}>
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
        <div className="column-index" data-n={index} />
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
          {mobileConfig?.applicationId ?? 'No application ID'}
        </div>
      </header>

      <div className="column-scroll">
      {/* Selectors row */}
      <div className="mobile-selectors">
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

        {/* Android build config */}
        {platform !== 'flutter' && kind === 'android' && androidConfigs.length > 0 && (
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

        {/* iOS build config */}
        {platform !== 'flutter' && kind === 'ios' && iosConfigs.length > 0 && (
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

        {/* Device selector (android / ios columns only) — required for Run/Install */}
        {usesDevices && (
          <select
            className="mobile-selector mobile-selector--device"
            value={selectedDeviceId ?? ''}
            onChange={(e) => setSelectedDeviceId(e.target.value || null)}
            disabled={iosBlocked}
            title="Target device"
          >
            <option value="">{kindDevices.length === 0 ? 'No devices found' : 'No device'}</option>
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
        )}
      </div>

      {/* Primary actions row */}
      <div className="mobile-actions mobile-actions--row1">
        {isIos ? (
          <>
            <ActionButton label="▶ Simulator" disabled={taskBusy || iosBlocked} onClick={doRunEmu} />
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
        {kind === 'android' && (
          <ActionButton
            label="📥 Install"
            disabled={taskBusy || !selectedDeviceId}
            title={!selectedDeviceId ? 'Select a device first' : 'Choose an .apk / .aab to install on the device'}
            onClick={doInstall}
          />
        )}
        {platform === 'flutter' && (
          <>
            <ActionButton label="📦 pub get" disabled={taskBusy} onClick={() => run(() => window.launcher.mobilePubGet({ projectPath: project.path, runKey }))} />
            <ActionButton label="🩺 Doctor" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileFlutterDoctor({ projectPath: project.path, runKey }))} />
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

      {/* Last build info */}
      {lastBuild?.lastArtifactPath && (
        <div className="mobile-last-build">
          <span className="mobile-last-build-label">Last:</span>
          <span className="mobile-last-build-variant">{lastBuild.lastVariant ?? 'build'}</span>
          {lastBuild.sizeBytes != null && (
            <span className="mobile-last-build-size">{sizeDisplay(lastBuild.sizeBytes)}</span>
          )}
          <button
            type="button"
            className="mobile-last-build-open btn ghost"
            onClick={() => window.launcher.openPath(lastBuild.lastArtifactPath!)}
            title="Show artifact in Finder / Explorer"
          >
            📂
          </button>
        </div>
      )}

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
      </div>
    </section>
  );
}
