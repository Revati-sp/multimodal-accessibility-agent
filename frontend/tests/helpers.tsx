import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import type { TaskView } from '../src/api/contracts';
import { AnnouncerProvider } from '../src/components/AccessibleStatus';
import type { SpeechOutput } from '../src/hooks/useSpeechOutput';
import type { EventStreamHandlers, Transport } from '../src/transport/types';

export function fakeSpeech(overrides: Partial<SpeechOutput> = {}): SpeechOutput {
  return {
    supported: true,
    prefs: { enabled: true, rate: 1, detail: 'concise' },
    updatePrefs: vi.fn(),
    speak: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  };
}

export function renderWithAnnouncer(ui: ReactElement, speech: SpeechOutput = fakeSpeech()) {
  const wrapper = ({ children }: { children: ReactNode }) => <AnnouncerProvider speech={speech}>{children}</AnnouncerProvider>;
  return { speech, ...render(ui, { wrapper }) };
}

export interface FakeTransport extends Transport {
  handlers: EventStreamHandlers[];
  emit(raw: unknown): void;
}

/** Controllable transport for component tests. `withStream: false` simulates the polling-only gateway. */
export function fakeTransport(task: TaskView, overrides: Partial<Transport> = {}, withStream = true): FakeTransport {
  const handlers: EventStreamHandlers[] = [];
  const t: FakeTransport = {
    mode: 'mock',
    streamLabel: 'Test stream',
    handlers,
    emit(raw) {
      handlers.forEach((h) => h.onMessage(raw));
    },
    createTask: vi.fn(async () => task),
    getTask: vi.fn(async () => structuredClone(task)),
    getJournal: vi.fn(async () => ({ task_id: task.task_id, journal: task.journal })),
    getSummary: vi.fn(async () => ({ task_id: task.task_id, status: task.status, plan_version: task.plan.version, summary: 'Test summary' })),
    interrupt: vi.fn(async () => task),
    submitApproval: vi.fn(async () => ({})),
    getReadiness: vi.fn(async () => ({ status: 'ok', mode: 'mock', storage: 'in-memory', model: 'mock' })),
    openEventStream: vi.fn((h: EventStreamHandlers) => {
      if (!withStream) return null;
      handlers.push(h);
      h.onStatus('connected');
      return { close: () => undefined };
    }),
    ...overrides,
  };
  return t;
}
