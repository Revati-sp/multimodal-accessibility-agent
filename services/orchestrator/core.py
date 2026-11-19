"""Deterministic mock orchestrator. Does not claim to be a real LLM agent."""
from uuid import uuid4
from services.orchestrator.planner import generate
from shared.schemas import Plan, TaskStatus, StepStatus, TaskView

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
        if kind=='PAUSE' and obj.status not in (TaskStatus.COMPLETED,TaskStatus.CANCELLED):obj.status=TaskStatus.PAUSED
        elif kind=='RESUME' and obj.status==TaskStatus.PAUSED:obj.status=TaskStatus.READY
        elif kind=='STOP' and obj.status not in (TaskStatus.COMPLETED,TaskStatus.CANCELLED):obj.status=TaskStatus.CANCELLED
        elif kind=='CORRECT':
            if obj.status in (TaskStatus.COMPLETED,TaskStatus.CANCELLED):raise ValueError('cannot correct terminal task')
            v=obj.plan.version+1
            obj.plan=Plan(task_id=tid,goal=instruction,version=v,steps=[step.model_copy(update={'plan_version':v,'status':StepStatus.PENDING if step.status!=StepStatus.VERIFIED else StepStatus.VERIFIED}) for step in obj.plan.steps]);obj.status=TaskStatus.PAUSED
        elif kind!='STATUS':raise ValueError('invalid transition')
        obj.journal.append({'kind':'task.interrupted','action':kind,'plan_version':obj.plan.version})
        return obj
