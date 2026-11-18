import type {
  ApprovalRequest,
  ApprovalResponse,
  InterruptRequest,
  JournalResponse,
  ReadinessResponse,
  SummaryResponse,
  TaskCreate,
  TaskView,
} from '../api/contracts';

export type TransportMode = 'mock' | 'http';

/** Deterministic demo scenarios; only the mock transport understands them. Never sent to the backend. */
export type DemoScenario = 'standard' | 'timeout-after-save' | 'stale-approval' | 'network-error';

export interface CreateTaskOptions {
  demoScenario?: DemoScenario;
}

export type StreamStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'schema-error'
  | 'polling' // no stream available; client polls the documented GET endpoint
  | 'idle';

export interface EventStreamHandlers {
  /** Raw, unvalidated message. The consumer validates schema_version and task_id. */
  onMessage(raw: unknown): void;
  onStatus(status: Exclude<StreamStatus, 'schema-error' | 'polling' | 'idle'>): void;
}

export interface EventStream {
  close(): void;
}

export interface Transport {
  readonly mode: TransportMode;
  /** Human-readable label of what the stream really is (for honesty in the UI). */
  readonly streamLabel: string;
  createTask(request: TaskCreate, options?: CreateTaskOptions): Promise<TaskView>;
  getTask(taskId: string): Promise<TaskView>;
  getJournal(taskId: string): Promise<JournalResponse>;
  getSummary(taskId: string): Promise<SummaryResponse>;
  interrupt(taskId: string, request: InterruptRequest): Promise<TaskView>;
  submitApproval(taskId: string, stepId: string, request: ApprovalRequest): Promise<ApprovalResponse>;
  getReadiness(): Promise<ReadinessResponse>;
  /** Returns null when no event stream exists (then the client polls). */
  openEventStream(handlers: EventStreamHandlers): EventStream | null;
}
