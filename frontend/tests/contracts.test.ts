import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPLICATIONS,
  EVENT_KINDS,
  INTERRUPT_KINDS,
  RISK_TIERS,
  SCHEMA_VERSION,
  STEP_ACTIONS,
  STEP_STATUSES,
  TASK_STATUSES,
  parseSummaryResponse,
  parseTaskEvent,
  parseTaskView,
} from '../src/api/contracts';
import { ContractError, SchemaVersionError } from '../src/api/errors';
import { documentedUncertainEvent, eventFixtures, invalidEventFixtures } from '../src/fixtures/mockEvents';
import { gatewayCreateResponse, taskFixtures } from '../src/fixtures/mockTasks';

const schemasPy = readFileSync(resolve(process.cwd(), '../shared/schemas.py'), 'utf8');

function enumMembers(className: string): string[] {
  const block = new RegExp(`class ${className}\\(str, Enum\\):([\\s\\S]*?)\\n\\n`).exec(schemasPy)?.[1] ?? '';
  return [...block.matchAll(/(\w+)='(\w+)'/g)].map((m) => m[2] as string);
}

function literal(field: string): string[] {
  const m = new RegExp(`${field}: Literal\\[([^\\]]+)\\]`).exec(schemasPy);
  return [...(m?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1] as string);
}

describe('frozen contract mirror (schema 1.0.0)', () => {
  it('uses the same schema version as shared/schemas.py', () => {
    expect(schemasPy).toContain(`SCHEMA_VERSION = "${SCHEMA_VERSION}"`);
  });

  it('mirrors every enum and literal exactly, with nothing invented', () => {
    expect([...TASK_STATUSES]).toEqual(enumMembers('TaskStatus'));
    expect([...STEP_STATUSES]).toEqual(enumMembers('StepStatus'));
    expect([...RISK_TIERS]).toEqual(enumMembers('RiskTier'));
    expect([...STEP_ACTIONS]).toEqual(literal('action'));
    expect([...APPLICATIONS]).toEqual(literal('application'));
    expect([...EVENT_KINDS]).toEqual(literal('kind').filter((k) => k.includes('.')));
    expect([...INTERRUPT_KINDS]).toEqual(['PAUSE', 'RESUME', 'STOP', 'STATUS', 'CORRECT']);
  });

  it('parses the exact TaskView the gateway returns', () => {
    const view = parseTaskView(gatewayCreateResponse);
    expect(view.status).toBe('CREATED');
    expect(view.plan.steps.map((s) => s.id)).toEqual(['read-deadline', 'create-event', 'verify-event']);
    expect(view.plan.steps[1]?.depends_on).toEqual(['read-deadline']);
  });

  it('parses every task fixture', () => {
    for (const fixture of Object.values(taskFixtures)) expect(() => parseTaskView(fixture)).not.toThrow();
  });

  it('parses the documented step.uncertain example', () => {
    const e = parseTaskEvent(documentedUncertainEvent);
    expect(e.kind).toBe('step.uncertain');
    expect(e.payload).toEqual({ step_id: 'create-event', route: 'API', reason: 'timeout_after_save' });
  });

  it('parses event fixtures', () => {
    for (const fixture of Object.values(eventFixtures)) expect(() => parseTaskEvent(fixture)).not.toThrow();
  });

  it('rejects unsupported or missing schema versions with SchemaVersionError', () => {
    expect(() => parseTaskEvent(invalidEventFixtures.unsupportedSchema)).toThrow(SchemaVersionError);
    expect(() => parseTaskEvent(invalidEventFixtures.missingSchema)).toThrow(SchemaVersionError);
  });

  it('rejects unknown event kinds and statuses instead of guessing', () => {
    expect(() => parseTaskEvent(invalidEventFixtures.unknownKind)).toThrow(ContractError);
    expect(() => parseTaskView({ ...gatewayCreateResponse, status: 'DONE' })).toThrow(ContractError);
    expect(() =>
      parseTaskView({
        ...gatewayCreateResponse,
        plan: { ...gatewayCreateResponse.plan, steps: [{ ...gatewayCreateResponse.plan.steps[0], status: 'SUCCESS' }] },
      }),
    ).toThrow(ContractError);
  });

  it('rejects plans with invalid dependencies', () => {
    const bad = {
      ...gatewayCreateResponse,
      plan: { ...gatewayCreateResponse.plan, steps: [{ ...gatewayCreateResponse.plan.steps[1], depends_on: ['missing'] }] },
    };
    expect(() => parseTaskView(bad)).toThrow(ContractError);
  });

  it('parses the summary response', () => {
    const s = parseSummaryResponse({ task_id: 't', status: 'CREATED', plan_version: 1, summary: 'Mock task: no external action has executed' });
    expect(s.plan_version).toBe(1);
  });
});
