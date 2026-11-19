import type { JournalEntry, JsonObject } from '../api/contracts';
import { redactText } from '../accessibility/announcements';
import { KeyValueList } from './KeyValueList';

const KIND_TEXT: Record<string, string> = {
  'task.created': 'Task created',
  'task.updated': 'Task updated',
  'step.ready': 'Step ready',
  'step.executed': 'Action sent (not yet verified)',
  'step.uncertain': 'Result not confirmed',
  'step.verified': 'Step verified',
  'task.interrupted': 'Control request',
  'task.completed': 'Task completed',
  'approval.requested': 'Approval requested',
};

function str(entry: JournalEntry, key: string): string | undefined {
  const v = entry[key];
  return typeof v === 'string' && v ? v : undefined;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Time not recorded' : d.toLocaleString();
}

export function describeEntry(entry: JournalEntry): string {
  const message = str(entry, 'message');
  if (message) return redactText(message);
  const action = str(entry, 'action');
  if (action) return `Control request: ${action}`;
  return 'No explanation recorded.';
}

interface JournalViewProps {
  entries: JournalEntry[];
  headingId: string;
  heading?: string;
  headingLevel?: 2 | 3;
}

/** Journal entries are untyped dicts in the frozen contract, so every field is optional here. Newest first. */
export function JournalView({ entries, headingId, heading = 'Task journal', headingLevel = 2 }: JournalViewProps) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section aria-labelledby={headingId} className="card">
      <H id={headingId}>{heading}</H>
      {entries.length === 0 ? (
        <p>No journal entries yet.</p>
      ) : (
        <>
          <p className="muted">{entries.length} entries, newest first.</p>
          <ol className="journal" reversed>
            {entries
              .map((entry, i) => ({ entry, n: i + 1 }))
              .reverse()
              .map(({ entry, n }) => {
                const kind = str(entry, 'kind');
                const time = str(entry, 'created_at');
                const evidence = entry.evidence;
                return (
                  <li key={n} className="journal-entry">
                    <p className="journal-head">
                      <strong>{kind ? (KIND_TEXT[kind] ?? kind) : 'Entry'}</strong>
                      <span className="muted">
                        {' · '}
                        {time ? <time dateTime={time}>{formatTime(time)}</time> : 'Time not recorded'}
                      </span>
                    </p>
                    <p>{describeEntry(entry)}</p>
                    <p className="muted">
                      Plan version {typeof entry.plan_version === 'number' ? entry.plan_version : 'not recorded'}
                      {str(entry, 'step_id') ? ` · Step ${str(entry, 'step_id')}` : ''}
                      {str(entry, 'route') ? ` · Route ${str(entry, 'route')}` : ''}
                    </p>
                    {evidence !== null && typeof evidence === 'object' && !Array.isArray(evidence) && (
                      <details>
                        <summary>Verification evidence</summary>
                        <KeyValueList data={evidence as JsonObject} />
                      </details>
                    )}
                  </li>
                );
              })}
          </ol>
        </>
      )}
    </section>
  );
}
