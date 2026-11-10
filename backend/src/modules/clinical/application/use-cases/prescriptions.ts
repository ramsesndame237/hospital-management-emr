import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Encounter } from '../../domain/encounter';
import { AllergyAlert, allergyAlertsFor, Prescription } from '../../domain/prescription';
import { DrugRef, EncounterId, PrescriptionId } from '../../domain/values';
import { ClinicalDependencies, DrugSummary, PrescriptionView, toPrescriptionViews } from '../views';

const ENCOUNTER_NOT_FOUND = new DomainError('CLINICAL_ENCOUNTER_NOT_FOUND', 'Consultation introuvable.');
const PRESCRIPTION_NOT_FOUND = new DomainError('CLINICAL_PRESCRIPTION_NOT_FOUND', 'Ordonnance introuvable.');
const NOT_AUTHOR = new DomainError('CLINICAL_NOT_AUTHOR', 'Seul le médecin qui conduit cette consultation peut la rédiger, la signer ou l’annuler.');

export interface PrescriptionLineInput {
  drugId: string;
  dose: string;
  frequency: string;
  durationDays?: number | null;
  quantity: number;
  instructions?: string | null;
  allergyOverride?: string | null;
}

export interface DrugSuggestion extends DrugSummary {
  /** Allergies actives du patient qui visent ce médicament : à lever par un motif pour prescrire malgré tout. */
  readonly allergyAlerts: AllergyAlert[];
}

/** Charge la consultation si l'utilisateur peut y agir avec ce droit ; hors de son périmètre elle « n'existe pas ». */
async function loadEncounter(d: ClinicalDependencies, actorId: string, rawId: string, permission: string): Promise<Result<Encounter>> {
  const id = EncounterId.create(rawId);
  if (!id.ok) return err(ENCOUNTER_NOT_FOUND);
  const found = await d.encounters.findById(id.value);
  if (!found || !(await d.access.canAccess(actorId, permission, found.state.serviceId))) return err(ENCOUNTER_NOT_FOUND);
  return ok(found);
}

function record(d: ClinicalDependencies, actorId: string, action: string, p: Prescription, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  // Le journal garde qui a fait quoi sur quelle ordonnance, jamais les médicaments ni les motifs.
  return d.audit.record({
    action, outcome: 'SUCCESS', actorId, resourceType: 'clinical-prescription', resourceId: p.id.value,
    metadata: { number: p.state.number.value, patientId: p.state.patientId.value, serviceId: p.state.serviceId, encounterId: p.state.encounterId.value, ...extra }, occurredAt: d.clock.now(),
  });
}

/** Médicaments du formulaire qui répondent à une recherche, avec les alertes d'allergie du patient de la consultation. */
export class SearchDrugsUseCase {
  constructor(private readonly d: ClinicalDependencies) {}

  async execute(actorId: string, encounterId: string, text: string): Promise<Result<DrugSuggestion[]>> {
    const encounter = await loadEncounter(this.d, actorId, encounterId, 'clinical.prescriptions:write');
    if (!encounter.ok) return err(encounter.error);
    const query = (text ?? '').trim();
    if (query.length < 2) return ok([]);
    const allergies = await this.d.allergies.listOf(encounter.value.state.patientId, false);
    const found = await this.d.drugs.search(query, 15);
    return ok(found.map((drug) => ({
      id: drug.id, code: drug.code, name: drug.name, genericName: drug.genericName, strength: drug.strength, form: drug.form, schedule: drug.schedule, unit: drug.unit, active: drug.active,
      allergyAlerts: allergyAlertsFor(drug, allergies.map((a) => ({ id: a.id.value, substance: a.state.substance, severity: a.state.severity }))),
    })));
  }
}

export class IssuePrescriptionUseCase {
  constructor(private readonly d: ClinicalDependencies) {}

  /**
   * Émet une ordonnance pour la consultation en cours du médecin. Chaque médicament doit exister et être actif. Si le patient a une allergie
   * active qui vise un médicament, la ligne doit porter un motif (`allergyOverride`) : sans lui, l'émission est refusée.
   */
  async execute(actorId: string, encounterId: string, input: { notes?: string | null; lines: PrescriptionLineInput[] }): Promise<Result<PrescriptionView>> {
    const encounter = await loadEncounter(this.d, actorId, encounterId, 'clinical.prescriptions:write');
    if (!encounter.ok) return err(encounter.error);
    const e = encounter.value;
    if (e.status !== 'IN_PROGRESS') {
      return err(new DomainError('CLINICAL_ENCOUNTER_LOCKED', `Cette consultation est ${e.status === 'SIGNED' ? 'signée : on ne prescrit plus' : 'annulée : on ne prescrit plus'}.`, { status: e.status }));
    }
    if (e.state.doctorId !== actorId) return err(NOT_AUTHOR);

    const refs = [];
    for (const [i, line] of input.lines.entries()) {
      const ref = DrugRef.create(line.drugId);
      if (!ref.ok) return err(new DomainError('CLINICAL_DRUG_NOT_FOUND', `Ligne ${i + 1} : médicament introuvable.`, { line: i + 1 }));
      refs.push(ref.value);
    }
    const drugs = await this.d.drugs.find(refs.map((r) => r.value));
    const allergies = (await this.d.allergies.listOf(e.state.patientId, false)).map((a) => ({ id: a.id.value, substance: a.state.substance, severity: a.state.severity }));

    const lines = [];
    for (const [i, line] of input.lines.entries()) {
      const drug = drugs.get(refs[i].value);
      if (!drug) return err(new DomainError('CLINICAL_DRUG_NOT_FOUND', `Ligne ${i + 1} : médicament introuvable.`, { line: i + 1 }));
      if (!drug.active) return err(new DomainError('CLINICAL_DRUG_INACTIVE', `Ligne ${i + 1} : « ${drug.name} » n’est plus prescrit (médicament désactivé).`, { line: i + 1, drug: drug.name }));
      const alerts = allergyAlertsFor(drug, allergies);
      const override = (line.allergyOverride ?? '').trim();
      if (alerts.length > 0 && override.length < 3) {
        return err(new DomainError('CLINICAL_ALLERGY_CONFLICT', `Ligne ${i + 1} : le patient est allergique à ${alerts[0].substance} (« ${drug.name} »). Indiquez un motif pour prescrire malgré tout.`, { line: i + 1, drug: drug.name, substance: alerts[0].substance }));
      }
      lines.push({ ...line, drugId: refs[i], allergyOverride: alerts.length > 0 ? override : null });
    }

    const id = PrescriptionId.create(this.d.ids.next());
    if (!id.ok) return err(id.error);
    const prescription = Prescription.issue({
      id: id.value, number: await this.d.prescriptions.nextNumber(), encounterId: e.id, patientId: e.state.patientId, serviceId: e.state.serviceId, doctorId: actorId,
      issuedAt: this.d.clock.now(), notes: input.notes, lines,
    });
    if (!prescription.ok) return err(prescription.error);
    await this.d.prescriptions.insert(prescription.value);
    await record(this.d, actorId, 'clinical.prescription.issue', prescription.value, { lines: lines.length, allergyOverrides: lines.filter((l) => l.allergyOverride !== null).length });
    return ok((await toPrescriptionViews(this.d, [prescription.value]))[0]);
  }
}

export class ListEncounterPrescriptionsUseCase {
  constructor(private readonly d: ClinicalDependencies) {}

  async execute(actorId: string, encounterId: string): Promise<Result<PrescriptionView[]>> {
    const encounter = await loadEncounter(this.d, actorId, encounterId, 'clinical.prescriptions:read');
    if (!encounter.ok) return err(encounter.error);
    return ok(await toPrescriptionViews(this.d, await this.d.prescriptions.listOfEncounter(encounter.value.id)));
  }
}

export class GetPrescriptionUseCase {
  constructor(private readonly d: ClinicalDependencies) {}

  async execute(actorId: string, rawId: string): Promise<Result<PrescriptionView>> {
    const id = PrescriptionId.create(rawId);
    if (!id.ok) return err(PRESCRIPTION_NOT_FOUND);
    const found = await this.d.prescriptions.findById(id.value);
    if (!found || !(await this.d.access.canAccess(actorId, 'clinical.prescriptions:read', found.state.serviceId))) return err(PRESCRIPTION_NOT_FOUND);
    await record(this.d, actorId, 'clinical.prescription.read', found);
    return ok((await toPrescriptionViews(this.d, [found]))[0]);
  }
}

export class CancelPrescriptionUseCase {
  constructor(private readonly d: ClinicalDependencies) {}

  /** Annule une ordonnance en cours, avec un motif ; réservé au médecin qui l'a émise. */
  async execute(actorId: string, rawId: string, reason: string): Promise<Result<PrescriptionView>> {
    const id = PrescriptionId.create(rawId);
    if (!id.ok) return err(PRESCRIPTION_NOT_FOUND);
    const found = await this.d.prescriptions.findById(id.value);
    if (!found || !(await this.d.access.canAccess(actorId, 'clinical.prescriptions:write', found.state.serviceId))) return err(PRESCRIPTION_NOT_FOUND);
    const done = await this.d.prescriptions.mutate(id.value, (p) => p.cancel(reason, actorId, this.d.clock.now()));
    if (!done) return err(PRESCRIPTION_NOT_FOUND);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'clinical.prescription.cancel', done.value);
    return ok((await toPrescriptionViews(this.d, [done.value]))[0]);
  }
}
