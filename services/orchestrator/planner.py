"""Deterministic mock planner.

The model client returns fixed JSON. Dates, recipients, and graph checks are
applied here. A live provider is not called. This does not execute a plan.
"""

from __future__ import annotations

from typing import Any, Protocol
import json

from pydantic import ValidationError

from services.model_router.router import choose_provider
from services.speech_intent.dates import DateResolution, resolve_when
from shared.schemas import Plan, RiskTier, TaskStep

MAX_STEPS = 8
MAX_RETRIES = 2

_ACTIONS = {
    "read_deadline",
    "create_calendar_event",
    "update_calendar_event",
    "read_calendar_event",
    "verify_calendar_event",
}
_APPLICATIONS = {"student_portal", "google_calendar", "mock_calendar"}
_WRITE_ACTIONS = {"create_calendar_event", "update_calendar_event"}
_PLAN_SCHEMA = {"type": "object", "required": ["steps"]}

_MOCK_PLAN = {
    "steps": [
        {
            "id": "read-deadline",
            "action": "read_deadline",
            "application": "student_portal",
            "depends_on": [],
            "risk_tier": "T0",
        },
        {
            "id": "create-event",
            "action": "create_calendar_event",
            "application": "mock_calendar",
            "depends_on": ["read-deadline"],
            "risk_tier": "T1",
        },
        {
            "id": "verify-event",
            "action": "verify_calendar_event",
            "application": "mock_calendar",
            "depends_on": ["create-event"],
            "risk_tier": "T0",
        },
    ]
}


class PlannerError(ValueError):
    def __init__(self, message: str, reasons: tuple[str, ...] = ()):
        self.reasons = reasons
        detail = f"{message}: {', '.join(reasons)}" if reasons else message
        super().__init__(detail)


class ModelClient(Protocol):
    def complete(self, *, role: str, prompt: str, json_schema: dict[str, Any]) -> str:
        """Return a JSON plan. Implementations must not perform external writes."""


class MockModelClient:
    """Fixed three-step plan. The instruction does not change the JSON."""

    def complete(self, *, role: str, prompt: str, json_schema: dict[str, Any]) -> str:
        return json.dumps(_MOCK_PLAN)


def generate(instruction: str, context: dict[str, Any], *, model: ModelClient | None = None) -> Plan:
    if not isinstance(instruction, str) or not instruction.strip():
        raise PlannerError("instruction is required")
    task_id = context.get("task_id")
    if not isinstance(task_id, str) or not task_id:
        raise PlannerError("task_id is required")
    version = context.get("plan_version", 1)
    if not isinstance(version, int) or version < 1:
        raise PlannerError("plan_version must be >= 1")
    resolution = resolve_when(instruction, clock=context.get("clock"), timezone=context.get("timezone"))
    if not resolution.ok:
        raise PlannerError("cannot build a plan", resolution.errors)
    client = model if model is not None else _mock_client()
    raw = client.complete(
        role="planner",
        prompt=f"Plan this instruction as JSON.\n{instruction.strip()}",
        json_schema=_PLAN_SCHEMA,
    )
    payload = _parse_payload(raw)
    steps = _steps(payload, version, resolution)
    try:
        return Plan(task_id=task_id, goal=instruction.strip(), version=version, steps=steps)
    except ValidationError as exc:
        text = str(exc)
        if "cyclic" in text:
            raise PlannerError("cyclic plan") from exc
        raise PlannerError("invalid plan") from exc


def _mock_client() -> MockModelClient:
    decision = choose_provider("planner")
    if decision.provider != "mock":
        raise PlannerError("live model is not wired")
    return MockModelClient()


def _parse_payload(raw: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise PlannerError("malformed model JSON") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("steps"), list):
        raise PlannerError("malformed model JSON")
    return payload


def _steps(payload: dict[str, Any], version: int, resolution: DateResolution) -> list[TaskStep]:
    raw_steps = payload["steps"]
    if not raw_steps:
        raise PlannerError("empty plan")
    if len(raw_steps) > MAX_STEPS:
        raise PlannerError("too many steps")
    steps: list[TaskStep] = []
    for raw in raw_steps:
        if not isinstance(raw, dict):
            raise PlannerError("malformed model JSON")
        action = raw.get("action")
        if action not in _ACTIONS:
            raise PlannerError("unknown action")
        application = raw.get("application")
        if application not in _APPLICATIONS:
            raise PlannerError("unknown application")
        risk = raw.get("risk_tier", "T0")
        if risk not in {"T0", "T1", "T2", "T3"}:
            raise PlannerError("unknown risk tier")
        step_id = raw.get("id")
        depends = raw.get("depends_on", [])
        retries = raw.get("retries", 0)
        if not isinstance(step_id, str) or not step_id:
            raise PlannerError("malformed model JSON")
        if not isinstance(depends, list) or not all(isinstance(item, str) for item in depends):
            raise PlannerError("malformed model JSON")
        if not isinstance(retries, int) or retries < 0 or retries > MAX_RETRIES:
            raise PlannerError("retry limit exceeded")
        arguments = dict(raw.get("arguments") or {})
        if action in _WRITE_ACTIONS:
            arguments.update(_schedule_arguments(resolution))
        steps.append(
            TaskStep(
                id=step_id,
                plan_version=version,
                action=action,
                application=application,
                arguments=arguments,
                depends_on=depends,
                risk_tier=RiskTier(risk),
            )
        )
    return steps


def _schedule_arguments(resolution: DateResolution) -> dict[str, Any]:
    arguments: dict[str, Any] = {}
    if resolution.date is not None:
        arguments["date"] = resolution.date.isoformat()
    if resolution.time is not None:
        arguments["time"] = resolution.time.strftime("%H:%M")
    if resolution.timezone is not None:
        arguments["timezone"] = resolution.timezone
    if resolution.remind_offset_minutes is not None:
        arguments["remind_offset_minutes"] = resolution.remind_offset_minutes
    return arguments
