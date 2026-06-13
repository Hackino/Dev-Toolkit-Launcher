import { useState, useEffect, useCallback, useRef } from 'react';
import type { AssetKind, AssetValidation, MobilePlatform } from '../../../../shared/types';

interface Props {
  label: string;
  value: string;
  projectPath: string;
  platform: MobilePlatform;
  kind: AssetKind;
  /** Browse-dialog filter, e.g. [{ name: 'JSON', extensions: ['json'] }]. */
  filters?: { name: string; extensions: string[] }[];
  hint?: string;
  onChange: (relPath: string) => void;
}

type Status = { kind: 'idle' | 'ok' | 'error' | 'busy'; message?: string };

/**
 * A drag-and-drop file field with autodetect + browse + validation. Used for
 * Firebase config files (google-services.json / GoogleService-Info.plist) and
 * Android keystores. Dropped files are validated, then copied into the project's
 * conventional location.
 */
export function FileDropField({ label, value, projectPath, platform, kind, filters, hint, onChange }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const hasPath = !!projectPath.trim();
  const lastValidated = useRef<string>('');

  // Validate whenever the stored path changes.
  useEffect(() => {
    if (!value || !hasPath) { setStatus({ kind: 'idle' }); return; }
    if (lastValidated.current === value) return;
    lastValidated.current = value;
    let cancelled = false;
    (async () => {
      const v: AssetValidation = await window.launcher.mobileValidateAsset({ projectPath, path: value, kind });
      if (cancelled) return;
      setStatus(v.valid ? { kind: 'ok', message: v.detail } : { kind: 'error', message: v.error });
    })();
    return () => { cancelled = true; };
  }, [value, projectPath, kind, hasPath]);

  const importFrom = useCallback(
    async (srcPath: string) => {
      setStatus({ kind: 'busy', message: 'Validating…' });
      const res = await window.launcher.mobileImportAsset({ projectPath, srcPath, kind, platform });
      if (res.ok) {
        lastValidated.current = res.relPath;
        setStatus({ kind: 'ok', message: res.detail ?? 'Imported' });
        onChange(res.relPath);
      } else {
        setStatus({ kind: 'error', message: res.error });
      }
    },
    [projectPath, kind, platform, onChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (!hasPath) { setStatus({ kind: 'error', message: 'Set the project path first.' }); return; }
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const srcPath = window.launcher.getPathForFile(file);
      if (!srcPath) { setStatus({ kind: 'error', message: 'Could not resolve the dropped file path.' }); return; }
      void importFrom(srcPath);
    },
    [hasPath, importFrom],
  );

  const autodetect = useCallback(async () => {
    if (!hasPath) { setStatus({ kind: 'error', message: 'Set the project path first.' }); return; }
    setStatus({ kind: 'busy', message: 'Scanning…' });
    const assets = await window.launcher.mobileDetectAssets({ projectPath, platform });
    const found =
      kind === 'firebase-android' ? assets.firebaseAndroid :
      kind === 'firebase-ios' ? assets.firebaseIos :
      kind === 'firebase-desktop' ? assets.firebaseDesktop :
      assets.keystores[0] ?? null;
    if (found) {
      lastValidated.current = '';
      onChange(found);
      setStatus({ kind: 'ok', message: `Found ${found}` });
    } else {
      setStatus({ kind: 'error', message: 'Nothing found in the project — drop or browse.' });
    }
  }, [hasPath, projectPath, platform, kind, onChange]);

  const openFile = useCallback(() => {
    if (!value || !hasPath) return;
    const root = projectPath.replace(/[\\/]+$/, '');
    void window.launcher.openPath(`${root}/${value}`);
  }, [value, hasPath, projectPath]);

  const browse = useCallback(async () => {
    if (!hasPath) { setStatus({ kind: 'error', message: 'Set the project path first.' }); return; }
    const picked = await window.launcher.mobilePickFile({
      title: `Select ${label}`,
      defaultPath: projectPath,
      filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
    });
    if (picked) void importFrom(picked);
  }, [hasPath, projectPath, label, filters, importFrom]);

  return (
    <div className="drop-field">
      <div className="drop-field-label">{label}</div>
      <div
        className={`drop-zone ${dragging ? 'drop-zone--over' : ''} status-${status.kind}`}
        onDragOver={(e) => { e.preventDefault(); if (hasPath) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="drop-zone-main">
          <span className="drop-zone-icon">{status.kind === 'busy' ? '⏳' : status.kind === 'ok' ? '✓' : '⤓'}</span>
          {value ? (
            <code className="drop-zone-path" title={value}>{value}</code>
          ) : (
            <span className="drop-zone-placeholder">{hint ?? 'Drag a file here'}</span>
          )}
        </div>
        <div className="drop-zone-actions">
          <button type="button" className="variant-detect-btn" onClick={autodetect} disabled={!hasPath}>⚡ Auto-detect</button>
          <button type="button" className="variant-detect-btn" onClick={browse} disabled={!hasPath}>📁 Browse</button>
          {value && (
            <button type="button" className="variant-detect-btn" onClick={openFile} title="Open the detected file">👁 Open</button>
          )}
          {value && (
            <button type="button" className="variant-detect-btn drop-zone-clear" onClick={() => { lastValidated.current = ''; onChange(''); setStatus({ kind: 'idle' }); }}>✕</button>
          )}
        </div>
      </div>
      {status.message && (
        <div className={`drop-field-status drop-field-status--${status.kind}`}>
          {status.kind === 'ok' ? '✓ ' : status.kind === 'error' ? '⚠ ' : ''}{status.message}
        </div>
      )}
    </div>
  );
}
