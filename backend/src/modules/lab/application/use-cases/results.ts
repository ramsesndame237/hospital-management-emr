import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Instant, Temporal } from '../../../../shared-kernel/temporal';
import { OrderedTest, Requisition, ResultEntry } from '../../domain/requisition';
import { applicableRange, currentVersion, deltaAlertFor, flagFor, isCritical, NOTIFICATION_METHODS, NotificationMethod, parseValue } from '../../domain/result';
import { Reason, RequisitionId, TestId } from '../../domain/values';
import { RequisitionDependencies, RequisitionView, toView } from './requisitions';

const NOT_FOUND = new DomainError('LAB_REQUISITION_NOT_FOUND', "Demande d'analyses introuvable.");
const NOT_IN_REQUISITION = new DomainError('LAB_TEST_NOT_IN_REQUISITION', 'Cette analyse ne figure pas dans la demande.');
const PATIENT_NOT_FOUND = new DomainError('LAB_PATIENT_NOT_FOUND', 'Patient introuvable.');
const CHANGED = NOT_FOUND;

/** Âge du patient, en jours, le jour du prélèvement : c'est lui qui choisit la tranche de valeurs de référence. */
function ageInDays(birthDate: string, at: Instant): number {
  const collected = at.toZonedDateTimeISO('UTC').toPlainDate();
  return Math.max(0, Temporal.PlainDate.from(birthDate).until(collected, { largestUnit: 'days' }).days);
}

function parseComment(raw: string | null | undefined): Result<string | null> {
  const text = (raw ?? '').trim();
  if (text === '') return ok(null);
  return text.length <= 300 ? ok(text) : err(new DomainError('LAB_COMMENT_INVALID', 'Le commentaire ne doit pas dépasser 300 caractères.'));
}

export interface EnterResultInput {
  readonly value: unknown;
  readonly comment?: string | null;
}

export interface NotifyInput {
  readonly notifiedName: string;
  readonly notifiedRole: string;
  readonly method: string;
  readonly readBackConfirmed: boolean;
}

/**
 * Cycle d'un résultat : saisie → validation par un autre technicien → (appel du clinicien si valeur critique) → publication ; un résultat publié
 * s'amende avec un motif, en gardant toutes ses versions. Chaque étape est inscrite au journal, sans jamais y écrire la valeur.
 */
export class ResultUseCases {
  constructor(private readonly d: RequisitionDependencies) {}

  private async locate(rawRequisition: string, rawTest: string): Promise<Result<{ requisition: Requisition; test: OrderedTest }>> {
    const id = RequisitionId.create(rawRequisition);
    if (!id.ok) return err(NOT_FOUND);
    const requisition = await this.d.requisitions.findById(id.value);
    if (!requisition) return err(NOT_FOUND);
    const testId = TestId.create(rawTest);
    const test = testId.ok ? requisition.state.tests.find((t) => t.testId.equals(testId.value)) : undefined;
    return test ? ok({ requisition, test }) : err(NOT_IN_REQUISITION);
  }

  /** Valeur contrôlée, position par rapport aux valeurs de référence du patient (sexe, âge) et variation par rapport à son dernier résultat publié. */
  private async entryFor(requisition: Requisition, test: OrderedTest, input: EnterResultInput): Promise<Result<ResultEntry>> {
    const catalogue = (await this.d.tests.findById(test.testId))?.state;
    if (!catalogue) return err(NOT_IN_REQUISITION);
    const parsed = parseValue(catalogue, input.value);
    if (!parsed.ok) return err(parsed.error);
    const comment = parseComment(input.comment);
    if (!comment.ok) return err(comment.error);
    const base = { parsed: parsed.value, comment: comment.value, unit: catalogue.unit, refLow: null, refHigh: null, criticalLow: null, criticalHigh: null, flag: null, previousValue: null, deltaAlert: false };
    if (parsed.value.valueNumber === null) return ok(base);

    const patient = (await this.d.patients.find([requisition.state.patientId.value])).get(requisition.state.patientId.value);
    if (!patient) return err(PATIENT_NOT_FOUND);
    const collectedAt = requisition.findSpecimen(test.specimenId)?.collectedAt;
    const range = collectedAt ? applicableRange(catalogue.ranges, patient.sex, ageInDays(patient.birthDate, collectedAt)) : null;
    const previous = await this.d.requisitions.previousReleased(requisition.state.patientId, test.testId, requisition.id);
    return ok({
      ...base, flag: flagFor(range, parsed.value.valueNumber), refLow: range?.low ?? null, refHigh: range?.high ?? null, criticalLow: range?.criticalLow ?? null, criticalHigh: range?.criticalHigh ?? null,
      previousValue: previous?.value ?? null, deltaAlert: deltaAlertFor(previous?.value ?? null, parsed.value.valueNumber),
    });
  }

  private async apply(
    actorId: string, rawRequisition: string, rawTest: string, action: string, change: (r: Requisition, test: OrderedTest) => Result<void>, extra: (r: Requisition, test: OrderedTest) => Record<string, string | number | boolean | null> = () => ({}), reason?: string,
  ): Promise<Result<RequisitionView>> {
    const found = await this.locate(rawRequisition, rawTest);
    if (!found.ok) return err(found.error);
    const done = await this.d.requisitions.mutate(found.value.requisition.id, (r) => change(r, found.value.test));
    if (!done) return err(CHANGED);
    if (!done.ok) return err(done.error);
    const s = done.value.state;
    await this.d.audit.record({
      action, outcome: 'SUCCESS', actorId, resourceType: 'lab-requisition', resourceId: s.id.value, ...(reason ? { reason } : {}),
      metadata: { requisitionNumber: s.number.value, patientId: s.patientId.value, testCode: found.value.test.code.value, ...extra(done.value, found.value.test) }, occurredAt: this.d.clock.now(),
    });
    return ok(await toView(this.d, actorId, done.value));
  }

  private versionInfo = (r: Requisition, test: OrderedTest): Record<string, string | number | boolean | null> => {
    const result = r.state.tests.find((t) => t.testId.equals(test.testId))?.result;
    if (!result) return {};
    const v = currentVersion(result);
    return { version: v.version, critical: isCritical(v.flag), deltaAlert: v.deltaAlert };
  };

  /** Saisit le résultat (ou le corrige tant qu'il n'est pas validé). Le drapeau L/H/critique et l'alerte de variation sont calculés par le serveur. */
  async enter(actorId: string, requisitionId: string, testId: string, input: EnterResultInput): Promise<Result<RequisitionView>> {
    const found = await this.locate(requisitionId, testId);
    if (!found.ok) return err(found.error);
    const entry = await this.entryFor(found.value.requisition, found.value.test, input);
    if (!entry.ok) return err(entry.error);
    return this.apply(actorId, requisitionId, testId, 'lab.result.enter', (r, t) => r.enterResult(t.testId, actorId, this.d.clock.now(), entry.value), this.versionInfo);
  }

  /** Valide un résultat saisi : jamais par son auteur. */
  verify(actorId: string, requisitionId: string, testId: string): Promise<Result<RequisitionView>> {
    return this.apply(actorId, requisitionId, testId, 'lab.result.verify', (r, t) => r.verifyResult(t.testId, actorId, this.d.clock.now()), this.versionInfo);
  }

  /** Renvoie un résultat saisi ou validé à son auteur, avec un motif obligatoire. */
  async returnForCorrection(actorId: string, requisitionId: string, testId: string, rawReason: string): Promise<Result<RequisitionView>> {
    const reason = Reason.create(rawReason);
    if (!reason.ok) return err(reason.error);
    return this.apply(actorId, requisitionId, testId, 'lab.result.return', (r, t) => r.returnResult(t.testId, reason.value), this.versionInfo, reason.value.value);
  }

  /** Documente l'appel du clinicien pour une valeur critique : qui, son rôle, par quel moyen, et la relecture de la valeur (obligatoire). */
  async notifyCritical(actorId: string, requisitionId: string, testId: string, input: NotifyInput): Promise<Result<RequisitionView>> {
    const name = (input.notifiedName ?? '').trim();
    const role = (input.notifiedRole ?? '').trim();
    if (name.length < 1 || name.length > 100 || role.length < 1 || role.length > 60) return err(new DomainError('LAB_NOTIFY_FIELD_INVALID', 'Le nom (100 caractères au plus) et la fonction (60 au plus) de la personne prévenue sont obligatoires.'));
    const method = NOTIFICATION_METHODS.find((m) => m === (input.method ?? '').trim().toUpperCase());
    if (!method) return err(new DomainError('LAB_NOTIFY_METHOD_INVALID', `Moyen d'appel invalide : « ${String(input.method ?? '')} ».`, { value: String(input.method ?? '') }));
    return this.apply(
      actorId, requisitionId, testId, 'lab.result.critical-notified',
      (r, t) => r.documentCritical(t.testId, actorId, this.d.clock.now(), { notifiedName: name, notifiedRole: role, method: method as NotificationMethod, readBackConfirmed: input.readBackConfirmed === true }),
      (r, t) => ({ ...this.versionInfo(r, t), method }),
    );
  }

  /** Publie un résultat validé : jamais par son auteur ; une valeur critique exige d'abord l'appel du clinicien. */
  release(actorId: string, requisitionId: string, testId: string): Promise<Result<RequisitionView>> {
    return this.apply(actorId, requisitionId, testId, 'lab.result.release', (r, t) => r.releaseResult(t.testId, actorId, this.d.clock.now()), this.versionInfo);
  }

  /** Amende un résultat publié : motif obligatoire, nouvelle version à valider puis publier ; la version publiée reste visible du prescripteur en attendant. */
  async amend(actorId: string, requisitionId: string, testId: string, input: EnterResultInput & { reason: string }): Promise<Result<RequisitionView>> {
    const reason = Reason.create(input.reason);
    if (!reason.ok) return err(reason.error);
    const found = await this.locate(requisitionId, testId);
    if (!found.ok) return err(found.error);
    const entry = await this.entryFor(found.value.requisition, found.value.test, input);
    if (!entry.ok) return err(entry.error);
    return this.apply(actorId, requisitionId, testId, 'lab.result.amend', (r, t) => r.amendResult(t.testId, actorId, this.d.clock.now(), entry.value, reason.value), this.versionInfo, reason.value.value);
  }
}
