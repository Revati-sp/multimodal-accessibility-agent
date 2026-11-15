# Disha — Execution Router, Verifier, Recovery, Fault Testbed

You own: `services/execution/`, `services/verifier/`, `services/recovery/`, `testbed/` and relevant tests/docs. You must not edit the orchestrator, frontend, gateway or frozen schemas.

## Goal
Implement bounded authorized API and browser actions, verify actual outcomes separately, and reconcile uncertain writes before any retry or fallback. Fix the partial-side-effect problem identified in the earlier S4 mock evaluation.

## Exact deliverables

1. Create typed action adapter abstraction: can_handle, execute(ExecutionRequest), read_back, verify, optional compensate. Keep API and DOM paths deterministic wherever possible; GUI screenshot model is a later isolated optional adapter.
2. Build a controllable mock student portal with visible assignment deadlines and mock Calendar REST/UI that share authoritative backend state. Implement deterministic test fixture reset and seeded error injection.
3. Implement Google Calendar test-account adapter through official API with create/read/update/delete; support OAuth credentials only through secure local configuration. Never run live changes in CI.
4. Implement Playwright browser adapter: use role/label/text selectors, bounded timeouts, screenshot/sanitized DOM evidence; handle renamed elements, overlays and missing locators with error categories.
5. Build API -> DOM -> GUI route policy, but reconcile uncertainty before route switching. The initial GUI adapter may be a mock; real vision execution is P2.
6. Before each write, journal intent with stable idempotency key and enforce task/step/plan-version-bound approvals. T0 reads, T1 reversible calendar test writes, T2 consequential send/submit/delete requires confirmed authorization, T3 credential/CAPTCHA/payment human-only.
7. Verification MUST inspect authoritative Calendar record after action and compare date, title, external ID and expected fields. Separate adapter SUCCESS from VERIFIED. Silent save failure must not pass.
8. For timeout-after-save: inspect actual state; if found continue, if definitively absent consider safe retry using the same identity, if unknown escalate and do not resend. No generic rollback promise. For known reversible Calendar changes, implement scoped compensation with before/after evidence.
9. Build seedable S1 normal, S2 API down, S3 renamed DOM, S4 both, S5 popup, S6 silent save failure, S7 timeout-after-save, S8 browser crash. Implement B1 API-only, B2 DOM-only, B3 mock GUI-only, B4 router without verification, B5 router plus verification using identical input trials.
10. Publish a machine-readable result CSV with exact denominators, true task success, false-done, duplicate actions, route fallback frequency and latency; include limitations and source code to reproduce.

## Integration contracts

Only accept `ExecutionRequest` validated against shared schemas and authenticated/authorized orchestration state. Return `ExecutionResult` and `VerificationResult`; mark UNVERIFIED external effects UNCERTAIN. Disha's service does not set the entire task COMPLETED; Ramya orchestrator owns that state.

## Tests and acceptance

- When API reports timeout after save, exactly one mock event exists; same idempotency key never duplicates.
- Without consent, T2 action is blocked; T3 never auto-executes.
- On `UNKNOWN`, no retry/fallback write occurs.
- S4 partial-effects issue is reproducible and addressed with state reconciliation.
- All seed/fault tests run offline; real Google tests require isolated credentials and explicit opt-in.
- No live financial, payment or CAPTCHA activity.

## Research evaluation

Assess whether the additional independent verifier reduces false success and duplicates at an acceptable time overhead. Do not compare unrelated benchmark figures as though they share tasks.

## Required workflow

1. Inspect existing repository; read root `CLAUDE.md`, `docs/architecture.md`, `docs/api-contracts.md`, `docs/event-contracts.md`, `docs/state-and-safety.md`, `shared/schemas.py`, and your team instructions.
2. Produce a concise inventory, a file-level implementation plan, API assumptions, and proposed tests BEFORE modifying files.
3. Never modify `shared/` contracts or another teammate's ownership folder directly. Make a change proposal if the frozen schema is insufficient.
4. Implement against mock other services first, then swap to the real service under the exact same contract.
5. Never report a mock output as a live integration result. Keep external credentials out of Git and CI.
6. Run `PYTHONPATH=. pytest -q` and any owner-specific tests, then report exact results, unimplemented items, files changed, and integration needs.
7. Commit incremental changes on your own branch, open a PR, and request the relevant cross-team reviewer.
