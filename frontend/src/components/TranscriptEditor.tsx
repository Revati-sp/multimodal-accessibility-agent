import type { Ref } from 'react';
import { INSTRUCTION_MAX_LENGTH } from '../api/contracts';

export type InstructionSource = 'typed' | 'browser' | 'simulated';

const SOURCE_TEXT: Record<Exclude<InstructionSource, 'typed'>, string> = {
  browser: 'This text came from browser speech recognition and may contain mistakes.',
  simulated: 'This text is a simulated transcript (demo mode) and contains deliberate mistakes.',
};

interface TranscriptEditorProps {
  value: string;
  onChange(value: string): void;
  source: InstructionSource;
  error: string | undefined;
  textareaRef?: Ref<HTMLTextAreaElement>;
}

/** The single editable instruction field. Voice transcripts land here for review; nothing is auto-submitted. */
export function TranscriptEditor({ value, onChange, source, error, textareaRef }: TranscriptEditorProps) {
  const describedBy = ['instruction-hint', source !== 'typed' ? 'instruction-source' : null, error ? 'instruction-error' : null, 'instruction-count']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="field">
      <label htmlFor="instruction">Task instruction</label>
      <p id="instruction-hint" className="hint">
        Describe what you want done. Example: “Read my assignment deadline and create a reminder in my test calendar.”
      </p>
      {source !== 'typed' && (
        <p id="instruction-source" className="notice notice-info">
          {SOURCE_TEXT[source]} Review and correct it before choosing “Start task”.
        </p>
      )}
      <textarea
        id="instruction"
        ref={textareaRef}
        rows={4}
        value={value}
        maxLength={INSTRUCTION_MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required
      />
      {error && (
        <p id="instruction-error" className="field-error">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
      <p id="instruction-count" className="hint">
        {value.length} of {INSTRUCTION_MAX_LENGTH} characters
      </p>
    </div>
  );
}
