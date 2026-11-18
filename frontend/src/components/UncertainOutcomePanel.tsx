import type { TaskStep } from '../api/contracts';
import { ACTION_LABELS, UNCERTAIN_SENTENCE } from '../accessibility/announcements';
import { explainUncertainReason, type StepFacts } from '../state/taskDerivations';

interface UncertainOutcomePanelProps {
  step: TaskStep;
  facts: StepFacts | undefined;
  canStop: boolean;
  busy: 'check' | 'explain' | 'stop' | null;
  onCheckAgain(): void;
  onWhatHappened(): void;
  onStop(): void;
}

/**
 * Shown when a write may or may not have happened. Deliberately offers NO retry: the frozen
 * contract says UNKNOWN blocks blind retry, and the backend has not proven a retry is safe.
 */
export function UncertainOutcomePanel({ step, facts, canStop, busy, onCheckAgain, onWhatHappened, onStop }: UncertainOutcomePanelProps) {
  return (
    <section className="card uncertain" aria-labelledby="uncertain-heading">
      <h2 id="uncertain-heading">
        <span aria-hidden="true">? </span>Not confirmed: {ACTION_LABELS[step.action]}
      </h2>
      <p className="lead">
        <strong>{UNCERTAIN_SENTENCE}</strong>
      </p>
      <p>{explainUncertainReason(facts?.uncertainReason)}</p>
      <p>
        This is neither a success nor a failure. To avoid creating a duplicate, AccessPilot did not try again. Check the
        latest status, ask what happened, or stop the task.
      </p>
      <div className="button-row">
        <button type="button" onClick={onCheckAgain} disabled={busy === 'check'}>
          {busy === 'check' ? 'Checking…' : 'Check again'}
        </button>
        <button type="button" onClick={onWhatHappened} disabled={busy === 'explain'}>
          {busy === 'explain' ? 'Asking…' : 'What happened?'}
        </button>
        <button type="button" className="danger" onClick={onStop} disabled={!canStop || busy === 'stop'}>
          {busy === 'stop' ? 'Stopping…' : 'Stop task'}
        </button>
      </div>
      <p className="muted">“Check again” reloads the task from the backend. It does not repeat the action.</p>
    </section>
  );
}
