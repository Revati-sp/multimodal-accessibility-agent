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
