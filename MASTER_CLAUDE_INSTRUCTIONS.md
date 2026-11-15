# AccessPilot AI — MASTER Instructions for Claude Code

**Version:** 1.0 | **Date:** 15 November 2026 | **Repository:** Existing GitHub repository (structure unknown)

**Purpose:** One self-contained instruction file for Claude Code. It consolidates the exact instructions, architecture, shared API/event rules, and four team-specific briefs from the provided AccessPilot Claude Code Starter Pack. It is a *development directive*, not evidence of completed integrations.

## How to use this file

1. Download `AccessPilot_Claude_Code_Starter_Pack.zip` and extract it. Do not give Claude only this file without the repository: the starter's executable code and `shared/schemas.py` are needed.
2. In the existing GitHub repository, first inspect current files and create an isolated `accesspilot/` folder or plan a reviewed non-destructive merge. **Never overwrite existing work without a diff and approval.**
3. Place this file at the starter root as `MASTER_CLAUDE_INSTRUCTIONS.md`. Keep the original `CLAUDE.md` and the individual `team/<member>/CLAUDE.md` files.
4. Give the **Coordinator Setup Prompt** below to Claude Code once, to audit/freeze contracts; then create four separate branches from the common contract commit. Each teammate gives their **Individual Launch Prompt** to their own Claude Code session.
5. The sections copied below are the authoritative starting guidance **as packaged**, but if repo files have been intentionally revised by the team, stop and flag conflicts rather than silently overriding the current code.

## Coordinator Setup Prompt (run once, before parallel work)

> You are the integration coordinator for AccessPilot AI. Inspect the entire repository and the existing AccessPilot starter. Read MASTER_CLAUDE_INSTRUCTIONS.md, CLAUDE.md, README.md, docs/architecture.md, docs/api-contracts.md, docs/event-contracts.md, docs/state-and-safety.md, docs/integration-checklist.md and shared/schemas.py. Do not immediately rewrite code. First report: existing repository topology, collisions with the starter, missing dependencies, the precise current test status, and discrepancies between prose contracts and actual Pydantic code. Propose a non-destructive merge plan and a schema freeze checklist. Identify exactly which files all four owners must approve. Only after approval, initialize or integrate the starter, run its tests, save the agreed contract as version 1.0.0, and generate four feature branch names. Do not claim live features are working merely because mocks pass. Never commit secrets or production account information.

## Individual Launch Prompts (one per teammate)

### Yukta

> I am Yukta on the AccessPilot team. Read `MASTER_CLAUDE_INSTRUCTIONS.md`, root `CLAUDE.md`, `README.md`, the frozen `shared/schemas.py` and `docs/` contracts, and `team/yukta/CLAUDE.md`. Follow **only** the Yukta ownership instructions embedded below. Inventory the repository and identify the exact files you will change; outline interfaces, acceptance tests, and implementation stages before changing anything. Implement iteratively against mocks where peer modules are missing. Do not change frozen contracts or other owners' modules without a reviewed proposal. Run the relevant tests and report exact outputs, commits, open questions, and integration handoff. Never claim an integration that was only mocked.

### Ramya

> I am Ramya on the AccessPilot team. Read `MASTER_CLAUDE_INSTRUCTIONS.md`, root `CLAUDE.md`, `README.md`, the frozen `shared/schemas.py` and `docs/` contracts, and `team/ramya/CLAUDE.md`. Follow **only** the Ramya ownership instructions embedded below. Inventory the repository and identify the exact files you will change; outline interfaces, acceptance tests, and implementation stages before changing anything. Implement iteratively against mocks where peer modules are missing. Do not change frozen contracts or other owners' modules without a reviewed proposal. Run the relevant tests and report exact outputs, commits, open questions, and integration handoff. Never claim an integration that was only mocked.

### Disha

> I am Disha on the AccessPilot team. Read `MASTER_CLAUDE_INSTRUCTIONS.md`, root `CLAUDE.md`, `README.md`, the frozen `shared/schemas.py` and `docs/` contracts, and `team/disha/CLAUDE.md`. Follow **only** the Disha ownership instructions embedded below. Inventory the repository and identify the exact files you will change; outline interfaces, acceptance tests, and implementation stages before changing anything. Implement iteratively against mocks where peer modules are missing. Do not change frozen contracts or other owners' modules without a reviewed proposal. Run the relevant tests and report exact outputs, commits, open questions, and integration handoff. Never claim an integration that was only mocked.

### Revati

> I am Revati on the AccessPilot team. Read `MASTER_CLAUDE_INSTRUCTIONS.md`, root `CLAUDE.md`, `README.md`, the frozen `shared/schemas.py` and `docs/` contracts, and `team/revati/CLAUDE.md`. Follow **only** the Revati ownership instructions embedded below. Inventory the repository and identify the exact files you will change; outline interfaces, acceptance tests, and implementation stages before changing anything. Implement iteratively against mocks where peer modules are missing. Do not change frozen contracts or other owners' modules without a reviewed proposal. Run the relevant tests and report exact outputs, commits, open questions, and integration handoff. Never claim an integration that was only mocked.

## First milestone and definition of done

**First integrated user journey:** text command to read a **controlled student portal** deadline, plan a reminder, create/update a **dedicated test Google Calendar** entry by API or mock browser, independently verify saved event details, and give an accessible status. Support a paused task, a correction that changes date/time, and an uncertain timeout-after-save that does **not** duplicate the event.

**Minimum acceptance before declaring live integration:** actual external write verified by external read-back; persisted plan and journal after restart; approval bound to task/step/version; no retry on unknown outcome; end-to-end test through the web client; keyboard-only operation; model/provider identity logged; reproducible tests.

**Status distinction:** The original starter has an in-memory mock API, sample plan, mock execution adapter, static HTML preview, and 9 tests. Docker includes PostgreSQL and Redis services, but they are not yet wired to the domain logic. It has no working live cloud model, Google OAuth/Calendar integration, production browser agent, full speech stack, or React client. Treat all of these as work items, never as completed features.

## File ownership and review

| Owner | Owned paths | Responsibilities |
|---|---|---|
| Yukta | `services/gateway/`, `services/model_router/`, `infra/`, platform docs/tests | API gateway, event transport, model routing, Docker and auth infrastructure |
| Ramya | `services/speech_intent/`, `services/orchestrator/`, associated docs/tests | STT/intent, structured planning, durable task state, correction/replanning |
| Disha | `services/execution/`, `services/verifier/`, `services/recovery/`, `testbed/`, associated docs/tests | API/DOM/GUI adapters, verification, safe fallback, fault injection |
| Revati | `frontend/` and frontend docs/tests | Accessible UI, mic/transcript, progress, confirmation, voice status |
| All four | `shared/`, frozen API and event contracts | Changes by reviewed PR only |

## Build/test baseline

```bash
# Execute from the extracted starter root, not your GitHub repository root unless identical
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
PYTHONPATH=. pytest -q

docker compose -f infra/compose.yaml up --build
# then visit http://127.0.0.1:8000/docs
```

On Windows, use the platform-appropriate virtual environment activation command. Do not assume Docker startup passed until actually tested on a team computer.

---

# Part I — Exact root agent rules from starter

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

---

# Part II — Starter README and current implementation boundary

# AccessPilot AI — Claude Code Starter Pack

**Status: contract-first, mock-only runnable starter.** This is NOT the finished AccessPilot application. Its backend starts and its 9 initial tests pass locally. The live model, persistent database integration, real browser workflow, live Calendar API, voice pipeline, Redis event bus and production frontend are assigned follow-up work.

## Start in your existing GitHub repository

1. Create a new branch: `git switch -c setup/accesspilot-contracts`.
2. Back up or review your existing files. Copy the contents of this pack into a **new `accesspilot/` subdirectory** initially, or merge files carefully after comparing paths. **Do not blindly overwrite an existing README, app, compose file or CI configuration.** The exact existing repo layout was not supplied.
3. Run `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && PYTHONPATH=. pytest -q` from the pack root.
4. To start with Docker: `docker compose -f infra/compose.yaml up --build` from the pack root. Open `http://127.0.0.1:8000/docs`. Docker services PostgreSQL and Redis are provisioned but the API still uses in-memory mock state.
5. Commit the shared contracts as version **1.0.0**. Four teammates then create branches from that commit and work **only in owned directories**. See `docs/integration-checklist.md`.
6. Read `CLAUDE.md` (root) and the matching `team/<name>/CLAUDE.md` before asking a coding agent to edit files.

## Local smoke test

```bash
curl -s http://127.0.0.1:8000/health/ready
curl -s -X POST http://127.0.0.1:8000/api/v1/tasks -H 'Content-Type: application/json' -d '{"instruction":"Create a calendar reminder for my assignment"}'
```

The returned task is **not executed**. `task.created` means a MOCK task plan was generated. All task plans currently use the same deterministic sample three-step flow. The mock calendar can be exercised in unit tests; it is not wired to the HTTP gateway.

## Folder ownership

| Area | Owner | Initial status |
|---|---|---|
| `services/gateway`, `services/model_router`, `infra` | Yukta | Mock FastAPI gateway + Compose; live providers pending |
| `services/speech_intent`, `services/orchestrator` | Ramya | Basic parsing + in-memory mock plan; ASR and persistence pending |
| `services/execution`, `services/verifier`, `services/recovery`, `testbed` | Disha | Mock calendar + safe retry policy; live adapters pending |
| `frontend` | Revati | Static mock accessibility UI; React production client pending |
| `shared` | **All four approve** | Frozen v1 Pydantic models |
| `docs` | Change by team review | Design contracts and decisions |

## Model selection (provisional)

Use a deterministic mock first. For bounded local intent, evaluate a small Qwen or Gemma instruction model through Ollama. For complex planning, run a controlled comparison of **two structured-output cloud models** (exact model IDs and prices recorded at evaluation time). No particular provider is selected as the final winner yet. The initial model router is a decision preview, not a complete inference implementation.

## Critical nonclaims

- No live Google Calendar mutations or OAuth flows are included.
- Docker Compose creates PostgreSQL and Redis, but the sample gateway does not yet persist or publish to them.
- The UI is an offline mock view, not connected to the gateway.
- No software yet provides full-duplex voice or model-based visual GUI control.
- Do not report any of these features as implemented before adding and testing them.

---

# Part III — Architecture (`docs/architecture.md`)

# AccessPilot v1 architecture — approved proposal to freeze

## Product boundary

First product is an accessible desktop web client handling a **controlled student portal → test Google Calendar** workflow. A user asks for an assignment reminder; the system reads a deadline, plans dependent steps, executes an authorized write, independently verifies the saved result, and can pause, correct or reconcile uncertain outcomes.

```text
Voice/text client [Revati]
   | POST task, control commands / task event stream
Gateway + model-provider facade [Yukta]
   | validated TaskCreate / provider call
Speech & intent + planner [Ramya]
   | Plan (DAG) / plan versions
Durable task orchestrator + journal [Ramya]
   | approved ExecutionRequest
Execution router: API / Playwright DOM / optional GUI [Disha]
   | ExecutionResult (not proof of completion)
Verifier: read back external state [Disha]
   | VerificationResult
Recovery reconciliation [Disha] --> state update [Ramya]
   | only verified completion to UI [Revati]
```

**Manager/specialist design:** central orchestrator owns task lifetime and chooses which bounded specialist/tool to call. The planner is an LLM-backed specialist, not a permission authority. DOM execution is primarily deterministic Playwright, with optional model assistance only behind constrained actions. Verification and safety are deterministic where possible. The model router selects inference provider separately from the execution router choosing API/DOM/GUI.

## Model and agent choices

| Role | Starting implementation | Rationale | Comparison before claiming selection |
|---|---|---|---|
| Intent/control | deterministic mock then local Qwen/Gemma via Ollama | bounded extraction; private/cheap control | accuracy, latency, invalid JSON, hardware |
| Planner | mock then cloud structured-output model | stronger multi-step reasoning | two providers, schema-valid plans, tool accuracy, costs |
| API adapter | Calendar REST with test account | structured operations, read-back evidence | API vs DOM same tasks |
| Browser | Playwright with accessible role locators | reproducible, inspectable actions | locator failures, recovery |
| GUI | isolated mock first; real grounding later | avoid a costly unvalidated model dependency | grounding accuracy vs DOM baseline |
| Speech | ASR + LLM + TTS cascade first | simpler debug and control | full-duplex benchmark later |
| Verification | deterministic external reads | independent truth source | false-done and duplicates |

**Do not claim to have adopted OpenAI CUA, UFO², UI-TARS, ShowUI or NemotronLabs as runtime components unless code actually calls them.** They are research references; actual installed versions and evaluated models must be recorded in `docs/model-selection-log.md`.

## Scope exclusions

No arbitrary OS, payments, irreversible live purchases, account bypass, or guaranteed rollback. Real Google Calendar uses a dedicated calendar/test account. Unknown external writes stop rather than force retry.

---

# Part III — HTTP/API Contracts (`docs/api-contracts.md`)

# HTTP API and service contracts — frozen v1

All paths are relative to the gateway; all payloads are JSON and validated with `shared/schemas.py`. HTTP responses use standard errors with `{ "detail": "..." }`. The gateway currently has **mock implementations only**. Internal service communications may use HTTP or typed in-process adapters as long as they preserve these schemas.

## Public endpoints

| Method | Path | Request | Response | Starter behavior |
|---|---|---|---|---|
| POST | `/api/v1/tasks` | `TaskCreate` | `TaskView`, 201 | mock plan, no execution |
| GET | `/api/v1/tasks/{task_id}` | none | `TaskView` | in-memory state |
| GET | `/api/v1/tasks/{task_id}/journal` | none | `{task_id,journal}` | mock history |
| GET | `/api/v1/tasks/{task_id}/summary` | none | `{task_id,status,plan_version,summary}` | explicit mock summary |
| POST | `/api/v1/tasks/{task_id}/interrupt` | `InterruptRequest` | `TaskView` | mock pause/resume/correct/stop |
| POST | `/api/v1/tasks/{task_id}/confirmations/{step_id}` | `ApprovalRequest` | reserved | returns 501 (no approval ledger yet) |
| GET | `/health/live` | none | `{status}` | implemented |
| GET | `/health/ready` | none | `{status,mode,storage,model}` | implemented; says in-memory/mock |
| WS | `/ws/session` | `TaskEvent` stream | `TaskEvent` | **planned; not implemented** |

Example request:

```json
{"instruction":"Add a reminder for my next assignment","timezone":"America/Los_Angeles","mode":"mock"}
```

Example controls:

```json
{"kind":"PAUSE"}
{"kind":"CORRECT","instruction":"Actually change it to Thursday at 4 pm"}
```

**Responses:** `404` unknown task/step; `409` illegal state transition/stale plan; `422` invalid schema; `501` unsupported live capability. Do not return HTTP 200 for simulated successful external work.

## Internal typed operations

`planner.generate(instruction, context) -> Plan` (Ramya); `executor.execute(ExecutionRequest) -> ExecutionResult` (Disha); `verifier.verify(ExecutionResult, expected_state) -> VerificationResult` (Disha); `orchestrator.apply_event(TaskEvent) -> TaskView` (Ramya); `model_router.infer(role,prompt,json_schema,privacy_policy) -> parsed_result` (Yukta, future extension).

## Data contract hard rules

`Plan.steps` must have unique IDs and form an acyclic dependency graph. A `TaskStep` action must be in the allowlist. `ExecutionResult.outcome=SUCCESS` means the adapter reported success, **not** externally verified completion. `VerificationResult.status=VERIFIED` requires evidence; `UNKNOWN` blocks blind retry. Idempotency keys are stable for a single logical write, including retries. Plan correction increments `plan_version` and old approvals are invalid.

## Schema evolution

Update `SCHEMA_VERSION` plus example payloads, tests, and every consumer in the same reviewed PR. No autonomous coding agent may change a contract alone.

---

# Part III — Event Contracts (`docs/event-contracts.md`)

# Event contract — planned Redis Streams integration

Typed schema: `TaskEvent` (`shared/schemas.py`). Mandatory fields: `schema_version`, `event_id`, `task_id`, `plan_version`, `kind`, `created_at`, `payload`.

Allowed `kind`: `task.created`, `task.updated`, `step.ready`, `step.executed`, `step.uncertain`, `step.verified`, `task.interrupted`, `task.completed`, `approval.requested`.

Consumer rules: per-event deduplication by `event_id`; reject unsupported schema versions; write journal and state transactionally before acknowledging; preserve ordering per task or use optimistic `plan_version` checks; no raw secrets or private page content in events. Redis Streams is provisioned by Compose but no publisher/consumer implementation exists yet.

Example:

```json
{"schema_version":"1.0.0","event_id":"7a3d8f59-d2e8-4a23-8e78-e4fa0fe454e0","task_id":"task-1","plan_version":1,"kind":"step.uncertain","created_at":"2026-11-14T12:00:00Z","payload":{"step_id":"create-event","route":"API","reason":"timeout_after_save"}}
```

A `step.uncertain` must trigger reconciliation; it cannot be treated as permission to resubmit.

---

# Part III — State and Safety (`docs/state-and-safety.md`)

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

---

# Part III — Feature Backlog (`docs/feature-backlog.md`)

# Feature backlog and ownership

| Feature group | Priority | Owner | Acceptance outcome |
|---|---|---|---|
| Text+voice, accessible input/status | P0 | Revati (UI), Ramya (ASR) | transcribed/typed task matches intent; no-mouse navigation |
| Intent, structured DAG planning | P0 | Ramya | valid plan/action allowlist, no dependency cycles |
| Durable task state, audit journal | P0 | Ramya (+ Yukta DB infrastructure) | survives restart; plan versions maintained |
| Gateway, auth, service/event infrastructure | P0 | Yukta | accessible APIs, contracts, authenticated event channel |
| Portal DOM + Calendar API | P0 | Disha | read and write on controlled mock/test systems |
| Verification and uncertain-write policy | P0 | Disha | no false done or blind duplicate write |
| Pause/resume and approval | P0 | Ramya/Disha/Revati by interface | paused dispatch; scoped authorization |
| Spoken mid-task correction and selective replan | P1 | Ramya + Revati | preserve unrelated verified steps |
| API→DOM fallback + compensation | P1 | Disha | no duplicate writes under S4 and S7 |
| Local/cloud model routing | P1 | Yukta | empirical quality/cost/latency trade-off |
| Visual GUI real model | P2 | Disha | grounded supported-page benchmark |
| Full duplex and mobile app | P2 | Ramya/Revati | separately evaluated after MVP |
| Kubernetes/production observability | P2 | Yukta | only after measurable need |

Definitions: P0 means minimal integrated demo; P1 research differentiators; P2 stretch. This is the **proposed** final split for team approval, not evidence of work already completed.

---

# Part III — Model Selection Log (`docs/model-selection-log.md`)

# Model and agent selection evidence (fill after experiments)

**No final cloud provider/model has been selected.** The current starter uses deterministic mock outputs. Avoid claiming measured superiority without a controlled experiment.

For every candidate record: provider, exact model ID/version, inference endpoint, licenses/privacy policy, context limit, tools/JSON support, runtime/hardware, date tested, number of tasks, validity of structured output, plan correctness, median and p95 latency, cost/token usage, failure/retry rate, and prompt template hash.

Candidates: local bounded intent via Qwen/Gemma in Ollama; cloud planner via two eligible API-based structured-output models; Playwright DOM baseline versus constrained model-assisted browser route; cascaded speech versus optional full-duplex research model later. Keep API/DOM/GUI *execution methods* distinct from LLM *model selection*.

| Candidate | Tested date | Exact ID | Valid plans | Successful tasks | Median latency | Cost | Decision |
|---|---|---|---|---|---|---|---|
| Mock baseline | TBD | deterministic mock | TBD | N/A | TBD | $0 | infrastructure testing only |
| Cloud A | TBD | TBD | TBD | TBD | TBD | TBD | unselected |
| Cloud B | TBD | TBD | TBD | TBD | TBD | TBD | unselected |
| Local A | TBD | TBD | TBD | TBD | TBD | local resources | unselected |

---

# Part III — Integration Checklist (`docs/integration-checklist.md`)

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

---

# Part III — Test Plan (`docs/test-plan.md`)

# Test matrix, environment and research comparisons

**Unit:** invalid plan cycles, unknown tool names, state transitions, approval binding, timezone/date extraction, redaction, model routing policy, duplicate event delivery.

**Contract:** Pydantic payloads and OpenAPI routes, stale `plan_version` 409, `mode=live` refused until enabled, no changed enum names.

**Execution fault tests:** S1 normal; S2 API down; S3 UI renamed; S4 API down + renamed UI; S5 API down + popup overlay; S6 API down + silent save failure; S7 timeout-after-save; S8 browser crash after submit. Mock testbed must use deterministic seeds and authoritative external ground truth.

**Baselines:** B1 API only; B2 DOM only; B3 GUI only; B4 router no verifier; B5 router plus verifier. The same input tasks/faults are mandatory across each condition. Keep user-approval semantics consistent.

**Metrics:** true task success, false-done, duplicates, correction success, unnecessary repeated steps, recovery time, stop acknowledgement, first spoken response, hands-free completion, API calls and model cost. Report sample size and confidence intervals where justified. Do not compare incompatible vendor benchmark scores as though they use identical tasks.

**Live integration:** only isolated test Calendar; require external OAuth integration and optional credentials; integration tests skipped with explicit reason without credentials, never silently deemed passing. No real purchases or sensitive automation.

Current starter includes nine Python tests for contracts, gateway mock endpoints, idempotency, timeout recovery, and approval refusal. These do not replace the full fault matrix.

---

# Part IV — Yukta Claude Code Instructions (`team/yukta/CLAUDE.md`)

# Yukta — Platform, Gateway, Deployment, Model Router

You own: `services/gateway/`, `services/model_router/`, `infra/`, Docker root files with coordinated review, and platform-oriented tests. **Do not implement other owners' business logic.**

## Goal
Build the stable communication and deployment layer for AccessPilot: FastAPI public gateway, PostgreSQL persistence infrastructure, Redis Streams event transport, provider-neutral inference, development-safe auth, service metrics and Docker Compose orchestration. Start with the existing mock gateway and upgrade incrementally. **The current Compose starts Postgres/Redis but nothing uses them yet**; fixing that with tests is part of your work.

## Exact deliverables

1. Add DB connection pooling, Alembic migration tooling and table access abstractions with a documented owner boundary. Ramya owns task domain tables/models; you own DB infra and migration execution, not task state semantics.
2. Add Redis Streams `publish(event: TaskEvent)` and idempotent `consume(...)` adapters. Ensure event ID dedup and at-least-once delivery semantics; consumers must acknowledge only after successful processing.
3. Implement FastAPI proxy/delegation for TaskCreate, TaskView, interrupts, approval decisions and journal; do not put planning/execution inside gateway. Include authenticated user scope and correlation IDs.
4. Implement WebSocket `/ws/session` with authenticated subscriptions scoped to the right task/user, reconnection behavior and event-schema validation. Never leak other users' events.
5. Implement model provider interface with `MockModelProvider`, local Ollama and at least one configurable hosted provider. Pass `role`, `prompt`, JSON schema, privacy policy, timeout; validate returned JSON. Handle provider outages, cost and timeouts transparently.
6. Implement deterministic route selection: local-first for bounded private intents if configured; cloud for difficult planning where policy permits; fail closed rather than leaking restricted content. Avoid inventing final cloud-model selection. Record model ID, provider, latency, token usage and exceptions.
7. Build Compose profiles for mock-only and optional live model; DB/Redis persist volumes and health checks. Keep all published ports loopback-bound in development; avoid insecure demo defaults beyond local-only.
8. Supply `docs/platform-runbook.md`, `docs/model-routing-evaluation.md`, `.env.example`, troubleshooting, and tests.

## Integration contracts

Consume and return Pydantic v1.0.0 frozen schemas, not ad hoc dicts. Gateway HTTP endpoints are listed in `docs/api-contracts.md`. `TaskEvent` in `shared/schemas.py` is the only event envelope. Auth decisions cannot come from arbitrary frontend `user_id` fields. Integrate with Ramya's durable task service and Disha's execution service only through their reviewed interfaces.

## Tests and acceptance

- Mock mode runs in Docker with working task routes; Postgres and Redis are genuinely used once implemented, not simply started.
- Durable task journal and scoped event streams survive gateway restart.
- Duplicate Redis delivery does not repeat domain actions.
- Wrong-user session/task subscription rejected; stale approval rejected.
- `model_router` routes appropriately, and privacy-blocked cloud never calls hosted provider.
- No tokens/passwords or user page content appear in logs.
- Runs without real cloud credentials and shows clear live-credential skip statuses.

## Research selection evidence

Compare two current cloud structured-output models on **the same** task corpus, plus a small local Qwen/Gemma intent baseline. Record exact model IDs, API versions, hardware, prompt hash, schema-valid rate, task-plan validity, latency and approximate cost. Do not announce a winning provider before the experiment.

## Required workflow

1. Inspect existing repository; read root `CLAUDE.md`, `docs/architecture.md`, `docs/api-contracts.md`, `docs/event-contracts.md`, `docs/state-and-safety.md`, `shared/schemas.py`, and your team instructions.
2. Produce a concise inventory, a file-level implementation plan, API assumptions, and proposed tests BEFORE modifying files.
3. Never modify `shared/` contracts or another teammate's ownership folder directly. Make a change proposal if the frozen schema is insufficient.
4. Implement against mock other services first, then swap to the real service under the exact same contract.
5. Never report a mock output as a live integration result. Keep external credentials out of Git and CI.
6. Run `PYTHONPATH=. pytest -q` and any owner-specific tests, then report exact results, unimplemented items, files changed, and integration needs.
7. Commit incremental changes on your own branch, open a PR, and request the relevant cross-team reviewer.

---

# Part IV — Ramya Claude Code Instructions (`team/ramya/CLAUDE.md`)

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

---

# Part IV — Disha Claude Code Instructions (`team/disha/CLAUDE.md`)

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

---

# Part IV — Revati Claude Code Instructions (`team/revati/CLAUDE.md`)

# Revati — Accessible Frontend, Voice Experience, Approval UX

You own: `frontend/` and frontend-specific docs/tests. Do not edit backend modules or frozen schemas.

## Goal
Make AccessPilot usable through keyboard, speech, and screen readers; show truthful task state, interruptions, approval choices, uncertainty and audit history. Current `frontend/index.html` is deliberately a disconnected static design mock; replace it with a real accessible React + TypeScript application.

## Exact deliverables

1. Create a React/TypeScript app with New Task, Task Progress, Approval/Uncertainty Dialog, and Journal/History screens. Implement a generated or handwritten typed API client from the frozen API contracts.
2. Provide editable text task entry, microphone capture with clear permission handling, transcription preview and correction before submit. Always keep a keyboard-only fallback.
3. Show goal, plan version, step dependencies, current action, route (API/DOM/GUI), VERIFIED versus UNKNOWN, and independent evidence. Never label an unverified execution response as DONE.
4. Implement Pause, Resume, Stop, What Happened?, Change Instruction, Review Steps controls. Backend is authority; show pending network state, errors and reconnect indicators.
5. Connect task stream to `/ws/session` once implemented; until then use a clearly labeled mock transport. Support retrying WebSocket subscription without duplicating events. Treat schema version mismatch as a visible error.
6. Implement optional TTS and user-adjustable rate/detail level. Important events are announced once in `aria-live` regions. Avoid interrupting long speech constantly and always honor pause/stop voice controls if voice input is available.
7. Approval UI must say exactly what will be done, by which app, with what arguments; support Approve/Reject/Change, and bind decisions to step and plan version. Do not locally assume an approval completed the action.
8. UNKNOWN outcome UI must speak 'not confirmed' and offer Check Again / Explanation / Stop; do not show Retry unless backend proves it safe. Provide human-takeover page for supported authentication steps without bypassing CAPTCHA.
9. Implement semantic labels, focus restoration, keyboard tab order, visible focus, contrast, reduced motion support, and statuses with both color and text. Test with VoiceOver or NVDA manually and document results.
10. Create Vitest/React Testing Library tests and Playwright accessibility smoke tests (axe where applicable). Include offline fixtures for all task statuses, stale plan approvals and timeout-after-save uncertainty.

## Integration contracts

Consume TaskCreate/TaskView/TaskEvent semantics from frozen `shared/schemas.py` and docs. Never invent new status enums or use `success=true` to signify external verification. All service calls should pass through the gateway. Do not create a frontend-only fake approval that looks real.

## Tests and acceptance

- Full keyboard-only form entry, progress inspection, pause/resume and approval/rejection with mocked backend.
- Uncertain result is explained without requiring a screenshot or mouse.
- No visual-only status; screen-reader announcements make sense without seeing the screen.
- Task state after reconnect matches backend plan version; stale approval is blocked.
- Live-task features disabled or explicitly labeled until gateway supports them.
- Frontend tests can run without a Google Calendar account or cloud model.

## Research evaluation

Design an accessible test protocol measuring independent task completion, intervention count, recovery comprehension, pause acknowledgement and first spoken response. Do not treat blindfolded sighted participants as equivalent to blind/low-vision users.

## Required workflow

1. Inspect existing repository; read root `CLAUDE.md`, `docs/architecture.md`, `docs/api-contracts.md`, `docs/event-contracts.md`, `docs/state-and-safety.md`, `shared/schemas.py`, and your team instructions.
2. Produce a concise inventory, a file-level implementation plan, API assumptions, and proposed tests BEFORE modifying files.
3. Never modify `shared/` contracts or another teammate's ownership folder directly. Make a change proposal if the frozen schema is insufficient.
4. Implement against mock other services first, then swap to the real service under the exact same contract.
5. Never report a mock output as a live integration result. Keep external credentials out of Git and CI.
6. Run `PYTHONPATH=. pytest -q` and any owner-specific tests, then report exact results, unimplemented items, files changed, and integration needs.
7. Commit incremental changes on your own branch, open a PR, and request the relevant cross-team reviewer.

---

# Part V — Mandatory final handoff from every coding agent

At the end of every implementation session respond in exactly these sections:

1. **Scope completed:** Concrete features with paths and entry points.
2. **Tests executed:** Commands plus pass/fail/skip counts, including whether mocks or live services were used.
3. **Contracts:** Inputs, outputs, example JSON payloads, any requested schema amendments.
4. **How to run:** Exact dependency, environment variable, and command instructions.
5. **Unfinished and risks:** Explicitly separate mock, partial, and live functionality; security/privacy limitations.
6. **Integration handoff:** Files needing reviewer attention, branch/commit/PR identifiers if available, and next team dependency.

## Do not overclaim

A passing mocked API call is not a real Google Calendar integration. A screenshot comparison is not independent external-state verification. A planner that emits JSON is not an autonomous multi-agent product. A mic button is not a tested full-duplex voice pipeline. A configured PostgreSQL container is not durable persistence unless the application actually writes and reloads its data. Always report what code and tests prove.

## Professor's required agent justification artifact

For every agent/model the team actually runs, fill the `docs/model-selection-log.md` record with: exact provider/model ID/version; role and allowed tools; selected architecture; alternatives tested; evaluation dataset and scenario count; schema-valid plan/intent rate; latency percentiles; estimated usage cost; reproducibility settings; safety limitations. Distinguish actual components from literature inspirations (CUA, UFO², UI-TARS, Nemotron VoiceChat, etc.).

