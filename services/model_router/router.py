"""Provider-neutral scaffold. Mock is the only ready provider; live is intentionally disabled."""
import os
from dataclasses import dataclass

@dataclass(frozen=True)
class ModelDecision:
    provider: str
    model: str
    reason: str

def choose_provider(role: str, *, sensitive: bool=False, network: bool=True)->ModelDecision:
    if role in ('intent','interrupt'):
        return ModelDecision('mock' if os.getenv('MODEL_MODE','mock')=='mock' else 'ollama',os.getenv('LOCAL_MODEL','qwen2.5:3b'),'bounded control task')
    if sensitive or not network:
        return ModelDecision('mock' if os.getenv('MODEL_MODE','mock')=='mock' else 'ollama',os.getenv('LOCAL_MODEL','qwen2.5:3b'),'cloud disallowed: local or fail closed')
    return ModelDecision('mock' if os.getenv('MODEL_MODE','mock')=='mock' else 'cloud',os.getenv('CLOUD_MODEL','unselected'),'complex planning; provider evaluation pending')
