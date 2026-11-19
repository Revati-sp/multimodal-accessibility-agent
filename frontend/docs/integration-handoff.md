# Frontend integration handoff

For Yukta, Ramya and Disha. Contract version: **schema 1.0.0** (frozen). Branch: `feat/revati-accessibility`.

## Endpoints consumed

All are called through `src/transport/httpTransport.ts`. Responses are validated in `src/api/contracts.ts`; a response that breaks the contract is shown as “Unexpected response” and is not rendered.

| Method | Path | Body sent | Used for |
|---|---|---|---|
| GET | `/health/ready` | — | Mode banner (shows the `mode` and `storage` the backend reports) |
| POST | `/api/v1/tasks` | `{"instruction","timezone","mode":"mock"}` | New Task (always `mode:"mock"`, because `live` returns 501) |
| GET | `/api/v1/tasks/{id}` | — | Authoritative state; polled every 3 s while no stream exists |
| GET | `/api/v1/tasks/{id}/journal` | — | History page |
| GET | `/api/v1/tasks/{id}/summary` | — | “What happened?” |
| POST | `/api/v1/tasks/{id}/interrupt` | `{"kind":"PAUSE"\|"RESUME"\|"STOP"}` or `{"kind":"CORRECT","instruction":"…"}` | Controls |
| POST | `/api/v1/tasks/{id}/confirmations/{step_id}` | `{"approved":true\|false,"plan_version":N,"confirmation_text":null}` | Approval dialog |
| WS | `/ws/session` | none yet (protocol undefined) | Only when `VITE_ENABLE_WEBSOCKET=true`; never tested |

**Error handling:**

| Response | How the frontend shows it |
|---|---|
| 404 | “Not found” |
| 409 `stale plan version` | “The plan changed”; the task is reloaded and the old approval is disabled |
| Other 409 | “Not allowed right now” |
| 422 | The validation messages |
| 501 | “Not available yet … no action was taken” |
| Network failure | “Cannot reach AccessPilot” |
| Timeout | “May or may not have taken effect”; for create: “check history before submitting again” |

**Verified in this session against the real mock gateway**, through the Vite proxy:

- `curl`: create 201, pause 200, approval 501, stale approval 409, summary 200
- Headless browser: create, polling label, pause confirmed, correction to plan v2

## Events consumed

`useTaskEvents` validates each event and works as follows:

- An unsupported `schema_version` is shown as a visible error and counted as rejected.
- Events for another `task_id` are ignored.
- Events are deduplicated by `event_id`.
- Every accepted event triggers `GET /tasks/{id}`. The TaskView stays the source of truth, and events are notifications.

| kind | What the UI does |
|---|---|
| `task.created` | Announce “Task created.” |
| `task.updated` | Refresh. Announce only ESCALATED, FAILED or CANCELLED |
| `step.ready` | Announce “Starting: …” |
| `step.executed` | Show “Action sent: adapter reported SUCCESS. Not done yet” with the route. Never “done” |
| `step.verified` | Show “Verified” and the evidence |
| `step.uncertain` | Show the Unknown Outcome panel: “The action may have occurred, but it has not been confirmed.” Options are Check again, What happened? and Stop. No Retry |
| `approval.requested` | Show “Approval needed” and Review action, bound to `step_id` and the current `plan_version` |
| `task.interrupted` | Announce pause, resume, stop or correction |
| `task.completed` | “Completed and verified”, only because the backend says COMPLETED |

## Approval data required

The frontend needs:

- From the TaskView step: `task_id`, `step_id`, `plan_version`, `action`, `application`, `arguments` (exact values to display), `risk_tier`.
- From the `approval.requested` payload or a journal entry for the **current** plan version: `step_id`.
- Optionally `expires_at`.

If the backend reports `AWAITING_APPROVAL` without saying which step, the UI says so and offers no approval. It never guesses.

## Uncertainty data required

- Step `status: UNCERTAIN`, and the task status (RECOVERING or ESCALATED).
- `reason` (for example `timeout_after_save`), `route`, and `verification: UNKNOWN` when read-back cannot decide.
- `GET /summary` must explain in plain language what is and is not known.

## Current mock fixtures

- `src/fixtures/mockTasks.ts`: a TaskView for every status (created, planning, ready, executing, verifying, verified step, awaiting approval, paused, corrected v2, completed, failed, cancelled, unknown outcome, recovering). It also holds the exact gateway create response and the documented HTTP error bodies (404, 409 stale/illegal, 422, 501).
- `src/fixtures/mockEvents.ts`: the documented `step.uncertain` example, a duplicate event, an event for another task, an unsupported schema version, and an unknown kind.
- `src/transport/mockTransport.ts`: deterministic scenarios (standard, timeout-after-save, stale-approval, network-error).

## Backend capabilities still missing

| Missing | Owner | Frontend impact today |
|---|---|---|
| Step execution and verification behind the gateway | Ramya / Disha | Progress only advances in demo mode |
| Approval ledger (currently 501) | Yukta / Ramya | Gateway mode shows 501 honestly |
| `/ws/session` and its subscription protocol | Yukta | Polling fallback |
| Typed event payloads (A1) and journal timestamps (A3) | All | Route and evidence show as “Not reported yet”; times as “Time not recorded” |
| CORS or same-origin hosting | Yukta | Development only, via the Vite proxy |
| ASR service | Ramya | Browser Web Speech API or simulated transcript, behind `SpeechInputAdapter` |
| Keep UNCERTAIN on correction | Ramya | See the safety note in `contract-amendment-proposal.md` |

Proposed contract changes (not applied): [`contract-amendment-proposal.md`](contract-amendment-proposal.md).
