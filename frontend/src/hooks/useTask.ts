import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskView } from '../api/contracts';
import type { Transport } from '../transport/types';

export interface UseTaskResult {
  task: TaskView | undefined;
  loading: boolean;
  /** Error from the most recent load; previous task data stays visible. */
  error: unknown;
  /** Fetches the authoritative TaskView. Concurrent calls are coalesced. */
  refresh(): Promise<void>;
  /** Accepts a TaskView returned by the backend (e.g. an interrupt response). */
  accept(view: TaskView): void;
}

export function useTask(transport: Transport, taskId: string): UseTaskResult {
  const [task, setTask] = useState<TaskView>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const inFlight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const currentId = useRef(taskId);
  currentId.current = taskId;

  const load = useCallback(async (): Promise<void> => {
    try {
      const view = await transport.getTask(taskId);
      if (currentId.current !== taskId || view.task_id !== taskId) return;
      setTask(view);
      setError(undefined);
    } catch (e) {
      if (currentId.current === taskId) setError(e);
    } finally {
      if (currentId.current === taskId) setLoading(false);
    }
  }, [transport, taskId]);

  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) {
      again.current = true;
      return inFlight.current;
    }
    const run = async () => {
      do {
        again.current = false;
        await load();
      } while (again.current);
      inFlight.current = null;
    };
    inFlight.current = run();
    return inFlight.current;
  }, [load]);

  useEffect(() => {
    setTask(undefined);
    setLoading(true);
    setError(undefined);
    void refresh();
  }, [refresh]);

  const accept = useCallback(
    (view: TaskView) => {
      if (view.task_id === currentId.current) setTask(view);
    },
    [],
  );

  return { task, loading, error, refresh, accept };
}
