# AccessPilot AI — Claude Code Starter Pack

**Status: contract-first, mock-only runnable starter.** This is NOT the finished AccessPilot application. Its backend starts and its 9 initial tests pass locally. The live model, persistent database integration, real browser workflow, live Calendar API, voice pipeline, Redis event bus and production frontend are assigned follow-up work.

## Setup

**Requires Python 3.10+** (the schemas use `X | None` union syntax). If your default `python3` is older, point the venv at a newer interpreter, e.g. `/opt/homebrew/bin/python3.12 -m venv .venv`.

1. `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && PYTHONPATH=. pytest -q` from the repo root. All 9 tests should pass.
2. To start with Docker: `docker compose -f infra/compose.yaml up --build` from the repo root. Open `http://127.0.0.1:8000/docs`. Docker services PostgreSQL and Redis are provisioned but the API still uses in-memory mock state.
3. Read `CLAUDE.md` (root) and the matching `team/<name>/CLAUDE.md` before asking a coding agent to edit files. See `MASTER_CLAUDE_INSTRUCTIONS.md` for the full consolidated directive and each teammate's launch prompt.
4. Create your feature branch from `main` per `docs/integration-checklist.md` and work **only in your owned directories**.

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
