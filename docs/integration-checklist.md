# Parallel development + integration runbook

## Setup gate (one joint team meeting)

- [ ] Confirm this starter should be merged into the actual existing repository (its layout is unknown here).
- [ ] Freeze schema v1 and choose one contract-owner/reviewer; agree on the action allowlist and risk policy.
- [ ] Agree to use an isolated test Google account/calendar; no real user credentials in Git.
- [ ] Decide on integration branch and PR review policy.
- [ ] Confirm acceptance tests and the experimental task corpus.

## Team branches

- `feat/yukta-platform`: gateway, model router, `infra/` and database/Redis integration.
- `feat/ramya-orchestrator`: intent, plan, task lifecycle, durable state, corrections.
- `feat/disha-execution`: API/DOM adapters, verification, safety, recovery and testbed.
- `feat/revati-accessibility`: accessible client, microphone, speech output and controls.

Every person should implement against `shared/schemas.py` and mocked opposite-side components. No one independently designs new endpoint shapes or status names.

## Integration sequence

1. `POST /tasks` returns durable task and valid plan.
2. Execute a read-only mock portal step; journal transition to verified.
3. Execute mock Calendar write with stable idempotency and independent verification.
4. Add real Calendar **test account** adapter with read-back; use mocks in CI.
5. Wire `TaskEvent` streaming to the frontend and speak only truthful statuses.
6. Add pause, correction/plan versioning, authorization ledger and recovery.
7. Reproduce failure matrix and compare baselines on identical seeded task sets.

## Merge gates (must all be true)

- [ ] Own-directory tests pass and changed contract tests pass.
- [ ] No committed secrets; no external write in CI.
- [ ] Mock and live modes clearly labeled.
- [ ] Gateway, orchestrator and execution interfaces use version 1 contracts.
- [ ] Timeout-after-save creates at most one mock event.
- [ ] UNKNOWN never becomes `COMPLETED`; T2 approval cannot be replayed.
- [ ] README instructions updated with commands actually run.

## Demo acceptance targets (to measure, not previously achieved)

- Correct portal deadline + correct Calendar reminder + external readback.
- Correct user correction with plan v2 and no obsolete duplicate event.
- Recovery from timeout-after-save without duplicate actions.
- Spoken and keyboard control for critical states.
- Evaluate P50/P95 latency; targets from Workbook 2: acknowledge pause ≤1 second and first spoken response median ≤3 seconds. Do not claim achievement until measured.
