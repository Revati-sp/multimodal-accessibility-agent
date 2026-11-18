/**
 * DEMO MODE — simulated backend running entirely in the browser.
 *
 * Purpose: let the frontend be developed and tested before the gateway executes steps,
 * streams events, or records approvals. Nothing here touches a real portal or calendar.
 *
 * Fidelity rules:
 *  - Interrupt transitions and error codes mirror services/gateway + services/orchestrator
 *    (PAUSE/RESUME/STOP/CORRECT/STATUS, 404/409/422) so UI behaviour carries over.
 *  - Approval checks mirror the gateway's order (stale plan version -> 409, unknown step -> 404),
 *    but unlike the gateway (which returns 501) the demo records a simulated approval.
 *  - Execution SUCCESS is never treated as completion: every step is "executed" first and only
 *    becomes VERIFIED after a separate simulated read-back. The task completes only when all
 *    steps are VERIFIED.
 *  - Timeout-after-save produces UNCERTAIN -> RECOVERING -> ESCALATED and is never retried.
 */
import {
  isTerminal,
  type ApprovalRequest,
  type InterruptRequest,
  type JournalEntry,
  type JsonObject,
  type TaskCreate,
  type TaskEvent,
  type TaskStatus,
  type TaskStep,
  type TaskView,
} from '../api/contracts';
import { ApiError } from '../api/errors';
import { buildDemoSteps } from '../fixtures/mockTasks';
import type { CreateTaskOptions, DemoScenario, EventStream, EventStreamHandlers, Transport } from './types';

export interface MockTransportOptions {
  /** Delay between simulated backend progress ticks. */
  stepDelayMs?: number;
  /** Simulated network latency per request (lets the UI show pending states). */
  latencyMs?: number;
}

export interface MockTransport extends Transport {
  readonly mode: 'mock';
  /** Drops and re-opens the simulated stream, replaying recent events (tests dedup). */
  simulateReconnect(): void;
  /** Injects a raw wire message, e.g. an unsupported schema version (testing only). */
  injectRawEvent(raw: unknown): void;
  /** Stops all timers (tests). */
  dispose(): void;
}

interface TaskRecord {
  view: TaskView;
  scenario: DemoScenario;
  approvals: Set<string>; // `${stepId}@v${version}`
  executed: Set<string>; // `${stepId}@v${version}`
  pendingApproval: { stepId: string; planVersion: number } | null;
  staleBumped: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
}

const BASE_TIME = Date.parse('2026-11-18T17:00:00Z');
const HALTED: readonly TaskStatus[] = ['PAUSED', 'AWAITING_APPROVAL', 'COMPLETED', 'CANCELLED', 'ESCALATED', 'FAILED'];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const key = (stepId: string, version: number) => `${stepId}@v${version}`;

export function createMockTransport(options: MockTransportOptions = {}): MockTransport {
  const stepDelayMs = options.stepDelayMs ?? 900;
  const latencyMs = options.latencyMs ?? 250;
  const records = new Map<string, TaskRecord>();
  const listeners = new Set<EventStreamHandlers>();
  const history: TaskEvent[] = [];
  let taskCounter = 0;
  let eventCounter = 0;
  let clockTicks = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
    return t;
  };
  const respond = <T>(fn: () => T): Promise<T> =>
    new Promise((resolve, reject) => {
      later(() => {
        try {
          resolve(fn());
        } catch (e) {
          reject(e);
        }
      }, latencyMs);
    });
  const now = () => new Date(BASE_TIME + (clockTicks += 1) * 1000).toISOString();

  const getRecord = (taskId: string): TaskRecord => {
    const rec = records.get(taskId);
    if (!rec) throw new ApiError('not_found', 'unknown task', 404);
    return rec;
  };

  const journal = (rec: TaskRecord, entry: JsonObject) => {
    const full: JournalEntry = { created_at: now(), plan_version: rec.view.plan.version, ...entry };
    rec.view.journal.push(full);
  };

  const emit = (rec: TaskRecord, kind: TaskEvent['kind'], payload: JsonObject) => {
    eventCounter += 1;
    const event: TaskEvent = {
      schema_version: '1.0.0',
      event_id: `demo-evt-${String(eventCounter).padStart(4, '0')}`,
      task_id: rec.view.task_id,
      plan_version: rec.view.plan.version,
      kind,
      created_at: now(),
      payload,
    };
    history.push(event);
    for (const l of listeners) l.onMessage(clone(event));
  };

  const setStatus = (rec: TaskRecord, status: TaskStatus, payload: JsonObject = {}) => {
    rec.view.status = status;
    emit(rec, status === 'COMPLETED' ? 'task.completed' : 'task.updated', { status, ...payload });
  };

  const stepById = (rec: TaskRecord, id: string) => rec.view.plan.steps.find((s) => s.id === id);
  const needsApproval = (step: TaskStep) =>
    step.action === 'create_calendar_event' || step.action === 'update_calendar_event' || step.risk_tier === 'T2';

  const schedule = (rec: TaskRecord) => {
    clearTimeout(rec.timer);
    rec.timer = later(() => advance(rec), stepDelayMs);
  };

  const requestApproval = (rec: TaskRecord, step: TaskStep) => {
    rec.pendingApproval = { stepId: step.id, planVersion: rec.view.plan.version };
    rec.view.status = 'AWAITING_APPROVAL';
    journal(rec, { kind: 'approval.requested', step_id: step.id, message: `Approval requested for ${step.action}` });
    emit(rec, 'approval.requested', { step_id: step.id, status: 'AWAITING_APPROVAL', risk_tier: step.risk_tier });
    if (rec.scenario === 'stale-approval' && !rec.staleBumped) {
      // Simulates a correction made elsewhere whose event never reached this client.
      later(() => {
        if (rec.view.status !== 'AWAITING_APPROVAL') return;
        rec.staleBumped = true;
        const v = rec.view.plan.version + 1;
        rec.view.plan = {
          ...rec.view.plan,
          version: v,
          steps: rec.view.plan.steps.map((s) => ({ ...s, plan_version: v, arguments: s.id === step.id ? { ...s.arguments, time: '18:00' } : s.arguments })),
        };
        rec.pendingApproval = { stepId: step.id, planVersion: v };
        journal(rec, {
          kind: 'task.updated',
          message: 'Simulated: plan changed in another session (reminder time 18:00); this update was not streamed to this page.',
        });
        journal(rec, { kind: 'approval.requested', step_id: step.id, message: `Approval requested again for plan version ${v}` });
      }, Math.max(1, stepDelayMs / 2));
    }
  };

  const advance = (rec: TaskRecord) => {
    const v = rec.view;
    if (HALTED.includes(v.status)) return;
    const version = v.plan.version;
    switch (v.status) {
      case 'CREATED':
        setStatus(rec, 'PLANNING');
        journal(rec, { kind: 'task.updated', message: 'Simulated planner is preparing the plan' });
        break;
      case 'PLANNING':
        setStatus(rec, 'READY');
        journal(rec, { kind: 'task.updated', message: `Plan version ${version} ready (simulated planner)` });
        break;
      case 'RECOVERING': {
        const step = v.plan.steps.find((s) => s.status === 'UNCERTAIN');
        journal(rec, {
          kind: 'task.updated',
          step_id: step?.id,
          message: 'Simulated read-back could not confirm whether the calendar event exists. Verification result: UNKNOWN. Stopped without retrying.',
          verification: 'UNKNOWN',
        });
        setStatus(rec, 'ESCALATED', { step_id: step?.id, verification: 'UNKNOWN' });
        return;
      }
      default: {
        const running = v.plan.steps.find((s) => s.status === 'RUNNING');
        if (running) {
          const k = key(running.id, version);
          if (!rec.executed.has(k)) {
            if (rec.scenario === 'timeout-after-save' && running.action === 'create_calendar_event') {
              rec.executed.add(k);
              running.status = 'UNCERTAIN';
              journal(rec, {
                kind: 'step.uncertain',
                step_id: running.id,
                route: 'API',
                message: 'Simulated timeout after save: the write may have happened. Not retried.',
              });
              emit(rec, 'step.uncertain', { step_id: running.id, route: 'API', reason: 'timeout_after_save' });
              setStatus(rec, 'RECOVERING', { step_id: running.id });
              break;
            }
            rec.executed.add(k);
            const route = running.application === 'student_portal' ? 'DOM' : 'API';
            journal(rec, {
              kind: 'step.executed',
              step_id: running.id,
              route,
              outcome: 'SUCCESS',
              message: `Simulated ${route} adapter reported SUCCESS for ${running.action} (not yet verified)`,
            });
            emit(rec, 'step.executed', { step_id: running.id, route, outcome: 'SUCCESS' });
            setStatus(rec, 'VERIFYING', { step_id: running.id });
          } else {
            running.status = 'VERIFIED';
            const evidence = evidenceFor(running);
            journal(rec, {
              kind: 'step.verified',
              step_id: running.id,
              message: `Independent simulated read-back confirmed ${running.action}`,
              evidence,
            });
            emit(rec, 'step.verified', { step_id: running.id, status: 'VERIFIED', evidence });
            v.status = 'EXECUTING';
          }
          break;
        }
        const next = v.plan.steps.find(
          (s) => s.status === 'PENDING' && s.depends_on.every((d) => stepById(rec, d)?.status === 'VERIFIED'),
        );
        if (next) {
          if (needsApproval(next) && !rec.approvals.has(key(next.id, version))) {
            requestApproval(rec, next);
            return;
          }
          next.status = 'RUNNING';
          v.status = 'EXECUTING';
          emit(rec, 'step.ready', { step_id: next.id });
          setStatus(rec, 'EXECUTING', { step_id: next.id });
          break;
        }
        if (v.plan.steps.every((s) => s.status === 'VERIFIED')) {
          journal(rec, { kind: 'task.completed', message: 'All steps independently verified (simulated)' });
          setStatus(rec, 'COMPLETED');
          return;
        }
        return; // blocked; waits for user correction or stop
      }
    }
    schedule(rec);
  };

  const transport: MockTransport = {
    mode: 'mock',
    streamLabel: 'Simulated event stream (demo mode)',

    createTask(request: TaskCreate, createOptions?: CreateTaskOptions) {
      const scenario = createOptions?.demoScenario ?? 'standard';
      return respond(() => {
        if (scenario === 'network-error') throw new ApiError('network', 'Simulated network failure');
        const instruction = request.instruction.trim();
        if (!instruction || instruction.length > 4000) {
          throw new ApiError('validation', 'instruction must be 1 to 4000 characters', 422);
        }
        taskCounter += 1;
        const taskId = `demo-task-${taskCounter}`;
        const rec: TaskRecord = {
          view: {
            task_id: taskId,
            instruction,
            status: 'CREATED',
            plan: { task_id: taskId, goal: instruction, version: 1, steps: buildDemoSteps(1, request.timezone) },
            journal: [],
          },
          scenario,
          approvals: new Set(),
          executed: new Set(),
          pendingApproval: null,
          staleBumped: false,
          timer: undefined,
        };
        records.set(taskId, rec);
        journal(rec, { kind: 'task.created', message: 'Simulated plan created; no external action executed' });
        emit(rec, 'task.created', { status: 'CREATED' });
        schedule(rec);
        return clone(rec.view);
      });
    },

    getTask(taskId) {
      return respond(() => clone(getRecord(taskId).view));
    },

    getJournal(taskId) {
      return respond(() => ({ task_id: taskId, journal: clone(getRecord(taskId).view.journal) }));
    },

    getSummary(taskId) {
      return respond(() => {
        const rec = getRecord(taskId);
        return {
          task_id: taskId,
          status: rec.view.status,
          plan_version: rec.view.plan.version,
          summary: summarize(rec.view),
        };
      });
    },

    interrupt(taskId, request: InterruptRequest) {
      return respond(() => {
        const rec = getRecord(taskId);
        const v = rec.view;
        const terminal = isTerminal(v.status);
        switch (request.kind) {
          case 'PAUSE':
            if (terminal) throw new ApiError('conflict', 'invalid transition', 409);
            clearTimeout(rec.timer);
            v.status = 'PAUSED';
            break;
          case 'RESUME':
            if (v.status !== 'PAUSED') throw new ApiError('conflict', 'invalid transition', 409);
            v.status = 'READY';
            rec.pendingApproval = null;
            schedule(rec);
            break;
          case 'STOP':
            if (terminal) throw new ApiError('conflict', 'invalid transition', 409);
            clearTimeout(rec.timer);
            v.status = 'CANCELLED';
            rec.pendingApproval = null;
            break;
          case 'CORRECT': {
            const instruction = request.instruction?.trim();
            if (!instruction) throw new ApiError('validation', 'Value error, CORRECT requires instruction', 422);
            if (terminal) throw new ApiError('conflict', 'cannot correct terminal task', 409);
            clearTimeout(rec.timer);
            const nextVersion = v.plan.version + 1;
            const changes = deriveCorrection(instruction);
            v.plan = {
              task_id: v.task_id,
              goal: instruction,
              version: nextVersion,
              steps: v.plan.steps.map((s) => ({
                ...s,
                plan_version: nextVersion,
                // Verified work is preserved. UNCERTAIN is kept (never silently reset to PENDING:
                // that could re-run a write that may already have happened).
                status: s.status === 'VERIFIED' || s.status === 'UNCERTAIN' ? s.status : 'PENDING',
                arguments: s.action === 'create_calendar_event' ? { ...s.arguments, ...changes } : s.arguments,
              })),
            };
            v.status = 'PAUSED';
            rec.pendingApproval = null; // old approvals are invalid for the new version
            break;
          }
          case 'STATUS':
            break;
        }
        journal(rec, { kind: 'task.interrupted', action: request.kind, message: `Control request ${request.kind} accepted` });
        emit(rec, 'task.interrupted', { action: request.kind, status: v.status });
        return clone(v);
      });
    },

    submitApproval(taskId, stepId, request: ApprovalRequest) {
      return respond(() => {
        const rec = getRecord(taskId);
        const v = rec.view;
        if (request.plan_version !== v.plan.version) throw new ApiError('conflict', 'stale plan version', 409);
        const step = stepById(rec, stepId);
        if (!step) throw new ApiError('not_found', 'unknown step', 404);
        if (v.status !== 'AWAITING_APPROVAL' || rec.pendingApproval?.stepId !== stepId) {
          throw new ApiError('conflict', 'no approval is pending for this step', 409);
        }
        rec.pendingApproval = null;
        if (request.approved) {
          rec.approvals.add(key(stepId, v.plan.version));
          journal(rec, { kind: 'task.updated', step_id: stepId, message: 'Simulated approval recorded for this step and plan version' });
          step.status = 'RUNNING';
          setStatus(rec, 'EXECUTING', { step_id: stepId });
          schedule(rec);
        } else {
          step.status = 'BLOCKED';
          journal(rec, { kind: 'task.updated', step_id: stepId, message: 'Approval rejected; step blocked. Change the instruction or stop the task.' });
          setStatus(rec, 'PAUSED', { step_id: stepId });
        }
        return {
          task_id: taskId,
          step_id: stepId,
          plan_version: v.plan.version,
          detail: 'Simulated decision recorded (demo mode). The next state comes from the task, not this response.',
        };
      });
    },

    getReadiness() {
      return respond(() => ({ status: 'ok', mode: 'demo', storage: 'browser memory', model: 'none' }));
    },

    openEventStream(handlers): EventStream {
      listeners.add(handlers);
      handlers.onStatus('connecting');
      later(() => listeners.has(handlers) && handlers.onStatus('connected'), 0);
      return {
        close() {
          listeners.delete(handlers);
          handlers.onStatus('disconnected');
        },
      };
    },

    simulateReconnect() {
      for (const l of listeners) {
        l.onStatus('reconnecting');
        later(() => {
          l.onStatus('connected');
          // Replay recent history as a real broker might after reconnect.
          for (const e of history.slice(-6)) l.onMessage(clone(e));
        }, Math.min(400, stepDelayMs));
      }
    },

    injectRawEvent(raw) {
      for (const l of listeners) l.onMessage(raw);
    },

    dispose() {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      listeners.clear();
    },
  };
  return transport;
}

function evidenceFor(step: TaskStep): JsonObject {
  switch (step.action) {
    case 'read_deadline':
      return { source: 'Controlled test student portal (simulated)', deadline: '2026-12-04 23:59', locator: 'table row "Assignment 3"' };
    case 'create_calendar_event':
      return {
        source: 'Simulated calendar read-back by external ID',
        external_id: 'demo-cal-evt-001',
        title: step.arguments.title,
        date: step.arguments.date,
        time: step.arguments.time,
      };
    default:
      return { source: 'Simulated calendar read-back', matches_expected: true };
  }
}

/** Tiny deterministic "replanner" for the demo correction (no model involved). */
function deriveCorrection(instruction: string): JsonObject {
  const changes: JsonObject = {};
  const days: Record<string, string> = { monday: '2026-11-30', tuesday: '2026-12-01', wednesday: '2026-12-02', thursday: '2026-12-03', friday: '2026-12-04' };
  for (const [day, date] of Object.entries(days)) if (instruction.toLowerCase().includes(day)) changes.date = date;
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(instruction);
  if (m) {
    let hour = Number(m[1]) % 12;
    if (m[3]?.toLowerCase() === 'pm') hour += 12;
    changes.time = `${String(hour).padStart(2, '0')}:${m[2] ?? '00'}`;
  }
  return changes;
}

function summarize(view: TaskView): string {
  const verified = view.plan.steps.filter((s) => s.status === 'VERIFIED').length;
  const uncertain = view.plan.steps.find((s) => s.status === 'UNCERTAIN');
  const base = `Simulated summary (demo mode): plan version ${view.plan.version}, ${verified} of ${view.plan.steps.length} steps verified.`;
  if (uncertain) {
    return `${base} Step "${uncertain.id}" timed out after saving, so the calendar event may or may not exist. A read-back could not confirm it, so the task stopped instead of retrying.`;
  }
  return `${base} Current status: ${view.status}.`;
}
