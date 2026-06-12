import type { BuildFlagEntry, MobilePlatform } from '../../../../shared/types';
import { BuildConfigEditor, type FlagContext } from '../buildConfig/BuildConfigEditor';
import { InfoTip } from '../ui/InfoTip';

function platformToFlagContext(platform: MobilePlatform): FlagContext {
  if (platform === 'ios') return 'ios';
  if (platform === 'flutter') return 'flutter';
  return 'android';
}

/** Shared ⓘ tooltip explaining global flags — reused by the Global tab and the KMP section. */
export const GLOBAL_FLAGS_INFO = (
  <InfoTip
    title="What are global flags?"
    lines={[
      'Extra arguments appended to EVERY build & run for this project — on top of each build config / entry point.',
      'Use them for Gradle options, JVM args, shared dart-defines, or env vars you want applied everywhere.',
    ]}
    example="--parallel   --no-daemon   -Dorg.gradle.jvmargs=-Xmx2g"
  />
);

interface Props {
  platform: MobilePlatform;
  flags: BuildFlagEntry[];
  onChange: (flags: BuildFlagEntry[]) => void;
}

export function GlobalFlagsSection({ platform, flags, onChange }: Props) {
  return (
    <div className="mobile-section">
      <div className="mobile-section-title">Global Flags {GLOBAL_FLAGS_INFO}</div>
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
