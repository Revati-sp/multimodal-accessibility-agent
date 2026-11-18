import { useEffect, useRef, useState, type FormEvent } from 'react';
import { INSTRUCTION_MAX_LENGTH } from '../api/contracts';

interface CorrectionFormProps {
  planVersion: number;
  pending: boolean;
  onSubmit(instruction: string): void;
  onCancel(): void;
}

/** Sends InterruptRequest {kind: "CORRECT", instruction}. The backend creates the next plan version. */
export function CorrectionForm({ planVersion, pending, onSubmit, onCancel }: CorrectionFormProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text) {
      setError('Enter the change you want, for example “Actually change it to Thursday at 4 pm”.');
      ref.current?.focus();
      return;
    }
    setError(undefined);
    onSubmit(text);
  };

  return (
    <form id="correction-form" className="card" onSubmit={submit} aria-labelledby="correction-heading" noValidate>
      <h2 id="correction-heading">Change instruction</h2>
      <p id="correction-help">
        Describe what should change. The backend will create plan version {planVersion + 1}, keep steps that are already
        verified, and pause the task so you can review it. Earlier approvals will no longer apply.
      </p>
      <label htmlFor="correction-input">New or corrected instruction</label>
      <textarea
        id="correction-input"
        ref={ref}
        rows={3}
        maxLength={INSTRUCTION_MAX_LENGTH}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'correction-help correction-error' : 'correction-help'}
      />
      {error && (
        <p id="correction-error" className="field-error">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Sending change…' : 'Send change'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
