import { useState } from 'react';
import type { FlutterEntryPoint } from '../../../../shared/types';
import { BuildConfigEditor } from '../../capabilities/buildConfig/BuildConfigEditor';
import { VariantDetector } from '../../capabilities/variants/VariantDetector';
import { applyFlutterDetection } from '../../capabilities/variants/variantApply';

function newEntryPoint(name: string, target: string): FlutterEntryPoint {
  return {
    id: crypto.randomUUID(),
    name,
    target,
    flavor: null,
    dartDefines: [],
    extraFlags: [],
    isDefault: false,
  };
}

export const DEFAULT_FLUTTER_ENTRIES: FlutterEntryPoint[] = [
  { ...newEntryPoint('Main', 'lib/main.dart'), isDefault: true },
];

interface Props {
  entries: FlutterEntryPoint[];
  projectPath: string;
  onChange: (entries: FlutterEntryPoint[]) => void;
}

function EntryPointItem({
  entry,
  onUpdate,
  onRemove,
  canRemove,
}: {
  entry: FlutterEntryPoint;
  onUpdate: (e: FlutterEntryPoint) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const set = <K extends keyof FlutterEntryPoint>(k: K, v: FlutterEntryPoint[K]) =>
    onUpdate({ ...entry, [k]: v });

  return (
    <div className="mobile-card">
      <div className="mobile-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="mobile-card-chevron">{expanded ? '▾' : '▸'}</span>
        <input
          className="mobile-card-name"
          type="text"
          value={entry.name}
          placeholder="Entry point name"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => set('name', e.target.value)}
        />
        <label className="mobile-default-check" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={entry.isDefault}
            onChange={(e) => set('isDefault', e.target.checked)}
          />
          Default
        </label>
        {canRemove && (
          <button
            type="button"
            className="btn ghost pf-env-remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >✕</button>
        )}
      </div>

      {expanded && (
        <div className="mobile-card-body">
          <div className="pf-field pf-field--row">
            <label className="pf-field pf-field--inline">
              <span>Target file</span>
              <input
                type="text"
                className="pf-mono"
                placeholder="lib/main.dart"
                value={entry.target}
                onChange={(e) => set('target', e.target.value)}
              />
            </label>
            <label className="pf-field pf-field--inline">
              <span>Flavor <small>(optional)</small></span>
              <input
                type="text"
                placeholder="production"
                value={entry.flavor ?? ''}
                onChange={(e) => set('flavor', e.target.value || null)}
              />
            </label>
          </div>

          <BuildConfigEditor
            entries={entry.dartDefines}
            onChange={(flags) => set('dartDefines', flags)}
            context="flutter"
            label="Dart Defines"
            placeholder="No dart-defines. Add --dart-define=KEY=VALUE entries."
          />

          <BuildConfigEditor
            entries={entry.extraFlags}
            onChange={(flags) => set('extraFlags', flags)}
            context="flutter"
            label="Extra Flags"
            placeholder="No extra flags. Add --no-sound-null-safety or similar."
          />
        </div>
      )}
    </div>
  );
}

export function FlutterSettingsSection({ entries, projectPath, onChange }: Props) {
  const addEntry = () =>
    onChange([...entries, newEntryPoint(`Entry ${entries.length + 1}`, 'lib/main.dart')]);

  const updateEntry = (id: string, e: FlutterEntryPoint) =>
    onChange(entries.map((x) => (x.id === id ? e : x)));

  const removeEntry = (id: string) =>
    onChange(entries.filter((x) => x.id !== id));

  return (
    <div className="mobile-section">
      <div className="mobile-section-title">Flutter Settings</div>

      <VariantDetector
        projectPath={projectPath}
        platform="flutter"
        kind="flutter"
        onApply={(d) => onChange(applyFlutterDetection(entries, d))}
      />

      <div className="mobile-subsection-header">
        <span>Entry Points</span>
        <button type="button" className="btn ghost pf-env-add" onClick={addEntry}>+ Add</button>
      </div>
      <div className="mobile-section-hint">
        Add multiple entry points to run different configurations (dev, staging, prod) without code changes.
      </div>

      {entries.map((e) => (
        <EntryPointItem
          key={e.id}
          entry={e}
          onUpdate={(updated) => updateEntry(e.id, updated)}
          onRemove={() => removeEntry(e.id)}
          canRemove={entries.length > 1}
        />
      ))}
    </div>
  );
}
