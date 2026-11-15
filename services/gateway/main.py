"""Mock-first gateway. No live calendar action is wired in this starter."""
from fastapi import FastAPI, HTTPException
from shared.schemas import TaskCreate,TaskView,InterruptRequest,ApprovalRequest
from services.orchestrator.core import MemoryTaskStore
from services.model_router.router import choose_provider

app=FastAPI(title='AccessPilot Contract-First Starter',version='0.1.0',description='MOCK MODE: no real external actions')
store=MemoryTaskStore()
@app.get('/health/live')
def live():return {'status':'ok'}
@app.get('/health/ready')
def ready():return {'status':'ok','mode':'mock','storage':'in-memory','model':'mock'}
@app.post('/api/v1/tasks',response_model=TaskView,status_code=201)
def create(payload:TaskCreate):
    if payload.mode!='mock':raise HTTPException(501,'Live mode not yet implemented; configure adapters before use')
    return store.create(payload.instruction)
@app.get('/api/v1/tasks/{task_id}',response_model=TaskView)
def get(task_id:str):
    obj=store.get(task_id)
    if obj is None:raise HTTPException(404,'unknown task')
    return obj
@app.get('/api/v1/tasks/{task_id}/journal')
def journal(task_id:str):return {'task_id':task_id,'journal':get(task_id).journal}
@app.get('/api/v1/tasks/{task_id}/summary')
def summary(task_id:str):
    obj=get(task_id)
    return {'task_id':task_id,'status':obj.status,'plan_version':obj.plan.version,'summary':'Mock task: no external action has executed'}
@app.post('/api/v1/tasks/{task_id}/interrupt',response_model=TaskView)
def interrupt(task_id:str,payload:InterruptRequest):
    get(task_id)
    try:return store.interrupt(task_id,payload.kind,payload.instruction)
    except ValueError as ex:raise HTTPException(409,str(ex)) from ex
@app.post('/api/v1/tasks/{task_id}/confirmations/{step_id}')
def confirm(task_id:str,step_id:str,payload:ApprovalRequest):
    obj=get(task_id)
    if obj.plan.version!=payload.plan_version:raise HTTPException(409,'stale plan version')
    if step_id not in [s.id for s in obj.plan.steps]:raise HTTPException(404,'unknown step')
    raise HTTPException(501,'Approval ledger is not implemented: no action was taken')
@app.get('/api/v1/model-routing-preview')
def routing(role:str='planner',sensitive:bool=False):return choose_provider(role,sensitive=sensitive).__dict__
