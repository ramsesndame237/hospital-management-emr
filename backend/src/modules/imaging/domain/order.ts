import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant, Temporal } from '../../../shared-kernel/temporal';
import { CommunicationMethod, ExamCode, ExamName, ExamTypeId, isIonizing, Modality, OrderId, OrderNumber, PatientRef, Priority, Reason, Source } from './values';

export type OrderStatus = 'ORDERED' | 'SCHEDULED' | 'PERFORMED' | 'REPORTED' | 'CANCELLED';

export const MAX_TECHNIQUE = 2000;
export const MAX_FINDINGS = 8000;
export const MAX_IMPRESSION = 2000;

/** Dépistage de sécurité fait avant l'examen. Une contre-indication (grossesse sous rayons, allergie au contraste) ne se passe que par un motif écrit. */
export interface Screening {
  readonly pregnant: boolean;
  readonly contrastAllergy: boolean;
  /** Motif de la dérogation, seulement s'il y avait une contre-indication à lever. */
  readonly overrideReason: string | null;
}

/** Compte rendu en cours de rédaction : modifiable jusqu'à la signature, invisible pour le prescripteur. */
export interface ReportDraft {
  readonly technique: string | null;
  readonly findings: string | null;
  readonly impression: string | null;
  readonly critical: boolean;
  readonly by: string;
  readonly at: Instant;
}

/** Compte rendu signé (version 1) ou addendum motivé (versions suivantes) : jamais réécrit. */
export interface ReportVersion {
  readonly version: number;
  readonly technique: string | null;
  readonly findings: string;
  readonly impression: string;
  readonly critical: boolean;
  readonly reason: string | null;
  readonly signedBy: string;
  readonly signedAt: Instant;
}

/** Appel du clinicien pour une découverte critique : qui, comment, quand, avec relecture. */
export interface CriticalCommunication {
  readonly version: number;
  readonly notifiedName: string;
  readonly notifiedRole: string;
  readonly method: CommunicationMethod;
  readonly readBackConfirmed: true;
  readonly at: Instant;
  readonly by: string;
}

export interface OrderState {
  readonly id: OrderId;
  readonly number: OrderNumber;
  readonly patientId: PatientRef;
  readonly examTypeId: ExamTypeId;
  readonly examCode: ExamCode;
  readonly examName: ExamName;
  readonly modality: Modality;
  readonly priority: Priority;
  readonly source: Source;
  readonly clinicalQuestion: string;
  readonly encounterId: string | null;
  readonly orderedBy: string;
  readonly orderedAt: Instant;
  readonly scheduledFor: Instant | null;
  readonly scheduledBy: string | null;
  readonly performedAt: Instant | null;
  readonly performedBy: string | null;
  readonly techniqueNote: string | null;
  readonly screening: Screening | null;
  readonly draft: ReportDraft | null;
  readonly versions: readonly ReportVersion[];
  readonly communications: readonly CriticalCommunication[];
  readonly cancelledBy: string | null;
  readonly cancelledAt: Instant | null;
  readonly cancellationReason: Reason | null;
  readonly version: number;
}

export interface NewOrder {
  readonly id: OrderId;
  readonly number: OrderNumber;
  readonly patientId: PatientRef;
  readonly examTypeId: ExamTypeId;
  readonly examCode: ExamCode;
  readonly examName: ExamName;
  readonly modality: Modality;
  readonly priority: Priority;
  readonly source: Source;
  readonly clinicalQuestion: string;
  readonly encounterId: string | null;
  readonly orderedBy: string;
  readonly orderedAt: Instant;
}

export interface PerformInput {
  readonly by: string;
  readonly at: Instant;
  readonly pregnant: boolean;
  readonly contrastAllergy: boolean;
  readonly overrideReason: string | null;
  readonly techniqueNote: string | null;
}

export interface DraftInput {
  readonly technique: string | null;
  readonly findings: string | null;
  readonly impression: string | null;
  readonly critical: boolean;
}

export interface CommunicationInput {
  readonly notifiedName: string;
  readonly notifiedRole: string;
  readonly method: CommunicationMethod;
  readonly readBackConfirmed: boolean;
}

export interface AddendumInput {
  readonly reason: Reason;
  readonly technique: string | null;
  readonly findings: string | null;
  readonly impression: string | null;
  readonly critical: boolean;
  /** Obligatoire quand l'addendum signale une découverte critique. */
  readonly communication: CommunicationInput | null;
}

const refuse = (code: string, message: string, params: Record<string, string> = {}): Result<never> => err(new DomainError(code, message, params));

function checkText(value: string | null, max: number, code: string, label: string): Result<void> {
  return value !== null && value.length > max ? refuse(code, `${label} ne doit pas dépasser ${max} caractères.`, { max: String(max) }) : ok(undefined);
}

function checkReportText(input: { technique: string | null; findings: string | null; impression: string | null }): Result<void> {
  for (const check of [
    checkText(input.technique, MAX_TECHNIQUE, 'IMG_REPORT_TEXT_INVALID', 'La technique'),
    checkText(input.findings, MAX_FINDINGS, 'IMG_REPORT_TEXT_INVALID', 'Les constatations'),
    checkText(input.impression, MAX_IMPRESSION, 'IMG_REPORT_TEXT_INVALID', "L'impression"),
  ]) if (!check.ok) return check;
  return ok(undefined);
}

function checkCommunication(c: CommunicationInput): Result<void> {
  const name = c.notifiedName.trim();
  const role = c.notifiedRole.trim();
  if (name.length < 1 || name.length > 100) return refuse('IMG_COMMUNICATION_INVALID', 'Le nom de la personne prévenue est obligatoire (100 caractères au plus).');
  if (role.length < 1 || role.length > 60) return refuse('IMG_COMMUNICATION_INVALID', 'La fonction de la personne prévenue est obligatoire (60 caractères au plus).');
  if (!c.readBackConfirmed) return refuse('IMG_READ_BACK_REQUIRED', 'La personne prévenue doit avoir relu la découverte : sans relecture confirmée, l’appel n’est pas documenté.');
  return ok(undefined);
}

const filled = (text: string | null): text is string => text !== null && text.trim() !== '';

/**
 * Demande d'un examen d'imagerie : demandée, planifiée (facultatif), réalisée après dépistage de sécurité, puis décrite dans un compte
 * rendu signé. Une découverte critique n'est signée qu'après l'appel documenté du clinicien. Un compte rendu signé ne se réécrit pas :
 * on le complète par un addendum motivé (nouvelle version).
 */
export class ImagingOrder {
  private constructor(private current: OrderState) {}

  static restore(state: OrderState): ImagingOrder {
    return new ImagingOrder(state);
  }

  static order(input: NewOrder): Result<ImagingOrder> {
    const question = input.clinicalQuestion.trim();
    if (question.length < 1 || question.length > 500) return refuse('IMG_CLINICAL_QUESTION_REQUIRED', 'La question clinique est obligatoire (500 caractères au plus) : elle justifie l’examen.');
    return ok(new ImagingOrder({
      ...input, clinicalQuestion: question, scheduledFor: null, scheduledBy: null, performedAt: null, performedBy: null, techniqueNote: null, screening: null, draft: null, versions: [], communications: [],
      cancelledBy: null, cancelledAt: null, cancellationReason: null, version: 0,
    }));
  }

  get state(): OrderState { return this.current; }
  get id(): OrderId { return this.current.id; }

  get status(): OrderStatus {
    const s = this.current;
    if (s.cancelledAt) return 'CANCELLED';
    if (s.versions.length > 0) return 'REPORTED';
    if (s.performedAt) return 'PERFORMED';
    if (s.scheduledFor) return 'SCHEDULED';
    return 'ORDERED';
  }

  private notOpen(): Result<void> {
    switch (this.status) {
      case 'CANCELLED': return refuse('IMG_ORDER_CANCELLED', 'Cette demande est annulée.');
      case 'PERFORMED': case 'REPORTED': return refuse('IMG_ORDER_ALREADY_PERFORMED', 'L’examen est déjà réalisé.');
      default: return ok(undefined);
    }
  }

  /** (Re)planifie l'examen : possible tant qu'il n'est pas réalisé. Le créneau ne peut pas être dans le passé. */
  schedule(by: string, when: Instant, now: Instant): Result<void> {
    const open = this.notOpen();
    if (!open.ok) return open;
    if (Temporal.Instant.compare(when, now) < 0) return refuse('IMG_SCHEDULE_IN_PAST', 'Le créneau choisi est déjà passé.');
    this.current = { ...this.current, scheduledFor: when, scheduledBy: by };
    return ok(undefined);
  }

  /**
   * Réalise l'examen. Le dépistage est obligatoire ; une grossesse sous rayons ionisants ou une allergie connue au produit de contraste
   * bloquent l'examen tant qu'aucun motif de dérogation n'est écrit (il est alors conservé).
   */
  perform(input: PerformInput, usesContrast: boolean): Result<void> {
    const open = this.notOpen();
    if (!open.ok) return open;
    const pregnancyBlocks = input.pregnant && isIonizing(this.current.modality);
    const allergyBlocks = input.contrastAllergy && usesContrast;
    if ((pregnancyBlocks || allergyBlocks) && input.overrideReason === null) {
      return pregnancyBlocks
        ? refuse('IMG_PREGNANCY_RISK', 'Patiente enceinte et examen irradiant : précisez le motif de la dérogation pour poursuivre.')
        : refuse('IMG_CONTRAST_ALLERGY', 'Allergie connue au produit de contraste : précisez le motif de la dérogation pour poursuivre.');
    }
    this.current = {
      ...this.current, performedAt: input.at, performedBy: input.by, techniqueNote: input.techniqueNote,
      screening: { pregnant: input.pregnant, contrastAllergy: input.contrastAllergy, overrideReason: pregnancyBlocks || allergyBlocks ? input.overrideReason : null },
    };
    return ok(undefined);
  }

  /** Annule une demande qui n'a pas encore donné lieu à l'examen. */
  cancel(by: string, at: Instant, reason: Reason): Result<void> {
    const open = this.notOpen();
    if (!open.ok) return open;
    this.current = { ...this.current, cancelledBy: by, cancelledAt: at, cancellationReason: reason };
    return ok(undefined);
  }

  /** Enregistre (ou remplace) le brouillon du compte rendu : seulement entre la réalisation et la signature. */
  saveDraft(input: DraftInput, by: string, at: Instant): Result<void> {
    if (this.status !== 'PERFORMED') return refuse('IMG_REPORT_NOT_DRAFTABLE', this.status === 'REPORTED' ? 'Le compte rendu est signé : complétez-le par un addendum.' : 'L’examen doit être réalisé avant d’en rédiger le compte rendu.');
    const text = checkReportText(input);
    if (!text.ok) return text;
    this.current = { ...this.current, draft: { technique: input.technique, findings: input.findings, impression: input.impression, critical: input.critical, by, at } };
    return ok(undefined);
  }

  /** Documente l'appel du clinicien pour la découverte critique du brouillon (relecture obligatoire). */
  recordCommunication(input: CommunicationInput, by: string, at: Instant): Result<void> {
    if (this.status !== 'PERFORMED' || !this.current.draft?.critical) return refuse('IMG_REPORT_NOT_CRITICAL', 'Aucune découverte critique à communiquer : marquez le brouillon du compte rendu comme critique.');
    const valid = checkCommunication(input);
    if (!valid.ok) return valid;
    this.current = {
      ...this.current,
      communications: [...this.current.communications, { version: this.current.versions.length + 1, notifiedName: input.notifiedName.trim(), notifiedRole: input.notifiedRole.trim(), method: input.method, readBackConfirmed: true, at, by }],
    };
    return ok(undefined);
  }

  /** Signe le compte rendu : constatations et impression obligatoires ; une découverte critique exige l'appel documenté. Le brouillon disparaît. */
  sign(by: string, at: Instant): Result<void> {
    if (this.status !== 'PERFORMED') return refuse('IMG_REPORT_NOT_SIGNABLE', this.status === 'REPORTED' ? 'Le compte rendu est déjà signé.' : 'L’examen doit être réalisé avant de signer un compte rendu.');
    const draft = this.current.draft;
    if (!draft || !filled(draft.findings) || !filled(draft.impression)) return refuse('IMG_REPORT_INCOMPLETE', 'Les constatations et l’impression sont obligatoires pour signer.');
    if (draft.critical && !this.current.communications.some((c) => c.version === 1)) return refuse('IMG_CRITICAL_NOT_COMMUNICATED', 'Découverte critique : documentez d’abord l’appel du clinicien (avec relecture) avant de signer.');
    this.current = {
      ...this.current, draft: null,
      versions: [{ version: 1, technique: draft.technique, findings: draft.findings.trim(), impression: draft.impression.trim(), critical: draft.critical, reason: null, signedBy: by, signedAt: at }],
    };
    return ok(undefined);
  }

  /** Complète un compte rendu signé : nouvelle version signée avec son motif ; les versions précédentes restent lisibles. */
  addendum(input: AddendumInput, by: string, at: Instant): Result<void> {
    if (this.status !== 'REPORTED') return refuse('IMG_REPORT_NOT_SIGNED', 'Seul un compte rendu signé se complète par un addendum.');
    const text = checkReportText(input);
    if (!text.ok) return text;
    if (!filled(input.findings) || !filled(input.impression)) return refuse('IMG_REPORT_INCOMPLETE', 'Les constatations et l’impression sont obligatoires pour signer.');
    const version = this.current.versions.length + 1;
    let communications = this.current.communications;
    if (input.critical) {
      if (!input.communication) return refuse('IMG_CRITICAL_NOT_COMMUNICATED', 'Découverte critique : documentez l’appel du clinicien (avec relecture) pour signer cet addendum.');
      const valid = checkCommunication(input.communication);
      if (!valid.ok) return valid;
      communications = [...communications, { version, notifiedName: input.communication.notifiedName.trim(), notifiedRole: input.communication.notifiedRole.trim(), method: input.communication.method, readBackConfirmed: true, at, by }];
    }
    this.current = {
      ...this.current, communications,
      versions: [...this.current.versions, { version, technique: input.technique, findings: input.findings.trim(), impression: input.impression.trim(), critical: input.critical, reason: input.reason.value, signedBy: by, signedAt: at }],
    };
    return ok(undefined);
  }
}
