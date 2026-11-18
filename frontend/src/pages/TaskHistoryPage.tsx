import { useEffect, useRef, useState } from 'react';
import type { JournalResponse, SummaryResponse } from '../api/contracts';
import { explainError } from '../api/errors';
import { TASK_STATUS_TEXT } from '../accessibility/announcements';
import { usePageFocus } from '../accessibility/focusManagement';
import { ErrorNotice } from '../components/ErrorNotice';
import { JournalView } from '../components/JournalView';
import { StatusBadge } from '../components/StatusBadge';
import type { Transport } from '../transport/types';

export interface SessionTask {
  task_id: string;
  instruction: string;
}

interface TaskHistoryPageProps {
  transport: Transport;
  sessionTasks: SessionTask[];
  selectedId: string | undefined;
}

export function TaskHistoryPage({ transport, sessionTasks, selectedId }: TaskHistoryPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageFocus(headingRef, 'Task history');
  const [journal, setJournal] = useState<JournalResponse>();
  const [summary, setSummary] = useState<SummaryResponse>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    setJournal(undefined);
    setSummary(undefined);
    Promise.all([transport.getJournal(selectedId), transport.getSummary(selectedId)])
      .then(([j, s]) => {
        if (cancelled) return;
        setJournal(j);
        setSummary(s);
      })
      .catch((e: unknown) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [transport, selectedId]);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        Task history
      </h1>
      <p>
        Tasks started in this browser tab. The backend does not yet offer a way to list earlier tasks, so tasks from other
        sessions are not shown.
      </p>
      <section className="card" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading">Tasks this session</h2>
        {sessionTasks.length === 0 ? (
          <p>
            No tasks yet. <a href="#/">Start a new task</a>.
          </p>
        ) : (
          <ul className="task-list">
            {[...sessionTasks].reverse().map((t) => (
              <li key={t.task_id}>
                <p className="task-list-title">{t.instruction}</p>
                <p className="muted">
                  Task ID <code>{t.task_id}</code>
                </p>
                <p className="link-row">
                  <a href={`#/history/${encodeURIComponent(t.task_id)}`} aria-current={t.task_id === selectedId ? 'true' : undefined}>
                    View journal<span className="visually-hidden"> for: {t.instruction}</span>
                  </a>
                  <a href={`#/tasks/${encodeURIComponent(t.task_id)}`}>
                    Open progress<span className="visually-hidden"> for: {t.instruction}</span>
                  </a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedId && loading && <p role="status">Loading journal…</p>}
      {selectedId && error !== undefined && <ErrorNotice {...explainError(error, 'load')} />}
      {summary && (
        <section className="card" aria-labelledby="history-summary-heading">
          <h2 id="history-summary-heading">Summary</h2>
          <p>
            <StatusBadge tone={TASK_STATUS_TEXT[summary.status].tone} label={TASK_STATUS_TEXT[summary.status].label} /> Plan version{' '}
            {summary.plan_version}
          </p>
          <p>{summary.summary}</p>
        </section>
      )}
      {journal && <JournalView entries={journal.journal} headingId="history-journal-heading" heading="Journal" />}
    </>
  );
}
