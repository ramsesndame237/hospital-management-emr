import { IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Drug } from '../../domain/drug';
import {
  DrugCode, DrugId, DrugName, GenericName, Money, parseForm, parseOptionalText, parseSchedule, parseStorage,
} from '../../domain/values';
import { DrugView, PharmacyDependencies, pageOf, toDrugView } from '../views';

const NOT_FOUND = new DomainError('PHARMACY_DRUG_NOT_FOUND', 'Médicament introuvable.');
const CODE_TAKEN = new DomainError('PHARMACY_DRUG_CODE_ALREADY_EXISTS', 'Un médicament utilise déjà ce code.');

async function loadDrug(d: PharmacyDependencies, rawId: string): Promise<Result<Drug>> {
  const id = DrugId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.drugs.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

function record(d: PharmacyDependencies, actorId: string, action: string, drug: Drug, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  return d.audit.record({ action, outcome: 'SUCCESS', actorId, resourceType: 'pharmacy-drug', resourceId: drug.id.value, metadata: { code: drug.state.code.value, ...extra }, occurredAt: d.clock.now() });
}

/** Texte facultatif : absent → `undefined` (inchangé), vide ou `null` → `null` (effacé). */
const optional = (raw: string | null | undefined): string | null | undefined => (raw === undefined ? undefined : raw === null || raw.trim() === '' ? null : raw.trim());

export interface CreateDrugInput {
  code: string;
  name: string;
  genericName: string;
  strength?: string | null;
  form: string;
  schedule: string;
  storage?: string;
  atcCode?: string | null;
  unit: string;
  unitPrice?: number;
  reorderLevel?: number;
  notes?: string | null;
}

export class CreateDrugUseCase {
  constructor(private readonly d: PharmacyDependencies, private readonly ids: IdGenerator) {}

  async execute(actorId: string, input: CreateDrugInput): Promise<Result<DrugView>> {
    const code = DrugCode.create(input.code);
    if (!code.ok) return err(code.error);
    const name = DrugName.create(input.name);
    if (!name.ok) return err(name.error);
    const generic = GenericName.create(input.genericName);
    if (!generic.ok) return err(generic.error);
    const form = parseForm(input.form);
    if (!form.ok) return err(form.error);
    const schedule = parseSchedule(input.schedule);
    if (!schedule.ok) return err(schedule.error);
    const storage = parseStorage(input.storage ?? 'ROOM');
    if (!storage.ok) return err(storage.error);
    const price = Money.create(input.unitPrice ?? 0);
    if (!price.ok) return err(price.error);
    const notes = parseOptionalText(input.notes, 500, 'PHARMACY_NOTES_INVALID');
    if (!notes.ok) return err(notes.error);
    const id = DrugId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const drug = Drug.create({
      id: id.value, code: code.value, name: name.value, genericName: generic.value, strength: optional(input.strength) ?? null, form: form.value, schedule: schedule.value, storage: storage.value,
      atcCode: optional(input.atcCode)?.toUpperCase() ?? null, unit: input.unit?.trim() ?? '', unitPrice: price.value, reorderLevel: input.reorderLevel ?? 0, notes: notes.value,
    });
    if (!drug.ok) return err(drug.error);
    if (!(await this.d.drugs.insert(drug.value))) return err(CODE_TAKEN);
    await record(this.d, actorId, 'pharmacy.drug.create', drug.value, { form: form.value, schedule: schedule.value, unitPrice: price.value.value });
    return ok(toDrugView(drug.value));
  }
}

export interface UpdateDrugInput {
  name?: string;
  genericName?: string;
  strength?: string | null;
  form?: string;
  schedule?: string;
  storage?: string;
  atcCode?: string | null;
  unit?: string;
  unitPrice?: number;
  reorderLevel?: number;
  notes?: string | null;
}

export class ManageDrugUseCases {
  constructor(private readonly d: PharmacyDependencies) {}

  /** Champs absents : inchangés ; `strength`, `atcCode`, `notes` à `null` : effacés. Le code ne change pas. Un changement de prix garde l'ancien et le nouveau au journal. */
  async update(actorId: string, id: string, input: UpdateDrugInput): Promise<Result<DrugView>> {
    const loaded = await loadDrug(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const drug = loaded.value;
    const before = drug.state;
    const name = input.name === undefined ? ok(undefined) : DrugName.create(input.name);
    if (!name.ok) return err(name.error);
    const generic = input.genericName === undefined ? ok(undefined) : GenericName.create(input.genericName);
    if (!generic.ok) return err(generic.error);
    const form = input.form === undefined ? ok(undefined) : parseForm(input.form);
    if (!form.ok) return err(form.error);
    const schedule = input.schedule === undefined ? ok(undefined) : parseSchedule(input.schedule);
    if (!schedule.ok) return err(schedule.error);
    const storage = input.storage === undefined ? ok(undefined) : parseStorage(input.storage);
    if (!storage.ok) return err(storage.error);
    const price = input.unitPrice === undefined ? ok(undefined) : Money.create(input.unitPrice);
    if (!price.ok) return err(price.error);
    const notes = input.notes === undefined || input.notes === null ? ok(undefined) : parseOptionalText(input.notes, 500, 'PHARMACY_NOTES_INVALID');
    if (!notes.ok) return err(notes.error);
    const done = drug.update({
      name: name.value, genericName: generic.value, strength: optional(input.strength), form: form.value, schedule: schedule.value, storage: storage.value, atcCode: optional(input.atcCode)?.toUpperCase(),
      unit: input.unit === undefined ? undefined : input.unit.trim(), unitPrice: price.value, reorderLevel: input.reorderLevel,
      notes: input.notes === null ? null : notes.value === undefined ? undefined : notes.value,
    });
    if (!done.ok) return err(done.error);
    const after = drug.state;
    const changed = (Object.keys(before) as (keyof typeof before)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(String);
    if (changed.length === 0) return ok(toDrugView(drug));
    await this.d.drugs.update(drug);
    const priceChange: Record<string, number> = before.unitPrice.value !== after.unitPrice.value ? { priceFrom: before.unitPrice.value, priceTo: after.unitPrice.value } : {};
    await record(this.d, actorId, 'pharmacy.drug.update', drug, { changed: changed.join(','), ...priceChange });
    return ok(toDrugView(drug));
  }

  async setActive(actorId: string, id: string, active: boolean): Promise<Result<DrugView>> {
    const loaded = await loadDrug(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const drug = loaded.value;
    if (drug.active === active) return ok(toDrugView(drug));
    drug.setActive(active);
    await this.d.drugs.update(drug);
    await record(this.d, actorId, active ? 'pharmacy.drug.activate' : 'pharmacy.drug.deactivate', drug);
    return ok(toDrugView(drug));
  }
}

export class GetDrugUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(id: string): Promise<Result<DrugView>> {
    const loaded = await loadDrug(this.d, id);
    return loaded.ok ? ok(toDrugView(loaded.value)) : err(loaded.error);
  }
}

export interface DrugListInput {
  search?: string;
  form?: string;
  schedule?: string;
  includeInactive: boolean;
  offset: number;
  limit: number;
}

export class ListDrugsUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(input: DrugListInput): Promise<Result<{ items: DrugView[]; total: number; offset: number; limit: number }>> {
    const form = input.form?.trim() ? parseForm(input.form) : ok(undefined);
    if (!form.ok) return err(form.error);
    const schedule = input.schedule?.trim() ? parseSchedule(input.schedule) : ok(undefined);
    if (!schedule.ok) return err(schedule.error);
    const { offset, limit } = pageOf(input.offset, input.limit);
    const page = await this.d.drugs.list({ search: input.search?.trim() || undefined, form: form.value, schedule: schedule.value, includeInactive: input.includeInactive }, offset, limit);
    return ok({ items: page.items.map(toDrugView), total: page.total, offset, limit });
  }
}
