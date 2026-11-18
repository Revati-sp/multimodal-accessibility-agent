import { act, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import {
  AnnouncementRegistry,
  announcementForEvent,
  announcementForStatusChange,
  redactText,
} from '../src/accessibility/announcements';
import { useAnnouncer } from '../src/components/AccessibleStatus';
import { useTaskEvents } from '../src/hooks/useTaskEvents';
import { eventFixtures, invalidEventFixtures } from '../src/fixtures/mockEvents';
import { DEMO_TASK_ID, taskFixtures } from '../src/fixtures/mockTasks';
import { fakeSpeech, fakeTransport, renderWithAnnouncer } from './helpers';

describe('useTaskEvents', () => {
  it('suppresses duplicate events by event_id (e.g. replay after reconnect)', () => {
    const transport = fakeTransport(taskFixtures.created);
    const onEvent = vi.fn();
    const { result } = renderHook(() => useTaskEvents(transport, DEMO_TASK_ID, { onEvent }));
    act(() => {
      transport.emit(eventFixtures.created);
      transport.emit(eventFixtures.planning);
      transport.handlers[0]?.onStatus('reconnecting');
      transport.handlers[0]?.onStatus('connected');
      transport.emit(eventFixtures.duplicateOfCreated);
      transport.emit(eventFixtures.planning);
    });
    expect(result.current.events.map((e) => e.event_id)).toEqual([eventFixtures.created.event_id, eventFixtures.planning.event_id]);
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it('never applies an event for another task', () => {
    const transport = fakeTransport(taskFixtures.created);
    const onEvent = vi.fn();
    const { result } = renderHook(() => useTaskEvents(transport, DEMO_TASK_ID, { onEvent }));
    act(() => transport.emit(eventFixtures.otherTask));
    expect(result.current.events).toHaveLength(0);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('rejects an unsupported schema version visibly and keeps processing valid events', () => {
    const transport = fakeTransport(taskFixtures.created);
    const { result } = renderHook(() => useTaskEvents(transport, DEMO_TASK_ID));
    act(() => transport.emit(invalidEventFixtures.unsupportedSchema));
    expect(result.current.status).toBe('schema-error');
    expect(result.current.rejectedCount).toBe(1);
    expect(String(result.current.streamError)).toMatch(/2\.0\.0/);
    expect(result.current.events).toHaveLength(0);
    act(() => transport.emit(eventFixtures.planning));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.status).toBe('connected');
  });

  it('falls back to polling when no stream exists', () => {
    vi.useFakeTimers();
    const transport = fakeTransport(taskFixtures.created, {}, false);
    const onPoll = vi.fn();
    const { result } = renderHook(() => useTaskEvents(transport, DEMO_TASK_ID, { onPoll, pollIntervalMs: 1000 }));
    expect(result.current.status).toBe('polling');
    act(() => vi.advanceTimersByTime(3100));
    expect(onPoll).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe('announcements', () => {
  it('registry claims each key once', () => {
    const r = new AnnouncementRegistry();
    expect(r.claim('event:1')).toBe(true);
    expect(r.claim('event:1')).toBe(false);
  });

  it('does not announce the initial load, only changes', () => {
    expect(announcementForStatusChange(undefined, taskFixtures.paused)).toBeNull();
    expect(announcementForStatusChange(taskFixtures.executing, taskFixtures.paused)?.concise).toBe('Status: Paused.');
  });

  it('describes an uncertain step as not confirmed, never as failed or done', () => {
    const a = announcementForEvent(eventFixtures.createEventUncertain, taskFixtures.unknownOutcome);
    expect(a?.concise).toMatch(/not confirmed/i);
    expect(a?.concise).not.toMatch(/fail|done|success/i);
  });

  it('describes step.executed as sent-and-checking, not done', () => {
    const a = announcementForEvent(eventFixtures.readDeadlineExecuted, taskFixtures.executing);
    expect(a?.concise).toMatch(/checking/);
    expect(a?.concise).not.toMatch(/done|complete/i);
  });

  it('redacts token-like values', () => {
    expect(redactText('Authorization: Bearer abc.def.ghi')).not.toContain('abc.def.ghi');
    expect(redactText('key sk9aZ8bY7cX6dW5eV4fU3gT2hS1iR0jQ9kP8')).toContain('[hidden value]');
    expect(redactText('task 00000000-0000-4000-8000-000000000001')).toContain('00000000-0000-4000-8000-000000000001');
  });
});

function Announce({ keys }: { keys: string[] }) {
  const { announce } = useAnnouncer();
  useEffect(() => {
    keys.forEach((k) => announce({ key: k, concise: `Message ${k}` }));
  }, [keys, announce]);
  return null;
}

describe('AnnouncerProvider and TTS', () => {
  it('speaks and announces each key once, even across re-renders', () => {
    const speech = fakeSpeech();
    const { rerender } = renderWithAnnouncer(<Announce keys={['a', 'b', 'a']} />, speech);
    rerender(<Announce keys={['a', 'b']} />);
    expect(speech.speak).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('live-polite')).toHaveTextContent('Message b');
  });
});
