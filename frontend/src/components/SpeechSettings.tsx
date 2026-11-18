import { useAnnouncer } from './AccessibleStatus';

/** Opt-in text-to-speech for status updates. Visual content is complete without it. */
export function SpeechSettings() {
  const { speech } = useAnnouncer();
  const { prefs, updatePrefs } = speech;
  return (
    <details className="speech-settings">
      <summary>Spoken status settings</summary>
      {!speech.supported ? (
        <p>Spoken status is not supported in this browser. All updates are still shown on screen and announced to screen readers.</p>
      ) : (
        <fieldset>
          <legend>Spoken status</legend>
          <div className="check">
            <input
              id="tts-enabled"
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => updatePrefs({ enabled: e.target.checked })}
            />
            <label htmlFor="tts-enabled">Speak important status updates aloud</label>
          </div>
          <p className="hint" id="tts-note">
            Off by default. Uses your browser’s voice. If you use a screen reader, you may prefer to leave this off.
          </p>
          <label htmlFor="tts-rate">Speech rate: {prefs.rate.toFixed(1)}×</label>
          <input
            id="tts-rate"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={prefs.rate}
            onChange={(e) => updatePrefs({ rate: Number(e.target.value) })}
            aria-valuetext={`${prefs.rate.toFixed(1)} times normal speed`}
          />
          <fieldset className="inline">
            <legend>Amount of detail</legend>
            <div className="check">
              <input id="tts-concise" type="radio" name="tts-detail" checked={prefs.detail === 'concise'} onChange={() => updatePrefs({ detail: 'concise' })} />
              <label htmlFor="tts-concise">Concise</label>
            </div>
            <div className="check">
              <input id="tts-detailed" type="radio" name="tts-detail" checked={prefs.detail === 'detailed'} onChange={() => updatePrefs({ detail: 'detailed' })} />
              <label htmlFor="tts-detailed">Detailed</label>
            </div>
          </fieldset>
          <button type="button" onClick={speech.stop}>
            Stop speaking
          </button>
        </fieldset>
      )}
    </details>
  );
}
