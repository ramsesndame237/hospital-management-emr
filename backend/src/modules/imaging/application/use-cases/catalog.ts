import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ExamType } from '../../domain/exam-type';
import { ExamTypeRepository } from '../../domain/ports';
import { ExamCode, ExamName, ExamTypeId, parseModality, parseOptionalText } from '../../domain/values';

const NOT_FOUND = new DomainError('IMG_EXAM_NOT_FOUND', 'Examen introuvable.');
const CODE_TAKEN = new DomainError('IMG_EXAM_CODE_ALREADY_EXISTS', 'Un examen utilise déjà ce code.');

export interface ExamTypeView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly modality: string;
  readonly bodyPart: string | null;
  readonly usesContrast: boolean;
  readonly durationMinutes: number;
  readonly preparation: string | null;
  readonly active: boolean;
}

export interface CatalogDependencies {
  readonly exams: ExamTypeRepository;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

export function toExamTypeView(exam: ExamType): ExamTypeView {
  const s = exam.state;
  return { id: s.id.value, code: s.code.value, name: s.name.value, modality: s.modality, bodyPart: s.bodyPart, usesContrast: s.usesContrast, durationMinutes: s.durationMinutes, preparation: s.preparation, active: s.active };
}

async function loadExam(d: CatalogDependencies, rawId: string): Promise<Result<ExamType>> {
  const id = ExamTypeId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.exams.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

function record(d: CatalogDependencies, actorId: string, action: string, exam: ExamType, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  return d.audit.record({ action, outcome: 'SUCCESS', actorId, resourceType: 'imaging-exam-type', resourceId: exam.id.value, metadata: { code: exam.state.code.value, ...extra }, occurredAt: d.clock.now() });
}

export interface CreateExamTypeInput {
  code: string;
  name: string;
  modality: string;
  bodyPart?: string | null;
  usesContrast?: boolean;
  durationMinutes?: number;
  preparation?: string | null;
}

export class CreateExamTypeUseCase {
  constructor(private readonly d: CatalogDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, input: CreateExamTypeInput): Promise<Result<ExamTypeView>> {
    const code = ExamCode.create(input.code);
    if (!code.ok) return err(code.error);
    const name = ExamName.create(input.name);
    if (!name.ok) return err(name.error);
    const modality = parseModality(input.modality);
    if (!modality.ok) return err(modality.error);
    const bodyPart = parseOptionalText(input.bodyPart, 60, 'IMG_EXAM_BODY_PART_INVALID');
    if (!bodyPart.ok) return err(bodyPart.error);
    const preparation = parseOptionalText(input.preparation, 500, 'IMG_EXAM_PREPARATION_INVALID');
    if (!preparation.ok) return err(preparation.error);
    const id = ExamTypeId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const exam = ExamType.create({
      id: id.value, code: code.value, name: name.value, modality: modality.value, bodyPart: bodyPart.value, usesContrast: input.usesContrast ?? false,
      durationMinutes: input.durationMinutes ?? 30, preparation: preparation.value,
    });
    if (!exam.ok) return err(exam.error);
    if (!(await this.d.exams.insert(exam.value))) return err(CODE_TAKEN);
    await record(this.d, actorId, 'imaging.exam-type.create', exam.value, { modality: modality.value, usesContrast: exam.value.state.usesContrast });
    return ok(toExamTypeView(exam.value));
  }
}

export interface UpdateExamTypeInput {
  name?: string;
  bodyPart?: string | null;
  usesContrast?: boolean;
  durationMinutes?: number;
  preparation?: string | null;
}

export class ManageExamTypeUseCases {
  constructor(private readonly d: CatalogDependencies) {}

  /** Champs absents : inchangés. Le code et la modalité ne changent pas. Les champs modifiés sont inscrits au journal. */
  async update(actorId: string, id: string, input: UpdateExamTypeInput): Promise<Result<ExamTypeView>> {
    const loaded = await loadExam(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const exam = loaded.value;
    const before = exam.state;
    const name = input.name === undefined ? ok(undefined) : ExamName.create(input.name);
    if (!name.ok) return err(name.error);
    const bodyPart = input.bodyPart === undefined ? ok(undefined) : parseOptionalText(input.bodyPart, 60, 'IMG_EXAM_BODY_PART_INVALID');
    if (!bodyPart.ok) return err(bodyPart.error);
    const preparation = input.preparation === undefined ? ok(undefined) : parseOptionalText(input.preparation, 500, 'IMG_EXAM_PREPARATION_INVALID');
    if (!preparation.ok) return err(preparation.error);
    const done = exam.update({ name: name.value, bodyPart: bodyPart.value, usesContrast: input.usesContrast, durationMinutes: input.durationMinutes, preparation: preparation.value });
    if (!done.ok) return err(done.error);
    const after = exam.state;
    const changed = (Object.keys(before) as (keyof typeof before)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map((k) => String(k));
    if (changed.length === 0) return ok(toExamTypeView(exam));
    await this.d.exams.update(exam);
    await record(this.d, actorId, 'imaging.exam-type.update', exam, { changed: changed.join(',') });
    return ok(toExamTypeView(exam));
  }

  async setActive(actorId: string, id: string, active: boolean): Promise<Result<ExamTypeView>> {
    const loaded = await loadExam(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const exam = loaded.value;
    if (exam.active === active) return ok(toExamTypeView(exam));
    exam.setActive(active);
    await this.d.exams.update(exam);
    await record(this.d, actorId, active ? 'imaging.exam-type.activate' : 'imaging.exam-type.deactivate', exam);
    return ok(toExamTypeView(exam));
  }
}

export class GetExamTypeUseCase {
  constructor(private readonly d: CatalogDependencies) {}

  async execute(id: string): Promise<Result<ExamTypeView>> {
    const loaded = await loadExam(this.d, id);
    return loaded.ok ? ok(toExamTypeView(loaded.value)) : err(loaded.error);
  }
}

export interface ExamTypeListInput {
  search?: string;
  modality?: string;
  includeInactive: boolean;
  offset: number;
  limit: number;
}

export class ListExamTypesUseCase {
  constructor(private readonly d: CatalogDependencies) {}

  async execute(input: ExamTypeListInput): Promise<Result<{ items: ExamTypeView[]; total: number; offset: number; limit: number }>> {
    const modality = input.modality?.trim() ? parseModality(input.modality) : ok(undefined);
    if (!modality.ok) return err(modality.error);
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.d.exams.list({ search: input.search?.trim() || undefined, modality: modality.value, includeInactive: input.includeInactive }, offset, limit);
    return ok({ items: page.items.map(toExamTypeView), total: page.total, offset, limit });
  }
}
