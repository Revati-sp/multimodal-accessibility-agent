# AccessPilot coding-agent rules (read first)

1. Read `README.md`, `docs/architecture.md`, `docs/api-contracts.md`, `docs/state-and-safety.md`, `shared/schemas.py` and your assigned `team/<name>/CLAUDE.md` **before coding**.
2. Stay within the assigned folders. `shared/schemas.py`, `docs/api-contracts.md`, and `docs/event-contracts.md` are frozen and require review by all four owners; raise a proposed change, do not silently edit.
3. Use mock adapters and contract tests to develop without waiting for another team. Never invent a working downstream dependency.
4. Preserve safe behavior: API/DOM writes must have a journaled idempotency key, confirmation must be tied to task/step/plan-version, and unknown external effects cannot be blindly retried.
5. Separate LLM suggestion from deterministic authorization, dispatch, verification and state transitions.
6. Unit tests must run without cloud credentials. Add reproducible integration tests separately, skipped only when the reason is recorded.
7. Do not commit credentials, real user data, recordings, screenshots, tokens or external-service cookies. Test with mock data and isolated test accounts.
8. Start every session with: (a) code inventory; (b) exact files you plan to modify; (c) interfaces consumed/provided; (d) tests. Finish with test output, known gaps, and handoff details.
9. No broad reformatting, moving files across owners, or edits to other teammates' modules.
10. Never label a mock demonstration as an end-to-end live agent.
