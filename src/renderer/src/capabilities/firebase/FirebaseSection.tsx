import type { MobilePlatform } from '../../../../shared/types';
import { FileDropField } from '../assets/FileDropField';

interface FirebaseEntry {
  enabled: boolean;
  configFilePath: string;
  appId: string;
}

export type FirebaseFormState = {
  android: FirebaseEntry;
  ios: FirebaseEntry;
  desktop: FirebaseEntry;
};

export const DEFAULT_FIREBASE_STATE: FirebaseFormState = {
  android: { enabled: false, configFilePath: '', appId: '' },
  ios: { enabled: false, configFilePath: '', appId: '' },
  desktop: { enabled: false, configFilePath: '', appId: '' },
};

interface Props {
  value: FirebaseFormState;
  projectPath: string;
  platform: MobilePlatform;
  onChange: (v: FirebaseFormState) => void;
  showIos?: boolean;
  showDesktop?: boolean;
}

const IS_MACOS = navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Mac');
const JSON_FILTER = [{ name: 'Firebase config', extensions: ['json'] }];
const PLIST_FILTER = [{ name: 'Firebase plist', extensions: ['plist'] }];

function PlatformRow({
  title,
  entry,
  dropLabel,
  dropKind,
  filters,
  projectPath,
  platform,
  disabled,
  disabledNote,
  onChange,
}: {
  title: string;
  entry: FirebaseEntry;
  dropLabel: string;
  dropKind: 'firebase-android' | 'firebase-ios' | 'firebase-desktop';
  filters: { name: string; extensions: string[] }[];
  projectPath: string;
  platform: MobilePlatform;
  disabled?: boolean;
  disabledNote?: string;
  onChange: (patch: Partial<FirebaseEntry>) => void;
}) {
  return (
    <div className="firebase-platform">
      <div className="firebase-platform-header">
        <label className={`firebase-toggle ${disabled ? 'disabled' : ''}`}>
          <input
            type="checkbox"
            checked={entry.enabled}
            disabled={disabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          <span>{title} {disabled && disabledNote && <small>({disabledNote})</small>}</span>
        </label>
      </div>
      {entry.enabled && !disabled && (
        <div className="firebase-fields">
          <FileDropField
            label={dropLabel}
            value={entry.configFilePath}
            projectPath={projectPath}
            platform={platform}
            kind={dropKind}
            filters={filters}
            hint={`Drop ${dropLabel} here`}
            onChange={(relPath) => onChange({ configFilePath: relPath })}
          />
        </div>
      )}
    </div>
  );
}

export function FirebaseSection({ value, projectPath, platform, onChange, showIos = true, showDesktop = false }: Props) {
  const patch = (key: keyof FirebaseFormState, p: Partial<FirebaseEntry>) =>
    onChange({ ...value, [key]: { ...value[key], ...p } });

  return (
    <div className="mobile-section">
      <div className="mobile-section-title">Firebase</div>
      <div className="mobile-section-hint">
        Drop a config file to auto-validate and place it in the right location, or auto-detect an existing one.
      </div>

      <div className="firebase-platform-row">
        <PlatformRow
          title="Android Firebase"
          entry={value.android}
          dropLabel="google-services.json"
          dropKind="firebase-android"
          filters={JSON_FILTER}
          projectPath={projectPath}
          platform={platform}
          onChange={(p) => patch('android', p)}
        />

        {showIos && (
          <PlatformRow
            title="iOS Firebase"
            entry={value.ios}
            dropLabel="GoogleService-Info.plist"
            dropKind="firebase-ios"
            filters={PLIST_FILTER}
            projectPath={projectPath}
            platform={platform}
            disabled={!IS_MACOS}
            disabledNote="macOS only"
            onChange={(p) => patch('ios', p)}
          />
        )}

        {showDesktop && (
          <PlatformRow
            title="Desktop Firebase"
            entry={value.desktop}
            dropLabel="google-services.json"
            dropKind="firebase-desktop"
            filters={JSON_FILTER}
            projectPath={projectPath}
            platform={platform}
            onChange={(p) => patch('desktop', p)}
          />
        )}
      </div>
    </div>
  );
}
