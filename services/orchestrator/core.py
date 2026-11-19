"""Deterministic mock orchestrator. Does not claim to be a real LLM agent."""
from uuid import uuid4
from services.orchestrator.planner import generate
from shared.schemas import Plan, TaskStatus, StepStatus, TaskView

_TERMINAL = frozenset({TaskStatus.COMPLETED, TaskStatus.CANCELLED})

class MemoryTaskStore:
    def __init__(self): self.records={}
    def create(self, instruction, *, clock=None, timezone=None):
        tid=str(uuid4())
        context={"task_id": tid}
        if clock is not None:
            context["clock"]=clock
        if timezone is not None:
            context["timezone"]=timezone
        plan=generate(instruction, context)
        view=TaskView(task_id=tid,instruction=instruction,status=TaskStatus.CREATED,plan=plan,journal=[{"kind":"task.created","message":"Mock plan created; no external action executed"}])
        self.records[tid]=view
        return view
    def get(self,tid):return self.records.get(tid)
    def interrupt(self,tid,kind,instruction=None):
        obj=self.records[tid]
        if kind=='STATUS':
            _journal(obj, kind)
            return obj
        if obj.status in _TERMINAL or kind not in {'PAUSE','RESUME','STOP','CORRECT'}:
            raise ValueError('invalid transition')
        if kind=='PAUSE':
            obj.status=TaskStatus.PAUSED
        elif kind=='RESUME':
            if obj.status!=TaskStatus.PAUSED:
                raise ValueError('invalid transition')
            obj.status=TaskStatus.READY
        elif kind=='STOP':
            obj.status=TaskStatus.CANCELLED
        else:
            if not instruction or not str(instruction).strip():
                raise ValueError('invalid transition')
            version=obj.plan.version+1
            obj.plan=Plan(
                task_id=tid,
                goal=instruction,
                version=version,
                steps=[step.model_copy(update={'plan_version':version,'status':StepStatus.PENDING if step.status!=StepStatus.VERIFIED else StepStatus.VERIFIED}) for step in obj.plan.steps],
            )
            obj.status=TaskStatus.PAUSED
        _journal(obj, kind)
        return obj

def _journal(task, kind):
    task.journal.append({'kind':'task.interrupted','action':kind,'plan_version':task.plan.version})
