# Event contract — planned Redis Streams integration

Typed schema: `TaskEvent` (`shared/schemas.py`). Mandatory fields: `schema_version`, `event_id`, `task_id`, `plan_version`, `kind`, `created_at`, `payload`.

Allowed `kind`: `task.created`, `task.updated`, `step.ready`, `step.executed`, `step.uncertain`, `step.verified`, `task.interrupted`, `task.completed`, `approval.requested`.

Consumer rules: per-event deduplication by `event_id`; reject unsupported schema versions; write journal and state transactionally before acknowledging; preserve ordering per task or use optimistic `plan_version` checks; no raw secrets or private page content in events. Redis Streams is provisioned by Compose but no publisher/consumer implementation exists yet.

Example:

```json
{"schema_version":"1.0.0","event_id":"7a3d8f59-d2e8-4a23-8e78-e4fa0fe454e0","task_id":"task-1","plan_version":1,"kind":"step.uncertain","created_at":"2026-11-14T12:00:00Z","payload":{"step_id":"create-event","route":"API","reason":"timeout_after_save"}}
```

A `step.uncertain` must trigger reconciliation; it cannot be treated as permission to resubmit.
