"""Transcript adapter for tests.

Accepts a prepared transcript string. A live recognizer such as faster-whisper
is not imported here; unit tests must run without a model.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Transcript:
    text: str
    source: str = "mock"


def transcribe(transcript: str) -> Transcript:
    if not isinstance(transcript, str) or not transcript.strip():
        raise ValueError("transcript must be a non-empty string")
    return Transcript(text=transcript.strip(), source="mock")
