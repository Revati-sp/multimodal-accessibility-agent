import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpeechInputAdapter, SpeechInputErrorCode, SpeechSession } from '../speech/speechInput';

export type MicrophoneState =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'processing'
  | 'ready'
  | 'denied'
  | 'unsupported'
  | 'error';

export interface MicrophoneResult {
  state: MicrophoneState;
  interim: string;
  /** Final transcript waiting for the user to review. Never submitted automatically. */
  transcript: string;
  source: SpeechInputAdapter['id'] | undefined;
  errorMessage: string | undefined;
  start(adapter: SpeechInputAdapter): void;
  stop(): void;
  cancel(): void;
  clear(): void;
}

const ERROR_TEXT: Record<SpeechInputErrorCode, string> = {
  'not-allowed': 'Microphone permission was denied. You can type your task instead, or allow the microphone in your browser settings and try again.',
  'no-speech': 'No speech was heard. Try again, or type your task.',
  'audio-capture': 'No working microphone was found. Type your task instead.',
  network: 'The browser speech service could not be reached. Type your task instead.',
  aborted: 'Voice input was cancelled.',
  other: 'Voice input stopped because of an error. Type your task instead.',
};

export function useMicrophone(): MicrophoneResult {
  const [state, setState] = useState<MicrophoneState>('idle');
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [source, setSource] = useState<SpeechInputAdapter['id']>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const session = useRef<SpeechSession | null>(null);
  const gotFinal = useRef(false);
  const failed = useRef(false);

  useEffect(() => () => session.current?.abort(), []);

  const start = useCallback((adapter: SpeechInputAdapter) => {
    if (!adapter.supported) {
      setState('unsupported');
      setErrorMessage('Voice input is not supported in this browser. Type your task instead.');
      return;
    }
    session.current?.abort();
    gotFinal.current = false;
    failed.current = false;
    setInterim('');
    setTranscript('');
    setErrorMessage(undefined);
    setSource(adapter.id);
    setState('requesting-permission');
    session.current = adapter.start({
      onStart: () => setState('recording'),
      onInterim: (text) => setInterim(text),
      onFinal: (text) => {
        gotFinal.current = true;
        setTranscript(text);
        setInterim('');
        setState('ready');
      },
      onError: (code) => {
        failed.current = true;
        setErrorMessage(ERROR_TEXT[code]);
        setState(code === 'not-allowed' ? 'denied' : code === 'aborted' ? 'idle' : 'error');
      },
      onEnd: () => {
        session.current = null;
        if (!gotFinal.current && !failed.current) {
          setErrorMessage(ERROR_TEXT['no-speech']);
          setState('error');
        }
      },
    });
  }, []);

  const stop = useCallback(() => {
    if (!session.current) return;
    setState('processing');
    session.current.stop();
  }, []);

  const cancel = useCallback(() => {
    session.current?.abort();
    session.current = null;
  }, []);

  const clear = useCallback(() => {
    setTranscript('');
    setInterim('');
    setState('idle');
  }, []);

  return { state, interim, transcript, source, errorMessage, start, stop, cancel, clear };
}
