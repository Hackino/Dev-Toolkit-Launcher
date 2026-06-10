import { getDb } from './database';
import type {
  MobileConfig,
  MobileConfigInput,
  MobilePlatform,
  AndroidBuildConfig,
  IosBuildConfig,
  FlutterEntryPoint,
  NativeBuildConfig,
  AndroidSigningConfig,
  IosSigningConfig,
  BuildFlagEntry,
  KmpTarget,
} from '../../../shared/types';

type MobileConfigRow = {
  project_id: string;
  platform: string;
  application_id: string | null;
  android_module: string | null;
  android_configs: string;
  android_signing: string;
  ios_workspace: string | null;
  ios_configs: string;
  ios_signing: string;
  flutter_entries: string;
  native_build: string;
  kmp_targets: string;
  kmp_module: string | null;
  global_flags: string;
  ide_hint: string | null;
  created_at: number;
};

const DEFAULT_ANDROID_SIGNING: AndroidSigningConfig = {
  keystorePath: null,
  keyAlias: null,
  storePasswordEnv: null,
  keyPasswordEnv: null,
};

const DEFAULT_IOS_SIGNING: IosSigningConfig = {
  bundleId: null,
  teamId: null,
  signingStyle: 'automatic',
  certificateName: null,
  provisioningProfile: null,
  deploymentTarget: null,
};

const DEFAULT_NATIVE: NativeBuildConfig = {
  enabled: false,
  cmakeListsPath: null,
  ndkVersion: null,
  abiFilters: [],
  cmakeFlags: [],
};

function toConfig(row: MobileConfigRow): MobileConfig {
  return {
    projectId: row.project_id,
    platform: row.platform as MobilePlatform,
    applicationId: row.application_id,
    androidModule: row.android_module,
    androidBuildConfigs: JSON.parse(row.android_configs) as AndroidBuildConfig[],
    androidSigning: JSON.parse(row.android_signing) as AndroidSigningConfig,
    iosWorkspace: row.ios_workspace,
    iosBuildConfigs: JSON.parse(row.ios_configs) as IosBuildConfig[],
    iosSigning: JSON.parse(row.ios_signing) as IosSigningConfig,
    flutterEntryPoints: JSON.parse(row.flutter_entries) as FlutterEntryPoint[],
    native: JSON.parse(row.native_build) as NativeBuildConfig,
    kmpTargets: JSON.parse(row.kmp_targets) as KmpTarget[],
    kmpModule: row.kmp_module,
    globalFlags: JSON.parse(row.global_flags) as BuildFlagEntry[],
    ideHint: row.ide_hint,
    createdAt: row.created_at,
  };
}

export const MobileConfigRepository = {
  get(projectId: string): MobileConfig | null {
    const row = getDb()
      .prepare('SELECT * FROM mobile_config WHERE project_id = ?')
      .get(projectId) as MobileConfigRow | undefined;
    return row ? toConfig(row) : null;
  },

  upsert(projectId: string, input: MobileConfigInput & { platform: MobilePlatform }): MobileConfig {
    const db = getDb();
    const now = Date.now();
    const existing = this.get(projectId);

    if (existing) {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (input.platform !== undefined) { fields.push('platform = ?'); values.push(input.platform); }
      if (input.applicationId !== undefined) { fields.push('application_id = ?'); values.push(input.applicationId); }
      if (input.androidModule !== undefined) { fields.push('android_module = ?'); values.push(input.androidModule); }
      if (input.androidBuildConfigs !== undefined) { fields.push('android_configs = ?'); values.push(JSON.stringify(input.androidBuildConfigs)); }
      if (input.androidSigning !== undefined) { fields.push('android_signing = ?'); values.push(JSON.stringify(input.androidSigning)); }
      if (input.iosWorkspace !== undefined) { fields.push('ios_workspace = ?'); values.push(input.iosWorkspace); }
      if (input.iosBuildConfigs !== undefined) { fields.push('ios_configs = ?'); values.push(JSON.stringify(input.iosBuildConfigs)); }
      if (input.iosSigning !== undefined) { fields.push('ios_signing = ?'); values.push(JSON.stringify(input.iosSigning)); }
      if (input.flutterEntryPoints !== undefined) { fields.push('flutter_entries = ?'); values.push(JSON.stringify(input.flutterEntryPoints)); }
      if (input.native !== undefined) { fields.push('native_build = ?'); values.push(JSON.stringify(input.native)); }
      if (input.kmpTargets !== undefined) { fields.push('kmp_targets = ?'); values.push(JSON.stringify(input.kmpTargets)); }
      if (input.kmpModule !== undefined) { fields.push('kmp_module = ?'); values.push(input.kmpModule); }
      if (input.globalFlags !== undefined) { fields.push('global_flags = ?'); values.push(JSON.stringify(input.globalFlags)); }
      if (input.ideHint !== undefined) { fields.push('ide_hint = ?'); values.push(input.ideHint); }

      if (fields.length > 0) {
        values.push(projectId);
        db.prepare(`UPDATE mobile_config SET ${fields.join(', ')} WHERE project_id = ?`).run(...values);
      }
    } else {
      db.prepare(`
        INSERT INTO mobile_config (
          project_id, platform, application_id, android_module,
          android_configs, android_signing, ios_workspace, ios_configs, ios_signing,
          flutter_entries, native_build, kmp_targets, kmp_module, global_flags, ide_hint, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        input.platform,
        input.applicationId ?? null,
        input.androidModule ?? null,
        JSON.stringify(input.androidBuildConfigs ?? []),
        JSON.stringify(input.androidSigning ?? DEFAULT_ANDROID_SIGNING),
        input.iosWorkspace ?? null,
        JSON.stringify(input.iosBuildConfigs ?? []),
        JSON.stringify(input.iosSigning ?? DEFAULT_IOS_SIGNING),
        JSON.stringify(input.flutterEntryPoints ?? []),
        JSON.stringify(input.native ?? DEFAULT_NATIVE),
        JSON.stringify(input.kmpTargets ?? []),
        input.kmpModule ?? null,
        JSON.stringify(input.globalFlags ?? []),
        input.ideHint ?? null,
        now,
      );
    }

    return this.get(projectId)!;
  },
};
