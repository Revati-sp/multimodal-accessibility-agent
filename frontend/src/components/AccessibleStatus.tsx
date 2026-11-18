/**
 * Global announcer: two visually hidden live regions (polite + assertive) that exist from first
 * render, plus optional text-to-speech. Each announcement key is spoken/announced at most once.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnnouncementRegistry, chooseText, redactText, type Announcement } from '../accessibility/announcements';
import { useSpeechOutput, type SpeechOutput } from '../hooks/useSpeechOutput';

interface AnnouncerApi {
  /** Returns false if this key was already announced. */
  announce(announcement: Announcement): boolean;
  speech: SpeechOutput;
}

const AnnouncerContext = createContext<AnnouncerApi | null>(null);

export function AnnouncerProvider({ children, speech: injected }: { children: ReactNode; speech?: SpeechOutput }) {
  const own = useSpeechOutput();
  const speech = injected ?? own;
  const [registry] = useState(() => new AnnouncementRegistry());
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const speechRef = useRef(speech);
  speechRef.current = speech;

  const announce = useCallback(
    (a: Announcement) => {
      if (!registry.claim(a.key)) return false;
      const text = redactText(chooseText(a, speechRef.current.prefs.detail));
      // Identical consecutive text would not be re-read by some screen readers; vary it invisibly.
      const set = a.politeness === 'assertive' ? setAssertive : setPolite;
      set((prev) => (prev === text ? `${text} ` : text));
      speechRef.current.speak(text, { interrupt: a.politeness === 'assertive' });
      return true;
    },
    [registry],
  );

  const value = useMemo(() => ({ announce, speech }), [announce, speech]);
  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {polite}
      </div>
      <div className="visually-hidden" aria-live="assertive" aria-atomic="true" data-testid="live-assertive">
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): AnnouncerApi {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) throw new Error('useAnnouncer must be used inside AnnouncerProvider');
  return ctx;
}
