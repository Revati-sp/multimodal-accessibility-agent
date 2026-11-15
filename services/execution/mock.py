"""Explicit mock side-effect store. Not a Google Calendar integration."""
from uuid import uuid4
from shared.schemas import ExecutionResult, VerificationResult

class MockCalendar:
    def __init__(self):self.events={};self.keys={}
    def create(self,request, *,timeout_after_save=False):
        if request.step.risk_tier.value in ('T2','T3') and not request.approved:raise PermissionError('approval required')
        key=request.idempotency_key
        if key in self.keys: eid=self.keys[key]
        else:
            eid=str(uuid4());self.keys[key]=eid;self.events[eid]={'title':request.step.arguments.get('title','Assignment deadline'),'date':request.step.arguments.get('date','2026-12-01')}
        return ExecutionResult(task_id=request.task_id,step_id=request.step.id,plan_version=request.step.plan_version,route='API',outcome='UNCERTAIN' if timeout_after_save else 'SUCCESS',idempotency_key=key,external_id=eid,evidence={'source':'mock_calendar','timeout_after_save':timeout_after_save})
    def verify(self,execution):
        event=self.events.get(execution.external_id)
        return VerificationResult(task_id=execution.task_id,step_id=execution.step_id,status='VERIFIED' if event else 'ABSENT',evidence={'external_id':execution.external_id,'record':event} if event else {})
