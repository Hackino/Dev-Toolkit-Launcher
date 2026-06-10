interface FirebaseEntry {
  enabled: boolean;
  configFilePath: string;
  appId: string;
}

export type FirebaseFormState = {
  android: FirebaseEntry;
  ios: FirebaseEntry;
};

export const DEFAULT_FIREBASE_STATE: FirebaseFormState = {
  android: { enabled: false, configFilePath: '', appId: '' },
  ios: { enabled: false, configFilePath: '', appId: '' },
};

interface Props {
  value: FirebaseFormState;
  onChange: (v: FirebaseFormState) => void;
  showIos?: boolean;
}

const IS_MACOS = navigator.platform.startsWith('Mac') || navigator.userAgent.includes('Mac');

export function FirebaseSection({ value, onChange, showIos = true }: Props) {
  const setAndroid = (patch: Partial<FirebaseEntry>) =>
    onChange({ ...value, android: { ...value.android, ...patch } });
  const setIos = (patch: Partial<FirebaseEntry>) =>
    onChange({ ...value, ios: { ...value.ios, ...patch } });

  return (
    <div className="mobile-section">
      <div className="mobile-section-title">Firebase</div>

      <div className="firebase-platform-row">
        <div className="firebase-platform">
          <div className="firebase-platform-header">
            <label className="firebase-toggle">
              <input
                type="checkbox"
                checked={value.android.enabled}
                onChange={(e) => setAndroid({ enabled: e.target.checked })}
              />
              <span>Android Firebase</span>
            </label>
          </div>
          {value.android.enabled && (
            <div className="firebase-fields">
              <label className="pf-field">
                <span>google-services.json path</span>
                <input
                  type="text"
                  className="pf-mono"
                  placeholder="app/google-services.json"
                  value={value.android.configFilePath}
                  onChange={(e) => setAndroid({ configFilePath: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>App ID <small>(optional)</small></span>
                <input
                  type="text"
                  className="pf-mono"
                  placeholder="1:1234567890:android:abc123"
                  value={value.android.appId}
                  onChange={(e) => setAndroid({ appId: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>

        {showIos && (
          <div className="firebase-platform">
            <div className="firebase-platform-header">
              <label className={`firebase-toggle ${!IS_MACOS ? 'disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={value.ios.enabled}
                  disabled={!IS_MACOS}
                  onChange={(e) => setIos({ enabled: e.target.checked })}
                />
                <span>iOS Firebase {!IS_MACOS && <small>(macOS only)</small>}</span>
              </label>
            </div>
            {value.ios.enabled && IS_MACOS && (
              <div className="firebase-fields">
                <label className="pf-field">
                  <span>GoogleService-Info.plist path</span>
                  <input
                    type="text"
                    className="pf-mono"
                    placeholder="ios/Runner/GoogleService-Info.plist"
                    value={value.ios.configFilePath}
                    onChange={(e) => setIos({ configFilePath: e.target.value })}
                  />
                </label>
                <label className="pf-field">
                  <span>App ID <small>(optional)</small></span>
                  <input
                    type="text"
                    className="pf-mono"
                    placeholder="1:1234567890:ios:abc123"
                    value={value.ios.appId}
                    onChange={(e) => setIos({ appId: e.target.value })}
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
