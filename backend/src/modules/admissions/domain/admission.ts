import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, Temporal } from '../../../shared-kernel/temporal';
import {
  AdmissionId, AdmissionNumber, AdmissionStatus, AdmissionType, AppointmentRef, BedRef, DischargeType, PatientRef, PractitionerRef, ReasonCode, ServiceRef,
} from './values';

export interface AdmissionState {
  readonly id: AdmissionId;
  readonly number: AdmissionNumber;
  readonly patientId: PatientRef;
  readonly type: AdmissionType;
  readonly status: AdmissionStatus;
  /** Service responsable de la prise en charge. */
  readonly serviceId: ServiceRef;
  /** Lit occupé : seulement pour une hospitalisation en cours (`null` ensuite, le lit est libéré). */
  readonly bedId: BedRef | null;
  readonly practitionerId: PractitionerRef | null;
  readonly appointmentId: AppointmentRef | null;
  readonly reasonCode: ReasonCode | null;
  readonly admittedAt: Instant;
  readonly dischargedAt: Instant | null;
  readonly dischargeType: DischargeType | null;
  readonly cancellationReason: string | null;
}

/** Ce qui est archivé à chaque changement de situation d'une admission (voir le dépôt). */
export type MovementKind = 'ADMISSION' | 'TRANSFER' | 'DISCHARGE' | 'CANCELLATION';
export interface Movement {
  readonly kind: MovementKind;
  readonly at: Instant;
  readonly actorId: string;
  readonly serviceId: string;
  readonly bedId: string | null;
}

const NOT_IN_PROGRESS = (status: AdmissionStatus) =>
  new DomainError('ADMISSION_NOT_IN_PROGRESS', `Cette admission est ${status === AdmissionStatus.DISCHARGED ? 'terminée (sortie enregistrée)' : 'annulée'} : elle ne peut plus être modifiée.`, { status });
const BED_RULE = (type: AdmissionType) =>
  type === AdmissionType.INPATIENT
    ? new DomainError('ADMISSION_BED_REQUIRED', 'Une hospitalisation occupe un lit : indiquez-le.')
    : new DomainError('ADMISSION_BED_NOT_ALLOWED', "Seule une hospitalisation occupe un lit.");

/**
 * Admission : l'arrivée d'un patient dans un service (consultation, urgence ou hospitalisation) jusqu'à sa sortie. Une
 * hospitalisation occupe un lit, et un lit n'a qu'un occupant à la fois. Rien n'est supprimé : une admission ouverte par erreur
 * est annulée (avec un motif), une admission terminée reçoit sa sortie. Chaque changement de lieu est archivé par le dépôt.
 */
export class Admission {
  private constructor(private current: AdmissionState) {}

  static restore(state: AdmissionState): Admission {
    return new Admission(state);
  }

  static open(input: Omit<AdmissionState, 'status' | 'dischargedAt' | 'dischargeType' | 'cancellationReason'>): Result<Admission> {
    if ((input.type === AdmissionType.INPATIENT) !== (input.bedId !== null)) return err(BED_RULE(input.type));
    return ok(new Admission({ ...input, status: AdmissionStatus.IN_PROGRESS, dischargedAt: null, dischargeType: null, cancellationReason: null }));
  }

  get state(): AdmissionState { return this.current; }
  get id(): AdmissionId { return this.current.id; }
  get inProgress(): boolean { return this.current.status === AdmissionStatus.IN_PROGRESS; }

  /** Refuse (avec la cause) toute opération sur une admission déjà terminée ou annulée : à appeler avant les autres vérifications. */
  ensureInProgress(): Result<void> {
    return this.inProgress ? ok(undefined) : err(NOT_IN_PROGRESS(this.current.status));
  }

  /** Change de service et/ou de lit. Une hospitalisation exige un lit ; les autres admissions n'en ont pas. Le lieu doit changer. */
  transfer(to: { serviceId: ServiceRef; bedId: BedRef | null }): Result<void> {
    if (!this.inProgress) return err(NOT_IN_PROGRESS(this.current.status));
    if ((this.current.type === AdmissionType.INPATIENT) !== (to.bedId !== null)) return err(BED_RULE(this.current.type));
    const sameBed = (this.current.bedId?.value ?? null) === (to.bedId?.value ?? null);
    if (sameBed && this.current.serviceId.equals(to.serviceId)) return err(new DomainError('ADMISSION_SAME_LOCATION', 'Le patient est déjà à cet endroit.'));
    this.current = { ...this.current, serviceId: to.serviceId, bedId: to.bedId };
    return ok(undefined);
  }

  /** Enregistre la sortie ; le lit est libéré. Jamais avant l'arrivée ni dans le futur. */
  discharge(type: DischargeType, at: Instant, now: Instant): Result<void> {
    if (!this.inProgress) return err(NOT_IN_PROGRESS(this.current.status));
    if (Temporal.Instant.compare(at, this.current.admittedAt) < 0 || Temporal.Instant.compare(at, now) > 0) {
      return err(new DomainError('ADMISSION_DISCHARGE_DATE_INVALID', 'La sortie doit être comprise entre l\'arrivée et maintenant.'));
    }
    this.current = { ...this.current, status: AdmissionStatus.DISCHARGED, dischargedAt: at, dischargeType: type, bedId: null };
    return ok(undefined);
  }

  /** Annule une admission ouverte par erreur ; le lit est libéré. Le motif est obligatoire. */
  cancel(reason: string): Result<void> {
    if (!this.inProgress) return err(NOT_IN_PROGRESS(this.current.status));
    this.current = { ...this.current, status: AdmissionStatus.CANCELLED, cancellationReason: reason, bedId: null };
    return ok(undefined);
  }
}
