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
