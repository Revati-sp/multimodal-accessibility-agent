/**
 * Subscribes to task events for ONE task.
 *  - Validates every message against TaskEvent schema 1.0.0; unsupported versions are surfaced.
 *  - Ignores events for other tasks.
 *  - Deduplicates by event_id, so reconnect/replay never duplicates displayed events.
 *  - If the transport has no stream (gateway WebSocket not implemented), polls instead.
 */
import { useEffect, useRef, useState } from 'react';
import { parseTaskEvent, type TaskEvent } from '../api/contracts';
import { SchemaVersionError } from '../api/errors';
import type { StreamStatus, Transport } from '../transport/types';

export interface UseTaskEventsOptions {
  onEvent?(event: TaskEvent): void;
  onPoll?(): void;
  pollIntervalMs?: number;
}

export interface UseTaskEventsResult {
  events: TaskEvent[];
  status: StreamStatus;
  /** Last rejected message (schema version or contract error). */
  streamError: unknown;
  rejectedCount: number;
}

export function useTaskEvents(transport: Transport, taskId: string, options: UseTaskEventsOptions = {}): UseTaskEventsResult {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [streamError, setStreamError] = useState<unknown>();
  const [rejectedCount, setRejectedCount] = useState(0);
  const handlers = useRef(options);
  handlers.current = options;
  const pollIntervalMs = options.pollIntervalMs ?? 3000;

  useEffect(() => {
    const seen = new Set<string>();
    setEvents([]);
    setStreamError(undefined);
    setRejectedCount(0);

    const stream = transport.openEventStream({
      onMessage(raw) {
        // Ignore other tasks before validating (one session socket may carry many tasks).
        if (typeof raw === 'object' && raw !== null && 'task_id' in raw && (raw as { task_id: unknown }).task_id !== taskId) return;
        let event: TaskEvent;
        try {
          event = parseTaskEvent(raw);
        } catch (e) {
          setStreamError(e);
          setRejectedCount((n) => n + 1);
          if (e instanceof SchemaVersionError) setStatus('schema-error');
          return;
        }
        if (event.task_id !== taskId || seen.has(event.event_id)) return;
        seen.add(event.event_id);
        setStatus((s) => (s === 'schema-error' ? 'connected' : s));
        setEvents((prev) => [...prev, event]);
        handlers.current.onEvent?.(event);
      },
      onStatus(next) {
        setStatus(next);
      },
    });

    if (stream) return () => stream.close();

    setStatus('polling');
    const id = setInterval(() => handlers.current.onPoll?.(), pollIntervalMs);
    return () => clearInterval(id);
  }, [transport, taskId, pollIntervalMs]);

  return { events, status, streamError, rejectedCount };
}
