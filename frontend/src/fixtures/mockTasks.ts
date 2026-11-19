/**
 * Deterministic SIMULATED fixtures. No real user data, accounts, or calendars.
 * Shapes follow the frozen TaskView contract (schema 1.0.0). The three-step plan mirrors the
 * gateway's mock planner (read-deadline -> create-event -> verify-event), with illustrative
 * arguments added so approval details can be demonstrated.
 */
import type { StepStatus, TaskStatus, TaskStep, TaskView } from '../api/contracts';

export const DEMO_INSTRUCTION = 'Read my assignment deadline and create a reminder in my test calendar.';
export const DEMO_TASK_ID = 'demo-task-fixture';

export function buildDemoSteps(planVersion: number, timezone = 'America/Los_Angeles'): TaskStep[] {
  return [
    {
      id: 'read-deadline',
      plan_version: planVersion,
      action: 'read_deadline',
      application: 'student_portal',
      arguments: { portal: 'Controlled test student portal (simulated)', course: 'CS 160', assignment: 'Assignment 3' },
      depends_on: [],
      risk_tier: 'T0',
      status: 'PENDING',
    },
    {
      id: 'create-event',
      plan_version: planVersion,
      action: 'create_calendar_event',
      application: 'mock_calendar',
      arguments: {
        calendar: 'AccessPilot test calendar (simulated)',
        title: 'CS 160 Assignment 3 due',
        date: '2026-12-04',
        time: '23:59',
        timezone,
        reminder_minutes_before: 1440,
      },
      depends_on: ['read-deadline'],
      risk_tier: 'T1',
      status: 'PENDING',
    },
    {
      id: 'verify-event',
      plan_version: planVersion,
      action: 'verify_calendar_event',
      application: 'mock_calendar',
      arguments: { calendar: 'AccessPilot test calendar (simulated)' },
      depends_on: ['create-event'],
      risk_tier: 'T0',
      status: 'PENDING',
    },
  ];
}

interface FixtureOptions {
  taskId?: string;
  planVersion?: number;
  stepStatuses?: [StepStatus, StepStatus, StepStatus];
  instruction?: string;
  journal?: TaskView['journal'];
}

export function buildTaskView(status: TaskStatus, options: FixtureOptions = {}): TaskView {
  const taskId = options.taskId ?? DEMO_TASK_ID;
  const version = options.planVersion ?? 1;
  const steps = buildDemoSteps(version);
  const statuses = options.stepStatuses ?? ['PENDING', 'PENDING', 'PENDING'];
  steps.forEach((s, i) => {
    s.status = statuses[i] ?? 'PENDING';
  });
  const instruction = options.instruction ?? DEMO_INSTRUCTION;
  return {
    task_id: taskId,
    instruction,
    status,
    plan: { task_id: taskId, goal: instruction, version, steps },
    journal: options.journal ?? [{ kind: 'task.created', message: 'Mock plan created; no external action executed' }],
  };
}

/** One fixture per state the UI must render. */
export const taskFixtures = {
  created: buildTaskView('CREATED'),
  planning: buildTaskView('PLANNING'),
  ready: buildTaskView('READY'),
  executing: buildTaskView('EXECUTING', { stepStatuses: ['RUNNING', 'PENDING', 'PENDING'] }),
  verifying: buildTaskView('VERIFYING', { stepStatuses: ['RUNNING', 'PENDING', 'PENDING'] }),
  verifiedStep: buildTaskView('EXECUTING', { stepStatuses: ['VERIFIED', 'PENDING', 'PENDING'] }),
  awaitingApproval: buildTaskView('AWAITING_APPROVAL', { stepStatuses: ['VERIFIED', 'PENDING', 'PENDING'] }),
  paused: buildTaskView('PAUSED', { stepStatuses: ['VERIFIED', 'PENDING', 'PENDING'] }),
  correctedV2: buildTaskView('PAUSED', {
    planVersion: 2,
    stepStatuses: ['VERIFIED', 'PENDING', 'PENDING'],
    instruction: 'Actually change it to Thursday at 4 pm',
  }),
  completed: buildTaskView('COMPLETED', { stepStatuses: ['VERIFIED', 'VERIFIED', 'VERIFIED'] }),
  failed: buildTaskView('FAILED', { stepStatuses: ['VERIFIED', 'FAILED', 'PENDING'] }),
  cancelled: buildTaskView('CANCELLED', { stepStatuses: ['VERIFIED', 'PENDING', 'PENDING'] }),
  /** Timeout after save: the write may have happened; read-back could not confirm. */
  unknownOutcome: buildTaskView('ESCALATED', { stepStatuses: ['VERIFIED', 'UNCERTAIN', 'PENDING'] }),
  recovering: buildTaskView('RECOVERING', { stepStatuses: ['VERIFIED', 'UNCERTAIN', 'PENDING'] }),
} satisfies Record<string, TaskView>;

/** Exactly what the current gateway returns for POST /api/v1/tasks (mock planner, no arguments). */
export const gatewayCreateResponse = {
  task_id: '00000000-0000-4000-8000-000000000001',
  instruction: 'Calendar reminder',
  status: 'CREATED',
  plan: {
    task_id: '00000000-0000-4000-8000-000000000001',
    goal: 'Calendar reminder',
    version: 1,
    steps: [
      { id: 'read-deadline', plan_version: 1, action: 'read_deadline', application: 'student_portal', arguments: {}, depends_on: [], risk_tier: 'T0', status: 'PENDING' },
      { id: 'create-event', plan_version: 1, action: 'create_calendar_event', application: 'mock_calendar', arguments: {}, depends_on: ['read-deadline'], risk_tier: 'T1', status: 'PENDING' },
      { id: 'verify-event', plan_version: 1, action: 'verify_calendar_event', application: 'mock_calendar', arguments: {}, depends_on: ['create-event'], risk_tier: 'T0', status: 'PENDING' },
    ],
  },
  journal: [{ kind: 'task.created', message: 'Mock plan created; no external action executed' }],
} as const;

/** Documented HTTP error bodies (FastAPI `{detail}` shape). */
export const httpErrorFixtures = {
  unknownTask: { status: 404, body: { detail: 'unknown task' } },
  unknownStep: { status: 404, body: { detail: 'unknown step' } },
  stalePlan: { status: 409, body: { detail: 'stale plan version' } },
  illegalTransition: { status: 409, body: { detail: 'invalid transition' } },
  invalidRequest: { status: 422, body: { detail: [{ loc: ['body', 'instruction'], msg: 'String should have at least 1 character' }] } },
  approvalNotImplemented: { status: 501, body: { detail: 'Approval ledger is not implemented: no action was taken' } },
  liveModeNotImplemented: { status: 501, body: { detail: 'Live mode not yet implemented; configure adapters before use' } },
} as const;
