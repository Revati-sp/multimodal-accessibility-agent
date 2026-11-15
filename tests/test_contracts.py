import pytest
from pydantic import ValidationError
from shared.schemas import Plan,TaskStep,TaskEvent

def test_cycle_rejected():
    with pytest.raises(ValidationError):Plan(task_id='t',goal='g',version=1,steps=[TaskStep(id='a',plan_version=1,action='read_deadline',application='student_portal',depends_on=['b']),TaskStep(id='b',plan_version=1,action='read_deadline',application='student_portal',depends_on=['a'])])
def test_invalid_tool_rejected():
    with pytest.raises(ValidationError):TaskStep(id='1',plan_version=1,action='execute_shell',application='student_portal')
def test_event_version():
    assert TaskEvent(task_id='t',plan_version=1,kind='task.created').schema_version=='1.0.0'
