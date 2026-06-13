import { ipcMain, dialog, shell, app } from 'electron';
import { statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  MobileBuildArgs,
  MobileRunArgs,
  MobileTaskRef,
  MobileConfigInput,
  FirebaseConfigInput,
  MobileVersionInfo,
  MobilePlatform,
  VariantDetectArgs,
  IntrospectArgs,
  MobileScriptAction,
} from '../../../shared/types';
import { detectVariants } from '../../capabilities/detection/variantDetection';
import { introspectProject } from '../../capabilities/detection/projectIntrospection';
import { detectAssets, validateAsset, importAsset, type AssetKind } from '../../capabilities/assets/mobileAssets';
import { MobileConfigRepository } from '../../capabilities/persistence/MobileConfigRepository';
import { FirebaseConfigRepository } from '../../capabilities/persistence/FirebaseConfigRepository';
import { MobileBuildHistoryRepository } from '../../capabilities/persistence/MobileBuildHistoryRepository';
import { ProjectRepository } from '../../capabilities/persistence/ProjectRepository';
import { FeatureRegistry } from '../../features/registry';
import { isMobileType } from '../../../shared/category';
import {
  runMobileTask,
  stopMobileTask,
  sendMobileTaskInput,
} from '../../capabilities/process/mobileProcess';
import { MOBILE_SCRIPTS } from '../../capabilities/process/mobileScripts';
import { harvestToOutput, listOutputArtifacts, type ArtifactPlatform } from '../../capabilities/artifacts/mobileArtifacts';
import { resolveEnvFlags } from '../../capabilities/buildflags/buildFlagResolver';
import {
  listAndroidDevices,
  listAndroidEmulators,
  listIosDevices,
  listIosSimulators,
} from '../../capabilities/devices/deviceService';
import { readGradleVersion, writeGradleVersion } from '../../capabilities/versioning/gradleVersion';
import { readPlistVersion, writePlistVersion } from '../../capabilities/versioning/plistVersion';
import { readPubspecVersion, writePubspecVersion } from '../../capabilities/versioning/pubspecVersion';
import { readGradlePropertiesVersion, writeGradlePropertiesVersion } from '../../capabilities/versioning/gradlePropertiesVersion';

const IOS_NOT_MACOS = 'iOS builds require macOS. This action is disabled on non-macOS systems.';

// bundletool — used to convert/install Android App Bundles (.aab) onto a device.
const BUNDLETOOL_VERSION = '1.18.1';
const BUNDLETOOL_URL = `https://github.com/google/bundletool/releases/download/${BUNDLETOOL_VERSION}/bundletool-all-${BUNDLETOOL_VERSION}.jar`;

function bundletoolJarPath(): string {
  return join(app.getPath('userData'), 'tools', `bundletool-${BUNDLETOOL_VERSION}.jar`);
}

function requireMacos(): boolean {
  return process.platform === 'darwin';
}

function getProject(projectPath: string) {
  const project = ProjectRepository.findByPath(projectPath);
  if (!project) throw new Error(`Project not found: ${projectPath}`);
  return project;
}

function getMobileConfig(projectId: string) {
  const cfg = MobileConfigRepository.get(projectId);
  if (!cfg) throw new Error(`Mobile config not found for project ${projectId}`);
  return cfg;
}

function buildContext(projectPath: string, args: MobileBuildArgs, resolvedEnv: Record<string, string> = {}) {
  const project = getProject(projectPath);
  const config = getMobileConfig(project.id);
  const androidBuildConfig = args.configId
    ? (config.androidBuildConfigs.find((c) => c.id === args.configId) ?? null)
    : (config.androidBuildConfigs.find((c) => c.isDefault) ?? config.androidBuildConfigs[0] ?? null);
  const iosBuildConfig = args.configId
    ? (config.iosBuildConfigs.find((c) => c.id === args.configId) ?? null)
    : (config.iosBuildConfigs.find((c) => c.isDefault) ?? config.iosBuildConfigs[0] ?? null);
  const flutterEntryPoint = args.entryPointId
    ? (config.flutterEntryPoints.find((e) => e.id === args.entryPointId) ?? null)
    : (config.flutterEntryPoints.find((e) => e.isDefault) ?? config.flutterEntryPoints[0] ?? null);

  // If no application ID is configured, detect it from the project so the
  // post-install launch step (adb monkey -p <appId>) still fires.
  let effectiveConfig = config;
  if (!config.applicationId && project.type !== 'ios') {
    try {
      const intro = introspectProject(projectPath, project.type as MobilePlatform, config.androidModule || 'app');
      if (intro.applicationIds[0]) effectiveConfig = { ...config, applicationId: intro.applicationIds[0] };
    } catch { /* detection optional */ }
  }

  return {
    projectPath,
    config: effectiveConfig,
    androidBuildConfig,
    iosBuildConfig,
    flutterEntryPoint,
    kmpTarget: args.kmpTarget ?? null,
    resolvedEnv,
  };
}

/** After a successful build, copy produced artifacts into <root>/output and record it. */
function harvestArtifacts(
  code: number | null,
  project: ReturnType<typeof getProject>,
  ctx: ReturnType<typeof buildContext>,
  args: MobileBuildArgs,
  startedAt: number,
): void {
  if (code !== 0) return;
  const platform: ArtifactPlatform =
    project.type === 'ios' || args.kmpTarget === 'ios' ? 'ios' : 'android';
  const copied = harvestToOutput(args.projectPath, platform, startedAt);
  const main = copied[0] ?? null;
  if (!main) return;
  try {
    MobileBuildHistoryRepository.record({
      projectId: project.id,
      configName: ctx.androidBuildConfig?.name ?? ctx.iosBuildConfig?.name ?? null,
      kmpTarget: args.kmpTarget ?? null,
      artifactPath: main,
      sizeBytes: statSync(main).size,
      status: 'success',
    });
  } catch { /* ignore — artifact may have moved */ }
}

function resolveSigningEnv(config: ReturnType<typeof getMobileConfig>): Record<string, string> {
  const env: Record<string, string> = {};
  const { androidSigning } = config;
  if (androidSigning.storePasswordEnv && process.env[androidSigning.storePasswordEnv]) {
    env[androidSigning.storePasswordEnv] = process.env[androidSigning.storePasswordEnv]!;
  }
  if (androidSigning.keyPasswordEnv && process.env[androidSigning.keyPasswordEnv]) {
    env[androidSigning.keyPasswordEnv] = process.env[androidSigning.keyPasswordEnv]!;
  }
  return env;
}

export function registerMobileIpc(): void {
  // ─── Config CRUD ──────────────────────────────────────────────────────────

  ipcMain.handle('mobile:getConfig', (_e, projectId: string) => {
    return MobileConfigRepository.get(projectId);
  });

  ipcMain.handle('mobile:saveConfig', (_e, projectId: string, input: MobileConfigInput & { platform: MobilePlatform }) => {
    return MobileConfigRepository.upsert(projectId, input);
  });

  ipcMain.handle('mobile:listFirebase', (_e, projectId: string) => {
    return FirebaseConfigRepository.list(projectId);
  });

  ipcMain.handle('mobile:saveFirebase', (_e, projectId: string, input: FirebaseConfigInput) => {
    return FirebaseConfigRepository.upsert(projectId, input);
  });

  // ─── Build / Clean ────────────────────────────────────────────────────────

  ipcMain.handle('mobile:build', (_e, args: MobileBuildArgs) => {
    try {
      const project = getProject(args.projectPath);
      if (!isMobileType(project.type)) return { ok: false, error: 'Not a mobile project' };
      const ctx = buildContext(args.projectPath, args);
      const strategy = FeatureRegistry.getMobile(project.type as MobilePlatform).mobile;
      const command = strategy.buildCommand(ctx);
      // Env-kind global flags
      const extraEnv = resolveEnvFlags(ctx.config.globalFlags);
      const startedAt = Date.now();
      return runMobileTask({
        taskKey: args.runKey ?? args.projectPath,
        command,
        displayCommand: command,
        cwd: args.projectPath,
        env: extraEnv,
        onComplete: (code) => harvestArtifacts(code, project, ctx, args, startedAt),
      });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('mobile:clean', (_e, args: MobileTaskRef) => {
    try {
      const project = getProject(args.projectPath);
      if (!isMobileType(project.type)) return { ok: false, error: 'Not a mobile project' };
      const ctx = buildContext(args.projectPath, { projectPath: args.projectPath });
      const strategy = FeatureRegistry.getMobile(project.type as MobilePlatform).mobile;
      const command = strategy.cleanCommand(ctx);
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command, displayCommand: command, cwd: args.projectPath });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('mobile:stopTask', (_e, args: MobileTaskRef) => {
    return stopMobileTask(args.runKey ?? args.projectPath);
  });

  // ─── Run on device / emulator ─────────────────────────────────────────────

  ipcMain.handle('mobile:runOnDevice', (_e, args: MobileRunArgs) => {
    try {
      const project = getProject(args.projectPath);
      if (!isMobileType(project.type)) return { ok: false, error: 'Not a mobile project' };
      const ctx = buildContext(args.projectPath, args);
      const strategy = FeatureRegistry.getMobile(project.type as MobilePlatform).mobile;
      const command = strategy.runOnDeviceCommand(ctx, args.deviceId);
      const extraEnv = resolveEnvFlags(ctx.config.globalFlags);
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command, displayCommand: command, cwd: args.projectPath, env: extraEnv });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('mobile:runOnEmulator', (_e, args: MobileRunArgs) => {
    try {
      const project = getProject(args.projectPath);
      if (!isMobileType(project.type)) return { ok: false, error: 'Not a mobile project' };
      const ctx = buildContext(args.projectPath, args);
      const strategy = FeatureRegistry.getMobile(project.type as MobilePlatform).mobile;
      const command = strategy.runOnEmulatorCommand(ctx, args.deviceId);
      const extraEnv = resolveEnvFlags(ctx.config.globalFlags);
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command, displayCommand: command, cwd: args.projectPath, env: extraEnv });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── Release ──────────────────────────────────────────────────────────────

  ipcMain.handle('mobile:generateRelease', (_e, args: MobileBuildArgs) => {
    try {
      const project = getProject(args.projectPath);
      if (!isMobileType(project.type)) return { ok: false, error: 'Not a mobile project' };
      const config = getMobileConfig(project.id);
      const resolvedEnv = resolveSigningEnv(config);

      // Validate required signing env vars are present
      const { androidSigning } = config;
      if (project.type === 'android' || project.type === 'react-native' || project.type === 'compose-multiplatform') {
        if (androidSigning.storePasswordEnv && !resolvedEnv[androidSigning.storePasswordEnv]) {
          return { ok: false, error: `Missing env var: ${androidSigning.storePasswordEnv}` };
        }
        if (androidSigning.keyPasswordEnv && !resolvedEnv[androidSigning.keyPasswordEnv]) {
          return { ok: false, error: `Missing env var: ${androidSigning.keyPasswordEnv}` };
        }
      }

      const ctx = buildContext(args.projectPath, args, resolvedEnv);
      const strategy = FeatureRegistry.getMobile(project.type as MobilePlatform).mobile;
      const command = strategy.releaseCommand(ctx);

      // Redact passwords in displayed command
      let displayCommand = command;
      if (androidSigning.storePasswordEnv && resolvedEnv[androidSigning.storePasswordEnv]) {
        displayCommand = displayCommand.replace(resolvedEnv[androidSigning.storePasswordEnv], '***');
      }
      if (androidSigning.keyPasswordEnv && resolvedEnv[androidSigning.keyPasswordEnv]) {
        displayCommand = displayCommand.replace(resolvedEnv[androidSigning.keyPasswordEnv], '***');
      }

      const startedAt = Date.now();
      const result = runMobileTask({
        taskKey: args.runKey ?? args.projectPath,
        command,
        displayCommand,
        cwd: args.projectPath,
        env: resolvedEnv,
        // After the bundle/archive finishes, copy the artifact into <root>/output and record it.
        onComplete: (code) => harvestArtifacts(code, project, ctx, args, startedAt),
      });
      return result;
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── Install APK ──────────────────────────────────────────────────────────

  ipcMain.handle('mobile:installApk', (_e, args: MobileTaskRef & { deviceId: string; apkPath: string }) => {
    try {
      const command = `adb -s ${args.deviceId} install -r "${args.apkPath}"`;
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command, displayCommand: command, cwd: args.projectPath });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── Install Artifact (.apk direct, .aab via bundletool) ──────────────────
  ipcMain.handle('mobile:installArtifact', (_e, args: MobileTaskRef & { deviceId: string; artifactPath: string }) => {
    try {
      if (!args.deviceId) return { ok: false, error: 'Select a device first' };
      const taskKey = args.runKey ?? args.projectPath;
      const file = args.artifactPath;
      const lower = file.toLowerCase();

      if (lower.endsWith('.apk')) {
        const command = `adb -s ${args.deviceId} install -r "${file}"`;
        return runMobileTask({ taskKey, command, displayCommand: command, cwd: args.projectPath });
      }

      // iOS: .ipa onto a physical device (devicectl), .app onto a simulator (simctl).
      if (lower.endsWith('.ipa')) {
        const command = `xcrun devicectl device install app --device ${args.deviceId} "${file}"`;
        return runMobileTask({ taskKey, command, displayCommand: command, cwd: args.projectPath });
      }
      if (lower.endsWith('.app')) {
        const command = `xcrun simctl install ${args.deviceId} "${file}"`;
        return runMobileTask({ taskKey, command, displayCommand: command, cwd: args.projectPath });
      }

      if (lower.endsWith('.aab')) {
        const jar = bundletoolJarPath();
        const toolsDir = dirname(jar);
        const apks = join(toolsDir, 'install-tmp.apks');

        // Optional release signing (mirrors mobile:generateRelease). Without a
        // keystore, bundletool signs the universal APK with its debug key, which
        // is fine for installing onto a test device.
        let ksFlags = '';
        let displayKsFlags = '';
        try {
          const project = getProject(args.projectPath);
          const config = MobileConfigRepository.get(project.id);
          const s = config?.androidSigning;
          if (s?.keystorePath && s.keyAlias) {
            const env = config ? resolveSigningEnv(config) : {};
            const storePwd = s.storePasswordEnv ? env[s.storePasswordEnv] : undefined;
            const keyPwd = s.keyPasswordEnv ? env[s.keyPasswordEnv] : undefined;
            const base = ` --ks="${s.keystorePath}" --ks-key-alias="${s.keyAlias}"`;
            ksFlags = base + (storePwd ? ` --ks-pass=pass:${storePwd}` : '') + (keyPwd ? ` --key-pass=pass:${keyPwd}` : '');
            displayKsFlags = base + (storePwd ? ' --ks-pass=pass:***' : '') + (keyPwd ? ' --key-pass=pass:***' : '');
          }
        } catch { /* config optional — fall back to debug signing */ }

        const ensure = `mkdir -p "${toolsDir}" && { [ -f "${jar}" ] || curl -L --fail -o "${jar}" "${BUNDLETOOL_URL}"; }`;
        const buildApks = (signing: string) =>
          `java -jar "${jar}" build-apks --bundle="${file}" --output="${apks}" --overwrite --mode=universal${signing}`;
        const installApks = `java -jar "${jar}" install-apks --apks="${apks}" --device-id=${args.deviceId}`;
        const command = `${ensure} && ${buildApks(ksFlags)} && ${installApks}`;
        const displayCommand = `${ensure} && ${buildApks(displayKsFlags)} && ${installApks}`;
        return runMobileTask({ taskKey, command, displayCommand, cwd: args.projectPath });
      }

      return { ok: false, error: 'Unsupported file — select an .apk / .aab / .ipa' };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── Uninstall (resolves INSTALL_FAILED_VERSION_DOWNGRADE) ──────────────────

  ipcMain.handle('mobile:uninstall', (_e, args: MobileTaskRef & { deviceId: string; packageId: string }) => {
    try {
      if (!args.deviceId) return { ok: false, error: 'Select a device first' };
      if (!args.packageId) return { ok: false, error: 'No application ID configured to uninstall.' };
      const command = `adb -s ${args.deviceId} uninstall ${args.packageId}`;
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command, displayCommand: command, cwd: args.projectPath });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── Output artifacts (for the custom install dialog) ───────────────────────

  ipcMain.handle('mobile:listOutputArtifacts', (_e, args: { projectPath: string; exts: string[] }) => {
    try {
      return listOutputArtifacts(args.projectPath, args.exts);
    } catch {
      return [];
    }
  });

  // ─── ADB Shell ────────────────────────────────────────────────────────────

  ipcMain.handle('mobile:adbShell', (_e, args: MobileTaskRef & { deviceId: string; command: string }) => {
    try {
      const command = `adb -s ${args.deviceId} shell ${args.command}`;
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command, displayCommand: command, cwd: args.projectPath });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── Pub Get / Flutter Doctor ─────────────────────────────────────────────

  ipcMain.handle('mobile:pubGet', (_e, args: MobileTaskRef) => {
    try {
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command: 'flutter pub get', displayCommand: 'flutter pub get', cwd: args.projectPath });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('mobile:flutterDoctor', (_e, args: MobileTaskRef) => {
    try {
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command: 'flutter doctor -v', displayCommand: 'flutter doctor -v', cwd: args.projectPath });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── Predefined tooling scripts (codegen, pods, gradle, …) ──────────────────

  ipcMain.handle('mobile:runScript', (_e, args: MobileTaskRef & { action: MobileScriptAction }) => {
    try {
      const def = MOBILE_SCRIPTS[args.action];
      if (!def) return { ok: false, error: `Unknown action: ${args.action}` };
      const cwd =
        def.dir && existsSync(join(args.projectPath, def.dir))
          ? join(args.projectPath, def.dir)
          : args.projectPath;
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command: def.command, displayCommand: def.command, cwd });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('mobile:sendInput', (_e, args: MobileTaskRef & { input: string }) => {
    return sendMobileTaskInput(args.runKey ?? args.projectPath, args.input);
  });

  // ─── View logs ────────────────────────────────────────────────────────────

  ipcMain.handle('mobile:viewLogs', (_e, args: MobileTaskRef & { deviceId?: string | null }) => {
    try {
      const project = getProject(args.projectPath);
      if (!isMobileType(project.type)) return { ok: false, error: 'Not a mobile project' };
      if ((project.type === 'ios') && !requireMacos()) {
        return { ok: false, error: IOS_NOT_MACOS };
      }
      const ctx = buildContext(args.projectPath, { projectPath: args.projectPath });
      const strategy = FeatureRegistry.getMobile(project.type as MobilePlatform).mobile;
      const command = strategy.logsCommand(ctx, args.deviceId ?? null);
      return runMobileTask({ taskKey: args.runKey ?? args.projectPath, command, displayCommand: command, cwd: args.projectPath });
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── Device listing ───────────────────────────────────────────────────────

  ipcMain.handle('mobile:listDevices', async (_e, args: MobileTaskRef) => {
    try {
      const project = getProject(args.projectPath);
      const type = project.type as MobilePlatform;
      if (type === 'ios') return requireMacos() ? listIosDevices() : [];
      // Flutter / React Native / KMP all use the native toolchains (adb + xcrun)
      // so devices are tagged with their real platform and match per-column filters.
      const [android, ios] = await Promise.all([
        listAndroidDevices(),
        requireMacos() ? listIosDevices() : Promise.resolve([]),
      ]);
      return [...android, ...ios];
    } catch {
      return [];
    }
  });

  ipcMain.handle('mobile:listEmulators', async (_e, args: MobileTaskRef) => {
    try {
      const project = getProject(args.projectPath);
      const type = project.type as MobilePlatform;
      if (type === 'ios') return requireMacos() ? listIosSimulators() : [];
      const [avds, sims] = await Promise.all([
        listAndroidEmulators(),
        requireMacos() ? listIosSimulators() : Promise.resolve([]),
      ]);
      return [...avds, ...sims];
    } catch {
      return [];
    }
  });

  // ─── Open IDE ─────────────────────────────────────────────────────────────

  ipcMain.handle('mobile:openIde', (_e, args: MobileTaskRef) => {
    try {
      const project = getProject(args.projectPath);
      if (!isMobileType(project.type)) return { ok: false, error: 'Not a mobile project' };
      const config = MobileConfigRepository.get(project.id);
      const strategy = FeatureRegistry.getMobile(project.type as MobilePlatform).mobile;
      const cmd = strategy.ideCommand(args.projectPath, config ?? { platform: project.type as MobilePlatform, projectId: project.id, applicationId: null, androidModule: null, androidBuildConfigs: [], androidSigning: { keystorePath: null, keyAlias: null, storePasswordEnv: null, keyPasswordEnv: null }, iosWorkspace: null, iosBuildConfigs: [], iosSigning: { bundleId: null, teamId: null, signingStyle: 'automatic', certificateName: null, provisioningProfile: null, deploymentTarget: null }, flutterEntryPoints: [], native: { enabled: false, cmakeListsPath: null, ndkVersion: null, abiFilters: [], cmakeFlags: [] }, kmpTargets: [], kmpModule: null, globalFlags: [], ideHint: null, createdAt: Date.now() });
      if (!cmd) return { ok: false, error: 'IDE not available on this platform' };
      const result = runMobileTask({ taskKey: args.runKey ?? args.projectPath, command: cmd, displayCommand: cmd, cwd: args.projectPath });
      return { ok: result.ok, error: result.ok ? undefined : result.error };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── Version management ───────────────────────────────────────────────────

  ipcMain.handle('mobile:getVersionInfo', (_e, args: MobileTaskRef) => {
    try {
      const project = getProject(args.projectPath);
      const type = project.type as MobilePlatform;
      const info: MobileVersionInfo = {};

      if (type === 'android' || type === 'react-native') {
        info.android = readGradleVersion(args.projectPath);
        if (type === 'react-native' && process.platform === 'darwin') {
          info.ios = readPlistVersion(args.projectPath);
        }
      } else if (type === 'ios') {
        info.ios = readPlistVersion(args.projectPath);
      } else if (type === 'flutter') {
        info.flutter = readPubspecVersion(args.projectPath);
      } else if (type === 'compose-multiplatform') {
        const gp = readGradlePropertiesVersion(args.projectPath);
        info.android = { versionName: gp.version, versionCode: gp.versionCode };
      }

      return info;
    } catch (err) {
      return {};
    }
  });

  ipcMain.handle('mobile:setVersionInfo', (_e, args: { projectPath: string; info: MobileVersionInfo }) => {
    try {
      const project = getProject(args.projectPath);
      const type = project.type as MobilePlatform;

      if (args.info.android && (type === 'android' || type === 'react-native')) {
        writeGradleVersion(args.projectPath, args.info.android);
      }
      if (args.info.ios && (type === 'ios' || (type === 'react-native' && process.platform === 'darwin'))) {
        writePlistVersion(args.projectPath, args.info.ios);
      }
      if (args.info.flutter && type === 'flutter') {
        writePubspecVersion(args.projectPath, args.info.flutter);
      }
      if (args.info.android && type === 'compose-multiplatform') {
        writeGradlePropertiesVersion(args.projectPath, {
          version: args.info.android.versionName ?? undefined,
          versionCode: args.info.android.versionCode ?? undefined,
        });
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ─── File picker ──────────────────────────────────────────────────────────

  ipcMain.handle('mobile:pickFile', async (_e, args: { defaultPath?: string; title?: string; filters?: { name: string; extensions: string[] }[] }) => {
    const result = await dialog.showOpenDialog({
      title: args.title ?? 'Select File',
      defaultPath: args.defaultPath,
      filters: args.filters ?? [{ name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  // ─── Build record ─────────────────────────────────────────────────────────

  ipcMain.handle('mobile:getBuildRecord', (_e, args: MobileTaskRef) => {
    try {
      const project = getProject(args.projectPath);
      return MobileBuildHistoryRepository.latest(project.id);
    } catch {
      return null;
    }
  });

  // ─── Variant / flavor detection ─────────────────────────────────────────────

  ipcMain.handle('mobile:detectVariants', async (_e, args: VariantDetectArgs) => {
    try {
      // During create the project isn't saved yet — accept platform/module from args.
      let platform = args.platform;
      let module = args.module;
      if (!platform || !module) {
        const project = ProjectRepository.findByPath(args.projectPath);
        if (project) {
          platform = platform ?? (project.type as MobilePlatform);
          const config = MobileConfigRepository.get(project.id);
          module = module || config?.androidModule || config?.kmpModule || 'app';
        }
      }
      if (!platform) throw new Error('Platform is required to detect variants.');
      return await detectVariants(args.projectPath, platform, module || 'app', !!args.deep);
    } catch (err) {
      return {
        source: 'none' as const,
        androidBuildTypes: [],
        androidFlavors: [],
        androidFlavorDimensions: [],
        androidVariants: [],
        flutterEntryPoints: [],
        iosSchemes: [],
        iosConfigurations: [],
        warnings: [String(err)],
      };
    }
  });

  // ─── Project introspection (detectable settings values) ─────────────────────

  ipcMain.handle('mobile:introspect', (_e, args: IntrospectArgs) => {
    try {
      let platform = args.platform;
      let module = args.module;
      if (!platform || !module) {
        const project = ProjectRepository.findByPath(args.projectPath);
        if (project) {
          platform = platform ?? (project.type as MobilePlatform);
          const config = MobileConfigRepository.get(project.id);
          module = module || config?.androidModule || config?.kmpModule || 'app';
        }
      }
      if (!platform) throw new Error('Platform is required to introspect.');
      return introspectProject(args.projectPath, platform, module || 'app');
    } catch (err) {
      return {
        gradleModules: [], applicationIds: [], bundleIds: [], signingConfigs: [], buildTypeConfigs: [], kmpTargets: [],
        iosWorkspaces: [], iosTeamIds: [], iosDeploymentTargets: [], iosCertificates: [], iosProvisioningProfiles: [],
        warnings: [String(err)],
      };
    }
  });

  // ─── Mobile assets (firebase configs, keystores) ────────────────────────────

  ipcMain.handle('mobile:detectAssets', (_e, args: { projectPath: string; platform: MobilePlatform }) => {
    try {
      return detectAssets(args.projectPath, args.platform);
    } catch {
      return { firebaseAndroid: null, firebaseIos: null, firebaseDesktop: null, keystores: [] };
    }
  });

  ipcMain.handle('mobile:validateAsset', (_e, args: { projectPath: string; path: string; kind: AssetKind }) => {
    try {
      return validateAsset(args.projectPath, args.path, args.kind);
    } catch (err) {
      return { valid: false, error: String(err) };
    }
  });

  ipcMain.handle(
    'mobile:importAsset',
    (_e, args: { projectPath: string; srcPath: string; kind: AssetKind; platform: MobilePlatform }) => {
      try {
        return importAsset(args.projectPath, args.srcPath, args.kind, args.platform);
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
  );
}
