import { useCallback, useState } from 'react';
import type { InterruptKind, TaskView } from '../api/contracts';
import { explainError } from '../api/errors';
import { TASK_STATUS_TEXT } from '../accessibility/announcements';
import type { Transport } from '../transport/types';
import { controlAvailability } from '../state/taskDerivations';
import { ErrorNotice } from './ErrorNotice';

export type ControlFeedback =
  | { phase: 'pending'; kind: InterruptKind | 'SUMMARY' | 'REFRESH'; text: string }
  | { phase: 'done'; kind: InterruptKind | 'SUMMARY' | 'REFRESH'; text: string }
  | { phase: 'error'; kind: InterruptKind | 'SUMMARY' | 'REFRESH'; title: string; text: string };

const PENDING_TEXT: Record<InterruptKind, string> = {
  PAUSE: 'Sending pause request. Waiting for the backend to confirm…',
  RESUME: 'Sending resume request. Waiting for the backend to confirm…',
  STOP: 'Sending stop request. Waiting for the backend to confirm…',
  STATUS: 'Asking the backend for status…',
  CORRECT: 'Sending the changed instruction. Waiting for the backend to confirm…',
};

/**
 * Sends interrupt requests. Never updates the task optimistically: the view only changes when
 * the backend returns its TaskView.
 */
export function useControlRequests(transport: Transport, taskId: string, accept: (view: TaskView) => void) {
  const [feedback, setFeedback] = useState<ControlFeedback | null>(null);

  const send = useCallback(
    async (kind: InterruptKind, instruction?: string): Promise<TaskView | null> => {
      setFeedback({ phase: 'pending', kind, text: PENDING_TEXT[kind] });
      try {
        const view = await transport.interrupt(taskId, kind === 'CORRECT' ? { kind, instruction: instruction ?? null } : { kind });
        accept(view);
        const status = TASK_STATUS_TEXT[view.status].label;
        const text =
          kind === 'CORRECT'
            ? `Backend confirmed the change. Plan version ${view.plan.version}. Task status: ${status}. Review the plan, then resume when ready.`
            : `Backend confirmed ${kind.toLowerCase()} request. Task status: ${status}.`;
        setFeedback({ phase: 'done', kind, text });
        return view;
      } catch (e) {
        const { title, message } = explainError(e, 'control');
        setFeedback({ phase: 'error', kind, title, text: message });
        return null;
      }
    },
    [transport, taskId, accept],
  );

  return { feedback, setFeedback, send };
}

interface TaskControlsProps {
  task: TaskView;
  feedback: ControlFeedback | null;
  correctionOpen: boolean;
  onControl(kind: 'PAUSE' | 'RESUME' | 'STOP'): void;
  onWhatHappened(): void;
  onCheckStatus(): void;
  onToggleCorrection(): void;
}

export function TaskControls({ task, feedback, correctionOpen, onControl, onWhatHappened, onCheckStatus, onToggleCorrection }: TaskControlsProps) {
  const can = controlAvailability(task);
  const pending = feedback?.phase === 'pending' ? feedback.kind : null;
  return (
    <section className="card" aria-labelledby="controls-heading">
      <h2 id="controls-heading">Controls</h2>
      <p className="muted" id="controls-help">
        Buttons that do not apply to the current status are unavailable. The task only changes when the backend confirms.
      </p>
      <div className="button-row" role="group" aria-labelledby="controls-heading" aria-describedby="controls-help">
        <button type="button" onClick={() => onControl('PAUSE')} disabled={!can.pause || pending === 'PAUSE'}>
          {pending === 'PAUSE' ? 'Pausing…' : 'Pause'}
        </button>
        <button type="button" onClick={() => onControl('RESUME')} disabled={!can.resume || pending === 'RESUME'}>
          {pending === 'RESUME' ? 'Resuming…' : 'Resume'}
        </button>
        <button type="button" className="danger" onClick={() => onControl('STOP')} disabled={!can.stop || pending === 'STOP'}>
          {pending === 'STOP' ? 'Stopping…' : 'Stop'}
        </button>
        <button type="button" onClick={onWhatHappened} disabled={pending === 'SUMMARY'}>
          What happened?
        </button>
        <button type="button" onClick={onCheckStatus} disabled={pending === 'REFRESH'}>
          Check status
        </button>
        <button type="button" onClick={onToggleCorrection} disabled={!can.correct} aria-expanded={correctionOpen} aria-controls="correction-form">
          Change instruction
        </button>
      </div>
      {feedback && feedback.phase !== 'error' && (
        <p className={`control-feedback ${feedback.phase}`} data-testid="control-feedback">
          {feedback.text}
        </p>
      )}
      {feedback?.phase === 'error' && <ErrorNotice title={feedback.title} message={feedback.text} />}
    </section>
  );
}
