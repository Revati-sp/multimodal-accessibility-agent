"""Deterministic planner tests. No model endpoint, network, or database."""

from datetime import datetime
import json
from zoneinfo import ZoneInfo

import pytest

from services.orchestrator.planner import PlannerError, generate
from shared.schemas import RiskTier

_CLOCK = datetime(2026, 11, 17, 15, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
_ZONE = "America/Los_Angeles"
_CONTEXT = {"task_id": "task-1", "clock": _CLOCK, "timezone": _ZONE}


class _ScriptedModel:
    def __init__(self, raw: str):
        self.raw = raw

    def complete(self, *, role: str, prompt: str, json_schema: dict) -> str:
        return self.raw


def _plan(*steps: dict) -> str:
    return json.dumps({"steps": list(steps)})


def test_sample_instruction_returns_the_three_step_dag():
    plan = generate("Create a calendar reminder for my assignment", _CONTEXT)
    assert plan.task_id == "task-1"
    assert plan.version == 1
    assert [step.id for step in plan.steps] == ["read-deadline", "create-event", "verify-event"]
    assert plan.steps[0].action == "read_deadline"
    assert plan.steps[0].application == "student_portal"
    assert plan.steps[0].risk_tier == RiskTier.T0
    assert plan.steps[0].depends_on == []
    assert plan.steps[1].action == "create_calendar_event"
    assert plan.steps[1].depends_on == ["read-deadline"]
    assert plan.steps[1].risk_tier == RiskTier.T1
    assert plan.steps[2].action == "verify_calendar_event"
    assert plan.steps[2].depends_on == ["create-event"]


def test_resolved_thursday_is_stored_on_the_create_step():
    plan = generate("Remind me 30 minutes before Thursday at 4 pm", _CONTEXT)
    assert plan.steps[1].arguments == {
        "date": "2026-11-19",
        "time": "16:00",
        "timezone": _ZONE,
        "remind_offset_minutes": 30,
    }


@pytest.mark.parametrize(
    ("instruction", "context", "reason"),
    [
        ("Remind me on Thursday", {"task_id": "task-1"}, "relative date requires a reference clock and timezone"),
        ("Schedule 31 February 2026", _CONTEXT, "impossible date"),
        ("Add a reminder for Alice or Bob on 2026-12-01", _CONTEXT, "ambiguous recipient"),
    ],
)
def test_unsafe_instructions_do_not_return_a_plan(instruction, context, reason):
    with pytest.raises(PlannerError) as caught:
        generate(instruction, context)
    assert reason in caught.value.reasons


def test_unknown_action_fails_before_a_plan_is_returned():
    raw = _plan(
        {
            "id": "bad",
            "action": "execute_shell",
            "application": "student_portal",
            "depends_on": [],
            "risk_tier": "T0",
        }
    )
    with pytest.raises(PlannerError, match="unknown action"):
        generate("Create a calendar reminder for my assignment", _CONTEXT, model=_ScriptedModel(raw))


def test_cyclic_model_json_fails():
    raw = _plan(
        {
            "id": "a",
            "action": "read_deadline",
            "application": "student_portal",
            "depends_on": ["b"],
            "risk_tier": "T0",
        },
        {
            "id": "b",
            "action": "read_deadline",
            "application": "student_portal",
            "depends_on": ["a"],
            "risk_tier": "T0",
        },
    )
    with pytest.raises(PlannerError, match="cyclic plan"):
        generate("Create a calendar reminder for my assignment", _CONTEXT, model=_ScriptedModel(raw))


def test_malformed_model_json_fails():
    with pytest.raises(PlannerError, match="malformed model JSON"):
        generate("Create a calendar reminder for my assignment", _CONTEXT, model=_ScriptedModel("{"))


def test_step_and_retry_limits_fail():
    too_many = _plan(
        *[
            {
                "id": f"s{index}",
                "action": "read_deadline",
                "application": "student_portal",
                "depends_on": [],
                "risk_tier": "T0",
            }
            for index in range(9)
        ]
    )
    with pytest.raises(PlannerError, match="too many steps"):
        generate("Create a calendar reminder for my assignment", _CONTEXT, model=_ScriptedModel(too_many))
    retry = _plan(
        {
            "id": "read-deadline",
            "action": "read_deadline",
            "application": "student_portal",
            "depends_on": [],
            "risk_tier": "T0",
            "retries": 3,
        }
    )
    with pytest.raises(PlannerError, match="retry limit exceeded"):
        generate("Create a calendar reminder for my assignment", _CONTEXT, model=_ScriptedModel(retry))


def test_live_provider_is_not_called(monkeypatch):
    monkeypatch.setenv("MODEL_MODE", "cloud")
    with pytest.raises(PlannerError, match="live model is not wired"):
        generate("Create a calendar reminder for my assignment", _CONTEXT)
