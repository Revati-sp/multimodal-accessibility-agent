import type { Tone } from '../accessibility/announcements';

const ICONS: Record<Tone, string> = {
  neutral: '○',
  info: '●',
  success: '✓',
  attention: '!',
  danger: '✕',
  unknown: '?',
};

/** Status is always conveyed by text; colour and icon are supplementary. */
export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`badge tone-${tone}`}>
      <span className="badge-icon" aria-hidden="true">
        {ICONS[tone]}
      </span>
      {label}
    </span>
  );
}
