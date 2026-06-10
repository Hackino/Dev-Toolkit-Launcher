import { useState, useEffect, useCallback } from 'react';
import type { MobilePlatform, MobileVersionInfo } from '../../../../shared/types';

interface Props {
  projectPath: string;
  platform: MobilePlatform;
}

export function VersionPanel({ projectPath, platform }: Props) {
  const [info, setInfo] = useState<MobileVersionInfo>({});
  const [draft, setDraft] = useState<MobileVersionInfo>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await window.launcher.mobileGetVersionInfo({ projectPath });
    setInfo(result);
    setDraft(result);
    setDirty(false);
    setError(null);
  }, [projectPath]);

  useEffect(() => { load(); }, [load]);

  const setAndroid = (patch: Partial<NonNullable<MobileVersionInfo['android']>>) => {
    setDraft((d: MobileVersionInfo) => ({ ...d, android: { versionName: d.android?.versionName ?? null, versionCode: d.android?.versionCode ?? null, ...patch } }));
    setDirty(true);
  };
  const setIos = (patch: Partial<NonNullable<MobileVersionInfo['ios']>>) => {
    setDraft((d: MobileVersionInfo) => ({ ...d, ios: { shortVersion: d.ios?.shortVersion ?? null, bundleVersion: d.ios?.bundleVersion ?? null, ...patch } }));
    setDirty(true);
  };
  const setFlutter = (patch: Partial<NonNullable<MobileVersionInfo['flutter']>>) => {
    setDraft((d: MobileVersionInfo) => ({ ...d, flutter: { version: d.flutter?.version ?? null, ...patch } }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await window.launcher.mobileSetVersionInfo({ projectPath, info: draft });
      if (result.ok) {
        setSuccessMsg('Version updated (backup .bak created)');
        setTimeout(() => setSuccessMsg(null), 3000);
        await load();
      } else {
        setError(result.error ?? 'Unknown error');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const showAndroid = platform !== 'ios';
  const showIos = platform === 'ios' || platform === 'react-native';
  const showFlutter = platform === 'flutter';

  return (
    <div className="mobile-section">
      <div className="mobile-section-title">Version Management</div>
      <div className="mobile-section-hint">
        Reads and writes version numbers directly in your project files. A <code>.bak</code> backup is created before any write.
      </div>

      {showAndroid && (
        <div className="pf-field pf-field--row">
          <label className="pf-field pf-field--inline">
            <span>Version name</span>
            <input
              type="text"
              className="pf-mono"
              placeholder="1.0.0"
              value={draft.android?.versionName ?? ''}
              onChange={(e) => setAndroid({ versionName: e.target.value || null })}
            />
          </label>
          <label className="pf-field pf-field--inline">
            <span>Version code</span>
            <input
              type="number"
              className="pf-mono"
              placeholder="1"
              value={draft.android?.versionCode ?? ''}
              onChange={(e) => setAndroid({ versionCode: e.target.value ? parseInt(e.target.value) : null })}
            />
          </label>
        </div>
      )}

      {showIos && (
        <div className="pf-field pf-field--row">
          <label className="pf-field pf-field--inline">
            <span>Short version (CFBundleShortVersionString)</span>
            <input
              type="text"
              className="pf-mono"
              placeholder="1.0.0"
              value={draft.ios?.shortVersion ?? ''}
              onChange={(e) => setIos({ shortVersion: e.target.value || null })}
            />
          </label>
          <label className="pf-field pf-field--inline">
            <span>Bundle version (Build number)</span>
            <input
              type="text"
              className="pf-mono"
              placeholder="42"
              value={draft.ios?.bundleVersion ?? ''}
              onChange={(e) => setIos({ bundleVersion: e.target.value || null })}
            />
          </label>
        </div>
      )}

      {showFlutter && (
        <label className="pf-field">
          <span>Version (semver+buildNumber)</span>
          <input
            type="text"
            className="pf-mono"
            placeholder="1.0.0+1"
            value={draft.flutter?.version ?? ''}
            onChange={(e) => setFlutter({ version: e.target.value || null })}
          />
        </label>
      )}

      {error && <div className="wm-error">{error}</div>}
      {successMsg && <div className="wm-success">{successMsg}</div>}

      <div className="wm-pe-actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn ghost" onClick={load}>Reload from files</button>
        <button
          type="button"
          className="btn primary"
          onClick={save}
          disabled={!dirty || saving}
        >
          {saving ? 'Writing…' : 'Write to files'}
        </button>
      </div>
    </div>
  );
}
