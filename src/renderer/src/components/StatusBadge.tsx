import type { ServiceStatus } from '../../../shared/types';

const LABEL: Record<ServiceStatus, string> = {
  idle: 'idle',
  starting: 'starting',
  running: 'running',
  crashed: 'crashed',
  stopped: 'stopped',
};

type Props = {
  status: ServiceStatus;
  lastExitCode?: number | null;
};

export default function StatusBadge({ status, lastExitCode }: Props) {
  const title =
    status === 'crashed' && lastExitCode != null
      ? `crashed (exit code ${lastExitCode})`
      : LABEL[status];
  return (
    <span className={`status-badge status-${status}`} title={title}>
      <span className="status-dot" />
      {LABEL[status]}
      {status === 'crashed' && lastExitCode != null ? ` · ${lastExitCode}` : null}
    </span>
  );
}
