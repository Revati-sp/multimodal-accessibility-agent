/**
 * Pure helpers that turn backend data into what the UI shows. The backend stays the authority:
 * these functions never invent a status; they only combine TaskView with event/journal facts.
 */
import {
  isTerminal,
  payloadEvidence,
  payloadRoute,
  payloadString,
  type ExecutionRoute,
  type JournalEntry,
  type JsonObject,
  type TaskEvent,
  type TaskStep,
  type TaskView,
} from '../api/contracts';

export interface StepFacts {
  route?: ExecutionRoute;
  /** Adapter outcome from step.executed (SUCCESS is NOT verification). Current plan version only. */
  executedOutcome?: string;
  evidence?: JsonObject;
  uncertainReason?: string;
  verification?: string;
}

interface Fact {
  stepId: string;
  planVersion: number | undefined;
  kind: string;
  route?: ExecutionRoute;
  outcome?: string;
  evidence?: JsonObject;
  reason?: string;
  verification?: string;
}

function factFromJournal(entry: JournalEntry): Fact | null {
  const stepId = typeof entry.step_id === 'string' ? entry.step_id : undefined;
  if (!stepId) return null;
  const fact: Fact = {
    stepId,
    planVersion: typeof entry.plan_version === 'number' ? entry.plan_version : undefined,
    kind: typeof entry.kind === 'string' ? entry.kind : '',
  };
  const route = payloadRoute(entry);
  if (route) fact.route = route;
  if (typeof entry.outcome === 'string') fact.outcome = entry.outcome;
  const evidence = payloadEvidence(entry);
  if (evidence) fact.evidence = evidence;
  if (typeof entry.reason === 'string') fact.reason = entry.reason;
  if (typeof entry.verification === 'string') fact.verification = entry.verification;
  return fact;
}

function factFromEvent(event: TaskEvent): Fact | null {
  const stepId = payloadString(event.payload, 'step_id');
  if (!stepId) return null;
  const fact: Fact = { stepId, planVersion: event.plan_version, kind: event.kind };
  const route = payloadRoute(event.payload);
  if (route) fact.route = route;
  const outcome = payloadString(event.payload, 'outcome');
  if (outcome) fact.outcome = outcome;
  const evidence = payloadEvidence(event.payload);
  if (evidence) fact.evidence = evidence;
  const reason = payloadString(event.payload, 'reason');
  if (reason) fact.reason = reason;
  const verification = payloadString(event.payload, 'verification');
  if (verification) fact.verification = verification;
  return fact;
}

/**
 * Combines journal entries and events into per-step facts.
 * - Evidence for a VERIFIED step may come from an earlier plan version (verified work is preserved).
 * - "Executed, awaiting verification" only counts for the CURRENT plan version.
 */
export function deriveStepFacts(task: TaskView, events: readonly TaskEvent[]): Map<string, StepFacts> {
  const facts: Fact[] = [];
  for (const entry of task.journal) {
    const f = factFromJournal(entry);
    if (f) facts.push(f);
  }
  for (const e of events) {
    if (e.task_id !== task.task_id) continue;
    const f = factFromEvent(e);
    if (f) facts.push(f);
  }
  const result = new Map<string, StepFacts>();
  for (const step of task.plan.steps) {
    const mine = facts.filter((f) => f.stepId === step.id);
    const current = mine.filter((f) => f.planVersion === task.plan.version);
    const out: StepFacts = {};
    const lastWith = <K extends keyof Fact>(list: Fact[], k: K) => [...list].reverse().find((f) => f[k] !== undefined)?.[k];
    const route = lastWith(step.status === 'VERIFIED' ? mine : current, 'route');
    if (route) out.route = route as ExecutionRoute;
    const outcome = lastWith(current, 'outcome');
    if (outcome) out.executedOutcome = outcome as string;
    const evidence = lastWith(step.status === 'VERIFIED' ? mine : current, 'evidence');
    if (evidence) out.evidence = evidence as JsonObject;
    const reason = lastWith(mine, 'reason');
    if (reason && step.status === 'UNCERTAIN') out.uncertainReason = reason as string;
    const verification = lastWith(mine, 'verification');
    if (verification) out.verification = verification as string;
    result.set(step.id, out);
  }
  return result;
}

/** The step the user should focus on: running, awaiting approval, uncertain, or next ready. */
export function currentStep(task: TaskView, approvalStepId?: string): TaskStep | undefined {
  const steps = task.plan.steps;
  return (
    steps.find((s) => s.status === 'RUNNING') ??
    (approvalStepId ? steps.find((s) => s.id === approvalStepId) : undefined) ??
    steps.find((s) => s.status === 'UNCERTAIN') ??
    steps.find((s) => s.status === 'BLOCKED') ??
    steps.find((s) => s.status === 'PENDING' && s.depends_on.every((d) => steps.find((x) => x.id === d)?.status === 'VERIFIED'))
  );
}

/**
 * Which step is awaiting approval. Only answered when the backend identified it, via an
 * `approval.requested` event or journal entry for the current plan version. Never guessed.
 */
export function approvalStepId(task: TaskView, events: readonly TaskEvent[]): string | undefined {
  if (task.status !== 'AWAITING_APPROVAL') return undefined;
  const valid = (id: string | undefined) => (id && task.plan.steps.some((s) => s.id === id) ? id : undefined);
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e && e.task_id === task.task_id && e.kind === 'approval.requested' && e.plan_version === task.plan.version) {
      const id = valid(payloadString(e.payload, 'step_id'));
      if (id) return id;
    }
  }
  for (let i = task.journal.length - 1; i >= 0; i -= 1) {
    const j = task.journal[i];
    if (j && j.kind === 'approval.requested' && (j.plan_version === undefined || j.plan_version === task.plan.version)) {
      const id = valid(typeof j.step_id === 'string' ? j.step_id : undefined);
      if (id) return id;
    }
  }
  return undefined;
}

/** Latest approval-expiry hint, only if the backend provided one (not in the frozen contract). */
export function approvalExpiry(events: readonly TaskEvent[], stepId: string): string | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e?.kind === 'approval.requested' && payloadString(e.payload, 'step_id') === stepId) {
      return payloadString(e.payload, 'expires_at');
    }
  }
  return undefined;
}

export function hasUncertainOutcome(task: TaskView): boolean {
  return task.plan.steps.some((s) => s.status === 'UNCERTAIN');
}

export interface ControlAvailability {
  pause: boolean;
  resume: boolean;
  stop: boolean;
  correct: boolean;
}

/** Mirrors the transitions the gateway accepts (services/orchestrator/core.py). */
export function controlAvailability(task: TaskView): ControlAvailability {
  const terminal = isTerminal(task.status);
  return {
    pause: !terminal && task.status !== 'PAUSED',
    resume: task.status === 'PAUSED',
    stop: !terminal,
    correct: !terminal,
  };
}

const STEP_REASON_TEXT: Record<string, string> = {
  timeout_after_save: 'The request timed out after the save was sent, so it may have been saved.',
};

export function explainUncertainReason(reason: string | undefined): string {
  if (!reason) return 'The backend did not report why.';
  return STEP_REASON_TEXT[reason] ?? `Reason reported by backend: ${reason}.`;
}
