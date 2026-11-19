"""Task creation goes through the planner. A rejected plan is not stored."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from services.orchestrator.core import MemoryTaskStore
from services.orchestrator.planner import PlannerError
from services.orchestrator.summary import summarize
from shared.schemas import StepStatus, TaskStatus

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


def test_pause_resume_stop_and_correct_follow_the_transition_table():
    store = MemoryTaskStore()
    view = store.create("Create a calendar reminder for my assignment")
    assert len(view.journal) == 1

    paused = store.interrupt(view.task_id, "PAUSE")
    assert paused.status == TaskStatus.PAUSED
    assert paused.journal[-1] == {"kind": "task.interrupted", "action": "PAUSE", "plan_version": 1}

    corrected = store.interrupt(view.task_id, "CORRECT", "Actually Thursday")
    assert corrected.status == TaskStatus.PAUSED
    assert corrected.plan.version == 2
    assert corrected.journal[-1]["action"] == "CORRECT"
    assert corrected.journal[-1]["plan_version"] == 2

    resumed = store.interrupt(view.task_id, "RESUME")
    assert resumed.status == TaskStatus.READY
    assert len(resumed.journal) == 4

    stopped = store.interrupt(view.task_id, "STOP")
    assert stopped.status == TaskStatus.CANCELLED
    assert stopped.journal[-1]["action"] == "STOP"


def test_resume_is_only_legal_from_paused():
    store = MemoryTaskStore()
    view = store.create("Create a calendar reminder for my assignment")
    before = len(view.journal)
    with pytest.raises(ValueError, match="invalid transition"):
        store.interrupt(view.task_id, "RESUME")
    assert view.status == TaskStatus.CREATED
    assert len(view.journal) == before


def test_terminal_tasks_accept_only_status():
    store = MemoryTaskStore()
    view = store.create("Create a calendar reminder for my assignment")
    store.interrupt(view.task_id, "STOP")
    before = len(view.journal)
    for kind in ("PAUSE", "RESUME", "STOP", "CORRECT"):
        with pytest.raises(ValueError, match="invalid transition"):
            store.interrupt(view.task_id, kind, "change it")
    assert view.status == TaskStatus.CANCELLED
    assert len(view.journal) == before
    status = store.interrupt(view.task_id, "STATUS")
    assert status.status == TaskStatus.CANCELLED
    assert status.plan.version == 1
    assert status.journal[-1]["action"] == "STATUS"


def test_rejected_control_does_not_append_a_journal_entry():
    store = MemoryTaskStore()
    view = store.create("Create a calendar reminder for my assignment")
    before = list(view.journal)
    with pytest.raises(ValueError, match="invalid transition"):
        store.interrupt(view.task_id, "NOPE")
    assert view.journal == before


def test_summary_is_grounded_in_the_record_and_does_not_claim_done():
    store = MemoryTaskStore()
    view = store.create("Create a calendar reminder for my assignment")
    store.interrupt(view.task_id, "PAUSE")
    report = summarize(view)
    assert report["task_id"] == view.task_id
    assert report["status"] == TaskStatus.PAUSED
    assert report["plan_version"] == 1
    text = report["summary"]
    assert "PAUSED" in text
    assert "Plan version 1" in text
    assert "task.interrupted" in text
    assert "PAUSE" in text
    assert "The task is not done." in text

    view.status = TaskStatus.COMPLETED
    assert "The task is not done." in summarize(view)["summary"]
    assert "No step is verified." in summarize(view)["summary"]

    for step in view.plan.steps:
        step.status = StepStatus.VERIFIED
    done = summarize(view)["summary"]
    assert "The task is done." in done
    assert "read-deadline" in done
    assert "Plan version 1" in done


def test_clock_and_timezone_are_omitted_unless_the_caller_supplies_them():
    store = MemoryTaskStore()
    with pytest.raises(PlannerError):
        store.create("Remind me on Thursday", timezone=_ZONE)
    with pytest.raises(PlannerError):
        store.create("Remind me on Thursday", clock=_CLOCK)
    assert store.records == {}
