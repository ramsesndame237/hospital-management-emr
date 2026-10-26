import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { LabTest, ReferenceRange } from '../../domain/test';
import { TestRepository } from '../../domain/ports';
import {
  parseContainer, parseNotes, parseRangeSex, parseResultType, parseSection, parseSpecimenType, TestCode, TestId, TestName,
} from '../../domain/values';

const NOT_FOUND = new DomainError('LAB_TEST_NOT_FOUND', 'Analyse introuvable.');
const CODE_TAKEN = new DomainError('LAB_TEST_CODE_ALREADY_EXISTS', 'Une analyse utilise déjà ce code.');

export interface RangeView {
  readonly sex: string;
  readonly ageMinDays: number;
  readonly ageMaxDays: number | null;
  readonly low: number | null;
  readonly high: number | null;
  readonly criticalLow: number | null;
  readonly criticalHigh: number | null;
}

export interface TestView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly section: string;
  readonly specimenType: string;
  readonly container: string;
  readonly resultType: string;
  readonly unit: string | null;
  readonly decimals: number;
  readonly choices: readonly string[];
  readonly tatMinutes: number;
  readonly instructions: string | null;
  readonly ranges: readonly RangeView[];
  readonly active: boolean;
}

export interface CatalogDependencies {
  readonly tests: TestRepository;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

export function toTestView(test: LabTest): TestView {
  const s = test.state;
  return {
    id: s.id.value, code: s.code.value, name: s.name.value, section: s.section, specimenType: s.specimenType, container: s.container, resultType: s.resultType, unit: s.unit, decimals: s.decimals,
    choices: s.choices, tatMinutes: s.tatMinutes, instructions: s.instructions, active: s.active,
    ranges: s.ranges.map((r) => ({ sex: r.sex, ageMinDays: r.ageMinDays, ageMaxDays: r.ageMaxDays, low: r.low, high: r.high, criticalLow: r.criticalLow, criticalHigh: r.criticalHigh })),
  };
}

export interface RangeInput {
  sex?: string;
  ageMinDays: number;
  ageMaxDays?: number | null;
  low?: number | null;
  high?: number | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
}

function parseRanges(raw: readonly RangeInput[] | undefined): Result<readonly ReferenceRange[]> {
  const out: ReferenceRange[] = [];
  for (const r of raw ?? []) {
    const sex = parseRangeSex(r.sex ?? 'ANY');
    if (!sex.ok) return err(sex.error);
    out.push({ sex: sex.value, ageMinDays: r.ageMinDays, ageMaxDays: r.ageMaxDays ?? null, low: r.low ?? null, high: r.high ?? null, criticalLow: r.criticalLow ?? null, criticalHigh: r.criticalHigh ?? null });
  }
  return ok(out);
}

async function loadTest(d: CatalogDependencies, rawId: string): Promise<Result<LabTest>> {
  const id = TestId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.tests.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

function record(d: CatalogDependencies, actorId: string, action: string, test: LabTest, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  return d.audit.record({ action, outcome: 'SUCCESS', actorId, resourceType: 'lab-test', resourceId: test.id.value, metadata: { code: test.state.code.value, ...extra }, occurredAt: d.clock.now() });
}

const cleanChoices = (raw: readonly string[] | undefined): string[] => (raw ?? []).map((c) => c.trim().replace(/\s+/g, ' ')).filter((c) => c !== '');

export interface CreateTestInput {
  code: string;
  name: string;
  section: string;
  specimenType: string;
  container: string;
  resultType: string;
  unit?: string | null;
  decimals?: number;
  choices?: readonly string[];
  tatMinutes?: number;
  instructions?: string | null;
  ranges?: readonly RangeInput[];
}

export class CreateTestUseCase {
  constructor(private readonly d: CatalogDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, input: CreateTestInput): Promise<Result<TestView>> {
    const code = TestCode.create(input.code);
    if (!code.ok) return err(code.error);
    const name = TestName.create(input.name);
    if (!name.ok) return err(name.error);
    const section = parseSection(input.section);
    if (!section.ok) return err(section.error);
    const specimenType = parseSpecimenType(input.specimenType);
    if (!specimenType.ok) return err(specimenType.error);
    const container = parseContainer(input.container);
    if (!container.ok) return err(container.error);
    const resultType = parseResultType(input.resultType);
    if (!resultType.ok) return err(resultType.error);
    const instructions = parseNotes(input.instructions);
    if (!instructions.ok) return err(instructions.error);
    const ranges = parseRanges(input.ranges);
    if (!ranges.ok) return err(ranges.error);
    const id = TestId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const unit = input.unit?.trim() ? input.unit.trim() : null;
    const test = LabTest.create({
      id: id.value, code: code.value, name: name.value, section: section.value, specimenType: specimenType.value, container: container.value, resultType: resultType.value, unit,
      decimals: input.decimals ?? 0, choices: cleanChoices(input.choices), tatMinutes: input.tatMinutes ?? 240, instructions: instructions.value, ranges: ranges.value,
    });
    if (!test.ok) return err(test.error);
    if (!(await this.d.tests.insert(test.value))) return err(CODE_TAKEN);
    await record(this.d, actorId, 'lab.test.create', test.value, { section: section.value, resultType: resultType.value, ranges: test.value.state.ranges.length });
    return ok(toTestView(test.value));
  }
}

export interface UpdateTestInput {
  name?: string;
  section?: string;
  specimenType?: string;
  container?: string;
  unit?: string | null;
  decimals?: number;
  choices?: readonly string[];
  tatMinutes?: number;
  instructions?: string | null;
}

export class ManageTestUseCases {
  constructor(private readonly d: CatalogDependencies) {}

  /** Champs absents : inchangés. Le code et le type de résultat ne changent pas. Les champs modifiés sont inscrits au journal. */
  async update(actorId: string, id: string, input: UpdateTestInput): Promise<Result<TestView>> {
    const loaded = await loadTest(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const test = loaded.value;
    const before = test.state;
    const name = input.name === undefined ? ok(undefined) : TestName.create(input.name);
    if (!name.ok) return err(name.error);
    const section = input.section === undefined ? ok(undefined) : parseSection(input.section);
    if (!section.ok) return err(section.error);
    const specimenType = input.specimenType === undefined ? ok(undefined) : parseSpecimenType(input.specimenType);
    if (!specimenType.ok) return err(specimenType.error);
    const container = input.container === undefined ? ok(undefined) : parseContainer(input.container);
    if (!container.ok) return err(container.error);
    const instructions = input.instructions === undefined || input.instructions === null ? ok(input.instructions as null | undefined) : parseNotes(input.instructions);
    if (!instructions.ok) return err(instructions.error);
    const done = test.update({
      name: name.value, section: section.value, specimenType: specimenType.value, container: container.value,
      unit: input.unit === undefined ? undefined : input.unit === null || input.unit.trim() === '' ? null : input.unit.trim(), decimals: input.decimals,
      choices: input.choices === undefined ? undefined : cleanChoices(input.choices), tatMinutes: input.tatMinutes, instructions: instructions.value,
    });
    if (!done.ok) return err(done.error);
    const after = test.state;
    const changed = (Object.keys(before) as (keyof typeof before)[])
      .filter((k) => k !== 'ranges' && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => String(k));
    if (changed.length === 0) return ok(toTestView(test));
    await this.d.tests.update(test);
    await record(this.d, actorId, 'lab.test.update', test, { changed: changed.join(',') });
    return ok(toTestView(test));
  }

  /** Remplace d'un bloc les valeurs de référence (analyse numérique seulement). */
  async setRanges(actorId: string, id: string, rawRanges: readonly RangeInput[]): Promise<Result<TestView>> {
    const loaded = await loadTest(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const test = loaded.value;
    const ranges = parseRanges(rawRanges);
    if (!ranges.ok) return err(ranges.error);
    const done = test.setRanges(ranges.value);
    if (!done.ok) return err(done.error);
    await this.d.tests.update(test);
    await record(this.d, actorId, 'lab.test.set-ranges', test, { ranges: test.state.ranges.length });
    return ok(toTestView(test));
  }

  async setActive(actorId: string, id: string, active: boolean): Promise<Result<TestView>> {
    const loaded = await loadTest(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const test = loaded.value;
    if (test.active === active) return ok(toTestView(test));
    test.setActive(active);
    await this.d.tests.update(test);
    await record(this.d, actorId, active ? 'lab.test.activate' : 'lab.test.deactivate', test);
    return ok(toTestView(test));
  }
}

export class GetTestUseCase {
  constructor(private readonly d: CatalogDependencies) {}

  async execute(id: string): Promise<Result<TestView>> {
    const loaded = await loadTest(this.d, id);
    return loaded.ok ? ok(toTestView(loaded.value)) : err(loaded.error);
  }
}

export interface TestListInput {
  search?: string;
  section?: string;
  includeInactive: boolean;
  offset: number;
  limit: number;
}

export class ListTestsUseCase {
  constructor(private readonly d: CatalogDependencies) {}

  async execute(input: TestListInput): Promise<Result<{ items: TestView[]; total: number; offset: number; limit: number }>> {
    const section = input.section?.trim() ? parseSection(input.section) : ok(undefined);
    if (!section.ok) return err(section.error);
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.d.tests.list({ search: input.search?.trim() || undefined, section: section.value, includeInactive: input.includeInactive }, offset, limit);
    return ok({ items: page.items.map(toTestView), total: page.total, offset, limit });
  }
}
