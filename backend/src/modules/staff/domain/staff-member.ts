import { DomainError, err, ok, Result } from '../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../shared-kernel/temporal';
import { ContactEmail, PersonName, PhoneNumber, ReferenceCode, StaffId, StaffNumber, UserRef } from './values';

export interface StaffState {
  readonly id: StaffId;
  readonly staffNumber: StaffNumber;
  readonly firstName: PersonName;
  readonly lastName: PersonName;
  readonly professionCode: ReferenceCode;
  readonly specialtyCode: ReferenceCode | null;
  readonly email: ContactEmail | null;
  readonly phone: PhoneNumber | null;
  readonly hiredOn: PlainDate | null;
  readonly departedOn: PlainDate | null;
  readonly userId: UserRef | null;
}

const ALREADY_DEPARTED = new DomainError('STAFF_ALREADY_DEPARTED', 'Ce membre du personnel a déjà un départ enregistré.');
const NOT_DEPARTED_YET = (field: string) => new DomainError('STAFF_DATES_INCONSISTENT', `La date « ${field} » est incohérente avec les autres dates.`, { field });

/**
 * Membre du personnel : la personne qui travaille dans l'établissement, avec ou sans compte de connexion. Un compte (IAM)
 * peut lui être relié, une fois au plus, mais l'identité professionnelle existe sans compte (agent d'entretien, vacataire…).
 *
 * Rien n'est jamais supprimé : un départ est une date. Le matricule ne change jamais.
 */
export class StaffMember {
  private constructor(private state: StaffState) {}

  /** Reconstitue un membre lu en base, ou en crée un nouveau (sans départ ni compte). */
  static restore(state: StaffState): StaffMember {
    return new StaffMember(state);
  }

  static register(input: Omit<StaffState, 'departedOn' | 'userId'>): StaffMember {
    return new StaffMember({ ...input, departedOn: null, userId: null });
  }

  get id(): StaffId { return this.state.id; }
  get staffNumber(): StaffNumber { return this.state.staffNumber; }
  get firstName(): PersonName { return this.state.firstName; }
  get lastName(): PersonName { return this.state.lastName; }
  get professionCode(): ReferenceCode { return this.state.professionCode; }
  get specialtyCode(): ReferenceCode | null { return this.state.specialtyCode; }
  get email(): ContactEmail | null { return this.state.email; }
  get phone(): PhoneNumber | null { return this.state.phone; }
  get hiredOn(): PlainDate | null { return this.state.hiredOn; }
  get departedOn(): PlainDate | null { return this.state.departedOn; }
  get userId(): UserRef | null { return this.state.userId; }

  /** Parti à la date donnée : le départ est enregistré et il est atteint (ce jour inclus). */
  hasDepartedBy(date: PlainDate): boolean {
    return this.state.departedOn !== null && Temporal.PlainDate.compare(this.state.departedOn, date) <= 0;
  }

  /** Vrai si la personne est en poste à cette date : embauchée (si l'embauche est connue) et pas encore partie. */
  isEmployedOn(date: PlainDate): boolean {
    const hired = this.state.hiredOn === null || Temporal.PlainDate.compare(this.state.hiredOn, date) <= 0;
    return hired && !this.hasDepartedBy(date);
  }

  rename(firstName: PersonName, lastName: PersonName): void {
    this.state = { ...this.state, firstName, lastName };
  }

  changeProfession(professionCode: ReferenceCode): void {
    this.state = { ...this.state, professionCode };
  }

  /** `null` retire la spécialité. */
  assignSpecialty(specialtyCode: ReferenceCode | null): void {
    this.state = { ...this.state, specialtyCode };
  }

  changeContact(email: ContactEmail | null, phone: PhoneNumber | null): void {
    this.state = { ...this.state, email, phone };
  }

  /** `null` efface la date d'embauche. Elle ne peut pas suivre la date de départ. */
  recordHiring(hiredOn: PlainDate | null): Result<void> {
    if (hiredOn && this.state.departedOn && Temporal.PlainDate.compare(hiredOn, this.state.departedOn) > 0) return err(NOT_DEPARTED_YET('hiredOn'));
    this.state = { ...this.state, hiredOn };
    return ok(undefined);
  }

  /** Enregistre le départ. Une seule fois ; jamais avant l'embauche. */
  depart(departedOn: PlainDate): Result<void> {
    if (this.state.departedOn) return err(ALREADY_DEPARTED);
    if (this.state.hiredOn && Temporal.PlainDate.compare(departedOn, this.state.hiredOn) < 0) return err(NOT_DEPARTED_YET('departedOn'));
    this.state = { ...this.state, departedOn };
    return ok(undefined);
  }

  linkAccount(userId: UserRef): Result<void> {
    if (this.state.userId) return err(new DomainError('STAFF_ACCOUNT_ALREADY_LINKED', 'Un compte est déjà relié à ce membre du personnel.'));
    this.state = { ...this.state, userId };
    return ok(undefined);
  }

  unlinkAccount(): void {
    this.state = { ...this.state, userId: null };
  }
}
