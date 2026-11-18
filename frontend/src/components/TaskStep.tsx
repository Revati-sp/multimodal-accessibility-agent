import type { Application, RiskTier, TaskStep as TaskStepModel } from '../api/contracts';
import { ACTION_LABELS, STEP_STATUS_TEXT, UNCERTAIN_SENTENCE } from '../accessibility/announcements';
import type { StepFacts } from '../state/taskDerivations';
import { explainUncertainReason } from '../state/taskDerivations';
import { KeyValueList } from './KeyValueList';
import { StatusBadge } from './StatusBadge';

export const APPLICATION_LABELS: Record<Application, string> = {
  student_portal: 'Student portal',
  google_calendar: 'Google Calendar',
  mock_calendar: 'Mock calendar (simulated, not Google Calendar)',
};

export const RISK_LABELS: Record<RiskTier, string> = {
  T0: 'T0 — read-only',
  T1: 'T1 — reversible write',
  T2: 'T2 — consequential action, needs explicit approval',
  T3: 'T3 — high impact, needs direct human control',
};

interface TaskStepProps {
  step: TaskStepModel;
  index: number;
  allSteps: TaskStepModel[];
  facts: StepFacts | undefined;
  isCurrent: boolean;
}

/** Describes execution separately from verification. SUCCESS from an adapter is never "done". */
export function executionText(step: TaskStepModel, facts: StepFacts | undefined): string {
  if (step.status === 'VERIFIED') return 'Done and independently verified.';
  if (step.status === 'UNCERTAIN') return `${UNCERTAIN_SENTENCE} ${explainUncertainReason(facts?.uncertainReason)}`;
  if (facts?.executedOutcome === 'SUCCESS') {
    return 'Action sent: the adapter reported SUCCESS. Not done yet — waiting for an independent check.';
  }
  if (facts?.executedOutcome === 'FAILED') return 'The adapter reported that the action failed.';
  if (step.status === 'RUNNING') return 'Running. No result reported yet.';
  return 'Not executed.';
}

export function TaskStep({ step, index, allSteps, facts, isCurrent }: TaskStepProps) {
  const status = STEP_STATUS_TEXT[step.status];
  const headingId = `step-${step.id}-heading`;
  const deps = step.depends_on.map((id) => {
    const dep = allSteps.find((s) => s.id === id);
    const depIndex = allSteps.findIndex((s) => s.id === id) + 1;
    return dep ? `Step ${depIndex}, ${ACTION_LABELS[dep.action]} (${STEP_STATUS_TEXT[dep.status].label})` : id;
  });
  return (
    <li className={`step${isCurrent ? ' step-current' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
      <div className="step-header">
        <h3 id={headingId}>
          Step {index + 1}: {ACTION_LABELS[step.action]}
          {isCurrent && <span className="current-tag"> (current step)</span>}
        </h3>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>
      <dl className="kv">
        <div className="kv-row">
          <dt>Status</dt>
          <dd>
            {status.label}. {status.description}
          </dd>
        </div>
        <div className="kv-row">
          <dt>Execution</dt>
          <dd>{executionText(step, facts)}</dd>
        </div>
        <div className="kv-row">
          <dt>Verification</dt>
          <dd>
            {step.status === 'VERIFIED'
              ? 'Verified'
              : facts?.verification === 'UNKNOWN'
                ? 'Unknown — could not be confirmed'
                : 'Not verified yet'}
          </dd>
        </div>
        <div className="kv-row">
          <dt>Depends on</dt>
          <dd>{deps.length ? deps.join('; ') : 'Nothing. This step can start first.'}</dd>
        </div>
        <div className="kv-row">
          <dt>Route</dt>
          <dd>{facts?.route ?? 'Not reported yet'}</dd>
        </div>
        <div className="kv-row">
          <dt>Application</dt>
          <dd>{APPLICATION_LABELS[step.application]}</dd>
        </div>
        <div className="kv-row">
          <dt>Risk</dt>
          <dd>{RISK_LABELS[step.risk_tier]}</dd>
        </div>
      </dl>
      <details className="step-details">
        <summary>Details for step {index + 1}: action arguments and evidence</summary>
        <h4>Action arguments</h4>
        <KeyValueList data={step.arguments} emptyText="No arguments reported by the backend." />
        <h4>Verification evidence</h4>
        <KeyValueList data={facts?.evidence} emptyText="No evidence available yet." />
        <p className="muted">
          Step ID: <code>{step.id}</code>. Plan version {step.plan_version}.
        </p>
      </details>
    </li>
  );
}
