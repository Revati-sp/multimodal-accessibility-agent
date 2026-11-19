/**
 * TypeScript mirror of the FROZEN AccessPilot v1 contracts, schema version 1.0.0.
 *
 * Sources of truth (do not edit from the frontend):
 *   - shared/schemas.py
 *   - docs/api-contracts.md
 *   - docs/event-contracts.md
 *
 * Every enum below is copied verbatim. If the backend changes a contract it must bump
 * SCHEMA_VERSION and this file must be updated in the same reviewed PR.
 *
 * Runtime parsers in this file are deliberately strict about enums and required fields so that
 * contract drift is shown to the user as a visible error instead of being silently misrendered.
 */
import { ContractError, SchemaVersionError } from './errors';

export const SCHEMA_VERSION = '1.0.0' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export const TASK_STATUSES = [
  'CREATED',
  'PLANNING',
  'READY',
  'EXECUTING',
  'VERIFYING',
  'AWAITING_APPROVAL',
  'PAUSED',
  'RECOVERING',
  'COMPLETED',
  'ESCALATED',
  'FAILED',
  'CANCELLED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STEP_STATUSES = [
  'PENDING',
  'RUNNING',
  'VERIFIED',
  'FAILED',
  'UNCERTAIN',
  'INVALIDATED',
  'BLOCKED',
] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const RISK_TIERS = ['T0', 'T1', 'T2', 'T3'] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const STEP_ACTIONS = [
  'read_deadline',
  'create_calendar_event',
  'update_calendar_event',
  'read_calendar_event',
  'verify_calendar_event',
] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

export const APPLICATIONS = ['student_portal', 'google_calendar', 'mock_calendar'] as const;
export type Application = (typeof APPLICATIONS)[number];

export const EXECUTION_ROUTES = ['API', 'DOM', 'GUI'] as const;
export type ExecutionRoute = (typeof EXECUTION_ROUTES)[number];

/** ExecutionResult.outcome. SUCCESS = adapter reported success, NOT verified completion. */
export const EXECUTION_OUTCOMES = ['SUCCESS', 'FAILED', 'UNCERTAIN'] as const;
export type ExecutionOutcome = (typeof EXECUTION_OUTCOMES)[number];

/** VerificationResult.status. UNKNOWN blocks blind retry. */
export const VERIFICATION_STATUSES = ['VERIFIED', 'ABSENT', 'UNKNOWN'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const EVENT_KINDS = [
  'task.created',
  'task.updated',
  'step.ready',
  'step.executed',
  'step.uncertain',
  'step.verified',
  'task.interrupted',
  'task.completed',
  'approval.requested',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const INTERRUPT_KINDS = ['PAUSE', 'RESUME', 'STOP', 'STATUS', 'CORRECT'] as const;
export type InterruptKind = (typeof INTERRUPT_KINDS)[number];

/** Terminal task statuses per docs/state-and-safety.md. */
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ['COMPLETED', 'CANCELLED'];

export type JsonObject = Record<string, unknown>;

// ---------- Request / response models (shared/schemas.py) ----------

export interface TaskCreate {
  instruction: string; // 1..4000 chars
  timezone: string; // default 'America/Los_Angeles' on the backend
  mode: 'mock' | 'live';
}

export interface TaskStep {
  id: string;
  plan_version: number;
  action: StepAction;
  application: Application;
  arguments: JsonObject;
  depends_on: string[];
  risk_tier: RiskTier;
  status: StepStatus;
}

export interface Plan {
  task_id: string;
  goal: string;
  version: number;
  steps: TaskStep[];
}

/** Journal entries are untyped dicts in the frozen contract (`list[dict[str, Any]]`). */
export type JournalEntry = JsonObject;

export interface TaskView {
  task_id: string;
  instruction: string;
  status: TaskStatus;
  plan: Plan;
  journal: JournalEntry[];
}

export interface TaskEvent {
  schema_version: SchemaVersion;
  event_id: string;
  task_id: string;
  plan_version: number;
  kind: EventKind;
  created_at: string; // ISO-8601 datetime
  payload: JsonObject;
}

export interface InterruptRequest {
  kind: InterruptKind;
  instruction?: string | null; // required when kind === 'CORRECT'
}

export interface ApprovalRequest {
  approved: boolean;
  plan_version: number;
  confirmation_text?: string | null;
}

/** GET /api/v1/tasks/{task_id}/journal */
export interface JournalResponse {
  task_id: string;
  journal: JournalEntry[];
}

/** GET /api/v1/tasks/{task_id}/summary */
export interface SummaryResponse {
  task_id: string;
  status: TaskStatus;
  plan_version: number;
  summary: string;
}

/** GET /health/ready */
export interface ReadinessResponse {
  status: string;
  mode: string;
  storage: string;
  model: string;
}

/**
 * Response of POST /confirmations/{step_id} is "reserved" in the frozen contract.
 * The frontend must not interpret any body as proof that the action happened; it only
 * waits for the backend's next TaskView/TaskEvent.
 */
export type ApprovalResponse = unknown;

// ---------- Runtime validation ----------

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new ContractError(`Unexpected value for ${field}: ${JSON.stringify(value)}`);
}

function str(value: unknown, field: string): string {
  if (typeof value === 'string') return value;
  throw new ContractError(`Expected text for ${field}`);
}

function positiveInt(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) return value;
  throw new ContractError(`Expected a positive whole number for ${field}`);
}

function obj(value: unknown, field: string): JsonObject {
  if (isObject(value)) return value;
  throw new ContractError(`Expected an object for ${field}`);
}

function arr(value: unknown, field: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new ContractError(`Expected a list for ${field}`);
}

export function parseTaskStep(raw: unknown): TaskStep {
  const o = obj(raw, 'step');
  return {
    id: str(o.id, 'step.id'),
    plan_version: positiveInt(o.plan_version, 'step.plan_version'),
    action: oneOf(o.action, STEP_ACTIONS, 'step.action'),
    application: oneOf(o.application, APPLICATIONS, 'step.application'),
    arguments: o.arguments === undefined ? {} : obj(o.arguments, 'step.arguments'),
    depends_on: (o.depends_on === undefined ? [] : arr(o.depends_on, 'step.depends_on')).map((d) =>
      str(d, 'step.depends_on[]'),
    ),
    risk_tier: o.risk_tier === undefined ? 'T0' : oneOf(o.risk_tier, RISK_TIERS, 'step.risk_tier'),
    status: o.status === undefined ? 'PENDING' : oneOf(o.status, STEP_STATUSES, 'step.status'),
  };
}

export function parsePlan(raw: unknown): Plan {
  const o = obj(raw, 'plan');
  const steps = arr(o.steps, 'plan.steps').map(parseTaskStep);
  const ids = new Set(steps.map((s) => s.id));
  if (ids.size !== steps.length) throw new ContractError('Plan has duplicate step ids');
  for (const s of steps) {
    for (const d of s.depends_on) {
      if (!ids.has(d) || d === s.id) throw new ContractError(`Step ${s.id} has an invalid dependency ${d}`);
    }
  }
  return {
    task_id: str(o.task_id, 'plan.task_id'),
    goal: str(o.goal, 'plan.goal'),
    version: positiveInt(o.version, 'plan.version'),
    steps,
  };
}

export function parseTaskView(raw: unknown): TaskView {
  const o = obj(raw, 'task');
  return {
    task_id: str(o.task_id, 'task_id'),
    instruction: str(o.instruction, 'instruction'),
    status: oneOf(o.status, TASK_STATUSES, 'status'),
    plan: parsePlan(o.plan),
    journal: (o.journal === undefined ? [] : arr(o.journal, 'journal')).map((j) => obj(j, 'journal[]')),
  };
}

export function parseJournalResponse(raw: unknown): JournalResponse {
  const o = obj(raw, 'journal response');
  return {
    task_id: str(o.task_id, 'task_id'),
    journal: arr(o.journal, 'journal').map((j) => obj(j, 'journal[]')),
  };
}

export function parseSummaryResponse(raw: unknown): SummaryResponse {
  const o = obj(raw, 'summary response');
  return {
    task_id: str(o.task_id, 'task_id'),
    status: oneOf(o.status, TASK_STATUSES, 'status'),
    plan_version: positiveInt(o.plan_version, 'plan_version'),
    summary: str(o.summary, 'summary'),
  };
}

export function parseReadiness(raw: unknown): ReadinessResponse {
  const o = obj(raw, 'readiness');
  return {
    status: str(o.status, 'status'),
    mode: str(o.mode, 'mode'),
    storage: str(o.storage, 'storage'),
    model: str(o.model, 'model'),
  };
}

/**
 * Validates a TaskEvent. An unsupported schema_version raises SchemaVersionError, which the UI
 * must surface visibly (docs/event-contracts.md: "reject unsupported schema versions").
 */
export function parseTaskEvent(raw: unknown): TaskEvent {
  const o = obj(raw, 'event');
  if (o.schema_version !== SCHEMA_VERSION) {
    throw new SchemaVersionError(typeof o.schema_version === 'string' ? o.schema_version : String(o.schema_version));
  }
  const createdAt = str(o.created_at, 'created_at');
  if (Number.isNaN(Date.parse(createdAt))) throw new ContractError('Event created_at is not a valid date');
  return {
    schema_version: SCHEMA_VERSION,
    event_id: str(o.event_id, 'event_id'),
    task_id: str(o.task_id, 'task_id'),
    plan_version: positiveInt(o.plan_version, 'plan_version'),
    kind: oneOf(o.kind, EVENT_KINDS, 'kind'),
    created_at: createdAt,
    payload: o.payload === undefined ? {} : obj(o.payload, 'payload'),
  };
}

/** Client-side mirror of TaskCreate validation (Field(min_length=1, max_length=4000)). */
export const INSTRUCTION_MAX_LENGTH = 4000;

export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(status);
}

// ---------- Payload readers (see frontend/docs/contract-amendment-proposal.md) ----------
// TaskEvent.payload is `dict[str, Any]` in the frozen contract. Only the `step.uncertain` example
// (step_id, route, reason) is documented. These readers accept the documented keys and the
// keys PROPOSED in the amendment; anything absent is shown as "not reported".

export function payloadString(payload: JsonObject, key: string): string | undefined {
  const v = payload[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function payloadRoute(payload: JsonObject): ExecutionRoute | undefined {
  const v = payload.route;
  return typeof v === 'string' && (EXECUTION_ROUTES as readonly string[]).includes(v) ? (v as ExecutionRoute) : undefined;
}

export function payloadEvidence(payload: JsonObject): JsonObject | undefined {
  const v = payload.evidence;
  return isObject(v) ? v : undefined;
}
