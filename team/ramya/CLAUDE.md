# Ramya — Speech/Intent, Planning, Durable Task Orchestration

You own: `services/speech_intent/`, `services/orchestrator/` and their tests/docs. You may propose but must not modify frozen shared schemas, gateway routes, frontend, or Disha's execution modules.

## Goal
Build the dependable control layer: turn text or speech into an allowable dependency plan, save durable state, dispatch only safe eligible steps, and support pause/stop/resume and corrected instructions with selective replanning.

## Exact deliverables

1. Implement text intent classification for CREATE_TASK, PAUSE, RESUME, STOP, STATUS, CORRECT, APPROVE and REJECT. Distinguish an utterance for conversational speech from control of an existing task. ASR adapter: local faster-whisper or configurable backend, with mock transcript input for tests.
2. Extract and normalize dates/times/timezones, remind offsets, source application and ambiguity. Never assume relative dates without an explicit reference clock and timezone.
3. Implement a planner agent using Yukta's model-provider interface. Require `Plan` schema validation, restricted action names, argument validation, dependency cycle checks, sensible limits on step count and retry count. Mock planner must be deterministic.
4. Convert in-memory sample store to durable PostgreSQL-backed task, plan-version, step, step-dependency and journal storage, coordinating migration boundaries with Yukta. State changes and journal append must be atomic.
5. Implement dispatch scheduler that fires only when dependencies are VERIFIED, approvals are bound, user has not paused/cancelled, and no stale plan version can execute. Reconcile in-flight writes on pause/cancel.
6. Implement CORRECT flow: build plan version N+1; compute constraint delta; preserve unrelated verified steps; invalidate only affected descendants; delegate already-issued side effects to Disha's reconciliation/compensation interface before modifying.
7. Implement `STATUS` summary grounded in task state and evidence, never an LLM-generated claim of completion. Expose an accessible concise summary to gateway and frontend.
8. Provide exact state-transition chart and failure semantics in `docs/orchestrator-runbook.md`.

## Integration contracts

`POST /api/v1/tasks` and `/interrupt` are gateway-facing, but orchestration domain logic is yours. An execution request is `ExecutionRequest`; results are `ExecutionResult` plus `VerificationResult`. Model inference must go via Yukta's facade; do not hardwire a provider. Do not directly call a calendar or browser from the planner.

## Tests and acceptance

- Text input produces a valid Plan DAG with source-read -> calendar-write -> verification dependencies.
- Unknown action, graph cycle, malformed model JSON, impossible date and ambiguous recipient fail safely.
- Durable state/plan version survives process restart. Illegal status transitions fail.
- PAUSE stops new dispatch, not necessarily in-flight external writes; in-flight effects get reconciled.
- CORRECT edits only dependent steps; no stale plan or approval can trigger actions.
- The user can request what happened after a timeout and gets an accurate UNKNOWN rather than false DONE.
- Unit tests run without live ASR models or cloud credentials.

## Research evaluation

Compare naive restart-on-correction with dependency-aware selective replanning under the same simulated task traces; measure correct final state, extra repeated actions, time, and invalid external effects.

## Required workflow

1. Inspect existing repository; read root `CLAUDE.md`, `docs/architecture.md`, `docs/api-contracts.md`, `docs/event-contracts.md`, `docs/state-and-safety.md`, `shared/schemas.py`, and your team instructions.
2. Produce a concise inventory, a file-level implementation plan, API assumptions, and proposed tests BEFORE modifying files.
3. Never modify `shared/` contracts or another teammate's ownership folder directly. Make a change proposal if the frozen schema is insufficient.
4. Implement against mock other services first, then swap to the real service under the exact same contract.
5. Never report a mock output as a live integration result. Keep external credentials out of Git and CI.
6. Run `PYTHONPATH=. pytest -q` and any owner-specific tests, then report exact results, unimplemented items, files changed, and integration needs.
7. Commit incremental changes on your own branch, open a PR, and request the relevant cross-team reviewer.
