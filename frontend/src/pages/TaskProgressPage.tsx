import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TaskView } from '../api/contracts';
import { explainError } from '../api/errors';
import {
  ACTION_LABELS,
  TASK_STATUS_TEXT,
  announcementForEvent,
  announcementForStatusChange,
} from '../accessibility/announcements';
import { focusById, rememberFocus, usePageFocus } from '../accessibility/focusManagement';
import { useAnnouncer } from '../components/AccessibleStatus';
import { ApprovalDialog, type ApprovalSnapshot } from '../components/ApprovalDialog';
import { CorrectionForm } from '../components/CorrectionForm';
import { ErrorNotice } from '../components/ErrorNotice';
import { JournalView } from '../components/JournalView';
import { PlanView } from '../components/PlanView';
import { StatusBadge } from '../components/StatusBadge';
import { TaskControls, useControlRequests } from '../components/TaskControls';
import { UncertainOutcomePanel } from '../components/UncertainOutcomePanel';
import { useTask } from '../hooks/useTask';
import { useTaskEvents } from '../hooks/useTaskEvents';
import {
  approvalExpiry,
  approvalStepId,
  controlAvailability,
  currentStep,
  deriveStepFacts,
  hasUncertainOutcome,
} from '../state/taskDerivations';
import type { MockTransport } from '../transport/mockTransport';
import type { StreamStatus, Transport } from '../transport/types';

function streamText(status: StreamStatus, pollIntervalMs: number): string {
  switch (status) {
    case 'connecting':
      return 'Connecting to task updates…';
    case 'connected':
      return 'Receiving task updates.';
    case 'reconnecting':
      return 'Reconnecting to task updates… Updates already shown will not be repeated.';
    case 'disconnected':
      return 'Disconnected from task updates. Use “Check status” to reload.';
    case 'schema-error':
      return 'An update was rejected because its format is not supported.';
    case 'polling':
      return `Checking the backend every ${Math.round(pollIntervalMs / 1000)} seconds (live updates are not available yet).`;
    case 'idle':
      return 'Not connected.';
  }
}

interface TaskProgressPageProps {
  transport: Transport;
  taskId: string;
  pollIntervalMs: number;
}

interface DecisionState {
  stepId: string;
  planVersion: number;
  approved: boolean;
  confirmedText?: string;
}

export function TaskProgressPage({ transport, taskId, pollIntervalMs }: TaskProgressPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  usePageFocus(headingRef, 'Task progress');
  const { announce } = useAnnouncer();
  const { task, loading, error, refresh, accept } = useTask(transport, taskId);
  const taskRef = useRef<TaskView | undefined>(task);
  taskRef.current = task;

  const { events, status: streamStatus, streamError, rejectedCount } = useTaskEvents(transport, taskId, {
    pollIntervalMs,
    onEvent: (event) => {
      void refresh();
      const a = announcementForEvent(event, taskRef.current);
      if (a) announce(a);
    },
    onPoll: () => void refresh(),
  });

  // Polling mode has no events, so announce authoritative status changes instead (never the initial load).
  const previous = useRef<TaskView | undefined>(undefined);
  useEffect(() => {
    if (!task) return;
    if (streamStatus === 'polling') {
      const a = announcementForStatusChange(previous.current, task);
      if (a) announce(a);
    }
    previous.current = task;
  }, [task, streamStatus, announce]);

  const controls = useControlRequests(transport, taskId, accept);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [summary, setSummary] = useState<string>();
  const summaryCount = useRef(0);
  const [snapshot, setSnapshot] = useState<ApprovalSnapshot | null>(null);
  const restoreFocus = useRef<(() => void) | null>(null);
  const [decision, setDecision] = useState<DecisionState | null>(null);

  const facts = useMemo(() => (task ? deriveStepFacts(task, events) : new Map()), [task, events]);
  const approvalId = task ? approvalStepId(task, events) : undefined;
  const current = task ? currentStep(task, approvalId) : undefined;

  // A sent decision stays "waiting" until the backend's task state moves on.
  useEffect(() => {
    if (!task || !decision || decision.confirmedText) return;
    const moved = task.status !== 'AWAITING_APPROVAL' || task.plan.version !== decision.planVersion || approvalId !== decision.stepId;
    if (moved) {
      setDecision({
        ...decision,
        confirmedText: `Backend confirmed the next state: ${TASK_STATUS_TEXT[task.status].label}.`,
      });
    }
  }, [task, decision, approvalId]);

  const whatHappened = useCallback(async () => {
    controls.setFeedback({ phase: 'pending', kind: 'SUMMARY', text: 'Asking the backend what happened…' });
    try {
      const result = await transport.getSummary(taskId);
      setSummary(result.summary);
      controls.setFeedback(null);
      summaryCount.current += 1;
      announce({ key: `summary:${taskId}:${summaryCount.current}`, concise: result.summary });
      focusById('summary-heading');
    } catch (e) {
      const { title, message } = explainError(e, 'load');
      controls.setFeedback({ phase: 'error', kind: 'SUMMARY', title, text: message });
    }
  }, [transport, taskId, controls, announce]);

  const checkStatus = useCallback(async () => {
    controls.setFeedback({ phase: 'pending', kind: 'REFRESH', text: 'Checking with the backend…' });
    await refresh();
    controls.setFeedback({ phase: 'done', kind: 'REFRESH', text: `Status reloaded from the backend at ${new Date().toLocaleTimeString()}.` });
  }, [controls, refresh]);

  const openApproval = useCallback(
    (latest: TaskView, stepId: string) => {
      const step = latest.plan.steps.find((s) => s.id === stepId);
      if (!step) return;
      if (!restoreFocus.current) restoreFocus.current = rememberFocus();
      setSnapshot({ taskId: latest.task_id, stepId, planVersion: latest.plan.version, step, expiresAt: approvalExpiry(events, stepId) });
    },
    [events],
  );

  const closeApproval = useCallback((restore: boolean) => {
    setSnapshot(null);
    const r = restoreFocus.current;
    restoreFocus.current = null;
    if (restore && r) r();
  }, []);

  if (!task) {
    return (
      <>
        <h1 ref={headingRef} tabIndex={-1}>
          Task progress
        </h1>
        {loading && <p role="status">Loading task from the backend…</p>}
        {!loading && error !== undefined && (
          <ErrorNotice {...explainError(error, 'load')} focusOnMount>
            <p>
              <a href="#/">Start a new task</a>
            </p>
          </ErrorNotice>
        )}
      </>
    );
  }

  const statusInfo = TASK_STATUS_TEXT[task.status];
  const can = controlAvailability(task);
  const uncertainStep = hasUncertainOutcome(task) ? task.plan.steps.find((s) => s.status === 'UNCERTAIN') : undefined;
  const pendingKind = controls.feedback?.phase === 'pending' ? controls.feedback.kind : null;

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        Task progress
      </h1>

      <section className="card" aria-labelledby="overview-heading">
        <h2 id="overview-heading">Overview</h2>
        <dl className="kv">
          <div className="kv-row">
            <dt>Status</dt>
            <dd>
              <StatusBadge tone={statusInfo.tone} label={statusInfo.label} /> {statusInfo.description}
            </dd>
          </div>
          <div className="kv-row">
            <dt>Original instruction</dt>
            <dd>{task.instruction}</dd>
          </div>
          <div className="kv-row">
            <dt>Current goal</dt>
            <dd>{task.plan.goal}</dd>
          </div>
          <div className="kv-row">
            <dt>Plan version</dt>
            <dd>{task.plan.version}</dd>
          </div>
          <div className="kv-row">
            <dt>Current step</dt>
            <dd>{current ? ACTION_LABELS[current.action] : task.status === 'COMPLETED' ? 'None. All steps verified.' : 'None'}</dd>
          </div>
          <div className="kv-row">
            <dt>Task ID</dt>
            <dd>
              <code>{task.task_id}</code>
            </dd>
          </div>
          <div className="kv-row">
            <dt>Updates</dt>
            <dd data-testid="stream-status">
              {streamText(streamStatus, pollIntervalMs)} <span className="muted">Source: {transport.streamLabel}.</span>
            </dd>
          </div>
        </dl>
        {transport.mode === 'mock' && (
          <button type="button" onClick={() => (transport as MockTransport).simulateReconnect()}>
            Simulate connection drop (demo)
          </button>
        )}
        {task.status === 'COMPLETED' && (
          <p className="notice notice-success">
            <span aria-hidden="true">✓ </span>Completed and verified: the backend confirmed every step with an independent check.
          </p>
        )}
        {error !== undefined && <ErrorNotice {...explainError(error, 'load')} />}
      </section>

      {streamError !== undefined && (
        <ErrorNotice {...explainError(streamError)}>
          <p>
            {rejectedCount} update{rejectedCount === 1 ? ' was' : 's were'} rejected and not shown. The task view below comes from the
            backend’s latest task data.
          </p>
        </ErrorNotice>
      )}

      {task.status === 'AWAITING_APPROVAL' && (
        <section className="card attention" aria-labelledby="approval-needed-heading">
          <h2 id="approval-needed-heading">
            <span aria-hidden="true">! </span>Approval needed
          </h2>
          {approvalId ? (
            <>
              <p>
                Before: <strong>{ACTION_LABELS[task.plan.steps.find((s) => s.id === approvalId)?.action ?? 'read_deadline']}</strong>. Review
                exactly what will happen, then approve or reject.
              </p>
              <button type="button" className="primary" onClick={() => openApproval(task, approvalId)}>
                Review action
              </button>
            </>
          ) : (
            <p>
              The backend reports that approval is needed but has not said which step. Approval cannot be given from here until it
              does. Use “What happened?” for details.
            </p>
          )}
        </section>
      )}

      {decision && (
        <p className="notice notice-info" id="approval-status" tabIndex={-1} data-testid="approval-status">
          {decision.confirmedText ??
            `${decision.approved ? 'Approval' : 'Rejection'} sent for step ${decision.stepId}, plan version ${decision.planVersion}. Waiting for the backend to confirm the next state…`}
        </p>
      )}

      {uncertainStep && (
        <UncertainOutcomePanel
          step={uncertainStep}
          facts={facts.get(uncertainStep.id)}
          canStop={can.stop}
          busy={pendingKind === 'REFRESH' ? 'check' : pendingKind === 'SUMMARY' ? 'explain' : pendingKind === 'STOP' ? 'stop' : null}
          onCheckAgain={() => void checkStatus()}
          onWhatHappened={() => void whatHappened()}
          onStop={() => void controls.send('STOP')}
        />
      )}

      <TaskControls
        task={task}
        feedback={controls.feedback}
        correctionOpen={correctionOpen}
        onControl={(kind) => void controls.send(kind)}
        onWhatHappened={() => void whatHappened()}
        onCheckStatus={() => void checkStatus()}
        onToggleCorrection={() => setCorrectionOpen((o) => !o)}
      />

      {correctionOpen && (
        <CorrectionForm
          planVersion={task.plan.version}
          pending={pendingKind === 'CORRECT'}
          onCancel={() => setCorrectionOpen(false)}
          onSubmit={async (instruction) => {
            const view = await controls.send('CORRECT', instruction);
            if (view) {
              setCorrectionOpen(false);
              focusById('plan-heading');
            }
          }}
        />
      )}

      {summary && (
        <section className="card" aria-labelledby="summary-heading">
          <h2 id="summary-heading" tabIndex={-1}>
            What happened
          </h2>
          <p>{summary}</p>
        </section>
      )}

      <PlanView task={task} facts={facts} currentStepId={current?.id} />
      <JournalView entries={task.journal} headingId="journal-heading" />

      {snapshot && (
        <ApprovalDialog
          key={`${snapshot.stepId}@${snapshot.planVersion}`}
          snapshot={snapshot}
          latestTask={task}
          transport={transport}
          onClose={() => closeApproval(true)}
          onSubmitted={(approved) => {
            setDecision({ stepId: snapshot.stepId, planVersion: snapshot.planVersion, approved });
            closeApproval(false);
            focusById('approval-status');
          }}
          onChangeInstruction={() => {
            closeApproval(false);
            setCorrectionOpen(true);
          }}
          onRefresh={refresh}
          onReviewLatest={() => {
            const latestId = approvalStepId(task, events) ?? snapshot.stepId;
            openApproval(task, latestId);
          }}
        />
      )}
    </>
  );
}
