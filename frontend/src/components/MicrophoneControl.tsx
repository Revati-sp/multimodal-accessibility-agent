import type { MicrophoneResult, MicrophoneState } from '../hooks/useMicrophone';
import type { SpeechInputAdapter } from '../speech/speechInput';

const STATE_TEXT: Record<MicrophoneState, string> = {
  idle: 'Not listening.',
  'requesting-permission': 'Waiting for microphone permission. Your browser may show a prompt.',
  recording: 'Listening. Speak your task, then choose “Stop and review”.',
  processing: 'Processing what you said…',
  ready: 'Transcript ready. Review and correct it in the instruction box before starting.',
  denied: 'Microphone permission denied.',
  unsupported: 'Voice input is not supported in this browser.',
  error: 'Voice input stopped.',
};

interface MicrophoneControlProps {
  mic: MicrophoneResult;
  browserAdapter: SpeechInputAdapter;
  /** Demo mode only: deterministic transcript, no microphone. */
  simulatedAdapter?: SpeechInputAdapter | undefined;
}

export function MicrophoneControl({ mic, browserAdapter, simulatedAdapter }: MicrophoneControlProps) {
  const active = mic.state === 'requesting-permission' || mic.state === 'recording' || mic.state === 'processing';
  return (
    <section className="card" aria-labelledby="voice-heading">
      <h2 id="voice-heading">Voice input (optional)</h2>
      <p id="mic-explain">
        {browserAdapter.supported ? (
          <>
            When you choose “Start voice input”, your browser will ask for microphone permission. Speech is converted to
            text by your browser’s built-in speech recognition, which in some browsers uses the browser maker’s online
            service. AccessPilot does not record or store audio. Nothing is sent to AccessPilot until you review the text
            and choose “Start task”.
          </>
        ) : (
          <>Voice input is not supported in this browser. You can type your task in the instruction box below.</>
        )}
      </p>
      <p className="mic-status" role="status">
        <strong>Voice status:</strong> {STATE_TEXT[mic.state]}
      </p>
      {mic.errorMessage && mic.state !== 'idle' && <p className="field-error">{mic.errorMessage}</p>}
      {mic.interim && (
        <p className="interim">
          <span className="muted">Hearing: </span>“{mic.interim}”
        </p>
      )}
      <div className="button-row">
        {!active && (
          <button type="button" onClick={() => mic.start(browserAdapter)} disabled={!browserAdapter.supported} aria-describedby="mic-explain">
            <span aria-hidden="true">🎙 </span>Start voice input
          </button>
        )}
        {mic.state === 'recording' && (
          <button type="button" className="primary" onClick={mic.stop}>
            Stop and review
          </button>
        )}
        {active && (
          <button type="button" onClick={mic.cancel}>
            Cancel voice input
          </button>
        )}
        {simulatedAdapter && !active && (
          <button type="button" onClick={() => mic.start(simulatedAdapter)}>
            Use simulated voice transcript (demo)
          </button>
        )}
      </div>
    </section>
  );
}
