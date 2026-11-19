/**
 * Announcement de-duplication and safe wording for live regions and text-to-speech.
 *
 * Every announcement carries a stable key (e.g. `event:<event_id>`). A key is announced at most
 * once per page session, so stream reconnects, event replay and React re-renders never repeat it.
 */
import type { StepAction, StepStatus, TaskEvent, TaskStatus, TaskView } from '../api/contracts';
import { payloadString } from '../api/contracts';

export type Politeness = 'polite' | 'assertive';
export type DetailLevel = 'concise' | 'detailed';

export interface Announcement {
  key: string;
  concise: string;
  detailed?: string;
  politeness?: Politeness;
}

export class AnnouncementRegistry {
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];
  constructor(private readonly capacity = 1000) {}

  /** Returns true the first time a key is seen, false afterwards. */
  claim(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.order.push(key);
    if (this.order.length > this.capacity) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return true;
  }
}

export function chooseText(a: Announcement, level: DetailLevel): string {
  return level === 'detailed' && a.detailed ? a.detailed : a.concise;
}

// ---------- Redaction (used for speech and journal display) ----------

const SENSITIVE_KEY = /(token|secret|password|passwd|cookie|authorization|api[_-]?key|credential|session|bearer|raw_?html|page_?content|dom_?snapshot|screenshot|stack|trace)/i;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

/** Removes things that look like credentials so they are never displayed or spoken. */
export function redactText(text: string): string {
  return text
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [hidden]')
    .replace(/\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+)\b/g, '[hidden token]')
    // Long opaque strings (API keys, cookies). UUIDs are not matched because '-' is excluded.
    .replace(/(?=[A-Za-z0-9+/_]{32,})(?=[A-Za-z0-9+/_]*\d)[A-Za-z0-9+/_]{32,}/g, '[hidden value]');
}

// ---------- Human wording ----------

export const ACTION_LABELS: Record<StepAction, string> = {
  read_deadline: 'Read the assignment deadline',
  create_calendar_event: 'Create a calendar reminder',
  update_calendar_event: 'Update the calendar reminder',
  read_calendar_event: 'Read the calendar reminder',
  verify_calendar_event: 'Check the saved reminder',
};

export const TASK_STATUS_TEXT: Record<TaskStatus, { label: string; description: string; tone: Tone }> = {
  CREATED: { label: 'Created', description: 'The task was received. Nothing has run yet.', tone: 'neutral' },
  PLANNING: { label: 'Planning', description: 'Preparing the steps.', tone: 'info' },
  READY: { label: 'Ready', description: 'The plan is ready to run.', tone: 'info' },
  EXECUTING: { label: 'Working', description: 'A step is running.', tone: 'info' },
  VERIFYING: { label: 'Checking', description: 'Independently checking that the last action really took effect.', tone: 'info' },
  AWAITING_APPROVAL: { label: 'Needs your approval', description: 'Waiting for you to approve or reject an action.', tone: 'attention' },
  PAUSED: { label: 'Paused', description: 'Paused. Nothing new will start until you resume.', tone: 'attention' },
  RECOVERING: { label: 'Checking what happened', description: 'An action had an unclear result. Checking before doing anything else.', tone: 'attention' },
  COMPLETED: { label: 'Completed and verified', description: 'All steps were independently verified.', tone: 'success' },
  ESCALATED: { label: 'Needs your attention', description: 'Stopped safely because something could not be confirmed.', tone: 'attention' },
  FAILED: { label: 'Failed', description: 'The task could not be finished.', tone: 'danger' },
  CANCELLED: { label: 'Stopped', description: 'The task was stopped. No further steps will run.', tone: 'neutral' },
};

export type Tone = 'neutral' | 'info' | 'success' | 'attention' | 'danger' | 'unknown';

export const STEP_STATUS_TEXT: Record<StepStatus, { label: string; description: string; tone: Tone }> = {
  PENDING: { label: 'Not started', description: 'Waiting for earlier steps.', tone: 'neutral' },
  RUNNING: { label: 'In progress', description: 'This step is running.', tone: 'info' },
  VERIFIED: { label: 'Verified', description: 'Confirmed by an independent check.', tone: 'success' },
  FAILED: { label: 'Failed', description: 'This step did not succeed.', tone: 'danger' },
  UNCERTAIN: { label: 'Not confirmed', description: 'The action may have occurred, but it has not been confirmed.', tone: 'unknown' },
  INVALIDATED: { label: 'Replaced', description: 'Replaced by a newer plan version.', tone: 'neutral' },
  BLOCKED: { label: 'Blocked', description: 'Cannot continue without a change from you.', tone: 'attention' },
};

export const UNCERTAIN_SENTENCE = 'The action may have occurred, but it has not been confirmed.';

function stepLabel(task: TaskView | undefined, stepId: string | undefined): string {
  if (!stepId) return 'A step';
  const step = task?.plan.steps.find((s) => s.id === stepId);
  return step ? ACTION_LABELS[step.action] : `Step ${stepId}`;
}

/** Returns an announcement for important events only; routine chatter returns null. */
export function announcementForEvent(event: TaskEvent, task: TaskView | undefined): Announcement | null {
  const key = `event:${event.event_id}`;
  const stepId = payloadString(event.payload, 'step_id');
  const status = payloadString(event.payload, 'status');
  const label = stepLabel(task, stepId);
  switch (event.kind) {
    case 'task.created':
      return { key, concise: 'Task created.', detailed: `Task created with plan version ${event.plan_version}.` };
    case 'step.ready':
      return { key, concise: `Starting: ${label}.` };
    case 'step.executed':
      return {
        key,
        concise: `${label}: action sent, now checking.`,
        detailed: `${label}: the adapter reported the action was sent. It is not counted as done until an independent check confirms it.`,
      };
    case 'step.verified':
      return { key, concise: `${label}: verified.`, detailed: `${label}: verified by an independent check.` };
    case 'step.uncertain':
      return {
        key,
        politeness: 'assertive',
        concise: `${label}: not confirmed. ${UNCERTAIN_SENTENCE}`,
        detailed: `${label}: not confirmed. ${UNCERTAIN_SENTENCE} AccessPilot will not retry it automatically.`,
      };
    case 'approval.requested':
      return {
        key,
        politeness: 'assertive',
        concise: `Approval needed: ${label}.`,
        detailed: `Approval needed before: ${label}. Open "Review action" to see exactly what will happen.`,
      };
    case 'task.interrupted': {
      const action = payloadString(event.payload, 'action');
      const map: Record<string, string> = {
        PAUSE: 'Task paused.',
        RESUME: 'Task resumed.',
        STOP: 'Task stopped.',
        CORRECT: `Instruction changed. Plan version ${event.plan_version}. Task is paused for review.`,
      };
      const text = action ? map[action] : undefined;
      return text ? { key, concise: text } : null;
    }
    case 'task.completed':
      return { key, politeness: 'assertive', concise: 'Task completed and verified.' };
    case 'task.updated':
      if (status === 'ESCALATED') {
        return { key, politeness: 'assertive', concise: `Stopped safely. ${UNCERTAIN_SENTENCE}` };
      }
      if (status === 'FAILED') return { key, politeness: 'assertive', concise: 'Task failed.' };
      if (status === 'CANCELLED') return { key, concise: 'Task stopped.' };
      return null;
  }
}

/** Polling-mode fallback: announce authoritative status changes. Keyed by task+version+status. */
export function announcementForStatusChange(previous: TaskView | undefined, next: TaskView): Announcement | null {
  if (!previous || previous.task_id !== next.task_id) return null; // never announce the initial load
  if (previous.status === next.status && previous.plan.version === next.plan.version) return null;
  const info = TASK_STATUS_TEXT[next.status];
  const urgent = ['AWAITING_APPROVAL', 'ESCALATED', 'FAILED', 'COMPLETED'].includes(next.status);
  return {
    key: `status:${next.task_id}:v${next.plan.version}:${next.status}`,
    politeness: urgent ? 'assertive' : 'polite',
    concise: `Status: ${info.label}.`,
    detailed: `Status: ${info.label}. ${info.description} Plan version ${next.plan.version}.`,
  };
}
