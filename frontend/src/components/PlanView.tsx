import type { TaskView } from '../api/contracts';
import type { StepFacts } from '../state/taskDerivations';
import { TaskStep } from './TaskStep';

interface PlanViewProps {
  task: TaskView;
  facts: Map<string, StepFacts>;
  currentStepId: string | undefined;
}

export function PlanView({ task, facts, currentStepId }: PlanViewProps) {
  const verified = task.plan.steps.filter((s) => s.status === 'VERIFIED').length;
  return (
    <section aria-labelledby="plan-heading" className="card">
      <h2 id="plan-heading" tabIndex={-1}>
        Plan, version {task.plan.version}</h2>
      <p>
        {verified} of {task.plan.steps.length} steps verified. Each step starts only after the steps it depends on are
        verified.
      </p>
      <ol className="steps">
        {task.plan.steps.map((step, i) => (
          <TaskStep
            key={`${step.id}@${step.plan_version}`}
            step={step}
            index={i}
            allSteps={task.plan.steps}
            facts={facts.get(step.id)}
            isCurrent={step.id === currentStepId}
          />
        ))}
      </ol>
    </section>
  );
}
