# AccessPilot frontend (Revati)

Accessible React + TypeScript client for AccessPilot. It mirrors the **frozen v1 contracts, schema `1.0.0`** (`shared/schemas.py`, `docs/api-contracts.md`, `docs/event-contracts.md`). The backend is the authority for task state, approval, execution, verification and completion. The client never marks anything done by itself.

> **Status:** The frontend is implemented and tested against a deterministic in-browser **demo (mock) backend**, and smoke-tested against the current **mock gateway**. No real student portal, Google Calendar, ASR service, event stream or approval ledger is connected yet. See [Known limitations](#known-limitations).

## Requirements

- Node.js 20 or newer (developed with Node 24.11, npm 11.6)
- For gateway mode: the repository's Python gateway (Python 3.10+, see the root README)
- For browser tests: Playwright's Chromium (`npx playwright install chromium`)

## Commands

Run all commands from `frontend/`.

| Purpose | Command |
|---|---|
| Install | `npm install` |
| Dev server (demo mode) | `npm run dev` → http://127.0.0.1:5173 |
| Type check | `npm run typecheck` |
| Lint (ESLint + jsx-a11y strict) | `npm run lint` |
| Unit/component tests | `npm test -- --run` |
| Browser tests (Playwright + axe) | `npx playwright install chromium` once, then `npm run test:e2e` |
| Production build | `npm run build` (output in `dist/`) |
| Preview the build | `npm run preview` |

## Environment variables

Copy `.env.example` to `.env.local` (git-ignored). Every `VITE_*` value is compiled into public JavaScript, so **never put secrets here**.

| Variable | Default | Meaning |
|---|---|---|
| `VITE_TRANSPORT_MODE` | `mock` | `mock` = demo backend in the browser. `http` = call the gateway. |
| `VITE_API_BASE_URL` | empty | Empty = same-origin paths through the Vite dev proxy (recommended, because the gateway has no CORS yet). |
| `VITE_PROXY_TARGET` | `http://127.0.0.1:8000` | Where the dev proxy sends `/api`, `/health` and `/ws`. |
| `VITE_ENABLE_WEBSOCKET` | `false` | `/ws/session` is planned but not implemented. Keep this `false`; the client polls instead. |
| `VITE_POLL_INTERVAL_MS` | `3000` | Polling interval in gateway mode (minimum 1000). |
| `VITE_MOCK_STEP_DELAY_MS` | `900` | Speed of the demo backend (the browser tests use 150). |

## Mock versus gateway mode

**Demo mode** (`VITE_TRANSPORT_MODE=mock`) shows a permanent banner, **“Demo mode — simulated data”**. A deterministic simulated backend (`src/transport/mockTransport.ts`) plays out scenarios selected on the New Task screen:

- **Standard:** read deadline → approval → write → separate verification → completed.
- **Timeout after save:** the write's result is unknown, so the task ends ESCALATED with the step UNCERTAIN and nothing is retried.
- **Stale approval:** a simulated concurrent plan change makes the first decision fail with 409 `stale plan version`.
- **Network error:** task creation fails, so nothing is created.

The demo backend's interrupt rules and error codes mirror the gateway. Unlike the gateway, it records approvals so the full flow can be shown. The calendar is labelled “Mock calendar (simulated, not Google Calendar)”.

**Gateway mode** (`VITE_TRANSPORT_MODE=http`):

```bash
# terminal 1, repository root
source .venv/bin/activate && PYTHONPATH=. uvicorn services.gateway.main:app --port 8000
# terminal 2, frontend/
VITE_TRANSPORT_MODE=http npm run dev
```

The banner reports what `/health/ready` says. Today that is `mode "mock", storage "in-memory"`, shown as “It is a mock backend: no real external actions run.”

## Current backend limitations (as of schema 1.0.0)

| Capability | Gateway today | Frontend behaviour |
|---|---|---|
| Create / get / journal / summary | Implemented (mock planner, in memory) | Used directly |
| Pause / resume / stop / correct / status | Implemented (mock) | Used directly; shows backend confirmation or 409/422 |
| Step execution and verification | Not wired to the gateway (tasks stay `CREATED`) | Progress only moves in demo mode |
| Approval `POST /confirmations/{step_id}` | Always **501** (409 stale, 404 unknown step) | 501 shown as “Not available yet … no action was taken” |
| `WS /ws/session` | Not implemented | Polls `GET /api/v1/tasks/{id}`, labelled as polling |
| Task listing | No endpoint | History shows only tasks from this browser tab |
| CORS | None | Vite dev proxy; production must be served same-origin or CORS added |

## Accessibility features

- Semantic landmarks, one `h1` per page, logical `h2`/`h3` structure. A skip link is the first Tab stop.
- After in-app navigation, focus moves to the page heading. On first load it stays at the start so the skip link comes first.
- Native buttons, inputs and `<dialog>`. ARIA is used only for live regions, `aria-current`, `aria-invalid`, `aria-describedby` and `aria-expanded`.
- Every status is shown as text plus colour plus an icon. Execution (“adapter reported SUCCESS — not done yet”) is shown separately from verification.
- Two global live regions (polite and assertive). Each announcement has a stable key (`event:<event_id>`), so reconnects and re-renders never repeat it. The initial page load is never announced.
- Optional text-to-speech: off by default, with rate, concise/detailed detail level and “Stop speaking”. Spoken text is redacted.
- Validation errors are tied to their fields and focus moves to the first invalid field. Blocking errors use `role="alert"` and take focus.
- The approval dialog focuses its heading. Escape closes it, and focus returns to the opener.
- Visible 3px focus ring, 44px minimum targets, AA-contrast tokens, dark mode, `prefers-reduced-motion`, forced colours and a layout that works at phone width.
- Voice input is progressive. It explains the microphone permission before asking. The transcript always goes into an editable field and is never auto-submitted. Typing always works.

## Browser support

Current Chromium, Firefox and Safari (ES2022 and native `<dialog>`). Voice input needs the Web Speech recognition API (Chrome, Edge, Safari). Elsewhere the client says voice is unsupported, and typing works. Automated browser tests run in Chromium only (desktop and Pixel 7 viewport).

## Project structure

```text
src/api/            contracts.ts (schema 1.0.0 mirror + runtime validation), client.ts, errors.ts
src/transport/      types.ts, httpTransport.ts (gateway), mockTransport.ts (demo backend)
src/fixtures/       mockTasks.ts, mockEvents.ts (simulated data only)
src/hooks/          useTask, useTaskEvents (dedup / schema check / polling), useMicrophone, useSpeechOutput
src/speech/         speechInput.ts (browser and simulated adapters; ASR swap point)
src/state/          taskDerivations.ts (pure helpers: step facts, current step, approval step)
src/accessibility/  announcements.ts, focusManagement.ts
src/components/     AccessibleStatus, ApprovalDialog, PlanView, TaskStep, TaskControls, CorrectionForm,
                    UncertainOutcomePanel, JournalView, MicrophoneControl, TranscriptEditor, SpeechSettings, ...
src/pages/          NewTaskPage, TaskProgressPage, TaskHistoryPage
tests/              Vitest + Testing Library
e2e/                Playwright + @axe-core/playwright (demo mode only)
docs/               accessibility-test-report.md, integration-handoff.md, contract-amendment-proposal.md
```

## Known limitations

- Every step-progress, verification, approval-success and uncertainty experience is **simulated** until the backend implements it.
- Manual screen-reader testing has **not** been performed yet (see `docs/accessibility-test-report.md`).
- The WebSocket client (`openReconnectingSocket`) is written but has never run against a real `/ws/session`, and the subscription protocol is undefined.
- Route, evidence and approval step come from event or journal payload keys that are **proposed**, not frozen (see `docs/contract-amendment-proposal.md`).
- Approval expiry is shown only if a backend sends it; the frozen contract has no such field.
- Browser speech recognition may send audio to the browser vendor's service. AccessPilot never records or stores audio.

## Integration expectations

- **Yukta (gateway/platform):** CORS or same-origin serving, `/ws/session` with a defined subscription message, an approval ledger instead of 501, and optionally a task-listing endpoint.
- **Ramya (orchestrator/ASR):** emit the events in `docs/integration-handoff.md` with the proposed payload keys, and journal entries with `created_at`/`plan_version`/`step_id`. Replace `createBrowserSpeechAdapter` with an ASR adapter implementing `SpeechInputAdapter`. Do not reset `UNCERTAIN` steps to `PENDING` on correction.
- **Disha (execution/verification):** report `route`, `outcome`, `evidence` and `verification` per step, and `reason` for uncertain results.

Details: [`docs/integration-handoff.md`](docs/integration-handoff.md).
