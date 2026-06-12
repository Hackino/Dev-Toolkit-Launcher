import type { ReactNode } from 'react';
import type { BuildFlagEntry, BuildFlagKind } from '../../../../shared/types';

export type FlagContext = 'android' | 'ios' | 'flutter' | 'global';

const KIND_OPTIONS: Record<FlagContext, { value: BuildFlagKind; label: string }[]> = {
  android: [
    { value: 'gradle-prop', label: '-P (Gradle prop)' },
    { value: 'gradle-flag', label: '--flag (Gradle flag)' },
    { value: 'gradle-system-prop', label: '-D (System prop)' },
    { value: 'env', label: 'Env var' },
  ],
  ios: [
    { value: 'xcode-setting', label: 'Build setting (KEY=VAL)' },
    { value: 'xcode-flag', label: 'xcodebuild flag' },
    { value: 'env', label: 'Env var' },
  ],
  flutter: [
    { value: 'flutter-dart-define', label: '--dart-define' },
    { value: 'flutter-flag', label: 'Flutter flag' },
    { value: 'env', label: 'Env var' },
  ],
  global: [
    { value: 'gradle-prop', label: '-P (Gradle prop)' },
    { value: 'gradle-flag', label: '--flag (Gradle)' },
    { value: 'gradle-system-prop', label: '-D (System prop)' },
    { value: 'xcode-setting', label: 'Build setting (iOS)' },
    { value: 'xcode-flag', label: 'xcodebuild flag' },
    { value: 'flutter-dart-define', label: '--dart-define (Flutter)' },
    { value: 'flutter-flag', label: 'Flutter flag' },
    { value: 'env', label: 'Env var' },
  ],
};

function newEntry(context: FlagContext): BuildFlagEntry {
  const defaultKind = KIND_OPTIONS[context][0].value;
  return {
    id: crypto.randomUUID(),
    key: '',
    value: '',
    enabled: true,
    kind: defaultKind,
    description: null,
  };
}

interface Props {
  entries: BuildFlagEntry[];
  onChange: (entries: BuildFlagEntry[]) => void;
  context: FlagContext;
  label?: string;
  placeholder?: string;
  info?: ReactNode;   // optional ⓘ tooltip rendered next to the label
}

export function BuildConfigEditor({ entries, onChange, context, label, placeholder, info }: Props) {
  const kinds = KIND_OPTIONS[context];

  const add = () => onChange([...entries, newEntry(context)]);
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const update = (id: string, patch: Partial<BuildFlagEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  return (
    <div className="bce-root">
      <div className="bce-header">
        <span className="bce-label">{label ?? 'Custom Flags'}{info}</span>
        <button type="button" className="btn ghost bce-add-btn" onClick={add}>+ Add</button>
      </div>

      {entries.length === 0 && (
        <div className="bce-empty">{placeholder ?? 'No flags configured. Click + Add to begin.'}</div>
      )}

      {entries.length > 0 && (
        <div className="bce-table-head">
          <span style={{ flex: '0 0 160px' }}>Kind</span>
          <span style={{ flex: '1' }}>Key</span>
          <span style={{ flex: '1' }}>Value</span>
          <span style={{ width: 32 }}></span>
        </div>
      )}

      {entries.map((entry) => {
        const isBoolFlag = entry.kind === 'gradle-flag' || entry.kind === 'xcode-flag' || entry.kind === 'flutter-flag';
        return (
          <div key={entry.id} className={`bce-row ${entry.enabled ? '' : 'bce-row--disabled'}`}>
            <div className="bce-row-main">
              <select
                className="bce-kind"
                value={entry.kind}
                onChange={(e) => update(entry.id, { kind: e.target.value as BuildFlagKind })}
              >
                {kinds.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>

              <input
                className="bce-key pf-mono"
                type="text"
                placeholder={entry.kind === 'env' ? 'VAR_NAME' : 'key'}
                value={entry.key}
                onChange={(e) => update(entry.id, { key: e.target.value })}
              />

              {!isBoolFlag ? (
                <input
                  className="bce-value pf-mono"
                  type={entry.kind === 'env' ? 'text' : 'text'}
                  placeholder="value"
                  value={entry.value}
                  onChange={(e) => update(entry.id, { value: e.target.value })}
                />
              ) : (
                <span className="bce-value-dash">—</span>
              )}

              <label className="bce-toggle" title={entry.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={(e) => update(entry.id, { enabled: e.target.checked })}
                />
                <span className="bce-toggle-track" />
              </label>

              <button type="button" className="bce-del" onClick={() => remove(entry.id)} title="Remove">✕</button>
            </div>

            <input
              className="bce-description"
              type="text"
              placeholder="Description (optional)"
              value={entry.description ?? ''}
              onChange={(e) => update(entry.id, { description: e.target.value || null })}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Minify / R8 section ──────────────────────────────────────────────────────

export type MinifyState = { enabled: boolean; r8FullMode: boolean; proguardFiles: string[] };

interface MinifyProps {
  value: MinifyState;
  onChange: (v: MinifyState) => void;
}

export function MinifySection({ value, onChange }: MinifyProps) {
  const set = <K extends keyof MinifyState>(k: K, v: MinifyState[K]) =>
    onChange({ ...value, [k]: v });

  const addFile = () => onChange({ ...value, proguardFiles: [...value.proguardFiles, ''] });
  const removeFile = (i: number) =>
    onChange({ ...value, proguardFiles: value.proguardFiles.filter((_, idx) => idx !== i) });
  const updateFile = (i: number, v: string) =>
    onChange({ ...value, proguardFiles: value.proguardFiles.map((f, idx) => idx === i ? v : f) });

  return (
    <div className="minify-section">
      <div className="minify-header">Minify / R8</div>
      <div className="minify-toggles">
        <label className="minify-opt">
          <input type="checkbox" checked={value.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          <span>Enable R8 / ProGuard</span>
        </label>
        {value.enabled && (
          <label className="minify-opt">
            <input type="checkbox" checked={value.r8FullMode} onChange={(e) => set('r8FullMode', e.target.checked)} />
            <span>R8 Full Mode</span>
          </label>
        )}
      </div>
      {value.enabled && (
        <div className="minify-proguard">
          <div className="minify-files-header">
            <span>ProGuard files</span>
            <button type="button" className="btn ghost pf-env-add" onClick={addFile}>+ Add</button>
          </div>
          {value.proguardFiles.map((f, i) => (
            <div key={i} className="pf-env-row">
              <input
                type="text"
                className="pf-mono"
                placeholder="proguard-rules.pro"
                value={f}
                onChange={(e) => updateFile(i, e.target.value)}
              />
              <button type="button" className="pf-env-remove" onClick={() => removeFile(i)}>✕</button>
            </div>
          ))}
          {value.proguardFiles.length === 0 && (
            <span className="pf-env-empty">No ProGuard files added</span>
          )}
        </div>
      )}
    </div>
  );
}
