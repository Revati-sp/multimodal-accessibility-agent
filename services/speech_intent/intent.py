"""Classify text as a new task or as control of an existing task.

Control labels stay on the active task. The same words with no active task
are not turned into a new task. Conversational speech during a task is not
treated as either.
"""

from dataclasses import dataclass

_EXACT = {
    "pause": "PAUSE",
    "hold on": "PAUSE",
    "resume": "RESUME",
    "continue": "RESUME",
    "go ahead": "RESUME",
    "stop": "STOP",
    "cancel": "STOP",
    "never mind": "STOP",
    "status": "STATUS",
    "what happened": "STATUS",
    "what is happening": "STATUS",
    "what is the status": "STATUS",
    "approve": "APPROVE",
    "approved": "APPROVE",
    "confirm": "APPROVE",
    "confirmed": "APPROVE",
    "i approve": "APPROVE",
    "reject": "REJECT",
    "rejected": "REJECT",
    "i reject": "REJECT",
    "deny": "REJECT",
    "denied": "REJECT",
    "do not approve": "REJECT",
    "correct": "CORRECT",
    "change": "CORRECT",
    "instead": "CORRECT",
    "actually": "CORRECT",
}

# Longer prefixes first so "do not approve" is not read as approval.
_PREFIXES = (
    ("do not approve", "REJECT"),
    ("reject", "REJECT"),
    ("approve", "APPROVE"),
    ("what happened", "STATUS"),
    ("what is happening", "STATUS"),
    ("what is the status", "STATUS"),
    ("hold on", "PAUSE"),
    ("never mind", "STOP"),
    ("go ahead", "RESUME"),
    ("pause", "PAUSE"),
    ("resume", "RESUME"),
    ("continue", "RESUME"),
    ("stop", "STOP"),
    ("cancel", "STOP"),
    ("status", "STATUS"),
    ("actually", "CORRECT"),
    ("instead", "CORRECT"),
    ("change", "CORRECT"),
    ("correct", "CORRECT"),
)

_POLITE = ("please ", "can you ", "could you ", "would you ")
_TASK_WORDS = {"create", "add", "remind", "schedule", "set", "book", "make", "put"}


@dataclass(frozen=True)
class ParsedIntent:
    kind: str
    instruction: str
    task_id: str | None = None
    bound: bool = True


def parse_text(value: str, *, active_task_id: str | None = None) -> ParsedIntent:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("instruction must be a non-empty string")
    normalized = _normalize(value)
    kind = _classify(normalized)
    if kind is None:
        words = set(normalized.split())
        if active_task_id and words.isdisjoint(_TASK_WORDS):
            return ParsedIntent("CONVERSATION", value, task_id=active_task_id, bound=True)
        return ParsedIntent("CREATE_TASK", value, task_id=None, bound=True)
    if active_task_id:
        return ParsedIntent(kind, value, task_id=active_task_id, bound=True)
    return ParsedIntent(kind, value, task_id=None, bound=False)


def _normalize(value: str) -> str:
    text = value.strip().lower().replace("\u2019", "'")
    text = text.replace("what's", "what is").replace("whats", "what is")
    text = text.replace("don't", "do not").replace("dont", "do not")
    cleaned = []
    for char in text:
        if char.isalnum() or char in {"'", " ", "-"}:
            cleaned.append(char)
        else:
            cleaned.append(" ")
    return " ".join("".join(cleaned).split())


def _classify(normalized: str) -> str | None:
    candidate = normalized
    for polite in _POLITE:
        if candidate.startswith(polite):
            candidate = candidate[len(polite):]
            break
    if candidate in _EXACT:
        return _EXACT[candidate]
    for prefix, kind in _PREFIXES:
        if candidate.startswith(prefix + " "):
            return kind
    return None
