"""Intent, date, and transcript tests. No model, network, or database."""

from datetime import date, datetime, time
import inspect
import sys
from zoneinfo import ZoneInfo

import pytest

from services.speech_intent.asr import transcribe
from services.speech_intent.dates import resolve_when
from services.speech_intent.intent import parse_text

_CLOCK = datetime(2026, 11, 17, 15, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
_ZONE = "America/Los_Angeles"


@pytest.mark.parametrize(
    ("text", "kind"),
    [
        ("Create a calendar reminder for my assignment", "CREATE_TASK"),
        ("pause", "PAUSE"),
        ("please resume", "RESUME"),
        ("stop", "STOP"),
        ("what happened?", "STATUS"),
        ("status", "STATUS"),
        ("Actually change it to Thursday", "CORRECT"),
        ("approve", "APPROVE"),
        ("do not approve", "REJECT"),
        ("reject", "REJECT"),
    ],
)
def test_classifies_task_and_control_labels(text, kind):
    parsed = parse_text(text, active_task_id="task-1")
    assert parsed.kind == kind
    assert parsed.instruction == text
    if kind == "CREATE_TASK":
        assert parsed.task_id is None
        assert parsed.bound is True
    else:
        assert parsed.task_id == "task-1"
        assert parsed.bound is True


def test_active_task_keeps_pause_and_status():
    paused = parse_text("pause", active_task_id="task-9")
    happened = parse_text("what happened", active_task_id="task-9")
    assert paused.kind == "PAUSE" and paused.task_id == "task-9" and paused.bound is True
    assert happened.kind == "STATUS" and happened.task_id == "task-9" and happened.bound is True


@pytest.mark.parametrize("text", ["pause", "what happened", "resume", "stop", "approve", "reject"])
def test_control_without_a_task_does_not_create_one(text):
    parsed = parse_text(text)
    assert parsed.kind != "CREATE_TASK"
    assert parsed.task_id is None
    assert parsed.bound is False


def test_conversation_during_a_task_is_not_a_new_task_or_a_control():
    parsed = parse_text("thanks", active_task_id="task-1")
    assert parsed.kind == "CONVERSATION"
    assert parsed.task_id == "task-1"
    assert parsed.kind != "CREATE_TASK"


def test_thursday_requires_a_clock_and_timezone():
    missing = [
        resolve_when("Remind me on Thursday"),
        resolve_when("Remind me on Thursday", clock=_CLOCK, timezone=None),
        resolve_when("Remind me on Thursday", clock=None, timezone=_ZONE),
    ]
    for result in missing:
        assert result.ok is False
        assert result.date is None
        assert "relative date requires a reference clock and timezone" in result.errors


def test_thursday_resolves_from_the_reference_clock():
    result = resolve_when(
        "Remind me 30 minutes before Thursday at 4 pm",
        clock=_CLOCK,
        timezone=_ZONE,
    )
    assert result.ok is True
    assert result.errors == ()
    assert result.date == date(2026, 11, 19)
    assert result.time == time(16, 0)
    assert result.timezone == _ZONE
    assert result.remind_offset_minutes == 30


@pytest.mark.parametrize("text", ["Schedule 31 February 2026", "Schedule February 31, 2026", "Schedule 2026-02-31"])
def test_impossible_date_is_an_error(text):
    result = resolve_when(text, clock=_CLOCK, timezone=_ZONE)
    assert result.ok is False
    assert result.date is None
    assert "impossible date" in result.errors


def test_two_recipients_are_not_guessed():
    result = resolve_when("Add a reminder for Alice or Bob on 2026-12-01", clock=_CLOCK, timezone=_ZONE)
    assert result.ok is False
    assert result.recipients == ("Alice", "Bob")
    assert "ambiguous recipient" in result.errors
    assert result.date == date(2026, 12, 1)


def test_transcribe_accepts_a_string_and_feeds_the_parser():
    heard = transcribe("  what happened  ")
    parsed = parse_text(heard.text)
    assert heard.source == "mock"
    assert heard.text == "what happened"
    assert parsed.kind == "STATUS"
    assert parsed.bound is False


def test_empty_transcript_is_rejected():
    with pytest.raises(ValueError):
        transcribe("   ")


def test_asr_does_not_import_faster_whisper():
    import services.speech_intent.asr as asr

    assert "faster_whisper" not in sys.modules
    assert "faster_whisper" not in inspect.getsource(asr)
