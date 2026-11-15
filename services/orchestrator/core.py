"""Deterministic mock orchestrator. Does not claim to be a real LLM agent."""
from uuid import uuid4
from shared.schemas import Plan, TaskStep, TaskStatus, StepStatus, TaskView, RiskTier

class MemoryTaskStore:
    def __init__(self): self.records={}
    def create(self,instruction):
        tid=str(uuid4())
        steps=[TaskStep(id='read-deadline',plan_version=1,action='read_deadline',application='student_portal',risk_tier=RiskTier.T0),
               TaskStep(id='create-event',plan_version=1,action='create_calendar_event',application='mock_calendar',depends_on=['read-deadline'],risk_tier=RiskTier.T1),
               TaskStep(id='verify-event',plan_version=1,action='verify_calendar_event',application='mock_calendar',depends_on=['create-event'],risk_tier=RiskTier.T0)]
        v=TaskView(task_id=tid,instruction=instruction,status=TaskStatus.CREATED,plan=Plan(task_id=tid,goal=instruction,version=1,steps=steps),journal=[{'kind':'task.created','message':'Mock plan created; no external action executed'}]);self.records[tid]=v;return v
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
