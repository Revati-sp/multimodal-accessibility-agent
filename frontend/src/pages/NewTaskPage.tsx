import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TaskView } from '../api/contracts';
import { INSTRUCTION_MAX_LENGTH } from '../api/contracts';
import { explainError } from '../api/errors';
import { usePageFocus } from '../accessibility/focusManagement';
import { ErrorNotice } from '../components/ErrorNotice';
import { MicrophoneControl } from '../components/MicrophoneControl';
import { TranscriptEditor, type InstructionSource } from '../components/TranscriptEditor';
import { useMicrophone } from '../hooks/useMicrophone';
import type { SpeechInputAdapter } from '../speech/speechInput';
import type { DemoScenario, Transport } from '../transport/types';

const SCENARIOS: { value: DemoScenario; label: string }[] = [
  { value: 'standard', label: 'Standard: read deadline, approve calendar reminder, verify' },
  { value: 'timeout-after-save', label: 'Timeout after save: calendar result cannot be confirmed' },
  { value: 'stale-approval', label: 'Stale approval: plan changes while approval is open' },
  { value: 'network-error', label: 'Network error when creating the task' },
];

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  } catch {
    return 'America/Los_Angeles';
  }
}

export function isValidTimezone(tz: string): boolean {
  if (!tz.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface NewTaskPageProps {
  transport: Transport;
  onCreated(task: TaskView): void;
  browserAdapter: SpeechInputAdapter;
  simulatedAdapter?: SpeechInputAdapter | undefined;
  /** Move focus to the heading on mount (after in-app navigation, not on first page load). */
  focusHeading?: boolean;
}

export function NewTaskPage({ transport, onCreated, browserAdapter, simulatedAdapter, focusHeading = true }: NewTaskPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageFocus(headingRef, 'New task', focusHeading);
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const timezoneRef = useRef<HTMLInputElement>(null);
  const mic = useMicrophone();

  const [instruction, setInstruction] = useState('');
  const [source, setSource] = useState<InstructionSource>('typed');
  const [timezone, setTimezone] = useState(detectTimezone);
  const [scenario, setScenario] = useState<DemoScenario>('standard');
  const [instructionError, setInstructionError] = useState<string>();
  const [timezoneError, setTimezoneError] = useState<string>();
  const [submitError, setSubmitError] = useState<{ title: string; message: string }>();
  const [submitting, setSubmitting] = useState(false);

  // A finished transcript goes into the editable field for review. It is never submitted automatically.
  useEffect(() => {
    if (mic.state === 'ready' && mic.transcript) {
      setInstruction(mic.transcript);
      setSource(mic.source === 'simulated' ? 'simulated' : 'browser');
      setInstructionError(undefined);
      instructionRef.current?.focus();
    }
  }, [mic.state, mic.transcript, mic.source]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(undefined);
    const text = instruction.trim();
    const tzOk = isValidTimezone(timezone);
    setTimezoneError(tzOk ? undefined : 'Enter a valid time zone name, for example America/Los_Angeles.');
    if (!text) {
      setInstructionError('Enter a task before starting. You can type it or use voice input.');
      instructionRef.current?.focus();
      return;
    }
    if (text.length > INSTRUCTION_MAX_LENGTH) {
      setInstructionError(`The task must be ${INSTRUCTION_MAX_LENGTH} characters or fewer.`);
      instructionRef.current?.focus();
      return;
    }
    setInstructionError(undefined);
    if (!tzOk) {
      timezoneRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const options = transport.mode === 'mock' ? { demoScenario: scenario } : {};
      // The gateway only accepts mode "mock" today ("live" returns 501), so the client always sends "mock".
      const task = await transport.createTask({ instruction: text, timezone: timezone.trim(), mode: 'mock' }, options);
      onCreated(task);
    } catch (err) {
      setSubmitError(explainError(err, 'create'));
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        Start a new task
      </h1>
      <p>
        Tell AccessPilot what you need. You can type or speak. You will see the plan and approve any calendar change before
        it happens.
      </p>

      <MicrophoneControl mic={mic} browserAdapter={browserAdapter} simulatedAdapter={simulatedAdapter} />

      <form className="card" onSubmit={(e) => void submit(e)} noValidate aria-labelledby="task-form-heading">
        <h2 id="task-form-heading">Describe your task</h2>
        <TranscriptEditor
          value={instruction}
          onChange={(v) => {
            setInstruction(v);
            if (instructionError) setInstructionError(undefined);
          }}
          source={source}
          error={instructionError}
          textareaRef={instructionRef}
        />
        <div className="field">
          <label htmlFor="timezone">Time zone</label>
          <p id="timezone-hint" className="hint">
            Detected from your device. Change it if the reminder should use a different time zone.
          </p>
          <input
            id="timezone"
            ref={timezoneRef}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            aria-invalid={timezoneError ? true : undefined}
            aria-describedby={timezoneError ? 'timezone-hint timezone-error' : 'timezone-hint'}
          />
          {timezoneError && (
            <p id="timezone-error" className="field-error">
              <span aria-hidden="true">✕ </span>
              {timezoneError}
            </p>
          )}
        </div>
        {transport.mode === 'mock' && (
          <div className="field">
            <label htmlFor="scenario">Demo scenario (simulated)</label>
            <p id="scenario-hint" className="hint">
              Chooses which simulated situation the demo backend plays out. Not sent to any real service.
            </p>
            <select id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value as DemoScenario)} aria-describedby="scenario-hint">
              {SCENARIOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {submitError && <ErrorNotice title={submitError.title} message={submitError.message} focusOnMount />}
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Starting task…' : 'Start task'}
        </button>
      </form>
    </>
  );
}
