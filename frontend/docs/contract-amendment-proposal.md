# Proposed contract amendments (frontend) — NOT APPLIED

**Status:** proposal for team review by all four owners. `shared/schemas.py`, `docs/api-contracts.md` and `docs/event-contracts.md` were **not modified**. The frontend works with schema `1.0.0` as frozen. Each gap below currently falls back to “not reported”.

**Proposed by:** Revati (frontend) · **Affects:** Yukta (gateway), Ramya (orchestrator), Disha (execution/verification)

## A1. Typed `TaskEvent.payload` per kind (non-breaking, additive)

Today `payload` is `dict[str, Any]`, and only the `step.uncertain` example is documented. The frontend needs these keys to show the route, the difference between execution and verification, the evidence, and which step needs approval. It already reads them when present.

| kind | Proposed payload keys |
|---|---|
| `task.created`, `task.updated`, `task.completed` | `status: TaskStatus`; optional `step_id`, `verification: VerificationResult.status` |
| `step.ready` | `step_id` |
| `step.executed` | `step_id`, `route: API\|DOM\|GUI`, `outcome: SUCCESS\|FAILED\|UNCERTAIN` (no `external_id` or secrets) |
| `step.verified` | `step_id`, `status: VERIFIED`, `evidence: {…}` (redacted, human-readable) |
| `step.uncertain` | `step_id`, `route`, `reason` (as already documented) |
| `approval.requested` | `step_id`, `risk_tier`, optional `expires_at` (ISO-8601) |
| `task.interrupted` | `action: InterruptKind`, `status: TaskStatus` |

## A2. Approval expiry and response shape

- Add an optional `expires_at` to the approval request (event payload or a future `ApprovalPrompt` model). `docs/state-and-safety.md` already requires approvals to bind an expiration.
- Define the `POST /confirmations/{step_id}` success response, for example `202 {task_id, step_id, plan_version, accepted: true}`. It should explicitly not mean that the action executed. The frontend already treats any 2xx as “sent, waiting for the backend's next state”.

## A3. Journal entry minimum fields

`TaskView.journal` is `list[dict]`. The proposed minimum per entry is `created_at`, `kind`, `plan_version`, optional `step_id`, `message` (human-readable, no secrets), and optional `route`/`outcome`/`evidence`/`verification`/`reason`. Today the gateway's entries have no timestamp, and the UI shows “Time not recorded”.

## A4. `/ws/session` subscription protocol

Define the client → server message, for example `{"type":"subscribe","task_id":"…","after_event_id":"…"}`. Also define whether the server replays history after reconnect. The client already deduplicates by `event_id` and filters by `task_id`, so replay is safe.

## A5. Gateway CORS (platform)

Allow the frontend origin, or serve the built frontend from the gateway origin. Today development uses the Vite proxy.

## A6. Optional: list tasks

`GET /api/v1/tasks?limit=…` would let History show earlier sessions. Without it, History is limited to the current browser tab.

## Safety observation (no contract change; for Ramya)

`services/orchestrator/core.py` handles `CORRECT` by resetting every step that is not `VERIFIED` to `PENDING`, **including `UNCERTAIN` steps**. If a write is uncertain, a correction followed by resume could run it again. That conflicts with `docs/state-and-safety.md` (“reconcile existing side effects before re-execution”). The frontend demo backend keeps `UNCERTAIN` steps as they are. We suggest the orchestrator do the same, or refuse correction until reconciliation.
