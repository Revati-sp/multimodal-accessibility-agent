/** Typed, user-explainable errors for every documented failure mode of the gateway. */

export type ApiErrorKind =
  | 'not_found' // 404 unknown task or step
  | 'conflict' // 409 stale plan or illegal transition
  | 'validation' // 422 invalid request
  | 'not_implemented' // 501 backend capability not implemented
  | 'server' // other 5xx / unexpected status
  | 'network' // request never reached the backend
  | 'timeout' // no response in time: the backend MAY have acted
  | 'contract'; // response did not match frozen contract

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly detail: string;

  constructor(kind: ApiErrorKind, detail: string, status?: number) {
    super(detail);
    this.name = 'ApiError';
    this.kind = kind;
    this.detail = detail;
    this.status = status;
  }
}

export class ContractError extends ApiError {
  constructor(detail: string) {
    super('contract', detail);
    this.name = 'ContractError';
  }
}

export class SchemaVersionError extends Error {
  readonly receivedVersion: string;
  constructor(receivedVersion: string) {
    super(`Unsupported event schema version "${receivedVersion}". This client supports 1.0.0 only.`);
    this.name = 'SchemaVersionError';
    this.receivedVersion = receivedVersion;
  }
}

/** FastAPI returns `{detail: string}` or, for 422, `{detail: [{msg, loc, ...}]}`. */
export function extractDetail(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (typeof d === 'object' && d !== null && typeof (d as { msg?: unknown }).msg === 'string' ? (d as { msg: string }).msg : undefined))
      .filter((m): m is string => Boolean(m));
    return msgs.length ? msgs.join('; ') : undefined;
  }
  return undefined;
}

export function errorFromStatus(status: number, body: unknown): ApiError {
  const detail = extractDetail(body) ?? `HTTP ${status}`;
  if (status === 404) return new ApiError('not_found', detail, status);
  if (status === 409) return new ApiError('conflict', detail, status);
  if (status === 422) return new ApiError('validation', detail, status);
  if (status === 501) return new ApiError('not_implemented', detail, status);
  return new ApiError('server', detail, status);
}

export interface ErrorExplanation {
  title: string;
  message: string;
}

/**
 * Plain-language explanation. `context` lets callers clarify what may or may not have happened,
 * e.g. a timeout on a create request means the task may exist.
 */
export function explainError(error: unknown, context?: 'create' | 'control' | 'approval' | 'load'): ErrorExplanation {
  if (error instanceof SchemaVersionError) {
    return { title: 'Unsupported update format', message: error.message };
  }
  if (!(error instanceof ApiError)) {
    return { title: 'Unexpected problem', message: 'Something went wrong in the page. Nothing was sent to the backend.' };
  }
  switch (error.kind) {
    case 'not_found':
      return { title: 'Not found', message: `The backend does not recognise this task or step (${error.detail}).` };
    case 'conflict':
      if (/stale/i.test(error.detail)) {
        return {
          title: 'The plan changed',
          message:
            'This request was for an older plan version, so the backend refused it. The latest plan has been loaded; review it before deciding again.',
        };
      }
      return {
        title: 'Not allowed right now',
        message: `The backend refused this request in the task's current state (${error.detail}).`,
      };
    case 'validation':
      return { title: 'Request was invalid', message: `The backend rejected the request: ${error.detail}` };
    case 'not_implemented':
      return {
        title: 'Not available yet',
        message: `The backend does not support this yet, so no action was taken. Backend said: "${error.detail}"`,
      };
    case 'timeout':
      return context === 'create'
        ? {
            title: 'No response in time',
            message:
              'The backend did not answer in time. The task may or may not have been created. Check task history before submitting again.',
          }
        : {
            title: 'No response in time',
            message: 'The backend did not answer in time. The request may or may not have taken effect. Use "Check status" before trying again.',
          };
    case 'network':
      return {
        title: 'Cannot reach AccessPilot',
        message: 'The request did not reach the backend. Check your connection; nothing new was confirmed.',
      };
    case 'contract':
      return {
        title: 'Unexpected response',
        message: `The backend replied in a format this client does not understand (${error.detail}). The display was not updated.`,
      };
    default:
      return { title: 'Backend error', message: `The backend reported an error (${error.detail}).` };
  }
}
