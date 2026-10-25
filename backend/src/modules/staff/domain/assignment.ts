import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../shared-kernel/temporal';
import { AssignmentId, FacilityRef, NodeRef, StaffId } from './values';

export interface AssignmentState {
  readonly id: AssignmentId;
  readonly staffId: StaffId;
  readonly nodeId: NodeRef;
  readonly facilityId: FacilityRef;
  readonly startDate: PlainDate;
  readonly endDate: PlainDate | null;
  readonly primary: boolean;
}

const before = (a: PlainDate, b: PlainDate) => Temporal.PlainDate.compare(a, b) < 0;

/**
 * Affectation : une personne travaille dans un service ou une unité pendant une période (fin ouverte tant qu'elle n'est pas
 * décidée). L'historique est conservé : une affectation qui prend fin reçoit une date de fin, elle n'est jamais supprimée.
 * L'affectation « principale » est le rattachement de référence de la personne (un seul à la fois).
 */
export class Assignment {
  private constructor(private state: AssignmentState) {}

  static restore(state: AssignmentState): Assignment {
    return new Assignment(state);
  }

  static create(input: AssignmentState): Result<Assignment> {
    if (input.endDate && before(input.endDate, input.startDate)) {
      return err(new DomainError('ASSIGNMENT_PERIOD_INVALID', 'La date de fin précède la date de début.'));
    }
    return ok(new Assignment(input));
  }

  get id(): AssignmentId { return this.state.id; }
  get staffId(): StaffId { return this.state.staffId; }
  get nodeId(): NodeRef { return this.state.nodeId; }
  get facilityId(): FacilityRef { return this.state.facilityId; }
  get startDate(): PlainDate { return this.state.startDate; }
  get endDate(): PlainDate | null { return this.state.endDate; }
  get primary(): boolean { return this.state.primary; }

  /** En cours à cette date : commencée, et pas terminée avant. */
  isCurrentOn(date: PlainDate): boolean {
    return !before(date, this.state.startDate) && (this.state.endDate === null || !before(this.state.endDate, date));
  }

  /** Les deux périodes ont au moins un jour en commun (bornes incluses ; une fin absente est sans limite). */
  overlaps(other: Assignment): boolean {
    const thisEndsBeforeOtherStarts = this.state.endDate !== null && before(this.state.endDate, other.state.startDate);
    const otherEndsBeforeThisStarts = other.state.endDate !== null && before(other.state.endDate, this.state.startDate);
    return !thisEndsBeforeOtherStarts && !otherEndsBeforeThisStarts;
  }

  /** Termine l'affectation (une fois) à la date donnée, jamais avant son début. */
  end(endDate: PlainDate): Result<void> {
    if (this.state.endDate) return err(new DomainError('ASSIGNMENT_ALREADY_ENDED', 'Cette affectation est déjà terminée.'));
    if (before(endDate, this.state.startDate)) return err(new DomainError('ASSIGNMENT_PERIOD_INVALID', 'La date de fin précède la date de début.'));
    this.state = { ...this.state, endDate };
    return ok(undefined);
  }

  markPrimary(primary: boolean): void {
    this.state = { ...this.state, primary };
  }
}
