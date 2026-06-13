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
}: {
  entry: FlutterEntryPoint;
  onUpdate: (e: FlutterEntryPoint) => void;
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
      </div>

      {expanded && (
        <div className="mobile-card-body">
          <label className="pf-field">
            <span>Target file <small>(detected)</small></span>
            <input
              type="text"
              className="pf-mono"
              value={entry.target}
              readOnly
              disabled
            />
          </label>

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
  const updateEntry = (id: string, e: FlutterEntryPoint) =>
    onChange(entries.map((x) => (x.id === id ? e : x)));

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
      </div>
      <div className="mobile-section-hint">
        Entry points are detected from your project's <code>lib/main*.dart</code> files.
      </div>

      {entries.map((e) => (
        <EntryPointItem
          key={e.id}
          entry={e}
          onUpdate={(updated) => updateEntry(e.id, updated)}
        />
      ))}
    </div>
  );
}
