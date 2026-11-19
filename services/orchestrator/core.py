"""Deterministic mock orchestrator. Does not claim to be a real LLM agent."""
from uuid import uuid4
from services.orchestrator.planner import generate
from services.speech_intent.dates import resolve_when
from shared.schemas import Plan, TaskStatus, StepStatus, TaskView

_TERMINAL = frozenset({TaskStatus.COMPLETED, TaskStatus.CANCELLED})
_WRITE_ACTIONS = frozenset({"create_calendar_event", "update_calendar_event"})

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
    def interrupt(self, tid, kind, instruction=None, *, clock=None, timezone=None, reconcile=None):
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
            _correct(obj, tid, instruction, clock=clock, timezone=timezone, reconcile=reconcile or _no_reconcile)
        _journal(obj, kind)
        return obj

def _no_reconcile(task_id, step, plan_version):
    return None

def _journal(task, kind):
    task.journal.append({'kind':'task.interrupted','action':kind,'plan_version':task.plan.version})

def _correct(task, task_id, instruction, *, clock, timezone, reconcile):
    """A clock and timezone select the affected steps. Without both, do not guess a date."""
    invalidate=set()
    schedule=None
    reset_unverified=True
    if clock is not None and timezone is not None:
        resolution=resolve_when(instruction, clock=clock, timezone=timezone)
        if not resolution.ok:
            raise ValueError('invalid transition')
        schedule=_schedule_change(resolution)
        if schedule:
            reset_unverified=False
            for step in task.plan.steps:
                if step.action in _WRITE_ACTIONS and _arguments_differ(step.arguments, schedule):
                    invalidate.add(step.id)
            invalidate=_with_descendants(task.plan.steps, invalidate)
            for step in task.plan.steps:
                if step.id in invalidate and step.action in _WRITE_ACTIONS and step.status==StepStatus.VERIFIED:
                    reconcile(task_id, step, task.plan.version)
    _replace_plan(task, task_id, instruction, invalidate=invalidate, schedule=schedule, reset_unverified=reset_unverified)

def _schedule_change(resolution):
    fields={}
    if resolution.date is not None:
        fields["date"]=resolution.date.isoformat()
    if resolution.time is not None:
        fields["time"]=resolution.time.strftime("%H:%M")
    if resolution.remind_offset_minutes is not None:
        fields["remind_offset_minutes"]=resolution.remind_offset_minutes
    if fields and resolution.timezone is not None:
        fields["timezone"]=resolution.timezone
    return fields

def _arguments_differ(arguments, schedule):
    return any(arguments.get(key)!=value for key, value in schedule.items())

def _with_descendants(steps, seeds):
    affected=set(seeds)
    changed=True
    while changed:
        changed=False
        for step in steps:
            if step.id in affected:
                continue
            if any(dep in affected for dep in step.depends_on):
                affected.add(step.id)
                changed=True
    return affected

def _replace_plan(task, task_id, instruction, *, invalidate, schedule, reset_unverified):
    version=task.plan.version+1
    steps=[]
    for step in task.plan.steps:
        arguments=dict(step.arguments)
        if step.id in invalidate:
            status=StepStatus.INVALIDATED
            if schedule and step.action in _WRITE_ACTIONS:
                arguments.update(schedule)
        elif reset_unverified and step.status!=StepStatus.VERIFIED:
            status=StepStatus.PENDING
        else:
            status=step.status
        steps.append(step.model_copy(update={"plan_version": version, "status": status, "arguments": arguments}))
    task.plan=Plan(task_id=task_id, goal=instruction, version=version, steps=steps)
    task.status=TaskStatus.PAUSED
