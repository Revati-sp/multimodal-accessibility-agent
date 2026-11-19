import { afterEach, describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { TaskEvent } from '../src/api/contracts';
import { ApiError } from '../src/api/errors';
import { createMockTransport, type MockTransport } from '../src/transport/mockTransport';

let transport: MockTransport;
afterEach(() => transport.dispose());

function setup() {
  transport = createMockTransport({ stepDelayMs: 1, latencyMs: 0 });
  const events: TaskEvent[] = [];
  transport.openEventStream({ onMessage: (e) => events.push(e as TaskEvent), onStatus: () => undefined });
  return events;
}

const create = (scenario: 'standard' | 'timeout-after-save' | 'stale-approval' = 'standard') =>
  transport.createTask({ instruction: 'Read my deadline', timezone: 'UTC', mode: 'mock' }, { demoScenario: scenario });

async function statusOf(id: string) {
  return (await transport.getTask(id)).status;
}

describe('mock transport (demo backend)', () => {
  it('reaches approval only after the portal step is verified', async () => {
    setup();
    const task = await create();
    await waitFor(async () => expect(await statusOf(task.task_id)).toBe('AWAITING_APPROVAL'));
    const view = await transport.getTask(task.task_id);
    expect(view.plan.steps.map((s) => s.status)).toEqual(['VERIFIED', 'PENDING', 'PENDING']);
  });

  it('completes only after every step is verified, and executed is reported before verified', async () => {
    const events = setup();
    const task = await create();
    await waitFor(async () => expect(await statusOf(task.task_id)).toBe('AWAITING_APPROVAL'));
    await transport.submitApproval(task.task_id, 'create-event', { approved: true, plan_version: 1 });
    await waitFor(async () => expect(await statusOf(task.task_id)).toBe('COMPLETED'));
    const kinds = events.map((e) => `${e.kind}:${String(e.payload.step_id ?? '')}`);
    expect(kinds.indexOf('step.executed:create-event')).toBeLessThan(kinds.indexOf('step.verified:create-event'));
    expect(kinds.at(-1)).toBe('task.completed:');
    const view = await transport.getTask(task.task_id);
    expect(view.plan.steps.every((s) => s.status === 'VERIFIED')).toBe(true);
  });

  it('timeout-after-save ends ESCALATED with an UNCERTAIN step and no second write', async () => {
    const events = setup();
    const task = await create('timeout-after-save');
    await waitFor(async () => expect(await statusOf(task.task_id)).toBe('AWAITING_APPROVAL'));
    await transport.submitApproval(task.task_id, 'create-event', { approved: true, plan_version: 1 });
    await waitFor(async () => expect(await statusOf(task.task_id)).toBe('ESCALATED'));
    const view = await transport.getTask(task.task_id);
    expect(view.plan.steps[1]?.status).toBe('UNCERTAIN');
    expect(events.filter((e) => e.kind === 'step.executed' && e.payload.step_id === 'create-event')).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'step.uncertain')).toHaveLength(1);
  });

  it('mirrors gateway interrupt rules', async () => {
    setup();
    const task = await create();
    await expect(transport.interrupt(task.task_id, { kind: 'RESUME' })).rejects.toMatchObject({ kind: 'conflict', status: 409 });
    expect((await transport.interrupt(task.task_id, { kind: 'PAUSE' })).status).toBe('PAUSED');
    const corrected = await transport.interrupt(task.task_id, { kind: 'CORRECT', instruction: 'Actually Thursday at 4 pm' });
    expect(corrected.plan.version).toBe(2);
    expect(corrected.status).toBe('PAUSED');
    expect(corrected.plan.steps[1]?.arguments).toMatchObject({ date: '2026-12-03', time: '16:00' });
    await expect(transport.interrupt(task.task_id, { kind: 'CORRECT' })).rejects.toMatchObject({ status: 422 });
    expect((await transport.interrupt(task.task_id, { kind: 'STOP' })).status).toBe('CANCELLED');
    await expect(transport.interrupt(task.task_id, { kind: 'STOP' })).rejects.toBeInstanceOf(ApiError);
  });

  it('refuses an approval for an old plan version with 409 stale plan version', async () => {
    setup();
    const task = await create('stale-approval');
    await waitFor(async () => expect(await statusOf(task.task_id)).toBe('AWAITING_APPROVAL'));
    await expect(transport.submitApproval(task.task_id, 'create-event', { approved: true, plan_version: 1 })).rejects.toMatchObject({
      status: 409,
      detail: 'stale plan version',
    });
    expect((await transport.getTask(task.task_id)).plan.version).toBe(2);
    await transport.submitApproval(task.task_id, 'create-event', { approved: true, plan_version: 2 });
  });

  it('returns 404 for an unknown task or step', async () => {
    setup();
    await expect(transport.getTask('nope')).rejects.toMatchObject({ status: 404 });
    const task = await create();
    await expect(transport.submitApproval(task.task_id, 'ghost', { approved: true, plan_version: 1 })).rejects.toMatchObject({ status: 404 });
  });

  it('simulated network error never creates a task', async () => {
    setup();
    await expect(
      transport.createTask({ instruction: 'x', timezone: 'UTC', mode: 'mock' }, { demoScenario: 'network-error' }),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});
