# Test matrix, environment and research comparisons

**Unit:** invalid plan cycles, unknown tool names, state transitions, approval binding, timezone/date extraction, redaction, model routing policy, duplicate event delivery.

**Contract:** Pydantic payloads and OpenAPI routes, stale `plan_version` 409, `mode=live` refused until enabled, no changed enum names.

**Execution fault tests:** S1 normal; S2 API down; S3 UI renamed; S4 API down + renamed UI; S5 API down + popup overlay; S6 API down + silent save failure; S7 timeout-after-save; S8 browser crash after submit. Mock testbed must use deterministic seeds and authoritative external ground truth.

**Baselines:** B1 API only; B2 DOM only; B3 GUI only; B4 router no verifier; B5 router plus verifier. The same input tasks/faults are mandatory across each condition. Keep user-approval semantics consistent.

**Metrics:** true task success, false-done, duplicates, correction success, unnecessary repeated steps, recovery time, stop acknowledgement, first spoken response, hands-free completion, API calls and model cost. Report sample size and confidence intervals where justified. Do not compare incompatible vendor benchmark scores as though they use identical tasks.

**Live integration:** only isolated test Calendar; require external OAuth integration and optional credentials; integration tests skipped with explicit reason without credentials, never silently deemed passing. No real purchases or sensitive automation.

Current starter includes nine Python tests for contracts, gateway mock endpoints, idempotency, timeout recovery, and approval refusal. These do not replace the full fault matrix.
