import type { ServiceStatus } from '../../../shared/types';

type Props = {
  status: ServiceStatus;
  busy: boolean;
  disabled?: boolean;
  onRun: () => void;
  onStop: () => void;
};

export default function RunStopButton({ status, busy, disabled, onRun, onStop }: Props) {
  const isRunning = status === 'running';
  const isStarting = status === 'starting' || busy;

  if (isStarting && !isRunning) {
    return (
      <button className="btn starting" disabled>
        ⏳ Working…
      </button>
    );
  }
  if (isRunning) {
    return (
      <button className="btn stop" onClick={onStop} disabled={disabled || busy} title="Stop service">
        ■ Stop
      </button>
    );
  }
  return (
    <button className="btn run" onClick={onRun} disabled={disabled || busy} title="Start service">
      ▶ Run
    </button>
  );
}
