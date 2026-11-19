import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TaskView } from '../src/api/contracts';
import { ApiError } from '../src/api/errors';
import { taskFixtures } from '../src/fixtures/mockTasks';
import { NewTaskPage } from '../src/pages/NewTaskPage';
import { SIMULATED_TRANSCRIPT, createSimulatedSpeechAdapter, type SpeechInputAdapter } from '../src/speech/speechInput';
import { fakeTransport, renderWithAnnouncer } from './helpers';

const unsupported: SpeechInputAdapter = {
  id: 'browser',
  label: 'Browser speech recognition',
  supported: false,
  start: vi.fn(() => ({ stop() {}, abort() {} })),
};

const denying: SpeechInputAdapter = {
  id: 'browser',
  label: 'Browser speech recognition',
  supported: true,
  start(cb) {
    setTimeout(() => {
      cb.onError('not-allowed');
      cb.onEnd();
    }, 0);
    return { stop() {}, abort() {} };
  },
};

function setup(adapter: SpeechInputAdapter = unsupported, transport = fakeTransport(taskFixtures.created), simulated?: SpeechInputAdapter) {
  const onCreated = vi.fn();
  const user = userEvent.setup();
  renderWithAnnouncer(<NewTaskPage transport={transport} onCreated={onCreated} browserAdapter={adapter} simulatedAdapter={simulated} />);
  return { user, onCreated, transport };
}

describe('New Task screen', () => {
  it('moves focus to the page heading on load', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Start a new task' })).toHaveFocus();
  });

  it('submits a typed task with timezone and mode "mock"', async () => {
    const { user, onCreated, transport } = setup();
    await user.type(screen.getByLabelText('Task instruction'), 'Read my assignment deadline');
    const tz = screen.getByLabelText('Time zone');
    await user.clear(tz);
    await user.type(tz, 'America/New_York');
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(taskFixtures.created));
    expect(transport.createTask).toHaveBeenCalledWith(
      { instruction: 'Read my assignment deadline', timezone: 'America/New_York', mode: 'mock' },
      { demoScenario: 'standard' },
    );
  });

  it('can be completed with the keyboard only', async () => {
    const { user, onCreated } = setup();
    // Heading has focus; tab to the instruction field (mic button is disabled when unsupported).
    await user.tab();
    expect(screen.getByLabelText('Task instruction')).toHaveFocus();
    await user.keyboard('Remind me of my deadline');
    await user.tab(); // time zone
    await user.tab(); // demo scenario
    await user.tab(); // submit
    expect(screen.getByRole('button', { name: 'Start task' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it('shows a validation error tied to the field and focuses it', async () => {
    const { user, transport } = setup();
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    const field = screen.getByLabelText('Task instruction');
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(expect.stringContaining('Enter a task before starting'));
    expect(transport.createTask).not.toHaveBeenCalled();
  });

  it('rejects an invalid time zone', async () => {
    const { user, transport } = setup();
    await user.type(screen.getByLabelText('Task instruction'), 'Task');
    const tz = screen.getByLabelText('Time zone');
    await user.clear(tz);
    await user.type(tz, 'Mars/Olympus');
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    expect(tz).toHaveFocus();
    expect(tz).toHaveAttribute('aria-invalid', 'true');
    expect(transport.createTask).not.toHaveBeenCalled();
  });

  it('shows a network error and does not navigate', async () => {
    const transport = fakeTransport(taskFixtures.created, {
      createTask: vi.fn(async () => Promise.reject(new ApiError('network', 'down'))),
    });
    const { user, onCreated } = setup(unsupported, transport);
    await user.type(screen.getByLabelText('Task instruction'), 'Task');
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cannot reach AccessPilot');
    expect(alert).toHaveFocus();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('shows a pending state while creating', async () => {
    let resolve: (v: typeof taskFixtures.created) => void = () => undefined;
    const transport = fakeTransport(taskFixtures.created, { createTask: vi.fn(() => new Promise<TaskView>((r) => (resolve = r))) });
    const { user } = setup(unsupported, transport);
    await user.type(screen.getByLabelText('Task instruction'), 'Task');
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    expect(screen.getByRole('button', { name: 'Starting task…' })).toBeDisabled();
    resolve(taskFixtures.created);
  });

  it('explains when voice input is unsupported and keeps typing available', () => {
    setup(unsupported);
    expect(screen.getAllByText(/Voice input is not supported in this browser/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Start voice input/ })).toBeDisabled();
    expect(screen.getByLabelText('Task instruction')).toBeEnabled();
  });

  it('shows the permission-denied state with a typing alternative', async () => {
    const { user } = setup(denying);
    expect(screen.getByText(/will ask for microphone permission/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Start voice input/ }));
    expect(await screen.findByText(/Microphone permission denied/)).toBeInTheDocument();
    expect(screen.getByText(/type your task instead/i)).toBeInTheDocument();
  });

  it('puts a voice transcript in the editor for correction and never auto-submits', async () => {
    const { user, onCreated, transport } = setup(unsupported, undefined, createSimulatedSpeechAdapter(10));
    await user.click(screen.getByRole('button', { name: /simulated voice transcript/ }));
    const field = screen.getByLabelText('Task instruction');
    await waitFor(() => expect(field).toHaveValue(SIMULATED_TRANSCRIPT));
    expect(field).toHaveFocus();
    expect(screen.getByText(/simulated transcript \(demo mode\)/)).toBeInTheDocument();
    expect(transport.createTask).not.toHaveBeenCalled();
    await user.clear(field);
    await user.type(field, 'Read my assignment deadline and create a reminder in my test calendar.');
    await user.click(screen.getByRole('button', { name: 'Start task' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(transport.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ instruction: 'Read my assignment deadline and create a reminder in my test calendar.' }),
      expect.anything(),
    );
  });
});
