"""Task creation goes through the planner. A rejected plan is not stored."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from services.orchestrator.core import MemoryTaskStore
from services.orchestrator.planner import PlannerError

_CLOCK = datetime(2026, 11, 17, 15, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
_ZONE = "America/Los_Angeles"


def test_create_uses_the_planner_step_ids():
    store = MemoryTaskStore()
    view = store.create("Create a calendar reminder for my assignment")
    assert store.get(view.task_id) is view
    assert [step.id for step in view.plan.steps] == ["read-deadline", "create-event", "verify-event"]
    assert view.plan.steps[1].depends_on == ["read-deadline"]
    assert view.journal[0]["kind"] == "task.created"


def test_create_stores_a_resolved_thursday_when_clock_and_timezone_are_given():
    store = MemoryTaskStore()
    view = store.create(
        "Remind me 30 minutes before Thursday at 4 pm",
        clock=_CLOCK,
        timezone=_ZONE,
    )
    assert view.plan.steps[1].arguments == {
        "date": "2026-11-19",
        "time": "16:00",
        "timezone": _ZONE,
        "remind_offset_minutes": 30,
    }


def test_rejected_plan_is_not_stored():
    store = MemoryTaskStore()
    with pytest.raises(PlannerError, match="cannot build a plan"):
        store.create("Remind me on Thursday")
    assert store.records == {}


def test_clock_and_timezone_are_omitted_unless_the_caller_supplies_them():
    store = MemoryTaskStore()
    with pytest.raises(PlannerError):
        store.create("Remind me on Thursday", timezone=_ZONE)
    with pytest.raises(PlannerError):
        store.create("Remind me on Thursday", clock=_CLOCK)
    assert store.records == {}
