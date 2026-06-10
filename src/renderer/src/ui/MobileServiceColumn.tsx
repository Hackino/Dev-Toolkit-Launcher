import { useState, useEffect, useCallback } from 'react';
import type {
  ProjectConfig,
  MobileConfig,
  MobileDevice,
  MobilePlatform,
  KmpTarget,
  ServiceStatus,
  MobileBuildRecord,
  FirebaseConfig,
} from '../../../shared/types';
import { KMP_TARGET_LABELS, MOBILE_PLATFORM_LABELS } from '../../../shared/types';
import { PlatformLogo } from '../capabilities/logos/mobileLogos';
import StatusBadge from './StatusBadge';

const IS_MACOS = navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Mac');

interface Props {
  index: number;
  project: ProjectConfig;
  mobileConfig: MobileConfig | null;
  firebase: FirebaseConfig[];
  devices: MobileDevice[];
  status: { status: ServiceStatus; lastExitCode: number | null };
  busy: boolean;
  lastBuild: MobileBuildRecord | null;
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
  mobileConfig,
  firebase,
  devices,
  status,
  busy,
  lastBuild,
  onEdit,
}: Props) {
  const platform = project.type as MobilePlatform;
  const iosBlocked = (platform === 'ios') && !IS_MACOS;
  const isRunning = status.status === 'running';

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedKmpTarget, setSelectedKmpTarget] = useState<KmpTarget>('android');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [taskBusy, setTaskBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

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
    if (mobileConfig.kmpTargets.length > 0 && !mobileConfig.kmpTargets.includes(selectedKmpTarget)) {
      setSelectedKmpTarget(mobileConfig.kmpTargets[0]);
    }
  }, [mobileConfig]); // eslint-disable-line

  const run = useCallback(
    async (action: () => Promise<ActionResult>) => {
      if (taskBusy) return;
      setTaskBusy(true);
      setLastError(null);
      try {
        const result = await action();
        if (result && !result.ok && result.error) setLastError(result.error);
      } catch (e) {
        setLastError(String(e));
      } finally {
        setTaskBusy(false);
      }
    },
    [taskBusy],
  );

  const buildArgs = {
    projectPath: project.path,
    configId: selectedConfigId,
    entryPointId: selectedEntryId,
    kmpTarget: platform === 'compose-multiplatform' ? selectedKmpTarget : null,
  };

  const runArgs = { ...buildArgs, deviceId: selectedDeviceId ?? '' };

  const androidConfigs = mobileConfig?.androidBuildConfigs ?? [];
  const iosConfigs = mobileConfig?.iosBuildConfigs ?? [];
  const flutterEntries = mobileConfig?.flutterEntryPoints ?? [];
  const kmpTargets = mobileConfig?.kmpTargets ?? [];
  const activeDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;

  const fbAndroid = firebase.find((f) => f.platform === 'android');
  const fbIos = firebase.find((f) => f.platform === 'ios');

  return (
    <section className="column mobile-column" data-platform={platform}>
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

      {/* Selectors row */}
      <div className="mobile-selectors">
        {/* Build config selector */}
        {(platform === 'android' || platform === 'react-native' || platform === 'compose-multiplatform') && androidConfigs.length > 0 && (
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

        {platform === 'ios' && iosConfigs.length > 0 && (
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

        {/* KMP target */}
        {platform === 'compose-multiplatform' && kmpTargets.length > 0 && (
          <select
            className="mobile-selector"
            value={selectedKmpTarget}
            onChange={(e) => setSelectedKmpTarget(e.target.value as KmpTarget)}
            title="KMP target"
          >
            {kmpTargets.map((t) => (
              <option key={t} value={t}>{KMP_TARGET_LABELS[t]}</option>
            ))}
          </select>
        )}

        {/* Device selector */}
        {devices.length > 0 && (
          <select
            className="mobile-selector mobile-selector--device"
            value={selectedDeviceId ?? ''}
            onChange={(e) => setSelectedDeviceId(e.target.value || null)}
            title="Target device"
          >
            <option value="">No device</option>
            {devices.filter((d) => d.kind === 'device').length > 0 && (
              <optgroup label="Devices">
                {devices.filter((d) => d.kind === 'device').map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.state})</option>
                ))}
              </optgroup>
            )}
            {devices.filter((d) => d.kind === 'emulator').length > 0 && (
              <optgroup label="Emulators / Simulators">
                {devices.filter((d) => d.kind === 'emulator').map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </div>

      {/* Primary actions row */}
      <div className="mobile-actions mobile-actions--row1">
        {platform === 'flutter' ? (
          <>
            <ActionButton label="▶ Run" disabled={taskBusy || iosBlocked} onClick={() => run(() => window.launcher.mobileRunOnDevice(runArgs))} />
            <ActionButton label="🔨 Build" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileBuild(buildArgs))} />
            <ActionButton label="📦 Release" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileGenerateRelease(buildArgs))} variant="primary" />
            <ActionButton label="🧹 Clean" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileClean({ projectPath: project.path }))} />
          </>
        ) : platform === 'ios' ? (
          <>
            <ActionButton label="▶ Simulator" disabled={taskBusy || iosBlocked} onClick={() => run(() => window.launcher.mobileRunOnEmulator(runArgs))} />
            <ActionButton label="📱 Device" disabled={taskBusy || iosBlocked || !selectedDeviceId} onClick={() => run(() => window.launcher.mobileRunOnDevice(runArgs))} />
            <ActionButton label="📦 Archive" disabled={taskBusy || iosBlocked} onClick={() => run(() => window.launcher.mobileGenerateRelease(buildArgs))} variant="primary" />
            <ActionButton label="🧹 Clean" disabled={taskBusy || iosBlocked} onClick={() => run(() => window.launcher.mobileClean({ projectPath: project.path }))} />
          </>
        ) : platform === 'compose-multiplatform' ? (
          <>
            <ActionButton label="▶ Run" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileRunOnEmulator(runArgs))} />
            <ActionButton label="🔨 Build" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileBuild(buildArgs))} />
            <ActionButton label="📦 Release" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileGenerateRelease(buildArgs))} variant="primary" />
            <ActionButton label="🧹 Clean" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileClean({ projectPath: project.path }))} />
          </>
        ) : (
          <>
            <ActionButton label="▶ Run" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileRunOnDevice(runArgs))} />
            <ActionButton label="🔨 Build" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileBuild(buildArgs))} />
            <ActionButton label="📦 Release" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileGenerateRelease(buildArgs))} variant="primary" />
            <ActionButton label="🧹 Clean" disabled={taskBusy} onClick={() => run(() => window.launcher.mobileClean({ projectPath: project.path }))} />
          </>
        )}
      </div>

      {/* Secondary actions row */}
      <div className="mobile-actions mobile-actions--row2">
        {(platform === 'android' || platform === 'react-native') && (
          <>
            <ActionButton
              label="📥 Install"
              disabled={taskBusy || !selectedDeviceId || !lastBuild?.lastArtifactPath}
              title={!selectedDeviceId ? 'Select a device first' : !lastBuild?.lastArtifactPath ? 'No artifact available' : 'Install APK on device'}
              onClick={() => run(() =>
                window.launcher.mobileInstallApk({ projectPath: project.path, deviceId: selectedDeviceId!, apkPath: lastBuild!.lastArtifactPath! })
              )}
            />
            <ActionButton
              label="🔬 Logcat"
              disabled={taskBusy}
              onClick={() => run(() => window.launcher.mobileViewLogs({ projectPath: project.path, deviceId: selectedDeviceId }))}
            />
            <ActionButton
              label="💻 ADB Shell"
              disabled={taskBusy || !selectedDeviceId}
              title={!selectedDeviceId ? 'Select a device first' : 'Open ADB shell'}
              onClick={() => run(() =>
                window.launcher.mobileAdbShell({ projectPath: project.path, deviceId: selectedDeviceId!, command: 'getprop ro.product.model' })
              )}
            />
          </>
        )}
        {platform === 'ios' && (
          <ActionButton
            label="🔬 Logs"
            disabled={taskBusy || iosBlocked}
            onClick={() => run(() => window.launcher.mobileViewLogs({ projectPath: project.path, deviceId: selectedDeviceId }))}
          />
        )}
        {platform === 'flutter' && (
          <>
            <ActionButton
              label="📦 pub get"
              disabled={taskBusy}
              onClick={() => run(() => window.launcher.mobilePubGet({ projectPath: project.path }))}
            />
            <ActionButton
              label="🩺 Doctor"
              disabled={taskBusy}
              onClick={() => run(() => window.launcher.mobileFlutterDoctor({ projectPath: project.path }))}
            />
          </>
        )}

        <ActionButton
          label="🖥 Open IDE"
          disabled={taskBusy || iosBlocked}
          onClick={() => run(() => window.launcher.mobileOpenIde({ projectPath: project.path }))}
        />

        {isRunning && (
          <ActionButton
            label="■ Stop"
            variant="danger"
            disabled={!isRunning}
            onClick={() => run(() => window.launcher.mobileStopTask({ projectPath: project.path }))}
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

      {/* Firebase status chips */}
      {(fbAndroid?.enabled || fbIos?.enabled) && (
        <div className="mobile-firebase-row">
          🔥
          {fbAndroid?.enabled && <span className="mobile-fb-chip mobile-fb-chip--android">Android</span>}
          {fbIos?.enabled && <span className="mobile-fb-chip mobile-fb-chip--ios">iOS</span>}
        </div>
      )}

      {/* Signing status */}
      {mobileConfig?.androidSigning?.keystorePath && (
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

      {lastError && (
        <div className="mobile-error">{lastError}</div>
      )}
    </section>
  );
}
