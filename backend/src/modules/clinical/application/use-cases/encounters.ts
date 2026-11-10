import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Diagnosis, ENCOUNTER_STATUSES, Encounter, EncounterStatus, NoteInput } from '../../domain/encounter';
import { createVitals, VitalsInput } from '../../domain/vitals';
import { EncounterId, IcdCode, parseCertainty, parseDiagnosisKind, PatientRef } from '../../domain/values';
import { ClinicalDependencies, EncounterView, PatientSummary, UserSummary, pageOf, toEncounterView, toPatientSummary, userSummaries } from '../views';

const NOT_FOUND = new DomainError('CLINICAL_ENCOUNTER_NOT_FOUND', 'Consultation introuvable.');
const VISIT_NOT_FOUND = new DomainError('CLINICAL_VISIT_NOT_FOUND', 'Admission introuvable.');

/** Charge une consultation que l'utilisateur a le droit de voir : hors de son périmètre, elle « n'existe pas » (rien ne fuit sur sa présence). */
async function loadReadable(d: ClinicalDependencies, actorId: string, rawId: string): Promise<Result<Encounter>> {
  const id = EncounterId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.encounters.findById(id.value);
  if (!found || !(await d.access.canAccess(actorId, 'clinical.encounters:read', found.state.serviceId))) return err(NOT_FOUND);
  return ok(found);
}

function record(d: ClinicalDependencies, actorId: string, action: string, encounter: Encounter, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  // Le journal garde qui a fait quoi sur quelle consultation, jamais le contenu clinique (note, diagnostics, valeurs).
  return d.audit.record({
    action, outcome: 'SUCCESS', actorId, resourceType: 'clinical-encounter', resourceId: encounter.id.value,
    metadata: { number: encounter.state.number.value, patientId: encounter.state.patientId.value, serviceId: encounter.state.serviceId, ...extra }, occurredAt: d.clock.now(),
  });
}

export class StartEncounterUseCase {
  constructor(private readonly d: ClinicalDependencies) {}

  /**
   * Ouvre la consultation d'un patient arrivé (admission en cours, consultation externe ou urgence) dans un service où le médecin exerce.
   * Une admission n'a qu'une consultation en cours : si elle existe déjà, l'erreur donne son identifiant pour la reprendre.
   */
  async execute(actorId: string, admissionId: string): Promise<Result<EncounterView>> {
    const visit = await this.d.visits.find((admissionId ?? '').trim().toLowerCase());
    if (!visit || !(await this.d.access.canAccess(actorId, 'clinical.encounters:write', visit.serviceId))) return err(VISIT_NOT_FOUND);
    if (!visit.inProgress) return err(new DomainError('CLINICAL_VISIT_CLOSED', 'Cette admission est terminée ou annulée : on ne peut plus ouvrir de consultation.'));
    if (visit.type === 'INPATIENT') return err(new DomainError('CLINICAL_VISIT_INPATIENT', 'La visite d’un patient hospitalisé se fait en tournée, pas en consultation externe.'));
    const id = EncounterId.create(this.d.ids.next());
    const patientId = PatientRef.create(visit.patientId);
    if (!id.ok || !patientId.ok) return err(VISIT_NOT_FOUND);
    const encounter = Encounter.start({ id: id.value, number: await this.d.encounters.nextNumber(), patientId: patientId.value, serviceId: visit.serviceId, admissionId: visit.id, doctorId: actorId, startedAt: this.d.clock.now() });
    if (!(await this.d.encounters.insert(encounter))) {
      const open = (await this.d.encounters.byAdmissions([visit.id])).get(visit.id);
      return err(new DomainError('CLINICAL_ENCOUNTER_ALREADY_OPEN', 'Une consultation est déjà en cours pour cette admission.', open ? { encounterId: open.id, number: open.number } : undefined));
    }
    await record(this.d, actorId, 'clinical.encounter.start', encounter, { admissionId: visit.id });
    return ok(await toEncounterView(this.d, encounter));
  }
}

export class GetEncounterUseCase {
  constructor(private readonly d: ClinicalDependencies) {}

  async execute(actorId: string, id: string): Promise<Result<EncounterView>> {
    const loaded = await loadReadable(this.d, actorId, id);
    if (!loaded.ok) return err(loaded.error);
    await record(this.d, actorId, 'clinical.encounter.read', loaded.value);
    return ok(await toEncounterView(this.d, loaded.value));
  }
}

export interface DiagnosisInput {
  code: string;
  label: string;
  kind: string;
  certainty?: string;
}

export class EncounterActionUseCases {
  constructor(private readonly d: ClinicalDependencies) {}

  private async act(
    actorId: string, rawId: string, permission: string, action: string, apply: (e: Encounter) => Result<void>, extra?: (e: Encounter) => Record<string, string | number | boolean | null>,
  ): Promise<Result<EncounterView>> {
    const id = EncounterId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const found = await this.d.encounters.findById(id.value);
    if (!found || !(await this.d.access.canAccess(actorId, permission, found.state.serviceId))) return err(NOT_FOUND);
    const done = await this.d.encounters.mutate(id.value, apply);
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, action, done.value, extra?.(done.value));
    return ok(await toEncounterView(this.d, done.value));
  }

  /** Relevé des constantes : par le médecin ou l'infirmier du service, tant que la consultation est en cours. Remplace le relevé précédent. */
  recordVitals(actorId: string, id: string, input: VitalsInput): Promise<Result<EncounterView>> {
    const vitals = createVitals(input);
    if (!vitals.ok) return Promise.resolve(err(vitals.error));
    return this.act(actorId, id, 'clinical.vitals:record', 'clinical.encounter.vitals', (e) => e.recordVitals(vitals.value, actorId, this.d.clock.now()));
  }

  /** Met à jour la note (SOAP) : absent = inchangé, vide = effacé. Réservé au médecin de la consultation. */
  updateNote(actorId: string, id: string, input: NoteInput): Promise<Result<EncounterView>> {
    const changed = (Object.keys(input) as (keyof NoteInput)[]).filter((k) => input[k] !== undefined).join(',');
    return this.act(actorId, id, 'clinical.encounters:write', 'clinical.encounter.note', (e) => e.updateNote(actorId, input), () => ({ fields: changed }));
  }

  /** Remplace les diagnostics (CIM-10). Réservé au médecin de la consultation. */
  setDiagnoses(actorId: string, id: string, inputs: readonly DiagnosisInput[]): Promise<Result<EncounterView>> {
    const diagnoses: Diagnosis[] = [];
    for (const raw of inputs) {
      const code = IcdCode.create(raw.code);
      if (!code.ok) return Promise.resolve(err(code.error));
      const kind = parseDiagnosisKind(raw.kind);
      if (!kind.ok) return Promise.resolve(err(kind.error));
      const certainty = parseCertainty(raw.certainty ?? 'PROVISIONAL');
      if (!certainty.ok) return Promise.resolve(err(certainty.error));
      diagnoses.push({ code: code.value, label: (raw.label ?? '').trim().replace(/\s+/g, ' '), kind: kind.value, certainty: certainty.value });
    }
    return this.act(actorId, id, 'clinical.encounters:write', 'clinical.encounter.diagnoses', (e) => e.setDiagnoses(actorId, diagnoses), () => ({ count: diagnoses.length }));
  }

  /** Signe et verrouille : il faut un diagnostic principal et une évaluation. */
  sign(actorId: string, id: string): Promise<Result<EncounterView>> {
    return this.act(actorId, id, 'clinical.encounters:write', 'clinical.encounter.sign', (e) => e.sign(actorId, this.d.clock.now()));
  }

  cancel(actorId: string, id: string, reason: string): Promise<Result<EncounterView>> {
    return this.act(actorId, id, 'clinical.encounters:write', 'clinical.encounter.cancel', (e) => e.cancel(reason, actorId, this.d.clock.now()));
  }

  /** Complète une consultation signée sans la modifier. Réservé au médecin de la consultation. */
  async addAddendum(actorId: string, rawId: string, text: string): Promise<Result<EncounterView>> {
    const id = EncounterId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const found = await this.d.encounters.findById(id.value);
    if (!found || !(await this.d.access.canAccess(actorId, 'clinical.encounters:write', found.state.serviceId))) return err(NOT_FOUND);
    const done = await this.d.encounters.addAddendum(id.value, (e) => e.addAddendum(text, actorId, this.d.clock.now()));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'clinical.encounter.addendum', done.value, { seq: done.value.state.addenda.length });
    return ok(await toEncounterView(this.d, done.value));
  }
}

export interface EncounterSummaryView {
  readonly id: string;
  readonly number: string;
  readonly patient: PatientSummary | null;
  readonly serviceId: string;
  readonly doctor: UserSummary | null;
  readonly status: EncounterStatus;
  readonly startedAt: string;
  readonly signedAt: string | null;
  readonly primaryDiagnosis: { readonly code: string; readonly label: string } | null;
}

export class ListEncountersUseCase {
  constructor(private readonly d: ClinicalDependencies) {}

  async execute(actorId: string, input: { status?: string; patientId?: string; mine?: boolean; offset: number; limit: number }): Promise<Result<{ items: EncounterSummaryView[]; total: number; offset: number; limit: number }>> {
    const status = input.status?.trim() ? ENCOUNTER_STATUSES.find((s) => s === input.status!.trim().toUpperCase()) : undefined;
    if (input.status?.trim() && !status) return err(new DomainError('CLINICAL_STATUS_INVALID', `Statut de consultation invalide : « ${input.status} ».`, { value: input.status }));
    const patientId = input.patientId ? PatientRef.create(input.patientId) : ok(undefined);
    if (!patientId.ok) return err(patientId.error);
    const visible = await this.d.access.visibleServices(actorId, 'clinical.encounters:read');
    const { offset, limit } = pageOf(input.offset, input.limit);
    const page = await this.d.encounters.list({ status, patientId: patientId.value, doctorId: input.mine ? actorId : undefined, serviceIds: visible === 'ALL' ? null : visible }, offset, limit);
    const patients = await this.d.patients.find([...new Set(page.items.map((i) => i.patientId))]);
    const who = await userSummaries(this.d, page.items.map((i) => i.doctorId));
    return ok({
      total: page.total, offset, limit,
      items: page.items.map((i) => ({
        id: i.id, number: i.number, patient: patients.get(i.patientId) ? toPatientSummary(patients.get(i.patientId)!) : null, serviceId: i.serviceId, doctor: who(i.doctorId), status: i.status,
        startedAt: i.startedAt.toString(), signedAt: i.signedAt?.toString() ?? null, primaryDiagnosis: i.primaryDiagnosis,
      })),
    });
  }
}

export interface QueueItemView {
  readonly admission: { readonly id: string; readonly number: string; readonly type: string; readonly admittedAt: string; readonly serviceId: string };
  readonly patient: PatientSummary | null;
  /** Consultation en cours pour cette admission : à reprendre. Absente : le patient attend. */
  readonly encounter: { readonly id: string; readonly number: string; readonly doctor: UserSummary | null; readonly mine: boolean } | null;
}

export class QueueUseCase {
  constructor(private readonly d: ClinicalDependencies) {}

  /**
   * Patients arrivés et pas encore vus, dans les services de l'utilisateur : les plus anciens d'abord. Ceux dont la consultation est signée n'y
   * figurent plus ; ceux dont la consultation est en cours y figurent avec elle (pour la reprendre, ou voir qui la conduit).
   */
  async execute(actorId: string): Promise<QueueItemView[]> {
    const visible = await this.d.access.visibleServices(actorId, 'clinical.encounters:read');
    const visits = await this.d.visits.waiting(visible === 'ALL' ? null : visible, 100);
    const encounters = await this.d.encounters.byAdmissions(visits.map((v) => v.id));
    const patients = await this.d.patients.find([...new Set(visits.map((v) => v.patientId))]);
    const who = await userSummaries(this.d, [...encounters.values()].map((e) => e.doctorId));
    return visits
      .filter((v) => encounters.get(v.id)?.status !== 'SIGNED')
      .map((v) => {
        const e = encounters.get(v.id);
        return {
          admission: { id: v.id, number: v.number, type: v.type, admittedAt: v.admittedAt.toString(), serviceId: v.serviceId },
          patient: patients.get(v.patientId) ? toPatientSummary(patients.get(v.patientId)!) : null,
          encounter: e ? { id: e.id, number: e.number, doctor: who(e.doctorId), mine: e.doctorId === actorId } : null,
        };
      });
  }
}

