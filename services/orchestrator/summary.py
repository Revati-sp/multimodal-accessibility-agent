"""Status text taken from the task record. No model is consulted."""

from shared.schemas import StepStatus, TaskStatus, TaskView


def summarize(task: TaskView) -> dict:
    verified = [step.id for step in task.plan.steps if step.status == StepStatus.VERIFIED]
    done = task.status == TaskStatus.COMPLETED and bool(verified)
    if verified:
        step_text = f"Verified steps: {', '.join(verified)}."
    else:
        step_text = "No step is verified."
    outcome = "The task is done." if done else "The task is not done."
    journal_text = ""
    if task.journal:
        last = task.journal[-1]
        action = last.get("action")
        journal_text = f" Last journal entry: {last.get('kind')}"
        journal_text += f" {action}." if action else "."
    summary = (
        f"Recorded status is {task.status.value}. "
        f"Plan version {task.plan.version}. {step_text} {outcome}{journal_text}"
    )
    return {
        "task_id": task.task_id,
        "status": task.status,
        "plan_version": task.plan.version,
        "summary": summary,
    }
