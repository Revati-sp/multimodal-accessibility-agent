"""Normalize a date, clock time, timezone, and remind-offset.

Relative wording such as a weekday resolves only when the caller passes both
a reference clock and a timezone. Impossible calendar dates and two named
recipients are errors. This module does not pick a value in those cases.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

_WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}
_MONTHS = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sept": 9, "sep": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}
_MAX_DAY = {1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}
_MONTH = (
    "january|february|march|april|may|june|july|august|september|october|november|december|"
    "jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec"
)
_ISO = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
_MDY = re.compile(rf"\b({_MONTH})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:\s+(\d{{4}}))?\b")
_DMY = re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({_MONTH})(?:\s+(\d{{4}}))?\b")
_WEEKDAY = re.compile(
    r"\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b"
)
_AMPM = re.compile(r"\b(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?m\.?\b")
_HHMM = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")
_OFFSET = re.compile(r"\b(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs|day|days)\s+before\b")
_RECIPIENT = re.compile(
    r"\b(?:for|to|email|notify|remind)\s+([A-Za-z][A-Za-z'-]+)\s+or\s+([A-Za-z][A-Za-z'-]+)\b"
)
_NOT_RECIPIENT = set(_WEEKDAYS) | set(_MONTHS) | {"today", "tomorrow", "next", "the", "a", "my"}

_RELATIVE_CLOCK = "relative date requires a reference clock and timezone"


@dataclass(frozen=True)
class DateResolution:
    ok: bool
    date: date | None = None
    time: time | None = None
    timezone: str | None = None
    remind_offset_minutes: int | None = None
    recipients: tuple[str, ...] = ()
    errors: tuple[str, ...] = ()


def resolve_when(
    text: str,
    *,
    clock: datetime | None = None,
    timezone: str | None = None,
) -> DateResolution:
    if not isinstance(text, str) or not text.strip():
        return DateResolution(ok=False, errors=("empty text",))
    normalized = _normalize(text)
    errors: list[str] = []
    recipients = _recipients(text)
    if len(recipients) > 1:
        errors.append("ambiguous recipient")
    offset = _remind_offset(normalized, errors)
    clock_time = _clock_time(normalized, errors)
    zone_ok = _timezone_ok(timezone, errors)
    resolved, saw_absolute, saw_relative = _calendar_date(normalized, clock, timezone, zone_ok, errors)
    if clock_time is not None and resolved is None and saw_absolute is False and saw_relative is False:
        if clock is not None and zone_ok and timezone is not None and "impossible time" not in errors:
            resolved = _local_date(clock, timezone)
        elif _RELATIVE_CLOCK not in errors and "invalid timezone" not in errors:
            errors.append("time requires a reference clock and timezone")
    unique: list[str] = []
    for error in errors:
        if error not in unique:
            unique.append(error)
    return DateResolution(
        ok=not unique,
        date=resolved,
        time=clock_time,
        timezone=timezone if zone_ok else None,
        remind_offset_minutes=offset,
        recipients=recipients,
        errors=tuple(unique),
    )


def _normalize(text: str) -> str:
    cleaned = []
    for char in text.strip().lower():
        if char.isalnum() or char in {":", "-", " "}:
            cleaned.append(char)
        else:
            cleaned.append(" ")
    return " ".join("".join(cleaned).split())


def _timezone_ok(timezone: str | None, errors: list[str]) -> bool:
    if timezone is None:
        return False
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        errors.append("invalid timezone")
        return False
    return True


def _local_date(clock: datetime, timezone: str) -> date:
    zone = ZoneInfo(timezone)
    aware = clock.replace(tzinfo=zone) if clock.tzinfo is None else clock.astimezone(zone)
    return aware.date()


def _recipients(text: str) -> tuple[str, ...]:
    match = _RECIPIENT.search(text)
    if match is None:
        return ()
    left, right = match.group(1), match.group(2)
    if left.lower() in _NOT_RECIPIENT or right.lower() in _NOT_RECIPIENT:
        return ()
    return (left, right)


def _remind_offset(normalized: str, errors: list[str]) -> int | None:
    matches = list(_OFFSET.finditer(normalized))
    if not matches:
        return None
    if len(matches) > 1:
        errors.append("ambiguous remind offset")
        return None
    amount = int(matches[0].group(1))
    unit = matches[0].group(2)
    if unit.startswith("min"):
        return amount
    if unit.startswith("h"):
        return amount * 60
    return amount * 24 * 60


def _clock_time(normalized: str, errors: list[str]) -> time | None:
    ampm = list(_AMPM.finditer(normalized))
    if len(ampm) > 1:
        errors.append("ambiguous time")
        return None
    if len(ampm) == 1:
        hour = int(ampm[0].group(1))
        minute = int(ampm[0].group(2) or 0)
        if hour < 1 or hour > 12:
            errors.append("impossible time")
            return None
        if ampm[0].group(3) == "p" and hour != 12:
            hour += 12
        if ampm[0].group(3) == "a" and hour == 12:
            hour = 0
        return time(hour, minute)
    hours = list(_HHMM.finditer(normalized))
    if len(hours) > 1:
        errors.append("ambiguous time")
        return None
    if len(hours) == 1:
        return time(int(hours[0].group(1)), int(hours[0].group(2)))
    return None


def _calendar_date(
    normalized: str,
    clock: datetime | None,
    timezone: str | None,
    zone_ok: bool,
    errors: list[str],
) -> tuple[date | None, bool, bool]:
    absolute = _absolute_candidates(normalized)
    relative = _relative_markers(normalized)
    saw_absolute = bool(absolute)
    saw_relative = bool(relative)
    if saw_absolute and saw_relative:
        errors.append("ambiguous date")
        return None, True, True
    if len(absolute) > 1 or len(relative) > 1:
        errors.append("ambiguous date")
        return None, saw_absolute, saw_relative
    if saw_absolute:
        return _build_absolute(absolute[0], clock, timezone, zone_ok, errors), True, False
    if saw_relative:
        return _build_relative(relative[0], clock, timezone, zone_ok, errors), False, True
    return None, False, False


def _absolute_candidates(normalized: str) -> list[tuple[int, int, int | None]]:
    found: list[tuple[int, int, int, int | None]] = []
    for match in _ISO.finditer(normalized):
        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
        found.append((match.start(), day, month, year))
    for match in _MDY.finditer(normalized):
        if _overlaps(match.start(), match.end(), found):
            continue
        found.append((match.start(), int(match.group(2)), _MONTHS[match.group(1)], _year(match.group(3))))
    for match in _DMY.finditer(normalized):
        if _overlaps(match.start(), match.end(), found):
            continue
        found.append((match.start(), int(match.group(1)), _MONTHS[match.group(2)], _year(match.group(3))))
    found.sort(key=lambda item: item[0])
    return [(day, month, year) for _, day, month, year in found]


def _overlaps(start: int, end: int, found: list[tuple[int, int, int, int | None]]) -> bool:
    for existing, *_rest in found:
        if abs(existing - start) < 2 or (start <= existing < end):
            return True
    return False


def _year(raw: str | None) -> int | None:
    return int(raw) if raw else None


def _build_absolute(
    parts: tuple[int, int, int | None],
    clock: datetime | None,
    timezone: str | None,
    zone_ok: bool,
    errors: list[str],
) -> date | None:
    day, month, year = parts
    if month < 1 or month > 12 or day < 1 or day > _MAX_DAY.get(month, 0):
        errors.append("impossible date")
        return None
    if year is None:
        if clock is None or not zone_ok or timezone is None:
            errors.append(_RELATIVE_CLOCK)
            return None
        year = _local_date(clock, timezone).year
    try:
        return date(year, month, day)
    except ValueError:
        errors.append("impossible date")
        return None


def _relative_markers(normalized: str) -> list[tuple[str, str | None]]:
    markers: list[tuple[str, str | None]] = []
    if re.search(r"\btoday\b", normalized):
        markers.append(("today", None))
    if re.search(r"\btomorrow\b", normalized):
        markers.append(("tomorrow", None))
    for match in _WEEKDAY.finditer(normalized):
        markers.append(("weekday", f"{match.group(1) or ''}{match.group(2)}".strip()))
    return markers


def _build_relative(
    marker: tuple[str, str | None],
    clock: datetime | None,
    timezone: str | None,
    zone_ok: bool,
    errors: list[str],
) -> date | None:
    if clock is None or not zone_ok or timezone is None:
        errors.append(_RELATIVE_CLOCK)
        return None
    local = _local_date(clock, timezone)
    kind, name = marker
    if kind == "today":
        return local
    if kind == "tomorrow":
        return local + timedelta(days=1)
    assert name is not None
    skip_today = name.startswith("next ")
    weekday = _WEEKDAYS[name.split()[-1]]
    delta = (weekday - local.weekday()) % 7
    if delta == 0 and skip_today:
        delta = 7
    return local + timedelta(days=delta)
