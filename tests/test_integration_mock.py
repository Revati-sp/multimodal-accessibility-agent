"""Cross-owner contract-level smoke: gateway -> planner contract; executor -> verifier -> recovery."""
from fastapi.testclient import TestClient
from services.gateway.main import app
from shared.schemas import ExecutionRequest
from services.execution.mock import MockCalendar
from services.recovery.policy import recovery_decision

def test_shared_plan_to_mock_adapter_contract():
    api=TestClient(app)
    response=api.post('/api/v1/tasks',json={'instruction':'Read assignment, create reminder and verify'})
    assert response.status_code==201
    task=response.json()
    steps=task['plan']['steps']
    assert [s['id'] for s in steps]==['read-deadline','create-event','verify-event']
    assert steps[1]['depends_on']==['read-deadline']
    # Not wired: explicit direct mock adapter call, NOT automatic gateway execution.
    req=ExecutionRequest(task_id=task['task_id'],step=steps[1],idempotency_key='integration-stable-key')
    calendar=MockCalendar()
    execution=calendar.create(req,timeout_after_save=True)
    verification=calendar.verify(execution)
    assert recovery_decision(execution,verification)=='CONTINUE'
    assert len(calendar.events)==1
