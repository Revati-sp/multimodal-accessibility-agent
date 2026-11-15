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
