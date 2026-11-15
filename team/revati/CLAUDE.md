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
