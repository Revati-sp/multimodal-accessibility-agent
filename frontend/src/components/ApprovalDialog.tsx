/**
 * Approval review in a native modal <dialog> (browser-provided focus containment and Escape).
 *
 * The decision is bound to the snapshot taken when the dialog opened: task ID, step ID and plan
 * version. If the backend's plan changes, the dialog says so and disables the decision. A local
 * "approved" value is never treated as authorization: after sending, the page waits for the
 * backend's next state.
 */
import { useEffect, useRef, useState } from 'react';
import type { TaskStep, TaskView } from '../api/contracts';
import { ApiError, explainError } from '../api/errors';
import { ACTION_LABELS } from '../accessibility/announcements';
import type { Transport } from '../transport/types';
import { ErrorNotice } from './ErrorNotice';
import { KeyValueList } from './KeyValueList';
import { APPLICATION_LABELS, RISK_LABELS } from './TaskStep';

export interface ApprovalSnapshot {
  taskId: string;
  stepId: string;
  planVersion: number;
  step: TaskStep;
  expiresAt: string | undefined;
}

interface ApprovalDialogProps {
  snapshot: ApprovalSnapshot;
  latestTask: TaskView;
  transport: Transport;
  /** Close without a decision; focus returns to the opener. */
  onClose(): void;
  /** Backend accepted the request (not proof the action ran). */
  onSubmitted(approved: boolean): void;
  onChangeInstruction(): void;
  /** Reload the task after a 409. */
  onRefresh(): Promise<void>;
  /** Re-open the review bound to the latest plan version. */
  onReviewLatest(): void;
}

export function ApprovalDialog({ snapshot, latestTask, transport, onClose, onSubmitted, onChangeInstruction, onRefresh, onReviewLatest }: ApprovalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<{ title: string; message: string }>();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    headingRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const versionChanged = latestTask.plan.version !== snapshot.planVersion;
  const noLongerPending = latestTask.status !== 'AWAITING_APPROVAL';
  const stale = versionChanged || noLongerPending;

  const decide = async (approved: boolean) => {
    setSubmitting(approved ? 'approve' : 'reject');
    setError(undefined);
    try {
      await transport.submitApproval(snapshot.taskId, snapshot.stepId, {
        approved,
        plan_version: snapshot.planVersion,
        confirmation_text: null,
      });
      onSubmitted(approved);
    } catch (e) {
      setError(explainError(e, 'approval'));
      if (e instanceof ApiError && e.kind === 'conflict') await onRefresh();
    } finally {
      setSubmitting(null);
    }
  };

  const { step } = snapshot;
  return (
    <dialog
      ref={dialogRef}
      className="approval-dialog"
      aria-labelledby="approval-heading"
      aria-describedby="approval-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!submitting) onClose();
      }}
    >
      <h2 id="approval-heading" ref={headingRef} tabIndex={-1}>
        Approve this action?
      </h2>
      <p id="approval-description">
        Nothing will be done unless you approve. Your decision applies only to step <code>{snapshot.stepId}</code> in plan
        version {snapshot.planVersion} of this task.
      </p>
      {transport.mode === 'mock' && (
        <p className="notice notice-demo">
          Demo mode: approving records a simulated decision. Nothing is written to a real calendar.
        </p>
      )}

      <h3>Proposed action</h3>
      <dl className="kv">
        <div className="kv-row">
          <dt>Action</dt>
          <dd>
            {ACTION_LABELS[step.action]} (<code>{step.action}</code>)
          </dd>
        </div>
        <div className="kv-row">
          <dt>Application</dt>
          <dd>{APPLICATION_LABELS[step.application]}</dd>
        </div>
        <div className="kv-row">
          <dt>Risk</dt>
          <dd>{RISK_LABELS[step.risk_tier]}</dd>
        </div>
        <div className="kv-row">
          <dt>Task ID</dt>
          <dd>
            <code>{snapshot.taskId}</code>
          </dd>
        </div>
        <div className="kv-row">
          <dt>Step ID</dt>
          <dd>
            <code>{snapshot.stepId}</code>
          </dd>
        </div>
        <div className="kv-row">
          <dt>Plan version</dt>
          <dd>{snapshot.planVersion}</dd>
        </div>
        <div className="kv-row">
          <dt>Expires</dt>
          <dd>{snapshot.expiresAt ? new Date(snapshot.expiresAt).toLocaleString() : 'No expiration provided by the backend'}</dd>
        </div>
      </dl>
      <h3>Exact arguments</h3>
      <KeyValueList data={step.arguments} emptyText="The backend did not provide arguments for this action." />

      {stale && (
        <div className="notice notice-warning" role="alert">
          <p className="notice-title">This request is out of date</p>
          <p>
            {versionChanged
              ? `The plan is now version ${latestTask.plan.version}. This approval was for version ${snapshot.planVersion} and can no longer be used.`
              : 'The task is no longer waiting for this approval.'}
          </p>
          {latestTask.status === 'AWAITING_APPROVAL' && versionChanged && (
            <button type="button" onClick={onReviewLatest}>
              Review the current request
            </button>
          )}
        </div>
      )}
      {error && <ErrorNotice title={error.title} message={error.message} />}

      <div className="button-row dialog-actions">
        <button type="button" className="primary" onClick={() => void decide(true)} disabled={stale || submitting !== null}>
          {submitting === 'approve' ? 'Sending approval…' : 'Approve'}
        </button>
        <button type="button" className="danger" onClick={() => void decide(false)} disabled={stale || submitting !== null}>
          {submitting === 'reject' ? 'Sending rejection…' : 'Reject'}
        </button>
        <button type="button" onClick={onChangeInstruction} disabled={submitting !== null}>
          Change instruction
        </button>
        <button type="button" onClick={onClose} disabled={submitting !== null}>
          Close without deciding
        </button>
      </div>
    </dialog>
  );
}
