"""AccessPilot v1 frozen cross-team contracts. Do not change without team approval."""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import uuid4
from pydantic import BaseModel, Field, model_validator

SCHEMA_VERSION = "1.0.0"

class TaskStatus(str, Enum):
    CREATED='CREATED'; PLANNING='PLANNING'; READY='READY'; EXECUTING='EXECUTING'
    VERIFYING='VERIFYING'; AWAITING_APPROVAL='AWAITING_APPROVAL'; PAUSED='PAUSED'
    RECOVERING='RECOVERING'; COMPLETED='COMPLETED'; ESCALATED='ESCALATED'
    FAILED='FAILED'; CANCELLED='CANCELLED'

class StepStatus(str, Enum):
    PENDING='PENDING'; RUNNING='RUNNING'; VERIFIED='VERIFIED'; FAILED='FAILED'
    UNCERTAIN='UNCERTAIN'; INVALIDATED='INVALIDATED'; BLOCKED='BLOCKED'

class RiskTier(str, Enum):
    T0='T0'; T1='T1'; T2='T2'; T3='T3'

class TaskCreate(BaseModel):
    instruction: str=Field(min_length=1,max_length=4000)
    timezone: str='America/Los_Angeles'
    mode: Literal['mock','live']='mock'

class TaskStep(BaseModel):
    id: str
    plan_version: int=Field(ge=1)
    action: Literal['read_deadline','create_calendar_event','update_calendar_event','read_calendar_event','verify_calendar_event']
    application: Literal['student_portal','google_calendar','mock_calendar']
    arguments: dict[str,Any]=Field(default_factory=dict)
    depends_on: list[str]=Field(default_factory=list)
    risk_tier: RiskTier=RiskTier.T0
    status: StepStatus=StepStatus.PENDING

class Plan(BaseModel):
    task_id: str
    goal: str
    version: int=Field(ge=1)
    steps: list[TaskStep]
    @model_validator(mode='after')
    def validate_graph(self):
        ids=[s.id for s in self.steps]
        if len(ids)!=len(set(ids)):
            raise ValueError('duplicate step ids')
        graph={s.id:set(s.depends_on) for s in self.steps}
        for sid,deps in graph.items():
            if not deps.issubset(graph) or sid in deps: raise ValueError('invalid dependency')
        seen=set(); active=set()
        def visit(node):
            if node in active: raise ValueError('cyclic plan')
            if node in seen: return
            active.add(node)
            for parent in graph[node]: visit(parent)
            active.remove(node);seen.add(node)
        for node in graph:visit(node)
        return self

class ExecutionRequest(BaseModel):
    task_id: str
    step: TaskStep
    idempotency_key: str=Field(min_length=8)
    approved: bool=False

class ExecutionResult(BaseModel):
    task_id: str
    step_id: str
    plan_version: int
    route: Literal['API','DOM','GUI']
    outcome: Literal['SUCCESS','FAILED','UNCERTAIN']
    idempotency_key: str
    external_id: str|None=None
    evidence: dict[str,Any]=Field(default_factory=dict)

class VerificationResult(BaseModel):
    task_id: str
    step_id: str
    status: Literal['VERIFIED','ABSENT','UNKNOWN']
    evidence: dict[str,Any]=Field(default_factory=dict)

class TaskEvent(BaseModel):
    schema_version: Literal['1.0.0']='1.0.0'
    event_id: str=Field(default_factory=lambda:str(uuid4()))
    task_id: str
    plan_version: int=Field(ge=1)
    kind: Literal['task.created','task.updated','step.ready','step.executed','step.uncertain','step.verified','task.interrupted','task.completed','approval.requested']
    created_at: datetime=Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: dict[str,Any]=Field(default_factory=dict)

class InterruptRequest(BaseModel):
    kind: Literal['PAUSE','RESUME','STOP','STATUS','CORRECT']
    instruction: str|None=None
    @model_validator(mode='after')
    def correction_instruction(self):
        if self.kind=='CORRECT' and not self.instruction:raise ValueError('CORRECT requires instruction')
        return self

class ApprovalRequest(BaseModel):
    approved: bool
    plan_version: int=Field(ge=1)
    confirmation_text: str|None=None

class TaskView(BaseModel):
    task_id: str
    instruction: str
    status: TaskStatus
    plan: Plan
    journal: list[dict[str,Any]]=Field(default_factory=list)
