# State, safety and recovery rules

## State transitions (recommended implementation; starter only covers a subset)

`CREATED → PLANNING → READY → EXECUTING → VERIFYING → COMPLETED`. The executor may enter `AWAITING_APPROVAL`, `PAUSED`, `RECOVERING`, `ESCALATED` or `FAILED` as appropriate. `CANCELLED` and `COMPLETED` are terminal for the task. In-flight writes can finish after pause: record and reconcile them before resuming. Step states: `PENDING`, `RUNNING`, `VERIFIED`, `FAILED`, `UNCERTAIN`, `INVALIDATED`, `BLOCKED`.

## Risks and approvals

- **T0** read-only: proceed in authorized scope.
- **T1** reversible write (e.g. dedicated test-calendar event): may be allowed by explicit project policy; journal before execution.
- **T2** consequential actions such as sending a message or submitting a form: explicit scoped approval required.
- **T3** credentials, CAPTCHA, payment, high-impact actions: pause for direct human control; no automated bypass.

Approval must bind authenticated user, task ID, step ID, plan version, exact action arguments, and expiration. The frontend cannot authorize by merely supplying `approved:true`. The sample test mock is not a production approval service.

## Uncertain write protocol

1. Persist intent, stable idempotency key and expected outcome **before** external write.
2. Execute once. If timeout/error, classify external result `UNCERTAIN` rather than `FAILED`.
3. Independently read authoritative external state, using external ID or idempotency metadata if supported.
4. If found and matches: `VERIFIED`, proceed. If proven absent: safe retry/replan with same logical identity. If unknown: `ESCALATED`, stop and explain uncertainty.
5. Never switch API to DOM for a write while the original write may already have succeeded.
6. Compensation is domain-specific; an undo request must not be falsely reported as rollback guarantee.

## Corrections

Generate plan version n+1; compute changed constraints; preserve unaffected `VERIFIED` steps; invalidate affected downstream steps; reconcile existing side effects before re-execution. Do not run the old and new plan concurrently.
