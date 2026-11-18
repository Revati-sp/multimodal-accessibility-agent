import { renderHook, screen, act } from '@testing-library/react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App, parseHash } from '../src/App';
import { taskFixtures } from '../src/fixtures/mockTasks';
import { useSpeechOutput } from '../src/hooks/useSpeechOutput';
import { createHttpTransport } from '../src/transport/httpTransport';
import { createMockTransport } from '../src/transport/mockTransport';
import { fakeSpeech } from './helpers';

const noSpeech = { id: 'browser' as const, label: 'x', supported: false, start: () => ({ stop() {}, abort() {} }) };

describe('App shell', () => {
  it('labels demo mode visibly as simulated data', () => {
    const transport = createMockTransport({ stepDelayMs: 1, latencyMs: 0 });
    render(<App transport={transport} browserSpeechAdapter={noSpeech} speech={fakeSpeech()} />);
    expect(screen.getByTestId('mode-banner')).toHaveTextContent('Demo mode — simulated data');
    transport.dispose();
  });

  it('in gateway mode reports what the gateway says (mock backend), never "live"', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: 'ok', mode: 'mock', storage: 'in-memory', model: 'mock' })));
    const transport = createHttpTransport({ baseUrl: '', enableWebSocket: false, fetchImpl: fetchImpl as unknown as typeof fetch });
    render(<App transport={transport} browserSpeechAdapter={noSpeech} speech={fakeSpeech()} />);
    expect(await screen.findByText(/It is a mock backend: no real external actions run/)).toBeInTheDocument();
    expect(screen.queryByText(/Demo mode/)).not.toBeInTheDocument();
  });

  it('has a skip link, a main landmark and a labelled navigation', () => {
    const transport = createMockTransport({ stepDelayMs: 1, latencyMs: 0 });
    render(<App transport={transport} browserSpeechAdapter={noSpeech} speech={fakeSpeech()} />);
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    transport.dispose();
  });

  it('parses routes', () => {
    expect(parseHash('#/tasks/abc')).toEqual({ name: 'task', id: 'abc' });
    expect(parseHash('#/history/x%20y')).toEqual({ name: 'history', id: 'x y' });
    expect(parseHash('#/history')).toEqual({ name: 'history' });
    expect(parseHash('#main')).toEqual({ name: 'new' });
    expect(taskFixtures.created.task_id).toBeTruthy();
  });
});

describe('useSpeechOutput', () => {
  function synth() {
    return { speak: vi.fn(), cancel: vi.fn() } as unknown as SpeechSynthesis & { speak: ReturnType<typeof vi.fn> };
  }
  class Utterance {
    rate = 1;
    constructor(public text: string) {}
  }

  it('is off by default and never speaks on load', () => {
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    const s = synth();
    const { result } = renderHook(() => useSpeechOutput(s));
    expect(result.current.prefs.enabled).toBe(false);
    act(() => result.current.speak('Hello'));
    expect(s.speak).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('speaks at the chosen rate once enabled, redacting secrets, and can stop', () => {
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    const s = synth();
    const { result } = renderHook(() => useSpeechOutput(s));
    act(() => result.current.updatePrefs({ enabled: true, rate: 1.5 }));
    act(() => result.current.speak('Token Bearer abc.def'));
    const utterance = s.speak.mock.calls[0]?.[0] as Utterance;
    expect(utterance.rate).toBe(1.5);
    expect(utterance.text).not.toContain('abc.def');
    act(() => result.current.stop());
    expect(s.cancel).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
