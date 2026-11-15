from shared.schemas import TaskStep,ExecutionRequest,RiskTier,ExecutionResult,VerificationResult
from services.execution.mock import MockCalendar
from services.recovery.policy import recovery_decision

def test_timeout_after_save_no_duplicate():
    db=MockCalendar();step=TaskStep(id='s',plan_version=1,action='create_calendar_event',application='mock_calendar',risk_tier=RiskTier.T1)
    req=ExecutionRequest(task_id='t',step=step,idempotency_key='stable-key-001')
    outcome=db.create(req,timeout_after_save=True)
    assert outcome.outcome=='UNCERTAIN'
    verification=db.verify(outcome)
    assert verification.status=='VERIFIED'
    assert recovery_decision(outcome,verification)=='CONTINUE'
    db.create(req)
    assert len(db.events)==1

def test_unknown_outcome_blocks_retry():
    outcome=ExecutionResult(task_id='t',step_id='s',plan_version=1,route='API',outcome='UNCERTAIN',idempotency_key='stable-key-002')
    result=VerificationResult(task_id='t',step_id='s',status='UNKNOWN')
    assert recovery_decision(outcome,result)=='ESCALATE_NO_RETRY'

def test_sensitive_action_denied():
    db=MockCalendar();step=TaskStep(id='s',plan_version=1,action='create_calendar_event',application='mock_calendar',risk_tier=RiskTier.T2)
    req=ExecutionRequest(task_id='t',step=step,idempotency_key='stable-key-003')
    import pytest
    with pytest.raises(PermissionError):db.create(req)
