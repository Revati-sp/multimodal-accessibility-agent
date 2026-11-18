/**
 * Speech-input adapters. The UI depends only on `SpeechInputAdapter`, so the team's future ASR
 * service (speech_intent, owned by Ramya) can replace the browser adapter without UI changes.
 *
 * Neither adapter records or stores audio in AccessPilot. The browser adapter uses the browser's
 * own Web Speech API, which in some browsers sends audio to the browser vendor's cloud service.
 */

export type SpeechInputErrorCode = 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'aborted' | 'other';

export interface SpeechInputCallbacks {
  onStart(): void;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(code: SpeechInputErrorCode): void;
  onEnd(): void;
}

export interface SpeechSession {
  stop(): void;
  abort(): void;
}

export interface SpeechInputAdapter {
  readonly id: 'browser' | 'simulated';
  readonly label: string;
  readonly supported: boolean;
  start(callbacks: SpeechInputCallbacks): SpeechSession;
}

// Minimal structural typing for the (still non-standard) Web Speech recognition API.
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

function getRecognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function createBrowserSpeechAdapter(): SpeechInputAdapter {
  const Ctor = getRecognitionConstructor();
  return {
    id: 'browser',
    label: 'Browser speech recognition',
    supported: Boolean(Ctor),
    start(callbacks) {
      if (!Ctor) {
        callbacks.onError('other');
        callbacks.onEnd();
        return { stop() {}, abort() {} };
      }
      const recognition = new Ctor();
      recognition.lang = navigator.language || 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      let finalText = '';
      recognition.onstart = () => callbacks.onStart();
      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result?.[0]?.transcript ?? '';
          if (result?.isFinal) finalText += text;
          else interim += text;
        }
        if (interim) callbacks.onInterim(finalText + interim);
      };
      recognition.onerror = (event) => {
        const map: Record<string, SpeechInputErrorCode> = {
          'not-allowed': 'not-allowed',
          'service-not-allowed': 'not-allowed',
          'no-speech': 'no-speech',
          'audio-capture': 'audio-capture',
          network: 'network',
          aborted: 'aborted',
        };
        callbacks.onError(map[event.error] ?? 'other');
      };
      recognition.onend = () => {
        if (finalText.trim()) callbacks.onFinal(finalText.trim());
        callbacks.onEnd();
      };
      recognition.start();
      return { stop: () => recognition.stop(), abort: () => recognition.abort() };
    },
  };
}

/** Deliberately imperfect transcript so the review-and-correct step can be demonstrated. */
export const SIMULATED_TRANSCRIPT = 'Read my assignment dead line and create a reminder in my test calender.';

export function createSimulatedSpeechAdapter(delayMs = 400): SpeechInputAdapter {
  return {
    id: 'simulated',
    label: 'Simulated transcript (demo mode — no microphone used)',
    supported: true,
    start(callbacks) {
      let cancelled = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const finish = () => {
        if (cancelled) return;
        callbacks.onFinal(SIMULATED_TRANSCRIPT);
        callbacks.onEnd();
      };
      timers.push(setTimeout(() => !cancelled && callbacks.onStart(), 0));
      timers.push(setTimeout(() => !cancelled && callbacks.onInterim('Read my assignment dead line'), delayMs / 2));
      timers.push(setTimeout(finish, delayMs));
      return {
        stop() {
          timers.forEach(clearTimeout);
          finish();
          cancelled = true;
        },
        abort() {
          cancelled = true;
          timers.forEach(clearTimeout);
          callbacks.onError('aborted');
          callbacks.onEnd();
        },
      };
    },
  };
}
