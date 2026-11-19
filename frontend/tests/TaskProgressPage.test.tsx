import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TaskView } from '../src/api/contracts';
import { ApiError } from '../src/api/errors';
import { eventFixtures } from '../src/fixtures/mockEvents';
import { buildTaskView, taskFixtures } from '../src/fixtures/mockTasks';
import { TaskProgressPage } from '../src/pages/TaskProgressPage';
import { fakeTransport, renderWithAnnouncer, type FakeTransport } from './helpers';

async function renderPage(transport: FakeTransport) {
  const user = userEvent.setup();
  const utils = renderWithAnnouncer(<TaskProgressPage transport={transport} taskId="demo-task-fixture" pollIntervalMs={60000} />);
  await screen.findByRole('heading', { level: 2, name: 'Overview' });
  return { user, ...utils };
}

/** Awaiting approval with the backend having identified the step via the journal. */
const awaiting: TaskView = {
  ...taskFixtures.awaitingApproval,
  journal: [{ kind: 'approval.requested', step_id: 'create-event', plan_version: 1, message: 'Approval requested' }],
};

describe('Task Progress screen', () => {
  it('shows a loading state, then the task', async () => {
    const transport = fakeTransport(taskFixtures.executing);
    renderWithAnnouncer(<TaskProgressPage transport={transport} taskId="demo-task-fixture" pollIntervalMs={60000} />);
    expect(screen.getByText(/Loading task/)).toBeInTheDocument();
    expect(await screen.findByText('Original instruction')).toBeInTheDocument();
  });

  it('shows a load error (e.g. 404) instead of a blank page', async () => {
    const transport = fakeTransport(taskFixtures.created, { getTask: vi.fn(async () => Promise.reject(new ApiError('not_found', 'unknown task', 404))) });
    renderWithAnnouncer(<TaskProgressPage transport={transport} taskId="missing" pollIntervalMs={60000} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });

  it('renders goal, status, plan version, steps and dependencies', async () => {
    await renderPage(fakeTransport(taskFixtures.verifiedStep));
    expect(screen.getByRole('heading', { level: 2, name: 'Plan, version 1' })).toBeInTheDocument();
    const steps = screen.getAllByRole('listitem').filter((li) => li.classList.contains('step'));
    expect(steps).toHaveLength(3);
    expect(within(steps[0] as HTMLElement).getByText('Nothing. This step can start first.')).toBeInTheDocument();
    expect(within(steps[1] as HTMLElement).getByText('Step 1, Read the assignment deadline (Verified)')).toBeInTheDocument();
    expect(within(steps[2] as HTMLElement).getByText('Step 2, Create a calendar reminder (Not started)')).toBeInTheDocument();
    expect(screen.getAllByText('Mock calendar (simulated, not Google Calendar)').length).toBeGreaterThan(0);
  });

  it('does not call an executed-but-unverified step done', async () => {
    const transport = fakeTransport(taskFixtures.verifying);
    await renderPage(transport);
    act(() => transport.emit(eventFixtures.readDeadlineExecuted));
    expect(await screen.findByText(/adapter reported SUCCESS\. Not done yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Completed and verified/)).not.toBeInTheDocument();
    expect(screen.getAllByText('DOM').length).toBeGreaterThan(0);
  });

  it('shows "Completed and verified" only when the backend reports COMPLETED', async () => {
    await renderPage(fakeTransport(taskFixtures.completed));
    expect(screen.getByText(/the backend confirmed every step with an independent check/)).toBeInTheDocument();
  });

  it('sends pause, resume and stop requests and waits for backend confirmation', async () => {
    let current: TaskView = taskFixtures.executing;
    const interrupt = vi.fn(async (_id: string, req: { kind: string }) => {
      current = req.kind === 'PAUSE' ? taskFixtures.paused : req.kind === 'RESUME' ? taskFixtures.ready : taskFixtures.cancelled;
      return current;
    });
    const transport = fakeTransport(taskFixtures.executing, { interrupt });
    const { user } = await renderPage(transport);
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(interrupt).toHaveBeenLastCalledWith('demo-task-fixture', { kind: 'PAUSE' });
    expect(await screen.findByText(/Backend confirmed pause request\. Task status: Paused/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(interrupt).toHaveBeenLastCalledWith('demo-task-fixture', { kind: 'RESUME' });
    await screen.findByText(/Task status: Ready/);
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(interrupt).toHaveBeenLastCalledWith('demo-task-fixture', { kind: 'STOP' });
    await screen.findByText(/Task status: Stopped/);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
  });

  it('shows a backend rejection (409) of a control without changing the task', async () => {
    const transport = fakeTransport(taskFixtures.executing, {
      interrupt: vi.fn(async () => Promise.reject(new ApiError('conflict', 'invalid transition', 409))),
    });
    const { user } = await renderPage(transport);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed right now');
    expect(screen.getByText('Working', { selector: '.badge' })).toBeInTheDocument();
  });

  it('sends a correction and shows the new plan version', async () => {
    const interrupt = vi.fn(async () => taskFixtures.correctedV2);
    const transport = fakeTransport(taskFixtures.paused, { interrupt });
    const { user } = await renderPage(transport);
    await user.click(screen.getByRole('button', { name: 'Change instruction' }));
    const input = screen.getByLabelText('New or corrected instruction');
    expect(input).toHaveFocus();
    await user.type(input, 'Actually change it to Thursday at 4 pm');
    await user.click(screen.getByRole('button', { name: 'Send change' }));
    expect(interrupt).toHaveBeenCalledWith('demo-task-fixture', { kind: 'CORRECT', instruction: 'Actually change it to Thursday at 4 pm' });
    expect(await screen.findByRole('heading', { name: 'Plan, version 2' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Plan, version 2' })).toHaveFocus());
  });

  it('shows exact approval details bound to task, step and plan version', async () => {
    const transport = fakeTransport(awaiting);
    const { user } = await renderPage(transport);
    await user.click(screen.getByRole('button', { name: 'Review action' }));
    const dialog = screen.getByRole('dialog', { name: 'Approve this action?' });
    expect(within(dialog).getByRole('heading', { name: 'Approve this action?' })).toHaveFocus();
    expect(within(dialog).getByText('create_calendar_event')).toBeInTheDocument();
    expect(within(dialog).getByText('CS 160 Assignment 3 due')).toBeInTheDocument();
    expect(within(dialog).getByText('T1 — reversible write')).toBeInTheDocument();
    expect(within(dialog).getByText('No expiration provided by the backend')).toBeInTheDocument();
    expect(within(dialog).getAllByText('create-event').length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(transport.submitApproval).toHaveBeenCalledWith('demo-task-fixture', 'create-event', {
      approved: true,
      plan_version: 1,
      confirmation_text: null,
    });
    // Approval is not treated as done: page waits for the backend's next state.
    expect(await screen.findByTestId('approval-status')).toHaveTextContent('Waiting for the backend to confirm');
  });

  it('sends a rejection bound to the same step and version', async () => {
    const transport = fakeTransport(awaiting);
    const { user } = await renderPage(transport);
    await user.click(screen.getByRole('button', { name: 'Review action' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject' }));
    expect(transport.submitApproval).toHaveBeenCalledWith('demo-task-fixture', 'create-event', { approved: false, plan_version: 1, confirmation_text: null });
  });

  it('blocks a stale approval (409) and explains the plan changed', async () => {
    let view: TaskView = awaiting;
    const transport = fakeTransport(awaiting, {
      getTask: vi.fn(async () => view),
      submitApproval: vi.fn(async () => {
        view = { ...buildTaskView('AWAITING_APPROVAL', { planVersion: 2, stepStatuses: ['VERIFIED', 'PENDING', 'PENDING'] }), journal: awaiting.journal };
        return Promise.reject(new ApiError('conflict', 'stale plan version', 409));
      }),
    });
    const { user } = await renderPage(transport);
    await user.click(screen.getByRole('button', { name: 'Review action' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await within(dialog).findByText('The plan changed')).toBeInTheDocument();
    expect(await within(dialog).findByText(/The plan is now version 2/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Approve' })).toBeDisabled();
  });

  it('shows a 501 from the approval endpoint honestly', async () => {
    const transport = fakeTransport(awaiting, {
      submitApproval: vi.fn(async () => Promise.reject(new ApiError('not_implemented', 'Approval ledger is not implemented: no action was taken', 501))),
    });
    const { user } = await renderPage(transport);
    await user.click(screen.getByRole('button', { name: 'Review action' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Not available yet');
    expect(alert).toHaveTextContent('no action was taken');
    expect(screen.queryByTestId('approval-status')).not.toBeInTheDocument();
  });

  it('restores focus to the opener when the approval dialog closes', async () => {
    const { user } = await renderPage(fakeTransport(awaiting));
    const opener = screen.getByRole('button', { name: 'Review action' });
    opener.focus();
    await user.click(opener);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close without deciding' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review action' })).toHaveFocus());
  });

  it('does not offer approval when the backend has not identified the step', async () => {
    await renderPage(fakeTransport(taskFixtures.awaitingApproval));
    expect(screen.getByText(/has not said which step/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review action' })).not.toBeInTheDocument();
  });

  it('explains an UNKNOWN outcome without Retry, success or failure wording', async () => {
    const task: TaskView = {
      ...taskFixtures.unknownOutcome,
      journal: [{ kind: 'step.uncertain', step_id: 'create-event', plan_version: 1, reason: 'timeout_after_save', route: 'API' }],
    };
    const transport = fakeTransport(task);
    const { user } = await renderPage(transport);
    const panel = screen.getByRole('region', { name: /Not confirmed/ });
    expect(within(panel).getByText('The action may have occurred, but it has not been confirmed.')).toBeInTheDocument();
    expect(within(panel).getByText(/timed out after the save was sent/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'What happened?' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Stop task' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry|try again/i })).not.toBeInTheDocument();
    expect(screen.getByText('Not confirmed', { selector: '.badge' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'What happened?' }));
    expect(await screen.findByRole('heading', { name: 'What happened' })).toBeInTheDocument();
    expect(transport.getSummary).toHaveBeenCalled();
  });

  it('renders the journal with explanations and missing times labelled', async () => {
    await renderPage(fakeTransport(taskFixtures.created));
    const journal = screen.getByRole('region', { name: 'Task journal' });
    expect(within(journal).getByText('Mock plan created; no external action executed')).toBeInTheDocument();
    expect(within(journal).getByText(/Time not recorded/)).toBeInTheDocument();
  });

  it('shows a visible error for an unsupported event schema', async () => {
    const transport = fakeTransport(taskFixtures.created);
    await renderPage(transport);
    act(() => transport.emit({ ...eventFixtures.planning, schema_version: '9.9.9', event_id: 'x' }));
    expect(await screen.findByText('Unsupported update format')).toBeInTheDocument();
    expect(screen.getByTestId('stream-status')).toHaveTextContent('format is not supported');
  });

  it('labels polling honestly when no stream exists', async () => {
    await renderPage(fakeTransport(taskFixtures.created, {}, false));
    expect(screen.getByTestId('stream-status')).toHaveTextContent('live updates are not available yet');
  });
});
