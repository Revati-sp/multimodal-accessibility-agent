/**
 * Gateway transport using only the documented endpoints in docs/api-contracts.md.
 * The gateway itself is a mock backend today; this transport never fabricates success.
 */
import { JsonClient } from '../api/client';
import {
  parseJournalResponse,
  parseReadiness,
  parseSummaryResponse,
  parseTaskView,
  type ApprovalRequest,
  type InterruptRequest,
  type TaskCreate,
} from '../api/contracts';
import type { EventStream, EventStreamHandlers, Transport } from './types';

export interface HttpTransportOptions {
  baseUrl: string;
  enableWebSocket: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  webSocketImpl?: typeof WebSocket;
}

const enc = encodeURIComponent;

export function createHttpTransport(options: HttpTransportOptions): Transport {
  const clientOptions: ConstructorParameters<typeof JsonClient>[0] = { baseUrl: options.baseUrl };
  if (options.timeoutMs !== undefined) clientOptions.timeoutMs = options.timeoutMs;
  if (options.fetchImpl !== undefined) clientOptions.fetchImpl = options.fetchImpl;
  const client = new JsonClient(clientOptions);

  return {
    mode: 'http',
    streamLabel: options.enableWebSocket
      ? 'Gateway WebSocket /ws/session (experimental — not yet verified against the gateway)'
      : 'Polling the gateway (the /ws/session event stream is not implemented yet)',
    async createTask(request: TaskCreate) {
      return parseTaskView(await client.post('/api/v1/tasks', request));
    },
    async getTask(taskId) {
      return parseTaskView(await client.get(`/api/v1/tasks/${enc(taskId)}`));
    },
    async getJournal(taskId) {
      return parseJournalResponse(await client.get(`/api/v1/tasks/${enc(taskId)}/journal`));
    },
    async getSummary(taskId) {
      return parseSummaryResponse(await client.get(`/api/v1/tasks/${enc(taskId)}/summary`));
    },
    async interrupt(taskId, request: InterruptRequest) {
      return parseTaskView(await client.post(`/api/v1/tasks/${enc(taskId)}/interrupt`, request));
    },
    async submitApproval(taskId, stepId, request: ApprovalRequest) {
      return client.post(`/api/v1/tasks/${enc(taskId)}/confirmations/${enc(stepId)}`, request);
    },
    async getReadiness() {
      return parseReadiness(await client.get('/health/ready'));
    },
    openEventStream(handlers) {
      if (!options.enableWebSocket) return null;
      return openReconnectingSocket(webSocketUrl(options.baseUrl), handlers, options.webSocketImpl ?? WebSocket);
    },
  };
}

export function webSocketUrl(baseUrl: string): string {
  const base = baseUrl || window.location.origin;
  return `${base.replace(/\/+$/, '').replace(/^http/, 'ws')}/ws/session`;
}

/**
 * Reconnecting WebSocket with capped exponential backoff. The subscription protocol for
 * /ws/session is not defined yet, so this only listens; consumers filter by task_id and
 * deduplicate by event_id, which makes server-side replay after reconnect safe.
 */
export function openReconnectingSocket(
  url: string,
  handlers: EventStreamHandlers,
  WebSocketImpl: typeof WebSocket,
): EventStream {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    handlers.onStatus(attempt === 0 ? 'connecting' : 'reconnecting');
    socket = new WebSocketImpl(url);
    socket.onopen = () => {
      attempt = 0;
      handlers.onStatus('connected');
    };
    socket.onmessage = (message: MessageEvent) => {
      try {
        handlers.onMessage(JSON.parse(String(message.data)));
      } catch {
        handlers.onMessage({ malformed: true });
      }
    };
    socket.onclose = () => {
      if (closed) return;
      attempt += 1;
      if (attempt > 6) {
        handlers.onStatus('disconnected');
        return;
      }
      handlers.onStatus('reconnecting');
      retryTimer = setTimeout(connect, Math.min(30_000, 500 * 2 ** attempt));
    };
  };
  connect();

  return {
    close() {
      closed = true;
      clearTimeout(retryTimer);
      socket?.close();
      handlers.onStatus('disconnected');
    },
  };
}
