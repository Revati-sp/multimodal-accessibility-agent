import { useCallback, useMemo, useRef, useState } from 'react';
import type { DetailLevel } from '../accessibility/announcements';
import { redactText } from '../accessibility/announcements';

export interface SpeechPrefs {
  enabled: boolean; // off by default: nothing is spoken on page load
  rate: number; // 0.5 .. 2
  detail: DetailLevel;
}

export const DEFAULT_SPEECH_PREFS: SpeechPrefs = { enabled: false, rate: 1, detail: 'concise' };
const STORAGE_KEY = 'accesspilot.speechPrefs';

function loadPrefs(): SpeechPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SPEECH_PREFS;
    const p = JSON.parse(raw) as Partial<SpeechPrefs>;
    return {
      // Speech never re-enables itself silently on a new visit: users opt in per session.
      enabled: false,
      rate: typeof p.rate === 'number' && p.rate >= 0.5 && p.rate <= 2 ? p.rate : 1,
      detail: p.detail === 'detailed' ? 'detailed' : 'concise',
    };
  } catch {
    return DEFAULT_SPEECH_PREFS;
  }
}

export interface SpeechOutput {
  supported: boolean;
  prefs: SpeechPrefs;
  updatePrefs(patch: Partial<SpeechPrefs>): void;
  /** Speaks text if enabled. `interrupt` cancels current speech first (urgent messages only). */
  speak(text: string, options?: { interrupt?: boolean }): void;
  stop(): void;
}

export function useSpeechOutput(synth: SpeechSynthesis | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined): SpeechOutput {
  const supported = Boolean(synth) && typeof SpeechSynthesisUtterance !== 'undefined';
  const [prefs, setPrefs] = useState<SpeechPrefs>(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const stop = useCallback(() => synth?.cancel(), [synth]);

  const updatePrefs = useCallback(
    (patch: Partial<SpeechPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rate: next.rate, detail: next.detail }));
        } catch {
          /* storage unavailable: preference lasts for this page only */
        }
        return next;
      });
      if (patch.enabled === false) synth?.cancel();
    },
    [synth],
  );

  const speak = useCallback(
    (text: string, options?: { interrupt?: boolean }) => {
      const current = prefsRef.current;
      if (!supported || !synth || !current.enabled || !text.trim()) return;
      if (options?.interrupt) synth.cancel();
      const utterance = new SpeechSynthesisUtterance(redactText(text));
      utterance.rate = current.rate;
      synth.speak(utterance);
    },
    [supported, synth],
  );

  return useMemo(() => ({ supported, prefs, updatePrefs, speak, stop }), [supported, prefs, updatePrefs, speak, stop]);
}
