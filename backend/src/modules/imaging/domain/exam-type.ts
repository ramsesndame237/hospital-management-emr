import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { ExamCode, ExamName, ExamTypeId, Modality } from './values';

export interface ExamTypeState {
  readonly id: ExamTypeId;
  readonly code: ExamCode;
  readonly name: ExamName;
  /** Ne change jamais : elle décide si l'examen est irradiant. */
  readonly modality: Modality;
  /** Région examinée (thorax, abdomen, genou…). */
  readonly bodyPart: string | null;
  /** Examen avec produit de contraste : une allergie connue doit être levée explicitement avant de le réaliser. */
  readonly usesContrast: boolean;
  /** Durée prévue du créneau, en minutes. */
  readonly durationMinutes: number;
  /** Préparation du patient (à jeun, vessie pleine…), donnée avec le rendez-vous. */
  readonly preparation: string | null;
  readonly active: boolean;
}

function consistent(s: Omit<ExamTypeState, 'active'>): Result<void> {
  if (s.bodyPart !== null && (s.bodyPart.length < 1 || s.bodyPart.length > 60)) return err(new DomainError('IMG_EXAM_BODY_PART_INVALID', 'La région examinée doit comporter de 1 à 60 caractères.'));
  if (!Number.isInteger(s.durationMinutes) || s.durationMinutes < 5 || s.durationMinutes > 480) return err(new DomainError('IMG_EXAM_DURATION_INVALID', 'La durée doit être de 5 à 480 minutes.'));
  if (s.preparation !== null && s.preparation.length > 500) return err(new DomainError('IMG_EXAM_PREPARATION_INVALID', 'La préparation ne doit pas dépasser 500 caractères.'));
  return ok(undefined);
}

/**
 * Examen du catalogue (radiographie du thorax, échographie abdominale…). Le code et la modalité ne changent jamais : les demandes y renvoient.
 * Rien n'est supprimé : un examen retiré se désactive et ne peut plus être demandé.
 */
export class ExamType {
  private constructor(private current: ExamTypeState) {}

  static restore(state: ExamTypeState): ExamType {
    return new ExamType(state);
  }

  static create(state: Omit<ExamTypeState, 'active'>): Result<ExamType> {
    const valid = consistent(state);
    return valid.ok ? ok(new ExamType({ ...state, active: true })) : err(valid.error);
  }

  get state(): ExamTypeState { return this.current; }
  get id(): ExamTypeId { return this.current.id; }
  get active(): boolean { return this.current.active; }

  /** Champs absents : inchangés. `bodyPart` et `preparation` à `null` : effacés. Le code et la modalité ne changent pas. */
  update(changes: Partial<Pick<ExamTypeState, 'name' | 'bodyPart' | 'usesContrast' | 'durationMinutes' | 'preparation'>>): Result<void> {
    const next = { ...this.current, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) } as ExamTypeState;
    const valid = consistent(next);
    if (!valid.ok) return valid;
    this.current = next;
    return ok(undefined);
  }

  setActive(active: boolean): void {
    this.current = { ...this.current, active };
  }
}
