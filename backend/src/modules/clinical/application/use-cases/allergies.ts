import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Allergy } from '../../domain/allergy';
import { AllergyId, parseSeverity, PatientRef } from '../../domain/values';
import { AllergyView, ClinicalDependencies, toAllergyViews } from '../views';

const NOT_FOUND = new DomainError('CLINICAL_ALLERGY_NOT_FOUND', 'Allergie introuvable.');
const PATIENT_NOT_FOUND = new DomainError('CLINICAL_PATIENT_NOT_FOUND', 'Patient introuvable.');

export interface RecordAllergyInput {
  substance: string;
  reaction?: string | null;
  severity: string;
}

export interface UpdateAllergyInput {
  reaction?: string | null;
  severity?: string;
}

/**
 * Allergies d'un patient : on les lit pour prescrire, délivrer ou soigner ; le médecin et l'infirmier les tiennent. Rien n'est supprimé : une
 * saisie erronée est déclarée telle, avec son motif. Le journal garde qui a fait quoi, jamais la substance ni la réaction.
 */
export class AllergyUseCases {
  constructor(private readonly d: ClinicalDependencies) {}

  private audit(actorId: string, action: string, allergy: Allergy, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
    return this.d.audit.record({
      action, outcome: 'SUCCESS', actorId, resourceType: 'clinical-allergy', resourceId: allergy.id.value, metadata: { patientId: allergy.state.patientId.value, severity: allergy.state.severity, ...extra },
      occurredAt: this.d.clock.now(),
    });
  }

  private async patientExists(patientId: PatientRef): Promise<boolean> {
    return (await this.d.patients.find([patientId.value])).has(patientId.value);
  }

  async list(rawPatientId: string, includeVoided: boolean): Promise<Result<AllergyView[]>> {
    const patientId = PatientRef.create(rawPatientId);
    if (!patientId.ok || !(await this.patientExists(patientId.value))) return err(PATIENT_NOT_FOUND);
    return ok(await toAllergyViews(this.d, await this.d.allergies.listOf(patientId.value, includeVoided)));
  }

  async record(actorId: string, rawPatientId: string, input: RecordAllergyInput): Promise<Result<AllergyView>> {
    const patientId = PatientRef.create(rawPatientId);
    if (!patientId.ok || !(await this.patientExists(patientId.value))) return err(PATIENT_NOT_FOUND);
    const severity = parseSeverity(input.severity);
    if (!severity.ok) return err(severity.error);
    const id = AllergyId.create(this.d.ids.next());
    if (!id.ok) return err(id.error);
    const allergy = Allergy.record({ id: id.value, patientId: patientId.value, substance: input.substance, reaction: input.reaction, severity: severity.value, by: actorId, at: this.d.clock.now() });
    if (!allergy.ok) return err(allergy.error);
    await this.d.allergies.insert(allergy.value);
    await this.audit(actorId, 'clinical.allergy.record', allergy.value);
    return ok((await toAllergyViews(this.d, [allergy.value]))[0]);
  }

  async update(actorId: string, rawId: string, input: UpdateAllergyInput): Promise<Result<AllergyView>> {
    const id = AllergyId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const severity = input.severity === undefined ? ok(undefined) : parseSeverity(input.severity);
    if (!severity.ok) return err(severity.error);
    const done = await this.d.allergies.mutate(id.value, (a) => a.update({ reaction: input.reaction, severity: severity.value }));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await this.audit(actorId, 'clinical.allergy.update', done.value);
    return ok((await toAllergyViews(this.d, [done.value]))[0]);
  }

  /** Déclare une saisie erronée : l'allergie sort de la liste active mais reste au dossier. Le motif est obligatoire. */
  async void(actorId: string, rawId: string, reason: string): Promise<Result<AllergyView>> {
    const id = AllergyId.create(rawId);
    if (!id.ok) return err(NOT_FOUND);
    const done = await this.d.allergies.mutate(id.value, (a) => a.void(reason, actorId, this.d.clock.now()));
    if (!done) return err(NOT_FOUND);
    if (!done.ok) return err(done.error);
    await this.audit(actorId, 'clinical.allergy.void', done.value);
    return ok((await toAllergyViews(this.d, [done.value]))[0]);
  }
}
