import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { Instant } from '../../../shared-kernel/temporal';
import { AllergyId, parseClinicalText, PatientRef, requiredText, Severity } from './values';

export type AllergyStatus = 'ACTIVE' | 'ENTERED_IN_ERROR';

export interface AllergyState {
  readonly id: AllergyId;
  readonly patientId: PatientRef;
  /** Substance en cause : un médicament (« Pénicilline »), une classe, un aliment, le latex… */
  readonly substance: string;
  readonly reaction: string | null;
  readonly severity: Severity;
  readonly status: AllergyStatus;
  readonly recordedBy: string;
  readonly recordedAt: Instant;
  readonly voidedBy: string | null;
  readonly voidedAt: Instant | null;
  readonly voidReason: string | null;
}

const VOIDED = new DomainError('CLINICAL_ALLERGY_VOIDED', 'Cette allergie a été déclarée saisie par erreur : elle ne peut plus être modifiée.');

/** Allergie d'un patient. Rien n'est supprimé : une saisie erronée est déclarée telle, avec son motif, et sort de la liste active. */
export class Allergy {
  private constructor(private current: AllergyState) {}

  static restore(state: AllergyState): Allergy {
    return new Allergy(state);
  }

  static record(input: { readonly id: AllergyId; readonly patientId: PatientRef; readonly substance: string; readonly reaction?: string | null; readonly severity: Severity; readonly by: string; readonly at: Instant }): Result<Allergy> {
    const substance = requiredText((input.substance ?? '').replace(/\s+/g, ' '), 100, 'CLINICAL_SUBSTANCE_INVALID', 'La substance doit comporter de 1 à 100 caractères.');
    if (!substance.ok) return err(substance.error);
    const reaction = parseClinicalText(input.reaction, 200, 'CLINICAL_REACTION_INVALID');
    if (!reaction.ok) return err(reaction.error);
    return ok(new Allergy({
      id: input.id, patientId: input.patientId, substance: substance.value, reaction: reaction.value, severity: input.severity, status: 'ACTIVE', recordedBy: input.by, recordedAt: input.at,
      voidedBy: null, voidedAt: null, voidReason: null,
    }));
  }

  get state(): AllergyState { return this.current; }
  get id(): AllergyId { return this.current.id; }

  /** Corrige la réaction et/ou la gravité (la substance ne change pas : une autre substance est une autre allergie). `null` efface la réaction. */
  update(changes: { readonly reaction?: string | null; readonly severity?: Severity }): Result<void> {
    if (this.current.status !== 'ACTIVE') return err(VOIDED);
    let reaction = this.current.reaction;
    if (changes.reaction !== undefined) {
      const parsed = parseClinicalText(changes.reaction, 200, 'CLINICAL_REACTION_INVALID');
      if (!parsed.ok) return err(parsed.error);
      reaction = parsed.value;
    }
    this.current = { ...this.current, reaction, severity: changes.severity ?? this.current.severity };
    return ok(undefined);
  }

  /** Déclare la saisie erronée : l'allergie sort de la liste active mais reste au dossier. Le motif est obligatoire. */
  void(reason: string, by: string, at: Instant): Result<void> {
    if (this.current.status !== 'ACTIVE') return err(VOIDED);
    const why = requiredText(reason, 200, 'CLINICAL_REASON_REQUIRED', 'Le motif est obligatoire (200 caractères au plus).');
    if (!why.ok) return err(why.error);
    this.current = { ...this.current, status: 'ENTERED_IN_ERROR', voidedBy: by, voidedAt: at, voidReason: why.value };
    return ok(undefined);
  }
}
