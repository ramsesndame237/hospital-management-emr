import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { DrugRef, EncounterId, parseClinicalText, PatientRef, PrescriptionId, PrescriptionNumber, requiredText } from './values';

export type PrescriptionStatus = 'ISSUED' | 'CANCELLED';
export const PRESCRIPTION_STATUSES: readonly PrescriptionStatus[] = ['ISSUED', 'CANCELLED'];
export const MAX_PRESCRIPTION_LINES = 20;
export const MAX_LINE_QUANTITY = 10_000;
export const MAX_DURATION_DAYS = 365;

/** Une ligne d'ordonnance : un médicament, comment le prendre, et la quantité à délivrer (en unités de dispensation du médicament). */
export interface PrescriptionLine {
  readonly drugId: DrugRef;
  /** Dose par prise, telle qu'on l'écrit (« 1 comprimé », « 5 mL »). */
  readonly dose: string;
  /** Rythme, tel qu'on l'écrit (« 3 fois par jour », « toutes les 8 h »). */
  readonly frequency: string;
  readonly durationDays: number | null;
  /** Nombre d'unités de dispensation à délivrer. */
  readonly quantity: number;
  readonly instructions: string | null;
  /** Motif du médecin qui prescrit malgré une allergie connue à ce médicament ; absent quand il n'y avait pas d'alerte. */
  readonly allergyOverride: string | null;
}

export interface LineInput {
  readonly drugId: DrugRef;
  readonly dose: string;
  readonly frequency: string;
  readonly durationDays?: number | null;
  readonly quantity: number;
  readonly instructions?: string | null;
  readonly allergyOverride?: string | null;
}

export interface PrescriptionState {
  readonly id: PrescriptionId;
  readonly number: PrescriptionNumber;
  readonly encounterId: EncounterId;
  readonly patientId: PatientRef;
  readonly serviceId: string;
  readonly doctorId: string;
  readonly status: PrescriptionStatus;
  readonly issuedAt: Instant;
  readonly notes: string | null;
  readonly lines: readonly PrescriptionLine[];
  readonly cancelledBy: string | null;
  readonly cancelledAt: Instant | null;
  readonly cancellationReason: string | null;
}

const NOT_AUTHOR = new DomainError('CLINICAL_NOT_AUTHOR', 'Seul le médecin qui conduit cette consultation peut la rédiger, la signer ou l’annuler.');

function parseLine(raw: LineInput, index: number): Result<PrescriptionLine> {
  const where = { line: index + 1 };
  const dose = requiredText((raw.dose ?? '').replace(/\s+/g, ' '), 60, 'CLINICAL_LINE_DOSE_INVALID', `Ligne ${index + 1} : la dose doit comporter de 1 à 60 caractères.`);
  if (!dose.ok) return err(new DomainError(dose.error.code, dose.error.message, where));
  const frequency = requiredText((raw.frequency ?? '').replace(/\s+/g, ' '), 60, 'CLINICAL_LINE_FREQUENCY_INVALID', `Ligne ${index + 1} : le rythme doit comporter de 1 à 60 caractères.`);
  if (!frequency.ok) return err(new DomainError(frequency.error.code, frequency.error.message, where));
  if (!Number.isSafeInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > MAX_LINE_QUANTITY) {
    return err(new DomainError('CLINICAL_LINE_QUANTITY_INVALID', `Ligne ${index + 1} : la quantité doit être un entier de 1 à ${MAX_LINE_QUANTITY}.`, where));
  }
  const days = raw.durationDays ?? null;
  if (days !== null && (!Number.isSafeInteger(days) || days < 1 || days > MAX_DURATION_DAYS)) {
    return err(new DomainError('CLINICAL_LINE_DURATION_INVALID', `Ligne ${index + 1} : la durée doit être un entier de 1 à ${MAX_DURATION_DAYS} jours.`, where));
  }
  const instructions = parseClinicalText(raw.instructions, 200, 'CLINICAL_LINE_INSTRUCTIONS_INVALID');
  if (!instructions.ok) return err(new DomainError('CLINICAL_LINE_INSTRUCTIONS_INVALID', `Ligne ${index + 1} : les consignes ne doivent pas dépasser 200 caractères.`, where));
  const override = parseClinicalText(raw.allergyOverride, 200, 'CLINICAL_LINE_OVERRIDE_INVALID');
  if (!override.ok) return err(new DomainError('CLINICAL_LINE_OVERRIDE_INVALID', `Ligne ${index + 1} : le motif ne doit pas dépasser 200 caractères.`, where));
  return ok({ drugId: raw.drugId, dose: dose.value, frequency: frequency.value, durationDays: days, quantity: raw.quantity, instructions: instructions.value, allergyOverride: override.value });
}

/**
 * Ordonnance : ce qu'un médecin prescrit à un patient pendant une consultation. Elle ne se réécrit pas — une erreur se corrige en l'annulant
 * (avec un motif) et en en émettant une nouvelle. Seul le médecin qui l'a émise l'annule.
 */
export class Prescription {
  private constructor(private current: PrescriptionState) {}

  static restore(state: PrescriptionState): Prescription {
    return new Prescription(state);
  }

  static issue(input: {
    readonly id: PrescriptionId; readonly number: PrescriptionNumber; readonly encounterId: EncounterId; readonly patientId: PatientRef; readonly serviceId: string;
    readonly doctorId: string; readonly issuedAt: Instant; readonly notes?: string | null; readonly lines: readonly LineInput[];
  }): Result<Prescription> {
    if (input.lines.length < 1) return err(new DomainError('CLINICAL_PRESCRIPTION_EMPTY', 'Une ordonnance comporte au moins une ligne.'));
    if (input.lines.length > MAX_PRESCRIPTION_LINES) return err(new DomainError('CLINICAL_PRESCRIPTION_TOO_LONG', `Une ordonnance comporte au plus ${MAX_PRESCRIPTION_LINES} lignes.`, { max: MAX_PRESCRIPTION_LINES }));
    const notes = parseClinicalText(input.notes, 300, 'CLINICAL_PRESCRIPTION_NOTES_INVALID');
    if (!notes.ok) return err(notes.error);
    const lines: PrescriptionLine[] = [];
    for (const [i, raw] of input.lines.entries()) {
      const line = parseLine(raw, i);
      if (!line.ok) return err(line.error);
      lines.push(line.value);
    }
    if (new Set(lines.map((l) => l.drugId.value)).size !== lines.length) return err(new DomainError('CLINICAL_PRESCRIPTION_DUPLICATE_DRUG', 'Un même médicament ne figure qu’une fois sur une ordonnance.'));
    return ok(new Prescription({
      id: input.id, number: input.number, encounterId: input.encounterId, patientId: input.patientId, serviceId: input.serviceId, doctorId: input.doctorId, status: 'ISSUED',
      issuedAt: input.issuedAt, notes: notes.value, lines, cancelledBy: null, cancelledAt: null, cancellationReason: null,
    }));
  }

  get state(): PrescriptionState { return this.current; }
  get id(): PrescriptionId { return this.current.id; }
  get status(): PrescriptionStatus { return this.current.status; }

  /** Annule l'ordonnance : par le médecin qui l'a émise, avec un motif, tant qu'elle est en cours. */
  cancel(reason: string, by: string, at: Instant): Result<void> {
    if (this.current.status !== 'ISSUED') return err(new DomainError('CLINICAL_PRESCRIPTION_CANCELLED', 'Cette ordonnance est déjà annulée.'));
    if (by !== this.current.doctorId) return err(NOT_AUTHOR);
    const why = requiredText(reason, 200, 'CLINICAL_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).');
    if (!why.ok) return err(why.error);
    this.current = { ...this.current, status: 'CANCELLED', cancelledBy: by, cancelledAt: at, cancellationReason: why.value };
    return ok(undefined);
  }
}

const strip = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface AllergyAlert {
  readonly allergyId: string;
  readonly substance: string;
  readonly severity: string;
}

/**
 * Les allergies actives du patient qui visent ce médicament : la substance déclarée figure dans le nom du médicament ou dans sa dénomination
 * commune (sans tenir compte des accents ni de la casse), ou l'inverse. C'est un rapprochement de noms, pas une base de réactions croisées :
 * il attrape « Pénicilline » pour « Pénicilline V », pas « amoxicilline » pour une allergie « aux pénicillines ».
 */
export function allergyAlertsFor(drug: { readonly name: string; readonly genericName: string }, allergies: readonly { readonly id: string; readonly substance: string; readonly severity: string }[]): AllergyAlert[] {
  const names = [strip(drug.name), strip(drug.genericName)];
  return allergies
    .filter((a) => {
      const s = strip(a.substance);
      return s.length >= 3 && names.some((n) => n.includes(s) || (n.length >= 3 && s.includes(n)));
    })
    .map((a) => ({ allergyId: a.id, substance: a.substance, severity: a.severity }));
}
