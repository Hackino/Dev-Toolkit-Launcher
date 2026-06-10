import type { BuildFlagEntry, MobilePlatform } from '../../../../shared/types';
import { BuildConfigEditor, type FlagContext } from './BuildConfigEditor';

function platformToFlagContext(platform: MobilePlatform): FlagContext {
  if (platform === 'ios') return 'ios';
  if (platform === 'flutter') return 'flutter';
  return 'android';
}

interface Props {
  platform: MobilePlatform;
  flags: BuildFlagEntry[];
  onChange: (flags: BuildFlagEntry[]) => void;
}

export function GlobalFlagsSection({ platform, flags, onChange }: Props) {
  return (
    <div className="mobile-section">
      <div className="mobile-section-title">Global Flags</div>
      <div className="mobile-section-hint">
        These flags are appended to every build for this project. Common use: <code>--parallel</code>, <code>--no-daemon</code>, shared dart-defines, or env vars.
      </div>
      <BuildConfigEditor
        entries={flags}
        onChange={onChange}
        context={platformToFlagContext(platform)}
        label="Global Flags"
        placeholder="No global flags configured."
      />
    </div>
  );
}
