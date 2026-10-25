import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Calendar, Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { PlainDate, Temporal } from '../../../../shared-kernel/temporal';
import { AssignmentRepository, ReferenceCatalog, ReferenceCodes, StaffRepository, StaffStatusFilter, UserDirectory } from '../../domain/ports';
import { StaffMember } from '../../domain/staff-member';
import { ContactEmail, parseDate, PersonName, PhoneNumber, ReferenceCode, StaffId, StaffNumber, UserRef } from '../../domain/values';
import { AssignmentView, StaffView, toAssignmentView, toStaffView } from '../views';

const NOT_FOUND = new DomainError('STAFF_NOT_FOUND', 'Membre du personnel introuvable.');
const NO_PROFILE = new DomainError('STAFF_PROFILE_NOT_FOUND', "Aucune fiche de personnel n'est reliée à votre compte.");
const DUPLICATE_NUMBER = new DomainError('STAFF_NUMBER_ALREADY_EXISTS', 'Un membre du personnel utilise déjà ce matricule.');
const USER_UNKNOWN = new DomainError('STAFF_USER_UNKNOWN', "Ce compte n'existe pas.");
const USER_ALREADY_LINKED = new DomainError('STAFF_USER_ALREADY_LINKED', 'Ce compte est déjà relié à un autre membre du personnel.');
const DEPARTURE_BEFORE_ASSIGNMENT = new DomainError('STAFF_DEPARTURE_BEFORE_ASSIGNMENT_START', "Le départ précède le début d'une affectation : corrigez ou terminez-la d'abord.");

async function loadStaff(staff: StaffRepository, rawId: string): Promise<Result<StaffMember>> {
  const id = StaffId.create(rawId);
  if (!id.ok) return err(NOT_FOUND); // un identifiant mal formé ne désigne personne
  const found = await staff.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

/** Vérifie qu'un code existe et est actif dans le catalogue ; sinon renvoie l'erreur propre au catalogue. */
async function checkedReference(refs: ReferenceCodes, catalog: ReferenceCatalog, raw: string): Promise<Result<ReferenceCode>> {
  const errorCode = catalog === 'PROFESSION' ? 'STAFF_PROFESSION_UNKNOWN' : 'STAFF_SPECIALTY_UNKNOWN';
  const code = ReferenceCode.create(raw, errorCode);
  if (!code.ok) return err(code.error);
  return (await refs.isActive(catalog, code.value.value)) ? ok(code.value) : err(new DomainError(errorCode, "Cette valeur n'existe pas ou n'est plus active.", { value: raw }));
}

/** Champ facultatif : absent → inchangé (`undefined`), `null` ou vide → retiré, sinon valeur à valider. */
const optional = <T>(raw: string | null | undefined, parse: (v: string) => Result<T>): Result<T | null | undefined> => {
  if (raw === undefined) return ok(undefined);
  if (raw === null || raw.trim() === '') return ok(null);
  return parse(raw);
};

export class GetStaffUseCase {
  constructor(private readonly staff: StaffRepository, private readonly calendar: Calendar) {}

  async execute(id: string): Promise<Result<StaffView>> {
    const found = await loadStaff(this.staff, id);
    return found.ok ? ok(toStaffView(found.value, this.calendar.today())) : err(found.error);
  }
}

export class ListStaffUseCase {
  constructor(private readonly staff: StaffRepository, private readonly calendar: Calendar) {}

  async execute(options: { search?: string; status?: string; professionCode?: string; offset: number; limit: number }): Promise<Result<{ items: StaffView[]; total: number; offset: number; limit: number }>> {
    const status = options.status?.trim().toUpperCase() || undefined;
    if (status !== undefined && status !== 'ACTIVE' && status !== 'DEPARTED') {
      return err(new DomainError('STAFF_STATUS_FILTER_INVALID', 'Le filtre de situation doit valoir ACTIVE ou DEPARTED.', { value: options.status ?? '' }));
    }
    const offset = Math.max(0, Math.trunc(options.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(options.limit)));
    const today = this.calendar.today();
    const { items, total } = await this.staff.list(
      { search: options.search?.trim() || undefined, status: status as StaffStatusFilter | undefined, professionCode: options.professionCode?.trim().toUpperCase() || undefined, today },
      offset,
      limit,
    );
    return ok({ items: items.map((s) => toStaffView(s, today)), total, offset, limit });
  }
}

/** « Mon profil » : la fiche reliée au compte connecté et ses affectations en cours ou à venir. */
export class GetMyStaffProfileUseCase {
  constructor(private readonly staff: StaffRepository, private readonly assignments: AssignmentRepository, private readonly calendar: Calendar) {}

  async execute(userId: string): Promise<Result<{ staff: StaffView; assignments: AssignmentView[] }>> {
    const ref = UserRef.create(userId);
    if (!ref.ok) return err(NO_PROFILE);
    const found = await this.staff.findByUserId(ref.value);
    if (!found) return err(NO_PROFILE);
    const today = this.calendar.today();
    const all = await this.assignments.listByStaff(found.id);
    return ok({
      staff: toStaffView(found, today),
      assignments: all.filter((a) => a.endDate === null || Temporal.PlainDate.compare(a.endDate, today) >= 0).map((a) => toAssignmentView(a, today)),
    });
  }
}

export class RegisterStaffUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly refs: ReferenceCodes,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
    private readonly calendar: Calendar,
  ) {}

  async execute(
    actorId: string,
    input: { staffNumber: string; firstName: string; lastName: string; professionCode: string; specialtyCode?: string | null; email?: string | null; phone?: string | null; hiredOn?: string | null },
  ): Promise<Result<StaffView>> {
    const staffNumber = StaffNumber.create(input.staffNumber);
    if (!staffNumber.ok) return err(staffNumber.error);
    const firstName = PersonName.create(input.firstName, 'firstName');
    if (!firstName.ok) return err(firstName.error);
    const lastName = PersonName.create(input.lastName, 'lastName');
    if (!lastName.ok) return err(lastName.error);
    const email = optional(input.email, ContactEmail.create);
    if (!email.ok) return err(email.error);
    const phone = optional(input.phone, PhoneNumber.create);
    if (!phone.ok) return err(phone.error);
    const hiredOn = optional(input.hiredOn, (v) => parseDate(v, 'hiredOn'));
    if (!hiredOn.ok) return err(hiredOn.error);
    const profession = await checkedReference(this.refs, 'PROFESSION', input.professionCode);
    if (!profession.ok) return err(profession.error);
    const specialty = input.specialtyCode ? await checkedReference(this.refs, 'SPECIALTY', input.specialtyCode) : ok(null);
    if (!specialty.ok) return err(specialty.error);
    if (await this.staff.findByNumber(staffNumber.value)) return err(DUPLICATE_NUMBER);

    const id = StaffId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const member = StaffMember.register({
      id: id.value, staffNumber: staffNumber.value, firstName: firstName.value, lastName: lastName.value,
      professionCode: profession.value, specialtyCode: specialty.value, email: email.value ?? null, phone: phone.value ?? null, hiredOn: hiredOn.value ?? null,
    });
    await this.staff.save(member);
    // Le journal d'audit ne contient pas de donnée personnelle : matricule et profession suffisent à retrouver la fiche.
    await this.audit.record({
      action: 'staff.member.register', outcome: 'SUCCESS', actorId, resourceType: 'staff-member', resourceId: id.value.value,
      metadata: { staffNumber: staffNumber.value.value, professionCode: profession.value.value }, occurredAt: this.clock.now(),
    });
    return ok(toStaffView(member, this.calendar.today()));
  }
}

/** Modifications d'une fiche existante : identité professionnelle, coordonnées, départ, compte relié. */
export class ManageStaffUseCases {
  constructor(
    private readonly staff: StaffRepository,
    private readonly assignments: AssignmentRepository,
    private readonly refs: ReferenceCodes,
    private readonly users: UserDirectory,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
    private readonly calendar: Calendar,
  ) {}

  /** Champs absents : inchangés. `specialtyCode`, `email`, `phone` et `hiredOn` à `null` : valeur retirée. Le matricule ne change jamais. */
  async update(
    actorId: string,
    id: string,
    input: { firstName?: string; lastName?: string; professionCode?: string; specialtyCode?: string | null; email?: string | null; phone?: string | null; hiredOn?: string | null },
  ): Promise<Result<StaffView>> {
    const loaded = await loadStaff(this.staff, id);
    if (!loaded.ok) return err(loaded.error);
    const member = loaded.value;

    const firstName = input.firstName === undefined ? ok(member.firstName) : PersonName.create(input.firstName, 'firstName');
    if (!firstName.ok) return err(firstName.error);
    const lastName = input.lastName === undefined ? ok(member.lastName) : PersonName.create(input.lastName, 'lastName');
    if (!lastName.ok) return err(lastName.error);
    const email = optional(input.email, ContactEmail.create);
    if (!email.ok) return err(email.error);
    const phone = optional(input.phone, PhoneNumber.create);
    if (!phone.ok) return err(phone.error);
    const hiredOn = optional(input.hiredOn, (v) => parseDate(v, 'hiredOn'));
    if (!hiredOn.ok) return err(hiredOn.error);

    const changed: string[] = [];
    if (!firstName.value.equals(member.firstName) || !lastName.value.equals(member.lastName)) {
      member.rename(firstName.value, lastName.value);
      changed.push('name');
    }
    if (input.professionCode !== undefined) {
      const profession = await checkedReference(this.refs, 'PROFESSION', input.professionCode);
      if (!profession.ok) return err(profession.error);
      if (!profession.value.equals(member.professionCode)) {
        member.changeProfession(profession.value);
        changed.push('professionCode');
      }
    }
    if (input.specialtyCode !== undefined) {
      const specialty = input.specialtyCode === null || input.specialtyCode.trim() === '' ? ok(null) : await checkedReference(this.refs, 'SPECIALTY', input.specialtyCode);
      if (!specialty.ok) return err(specialty.error);
      if ((specialty.value?.value ?? null) !== (member.specialtyCode?.value ?? null)) {
        member.assignSpecialty(specialty.value);
        changed.push('specialtyCode');
      }
    }
    const nextEmail = email.value === undefined ? member.email : email.value;
    const nextPhone = phone.value === undefined ? member.phone : phone.value;
    if ((nextEmail?.value ?? null) !== (member.email?.value ?? null) || (nextPhone?.value ?? null) !== (member.phone?.value ?? null)) {
      member.changeContact(nextEmail, nextPhone);
      changed.push('contact');
    }
    if (hiredOn.value !== undefined && (hiredOn.value?.toString() ?? null) !== (member.hiredOn?.toString() ?? null)) {
      const r = member.recordHiring(hiredOn.value);
      if (!r.ok) return err(r.error);
      changed.push('hiredOn');
    }
    if (changed.length === 0) return ok(toStaffView(member, this.calendar.today()));

    await this.staff.save(member);
    await this.record(actorId, 'staff.member.update', member, { changed: changed.join(',') });
    return ok(toStaffView(member, this.calendar.today()));
  }

  /**
   * Enregistre le départ (aujourd'hui par défaut) et termine à cette date les affectations qui se poursuivaient. Refusé si une
   * affectation commence après la date de départ : l'historique ne doit pas être réécrit en silence.
   */
  async depart(actorId: string, id: string, input: { departedOn?: string }): Promise<Result<StaffView>> {
    const date: Result<PlainDate> = input.departedOn ? parseDate(input.departedOn, 'departedOn') : ok(this.calendar.today());
    if (!date.ok) return err(date.error);
    const loaded = await loadStaff(this.staff, id);
    if (!loaded.ok) return err(loaded.error);
    const member = loaded.value;

    const departed = member.depart(date.value); // d'abord : un départ déjà enregistré ou avant l'embauche prime sur le reste
    if (!departed.ok) return err(departed.error);
    const assignments = await this.assignments.listByStaff(member.id);
    if (assignments.some((a) => Temporal.PlainDate.compare(a.startDate, date.value) > 0)) return err(DEPARTURE_BEFORE_ASSIGNMENT);

    const toEnd = assignments.filter((a) => a.endDate === null || Temporal.PlainDate.compare(a.endDate, date.value) > 0).length;
    await this.staff.saveDeparture(member);
    await this.record(actorId, 'staff.member.depart', member, { departedOn: date.value.toString(), endedAssignments: toEnd });
    return ok(toStaffView(member, this.calendar.today()));
  }

  /** Relie un compte de connexion à la fiche (un compte pour une fiche, et inversement). */
  async linkAccount(actorId: string, id: string, rawUserId: string): Promise<Result<StaffView>> {
    const userId = UserRef.create(rawUserId);
    if (!userId.ok) return err(userId.error);
    const loaded = await loadStaff(this.staff, id);
    if (!loaded.ok) return err(loaded.error);
    const member = loaded.value;
    if (!(await this.users.exists(userId.value))) return err(USER_UNKNOWN);
    const owner = await this.staff.findByUserId(userId.value);
    if (owner && !owner.id.equals(member.id)) return err(USER_ALREADY_LINKED);
    if (owner) return ok(toStaffView(member, this.calendar.today())); // déjà relié à ce compte : rien à faire
    const linked = member.linkAccount(userId.value);
    if (!linked.ok) return err(linked.error);

    await this.staff.save(member);
    await this.record(actorId, 'staff.member.link-account', member, { userId: userId.value.value });
    return ok(toStaffView(member, this.calendar.today()));
  }

  async unlinkAccount(actorId: string, id: string): Promise<Result<StaffView>> {
    const loaded = await loadStaff(this.staff, id);
    if (!loaded.ok) return err(loaded.error);
    const member = loaded.value;
    const previous = member.userId?.value;
    if (!previous) return ok(toStaffView(member, this.calendar.today()));
    member.unlinkAccount();
    await this.staff.save(member);
    await this.record(actorId, 'staff.member.unlink-account', member, { userId: previous });
    return ok(toStaffView(member, this.calendar.today()));
  }

  private record(actorId: string, action: string, member: StaffMember, extra: Record<string, string | number>): Promise<void> {
    return this.audit.record({
      action, outcome: 'SUCCESS', actorId, resourceType: 'staff-member', resourceId: member.id.value,
      metadata: { staffNumber: member.staffNumber.value, ...extra }, occurredAt: this.clock.now(),
    });
  }
}
