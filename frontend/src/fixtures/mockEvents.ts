/**
 * SIMULATED TaskEvent fixtures (schema 1.0.0). Payload keys beyond the documented
 * `step.uncertain` example are PROPOSED, see frontend/docs/contract-amendment-proposal.md.
 */
import type { TaskEvent } from '../api/contracts';
import { DEMO_TASK_ID } from './mockTasks';

let seq = 0;
function ev(kind: TaskEvent['kind'], payload: TaskEvent['payload'], planVersion = 1, taskId = DEMO_TASK_ID): TaskEvent {
  seq += 1;
  return {
    schema_version: '1.0.0',
    event_id: `fixture-evt-${String(seq).padStart(3, '0')}`,
    task_id: taskId,
    plan_version: planVersion,
    kind,
    created_at: `2026-11-18T17:00:${String(seq).padStart(2, '0')}Z`,
    payload,
  };
}

const created = ev('task.created', { status: 'CREATED' });

export const eventFixtures = {
  created,
  planning: ev('task.updated', { status: 'PLANNING' }),
  readDeadlineReady: ev('step.ready', { step_id: 'read-deadline' }),
  readDeadlineExecuted: ev('step.executed', { step_id: 'read-deadline', route: 'DOM', outcome: 'SUCCESS' }),
  readDeadlineVerified: ev('step.verified', {
    step_id: 'read-deadline',
    status: 'VERIFIED',
    evidence: { source: 'controlled student portal (simulated)', deadline: '2026-12-04 23:59' },
  }),
  approvalRequested: ev('approval.requested', { step_id: 'create-event', risk_tier: 'T1' }),
  createEventUncertain: ev('step.uncertain', { step_id: 'create-event', route: 'API', reason: 'timeout_after_save' }),
  paused: ev('task.interrupted', { action: 'PAUSE', status: 'PAUSED' }),
  completed: ev('task.completed', { status: 'COMPLETED' }),
  /** Same event_id as `created`: must be ignored as a duplicate. */
  duplicateOfCreated: { ...created } as TaskEvent,
  /** For a different task: must not be applied to DEMO_TASK_ID. */
  otherTask: ev('task.updated', { status: 'CANCELLED' }, 1, 'some-other-task'),
};

/** Wire messages that must be rejected visibly. */
export const invalidEventFixtures = {
  unsupportedSchema: { ...eventFixtures.planning, schema_version: '2.0.0', event_id: 'fixture-evt-v2' },
  missingSchema: { event_id: 'fixture-evt-noschema', task_id: DEMO_TASK_ID, kind: 'task.updated' },
  unknownKind: { ...eventFixtures.planning, kind: 'task.teleported', event_id: 'fixture-evt-badkind' },
};

/** The exact example documented in docs/event-contracts.md. */
export const documentedUncertainEvent = {
  schema_version: '1.0.0',
  event_id: '7a3d8f59-d2e8-4a23-8e78-e4fa0fe454e0',
  task_id: 'task-1',
  plan_version: 1,
  kind: 'step.uncertain',
  created_at: '2026-11-14T12:00:00Z',
  payload: { step_id: 'create-event', route: 'API', reason: 'timeout_after_save' },
};
