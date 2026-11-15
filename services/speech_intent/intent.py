"""Mock intent/ASR adapter. Ramya replaces while preserving public contract."""
from dataclasses import dataclass
@dataclass(frozen=True)
class ParsedIntent:
    kind: str
    instruction: str

def parse_text(value:str)->ParsedIntent:
    s=value.strip().lower()
    if s in ('pause','stop','resume','what happened','status'):
        return ParsedIntent('STATUS' if s in ('what happened','status') else s.upper(),value)
    if s.startswith(('actually','change ','instead ')):
        return ParsedIntent('CORRECT',value)
    return ParsedIntent('CREATE_TASK',value)
