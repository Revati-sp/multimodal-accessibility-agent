from fastapi.testclient import TestClient
from services.gateway.main import app
client=TestClient(app)
def test_create_get_pause_resume_correction():
    v=client.post('/api/v1/tasks',json={'instruction':'Calendar reminder'});assert v.status_code==201
    tid=v.json()['task_id'];assert client.get(f'/api/v1/tasks/{tid}').status_code==200
    assert client.post(f'/api/v1/tasks/{tid}/interrupt',json={'kind':'PAUSE'}).json()['status']=='PAUSED'
    assert client.post(f'/api/v1/tasks/{tid}/interrupt',json={'kind':'CORRECT','instruction':'Actually Thursday'}).json()['plan']['version']==2
    assert client.post(f'/api/v1/tasks/{tid}/interrupt',json={'kind':'RESUME'}).json()['status']=='READY'
def test_no_live_execution_or_approval_shortcut():
    assert client.post('/api/v1/tasks',json={'instruction':'hello','mode':'live'}).status_code==501
    v=client.post('/api/v1/tasks',json={'instruction':'hello'}).json();tid=v['task_id']
    assert client.post(f'/api/v1/tasks/{tid}/confirmations/read-deadline',json={'approved':True,'plan_version':1}).status_code==501
    assert client.post(f'/api/v1/tasks/{tid}/confirmations/read-deadline',json={'approved':True,'plan_version':2}).status_code==409
