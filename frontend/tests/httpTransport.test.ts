import { describe, expect, it, vi } from 'vitest';
import { ApiError, explainError } from '../src/api/errors';
import { gatewayCreateResponse, httpErrorFixtures } from '../src/fixtures/mockTasks';
import { createHttpTransport } from '../src/transport/httpTransport';

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function transportWith(fetchImpl: typeof fetch, timeoutMs?: number) {
  return createHttpTransport({ baseUrl: 'http://gw.test', enableWebSocket: false, fetchImpl, ...(timeoutMs ? { timeoutMs } : {}) });
}

async function catchError(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected rejection');
}

describe('HTTP transport — documented endpoints only', () => {
  it('POST /api/v1/tasks with a TaskCreate body', async () => {
    const fetchImpl = respond(201, gatewayCreateResponse);
    const t = transportWith(fetchImpl);
    const view = await t.createTask({ instruction: 'Calendar reminder', timezone: 'America/Los_Angeles', mode: 'mock' });
    expect(view.task_id).toBe(gatewayCreateResponse.task_id);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://gw.test/api/v1/tasks');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ instruction: 'Calendar reminder', timezone: 'America/Los_Angeles', mode: 'mock' });
  });

  it('uses the documented paths for get, journal, summary, interrupt and confirmation', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method} ${String(url)}`);
      const u = String(url);
      if (u.endsWith('/journal')) return new Response(JSON.stringify({ task_id: 'a b', journal: [] }));
      if (u.endsWith('/summary')) return new Response(JSON.stringify({ task_id: 'a b', status: 'CREATED', plan_version: 1, summary: 's' }));
      if (u.includes('/confirmations/')) return new Response(JSON.stringify({}));
      return new Response(JSON.stringify(gatewayCreateResponse));
    }) as unknown as typeof fetch;
    const t = transportWith(fetchImpl);
    await t.getTask('a b');
    await t.getJournal('a b');
    await t.getSummary('a b');
    await t.interrupt('a b', { kind: 'PAUSE' });
    await t.submitApproval('a b', 'create-event', { approved: true, plan_version: 1, confirmation_text: null });
    expect(calls).toEqual([
      'GET http://gw.test/api/v1/tasks/a%20b',
      'GET http://gw.test/api/v1/tasks/a%20b/journal',
      'GET http://gw.test/api/v1/tasks/a%20b/summary',
      'POST http://gw.test/api/v1/tasks/a%20b/interrupt',
      'POST http://gw.test/api/v1/tasks/a%20b/confirmations/create-event',
    ]);
  });

  it.each([
    ['unknownTask', 'not_found'],
    ['stalePlan', 'conflict'],
    ['illegalTransition', 'conflict'],
    ['invalidRequest', 'validation'],
    ['approvalNotImplemented', 'not_implemented'],
  ] as const)('maps %s to %s', async (fixture, kind) => {
    const { status, body } = httpErrorFixtures[fixture];
    const err = await catchError(transportWith(respond(status, body)).getTask('x'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe(kind);
    expect(err.status).toBe(status);
  });

  it('explains 501 honestly: no action was taken', async () => {
    const { status, body } = httpErrorFixtures.approvalNotImplemented;
    const err = await catchError(transportWith(respond(status, body)).submitApproval('t', 's', { approved: true, plan_version: 1 }));
    const text = explainError(err, 'approval');
    expect(text.title).toBe('Not available yet');
    expect(text.message).toMatch(/no action was taken/i);
  });

  it('explains a stale-plan 409 and joins 422 messages', async () => {
    expect(explainError(new ApiError('conflict', 'stale plan version', 409)).title).toBe('The plan changed');
    const err = await catchError(transportWith(respond(422, httpErrorFixtures.invalidRequest.body)).getTask('x'));
    expect(err.detail).toBe('String should have at least 1 character');
  });

  it('reports network failure without claiming anything happened', async () => {
    const err = await catchError(transportWith(vi.fn(async () => Promise.reject(new TypeError('offline')))).getTask('x'));
    expect(err.kind).toBe('network');
  });

  it('reports a timeout on create as "may or may not have been created"', async () => {
    const hanging = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    ) as unknown as typeof fetch;
    const err = await catchError(transportWith(hanging, 20).createTask({ instruction: 'x', timezone: 'UTC', mode: 'mock' }));
    expect(err.kind).toBe('timeout');
    expect(explainError(err, 'create').message).toMatch(/may or may not have been created/);
  });

  it('rejects a response that breaks the contract', async () => {
    const err = await catchError(transportWith(respond(200, { ...gatewayCreateResponse, status: 'DONE' })).getTask('x'));
    expect(err.kind).toBe('contract');
  });

  it('has no event stream unless the WebSocket is explicitly enabled', () => {
    const t = transportWith(respond(200, {}));
    expect(t.openEventStream({ onMessage: vi.fn(), onStatus: vi.fn() })).toBeNull();
    expect(t.streamLabel).toMatch(/not implemented/);
  });
});
