import type { JsonObject } from '../api/contracts';
import { isSensitiveKey, redactText } from '../accessibility/announcements';

function humanKey(key: string): string {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not provided';
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return redactText(JSON.stringify(value));
}

/** Renders an object as a definition list, hiding keys that could hold secrets or private content. */
export function KeyValueList({ data, emptyText = 'None' }: { data: JsonObject | undefined; emptyText?: string }) {
  const entries = Object.entries(data ?? {});
  if (entries.length === 0) return <p className="muted">{emptyText}</p>;
  return (
    <dl className="kv">
      {entries.map(([k, v]) => (
        <div key={k} className="kv-row">
          <dt>{humanKey(k)}</dt>
          <dd>{isSensitiveKey(k) ? 'Hidden for privacy' : formatValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
