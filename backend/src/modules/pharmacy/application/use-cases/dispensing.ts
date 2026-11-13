import { IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { allocateFefo, Batch, MovementDraft } from '../../domain/batch';
import { Dispensation, DispensationLine } from '../../domain/dispensation';
import { DispensationId, DrugId } from '../../domain/values';
import { RxInfo, RxLine } from '../../domain/ports';
import { PharmacyDependencies, UserSummary, userSummaries } from '../views';

const NOT_FOUND = new DomainError('PHARMACY_PRESCRIPTION_NOT_FOUND', 'Ordonnance introuvable.');

export type DispensingState = 'NONE' | 'PARTIAL' | 'COMPLETE';

export interface PatientView {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

export interface DispensingDrugView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength: string | null;
  readonly form: string;
  readonly schedule: string;
  readonly unit: string;
}

export interface DispensingLineView {
  readonly position: number;
  readonly drug: DispensingDrugView | null;
  readonly dose: string;
  readonly frequency: string;
  readonly durationDays: number | null;
  readonly instructions: string | null;
  readonly prescribed: number;
  readonly dispensed: number;
  readonly remaining: number;
  /** Motif du médecin qui a prescrit malgré une allergie connue à l'émission. */
  readonly allergyOverride: string | null;
  /** Allergies actives du patient qui visent ce médicament maintenant. */
  readonly allergyAlerts: readonly { readonly substance: string; readonly severity: string }[];
  /** Une allergie vise ce médicament et le médecin ne l'a pas levée : le pharmacien doit donner son propre motif pour délivrer. */
  readonly needsAcknowledgement: boolean;
  /** Quantité délivrable aujourd'hui (lots non périmés, hors quarantaine). */
  readonly dispensable: number;
  /** Ce que le « premier périmé, premier sorti » prélèverait pour le reste à délivrer. */
  readonly suggestion: readonly { readonly batchNumber: string; readonly expiry: string; readonly quantity: number }[];
}

export interface DispensationView {
  readonly id: string;
  readonly number: string;
  readonly dispensedBy: UserSummary | null;
  readonly dispensedAt: string;
  readonly notes: string | null;
  readonly lines: readonly { readonly prescriptionPosition: number; readonly drugId: string; readonly batchNumber: string; readonly expiry: string; readonly quantity: number; readonly allergyOverride: string | null }[];
}

export interface PrescriptionForDispensingView {
  readonly id: string;
  readonly number: string;
  readonly status: string;
  readonly issuedAt: string;
  readonly doctor: UserSummary | null;
  readonly notes: string | null;
  readonly patient: PatientView | null;
  readonly dispensing: DispensingState;
  readonly lines: DispensingLineView[];
  readonly dispensations: DispensationView[];
}

export interface QueueRowView {
  readonly id: string;
  readonly number: string;
  readonly issuedAt: string;
  readonly patient: PatientView | null;
  readonly dispensing: DispensingState;
  readonly lines: number;
  readonly remainingUnits: number;
  /** Au moins une ligne a une allergie connue non levée par le médecin. */
  readonly allergyWarning: boolean;
}

const stateOf = (rx: RxInfo, dispensed: ReadonlyMap<number, number>): DispensingState => {
  const total = rx.lines.reduce((n, l) => n + (dispensed.get(l.position) ?? 0), 0);
  if (total === 0) return 'NONE';
  return rx.lines.every((l) => (dispensed.get(l.position) ?? 0) >= l.quantity) ? 'COMPLETE' : 'PARTIAL';
};

const toDispensationView = (d: Dispensation, who: (id: string | null) => UserSummary | null): DispensationView => ({
  id: d.state.id.value, number: d.state.number.value, dispensedBy: who(d.state.dispensedBy), dispensedAt: d.state.dispensedAt.toString(), notes: d.state.notes,
  lines: d.state.lines.map((l) => ({ prescriptionPosition: l.prescriptionPosition, drugId: l.drugId, batchNumber: l.batchNumber, expiry: l.expiry.toString(), quantity: l.quantity, allergyOverride: l.allergyOverride })),
});

/** La file de la pharmacie : les ordonnances en cours pas encore entièrement délivrées, les plus anciennes d'abord. */
export class DispensingQueueUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(): Promise<QueueRowView[]> {
    const issued = await this.d.prescriptions.listIssued(0, 200);
    const dispensed = await this.d.dispensations.dispensedQuantities(issued.items.map((r) => r.id));
    return issued.items.flatMap((rx) => {
      const done = dispensed.get(rx.id) ?? new Map<number, number>();
      const state = stateOf(rx, done);
      if (state === 'COMPLETE') return [];
      const remainingUnits = rx.lines.reduce((n, l) => n + Math.max(0, l.quantity - (done.get(l.position) ?? 0)), 0);
      return [{
        id: rx.id, number: rx.number, issuedAt: rx.issuedAt.toString(), patient: rx.patient, dispensing: state, lines: rx.lines.length, remainingUnits,
        allergyWarning: rx.lines.some((l) => l.allergyAlerts.length > 0 && l.allergyOverride === null),
      }];
    });
  }
}

export class GetPrescriptionForDispensingUseCase {
  constructor(private readonly d: PharmacyDependencies) {}

  async execute(actorId: string, id: string): Promise<Result<PrescriptionForDispensingView>> {
    const rx = await this.d.prescriptions.find((id ?? '').trim().toLowerCase());
    if (!rx) return err(NOT_FOUND);
    await this.d.audit.record({
      action: 'pharmacy.prescription.read', outcome: 'SUCCESS', actorId, resourceType: 'pharmacy-prescription', resourceId: rx.id,
      metadata: { number: rx.number, patientId: rx.patient?.id ?? null }, occurredAt: this.d.clock.now(),
    });
    const dispensations = await this.d.dispensations.listOf(rx.id);
    const dispensed = (await this.d.dispensations.dispensedQuantities([rx.id])).get(rx.id) ?? new Map<number, number>();
    const drugs = new Map((await this.d.drugs.findByIds(rx.lines.flatMap((l) => { const r = DrugId.create(l.drugId); return r.ok ? [r.value] : []; }))).map((x) => [x.id.value, x]));
    const who = await userSummaries(this.d, [rx.doctorId, ...dispensations.map((x) => x.state.dispensedBy)]);
    const today = this.d.calendar.today();
    const lines: DispensingLineView[] = [];
    for (const l of rx.lines) {
      const drug = drugs.get(l.drugId);
      const done = dispensed.get(l.position) ?? 0;
      const remaining = Math.max(0, l.quantity - done);
      const batches = drug ? await this.d.stock.batchesOf(drug.id, false) : [];
      lines.push({
        position: l.position, drug: drug ? { id: drug.id.value, code: drug.state.code.value, name: drug.state.name.value, genericName: drug.state.genericName.value, strength: drug.state.strength, form: drug.state.form, schedule: drug.state.schedule, unit: drug.state.unit } : null,
        dose: l.dose, frequency: l.frequency, durationDays: l.durationDays, instructions: l.instructions, prescribed: l.quantity, dispensed: done, remaining, allergyOverride: l.allergyOverride, allergyAlerts: l.allergyAlerts,
        needsAcknowledgement: l.allergyAlerts.length > 0 && l.allergyOverride === null,
        dispensable: batches.filter((b) => b.isDispensable(today)).reduce((n, b) => n + b.state.quantity, 0),
        suggestion: remaining > 0 ? allocateFefo(batches, remaining, today).allocations.map((a) => ({ batchNumber: a.batchNumber, expiry: a.expiry.toString(), quantity: a.quantity })) : [],
      });
    }
    return ok({
      id: rx.id, number: rx.number, status: rx.status, issuedAt: rx.issuedAt.toString(), doctor: who(rx.doctorId), notes: rx.notes, patient: rx.patient, dispensing: stateOf(rx, dispensed), lines,
      dispensations: dispensations.map((x) => toDispensationView(x, who)),
    });
  }
}

export interface DispenseLineInput {
  position: number;
  quantity: number;
  /** Motif du pharmacien pour délivrer malgré une allergie connue que le médecin n'avait pas levée. */
  allergyOverride?: string | null;
}

export interface DispenseInput {
  lines: DispenseLineInput[];
  notes?: string | null;
}

export class DispenseUseCase {
  constructor(private readonly d: PharmacyDependencies, private readonly ids: IdGenerator) {}

  /**
   * Délivre tout ou partie d'une ordonnance en cours. Pour chaque ligne servie : la quantité ne dépasse pas ce qui reste à délivrer ; si une allergie
   * vise le médicament et que le médecin ne l'a pas levée, le pharmacien donne son motif ; le stock sort lot par lot (premier périmé, premier sorti) ;
   * si un médicament manque, RIEN ne sort. Tout s'écrit dans une seule transaction : dispensation, lots et grand livre.
   */
  async execute(actorId: string, rawId: string, input: DispenseInput): Promise<Result<PrescriptionForDispensingView>> {
    const rx = await this.d.prescriptions.find((rawId ?? '').trim().toLowerCase());
    if (!rx) return err(NOT_FOUND);
    if (rx.status !== 'ISSUED') return err(new DomainError('PHARMACY_PRESCRIPTION_NOT_ACTIVE', 'Cette ordonnance est annulée : elle ne se délivre pas.'));
    if (!rx.patient) return err(NOT_FOUND);
    const requested = this.validate(rx, input);
    if (!requested.ok) return err(requested.error);

    const id = DispensationId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const number = await this.d.dispensations.nextNumber();
    const today = this.d.calendar.today();
    const at = this.d.clock.now();
    const patientId = rx.patient.id;

    const done = await this.d.dispensations.dispense(rx.id, async (context) => {
      const lines: DispensationLine[] = [];
      const movements: { batch: Batch; draft: MovementDraft }[] = [];
      // Les lots se verrouillent dans l'ordre des médicaments : deux délivrances qui se croisent ne s'attendent pas l'une l'autre.
      for (const r of [...requested.value].sort((a, b) => a.line.drugId.localeCompare(b.line.drugId))) {
        const remaining = r.line.quantity - (context.dispensed.get(r.line.position) ?? 0);
        if (r.quantity > remaining) {
          return err(new DomainError('PHARMACY_DISPENSE_EXCEEDS_PRESCRIPTION', `Ligne ${r.line.position + 1} : il ne reste que ${remaining} unité(s) à délivrer.`, { line: r.line.position + 1, remaining }));
        }
        const batches = await context.batchesOf(r.line.drugId);
        const plan = allocateFefo(batches, r.quantity, today);
        if (plan.shortfall > 0) {
          return err(new DomainError('PHARMACY_STOCK_INSUFFICIENT_FOR_LINE', `Ligne ${r.line.position + 1} : il manque ${plan.shortfall} unité(s) en stock délivrable.`, { line: r.line.position + 1, missing: plan.shortfall }));
        }
        for (const a of plan.allocations) {
          const batch = batches.find((b) => b.id.value === a.batchId)!;
          const draft = batch.dispense(a.quantity, today, number.value);
          if (!draft.ok) return err(draft.error);
          movements.push({ batch, draft: draft.value });
          lines.push({ prescriptionPosition: r.line.position, drugId: r.line.drugId, batchId: a.batchId, batchNumber: a.batchNumber, expiry: a.expiry, quantity: a.quantity, allergyOverride: r.override });
        }
      }
      const dispensation = Dispensation.create({
        id: id.value, number, prescriptionId: rx.id, patientId, dispensedBy: actorId, dispensedAt: at, notes: input.notes?.trim() || null, lines,
      });
      return dispensation.ok ? ok({ dispensation: dispensation.value, movements }) : err(dispensation.error);
    });
    if (!done.ok) return err(done.error);

    // Le journal garde qui a délivré quoi pour quelle ordonnance, jamais les médicaments ni les motifs.
    await this.d.audit.record({
      action: 'pharmacy.dispensation.create', outcome: 'SUCCESS', actorId, resourceType: 'pharmacy-dispensation', resourceId: done.value.id.value,
      metadata: {
        number: done.value.state.number.value, prescriptionNumber: rx.number, patientId, lines: requested.value.length, units: done.value.state.lines.reduce((n, l) => n + l.quantity, 0),
        allergyAcknowledgements: requested.value.filter((r) => r.override !== null).length,
      },
      occurredAt: at,
    });
    return new GetPrescriptionForDispensingUseCase(this.d).execute(actorId, rx.id);
  }

  /** Contrôles qui ne dépendent pas du stock : lignes connues, une fois chacune, quantités entières, motif d'allergie. */
  private validate(rx: RxInfo, input: DispenseInput): Result<{ line: RxLine; quantity: number; override: string | null }[]> {
    if (!Array.isArray(input.lines) || input.lines.length < 1) return err(new DomainError('PHARMACY_DISPENSATION_EMPTY', 'Une dispensation comporte au moins une ligne.'));
    const out: { line: RxLine; quantity: number; override: string | null }[] = [];
    const seen = new Set<number>();
    for (const l of input.lines) {
      const line = rx.lines.find((x) => x.position === l.position);
      if (!line) return err(new DomainError('PHARMACY_PRESCRIPTION_LINE_NOT_FOUND', `Ligne ${Number(l.position) + 1} : elle ne figure pas sur l'ordonnance.`, { line: Number(l.position) + 1 }));
      if (seen.has(l.position)) return err(new DomainError('PHARMACY_DISPENSE_DUPLICATE_LINE', `Ligne ${l.position + 1} : elle n'est servie qu'une fois par dispensation.`, { line: l.position + 1 }));
      seen.add(l.position);
      if (!Number.isSafeInteger(l.quantity) || l.quantity < 1) return err(new DomainError('PHARMACY_DISPENSE_QUANTITY_INVALID', `Ligne ${l.position + 1} : la quantité doit être un entier positif.`, { line: l.position + 1 }));
      const override = (l.allergyOverride ?? '').trim();
      if (line.allergyAlerts.length > 0 && line.allergyOverride === null && override.length < 3) {
        return err(new DomainError('PHARMACY_ALLERGY_ACKNOWLEDGEMENT_REQUIRED', `Ligne ${l.position + 1} : le patient est allergique à ${line.allergyAlerts[0].substance}. Indiquez un motif pour délivrer malgré tout.`, { line: l.position + 1, substance: line.allergyAlerts[0].substance }));
      }
      out.push({ line, quantity: l.quantity, override: line.allergyAlerts.length > 0 && override.length >= 3 ? override : null });
    }
    return ok(out);
  }
}
