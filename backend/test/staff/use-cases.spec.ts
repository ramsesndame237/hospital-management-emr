import { ListNodeAssignmentsUseCase, ListStaffAssignmentsUseCase, ManageAssignmentsUseCases } from '../../src/modules/staff/application/use-cases/assignments';
import { GetMyStaffProfileUseCase, GetStaffUseCase, ListStaffUseCase, ManageStaffUseCases, RegisterStaffUseCase } from '../../src/modules/staff/application/use-cases/staff';
import { Assignment } from '../../src/modules/staff/domain/assignment';
import {
  AssignmentRepository, NodeInfo, ReferenceCatalog, ReferenceCodes, StaffFilter, StaffRepository, StaffSummary, StructureDirectory, UserDirectory,
} from '../../src/modules/staff/domain/ports';
import { StaffMember } from '../../src/modules/staff/domain/staff-member';
import {
  AssignmentId, ContactEmail, FacilityRef, NodeRef, parseDate, PersonName, PhoneNumber, ReferenceCode, StaffId, StaffNumber, UserRef,
} from '../../src/modules/staff/domain/values';
import { Calendar } from '../../src/shared-kernel/ports';
import { PlainDate, Temporal } from '../../src/shared-kernel/temporal';
import { FixedClock, MemoryAudit, must, SeqIds } from '../iam/fakes';

class FixedCalendar implements Calendar {
  constructor(public date: PlainDate = Temporal.PlainDate.from('2026-10-23')) {}
  today() { return this.date; }
}

class InMemoryAssignments implements AssignmentRepository {
  readonly byId = new Map<string, Assignment>();
  constructor(private readonly staff: InMemoryStaff) {}
  async findById(id: AssignmentId) { return this.byId.get(id.value) ?? null; }
  async save(a: Assignment) { this.byId.set(a.id.value, a); }
  async listByStaff(id: StaffId) {
    return [...this.byId.values()].filter((a) => a.staffId.equals(id)).sort((a, b) => Temporal.PlainDate.compare(b.startDate, a.startDate));
  }
  async listByNode(node: NodeRef, includeEnded: boolean, today: PlainDate) {
    return [...this.byId.values()]
      .filter((a) => a.nodeId.equals(node) && (includeEnded || a.endDate === null || Temporal.PlainDate.compare(a.endDate, today) >= 0))
      .map((assignment): { assignment: Assignment; staff: StaffSummary } => {
        const s = this.staff.byId.get(assignment.staffId.value)!;
        return { assignment, staff: { id: s.id, staffNumber: s.staffNumber.value, firstName: s.firstName.value, lastName: s.lastName.value, professionCode: s.professionCode.value } };
      });
  }
}

/** Comme une vraie base : chaque lecture renvoie une copie, une modification non enregistrée ne laisse aucune trace. */
const copy = (s: StaffMember | undefined | null): StaffMember | null =>
  s ? StaffMember.restore({ id: s.id, staffNumber: s.staffNumber, firstName: s.firstName, lastName: s.lastName, professionCode: s.professionCode, specialtyCode: s.specialtyCode, email: s.email, phone: s.phone, hiredOn: s.hiredOn, departedOn: s.departedOn, userId: s.userId }) : null;

class InMemoryStaff implements StaffRepository {
  readonly byId = new Map<string, StaffMember>();
  assignments!: InMemoryAssignments;
  async findById(id: StaffId) { return copy(this.byId.get(id.value)); }
  async findByNumber(n: StaffNumber) { return copy([...this.byId.values()].find((s) => s.staffNumber.equals(n))); }
  async findByUserId(u: UserRef) { return copy([...this.byId.values()].find((s) => s.userId?.equals(u))); }
  async save(s: StaffMember) { this.byId.set(s.id.value, s); }
  async saveDeparture(s: StaffMember) {
    this.byId.set(s.id.value, s);
    for (const a of this.assignments.byId.values()) {
      if (a.staffId.equals(s.id) && (a.endDate === null || Temporal.PlainDate.compare(a.endDate, s.departedOn!) > 0)) {
        // simule l'UPDATE du dépôt : la fin devient la date de départ, même si une fin plus tardive était déjà prévue
        this.assignments.byId.set(a.id.value, Assignment.restore({ id: a.id, staffId: a.staffId, nodeId: a.nodeId, facilityId: a.facilityId, startDate: a.startDate, endDate: s.departedOn!, primary: a.primary }));
      }
    }
  }
  async list(filter: StaffFilter, offset: number, limit: number) {
    const all = [...this.byId.values()]
      .filter((s) => !filter.status || (filter.status === 'DEPARTED') === s.hasDepartedBy(filter.today))
      .filter((s) => !filter.professionCode || s.professionCode.value === filter.professionCode)
      .filter((s) => !filter.search || `${s.staffNumber.value} ${s.firstName.value} ${s.lastName.value}`.toLowerCase().includes(filter.search.toLowerCase()))
      .sort((a, b) => a.lastName.value.localeCompare(b.lastName.value));
    return { items: all.slice(offset, offset + limit), total: all.length };
  }
}

const USER = '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73';
const OTHER_USER = '6e92c5de-fde2-48a5-a296-7d5c2f2e2d84';
const NODES: Record<string, NodeInfo> = {
  SERVICE_A: { facilityId: must(FacilityRef.create('11111111-1111-4111-8111-111111111111')), kind: 'SERVICE', active: true },
  SERVICE_B: { facilityId: must(FacilityRef.create('11111111-1111-4111-8111-111111111111')), kind: 'SERVICE', active: true },
  UNIT_A: { facilityId: must(FacilityRef.create('11111111-1111-4111-8111-111111111111')), kind: 'UNIT', active: true },
  ROOM_A: { facilityId: must(FacilityRef.create('11111111-1111-4111-8111-111111111111')), kind: 'ROOM', active: true },
  OLD_SERVICE: { facilityId: must(FacilityRef.create('11111111-1111-4111-8111-111111111111')), kind: 'SERVICE', active: false },
};
const NODE_IDS: Record<string, string> = {
  SERVICE_A: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', SERVICE_B: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', UNIT_A: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  ROOM_A: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', OLD_SERVICE: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
};
const structure: StructureDirectory = {
  describe: async (id: NodeRef) => {
    const key = Object.keys(NODE_IDS).find((k) => NODE_IDS[k] === id.value);
    return key ? NODES[key] : null;
  },
};
const users: UserDirectory = { exists: async (u: UserRef) => [USER, OTHER_USER].includes(u.value) };
const refs: ReferenceCodes = {
  isActive: async (catalog: ReferenceCatalog, code: string) => (catalog === 'PROFESSION' ? ['DOCTOR', 'NURSE'] : ['PEDIATRICS']).includes(code),
};

function build() {
  const staff = new InMemoryStaff();
  const assignments = new InMemoryAssignments(staff);
  staff.assignments = assignments;
  const audit = new MemoryAudit();
  const clock = new FixedClock();
  const calendar = new FixedCalendar();
  const ids = new SeqIds();
  return {
    staff, assignments, audit, calendar,
    register: new RegisterStaffUseCase(staff, refs, ids, audit, clock, calendar),
    manage: new ManageStaffUseCases(staff, assignments, refs, users, audit, clock, calendar),
    get: new GetStaffUseCase(staff, calendar),
    list: new ListStaffUseCase(staff, calendar),
    me: new GetMyStaffProfileUseCase(staff, assignments, calendar),
    assign: new ManageAssignmentsUseCases(staff, assignments, structure, ids, audit, clock, calendar),
    byStaff: new ListStaffAssignmentsUseCase(staff, assignments, calendar),
    byNode: new ListNodeAssignmentsUseCase(structure, assignments, calendar),
  };
}

const ACTOR = 'admin-1';
const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const CURIE = { staffNumber: 'mat-001', firstName: ' Marie ', lastName: 'Curie', professionCode: 'doctor', specialtyCode: 'pediatrics', email: 'M.Curie@Hopital.example', phone: '+237 655 00 00 00', hiredOn: '2024-09-01' };
const SERVICE_A = NODE_IDS.SERVICE_A;

describe('personnel : valeurs', () => {
  it('normalise et valide matricule, noms, e-mail, téléphone et dates', () => {
    expect(must(StaffNumber.create(' mat/2024-01 ')).value).toBe('MAT/2024-01');
    expect(codeOf(StaffNumber.create('mat 1'))).toBe('STAFF_NUMBER_INVALID');
    expect(must(PersonName.create('  Jean   Pierre ', 'firstName')).value).toBe('Jean Pierre');
    for (const bad of ['', '   ', 'x'.repeat(101), 'a\u0000b']) expect(codeOf(PersonName.create(bad, 'lastName'))).toBe('STAFF_NAME_INVALID');
    expect(must(ContactEmail.create(' A@B.Co ')).value).toBe('a@b.co');
    expect(codeOf(ContactEmail.create('pas-un-email'))).toBe('STAFF_EMAIL_INVALID');
    expect(codeOf(PhoneNumber.create('abc'))).toBe('STAFF_PHONE_INVALID');
    expect(codeOf(PhoneNumber.create('+12'))).toBe('STAFF_PHONE_INVALID');
    expect(must(PhoneNumber.create('+237 6 55 00 00 00')).value).toBe('+237 6 55 00 00 00');
    expect(must(parseDate('2024-02-29', 'd')).toString()).toBe('2024-02-29');
    for (const bad of ['2023-02-29', '2024-13-01', '01/02/2024', '2024-1-1', '', 'demain']) expect(codeOf(parseDate(bad, 'd'))).toBe('STAFF_DATE_INVALID');
    expect(codeOf(ReferenceCode.create('a b', 'STAFF_PROFESSION_UNKNOWN'))).toBe('STAFF_PROFESSION_UNKNOWN');
  });
});

describe('personnel : fiches', () => {
  it('enregistre une fiche normalisée, sans donnée personnelle dans l\'audit', async () => {
    const w = build();
    const s = must(await w.register.execute(ACTOR, CURIE));
    expect(s).toMatchObject({
      staffNumber: 'MAT-001', firstName: 'Marie', lastName: 'Curie', professionCode: 'DOCTOR', specialtyCode: 'PEDIATRICS', email: 'm.curie@hopital.example',
      hiredOn: '2024-09-01', departedOn: null, status: 'ACTIVE', userId: null,
    });
    const entry = w.audit.last('staff.member.register')!;
    expect(entry).toMatchObject({ actorId: ACTOR, resourceType: 'staff-member', resourceId: s.id, metadata: { staffNumber: 'MAT-001', professionCode: 'DOCTOR' } });
    expect(JSON.stringify(entry)).not.toMatch(/Curie|Marie|hopital\.example|237/);
  });

  it('refuse matricule en double, profession ou spécialité inconnue, et données invalides', async () => {
    const w = build();
    must(await w.register.execute(ACTOR, CURIE));
    expect(codeOf(await w.register.execute(ACTOR, { ...CURIE, staffNumber: 'MAT-001' }))).toBe('STAFF_NUMBER_ALREADY_EXISTS');
    expect(codeOf(await w.register.execute(ACTOR, { ...CURIE, staffNumber: 'M2', professionCode: 'WIZARD' }))).toBe('STAFF_PROFESSION_UNKNOWN');
    expect(codeOf(await w.register.execute(ACTOR, { ...CURIE, staffNumber: 'M2', specialtyCode: 'ASTROLOGY' }))).toBe('STAFF_SPECIALTY_UNKNOWN');
    expect(codeOf(await w.register.execute(ACTOR, { ...CURIE, staffNumber: 'M2', hiredOn: '2024-02-30' }))).toBe('STAFF_DATE_INVALID');
    expect(codeOf(await w.register.execute(ACTOR, { ...CURIE, staffNumber: 'M2', email: 'x' }))).toBe('STAFF_EMAIL_INVALID');
    expect(codeOf(await w.register.execute(ACTOR, { ...CURIE, staffNumber: 'M2', firstName: ' ' }))).toBe('STAFF_NAME_INVALID');
    expect(must(await w.register.execute(ACTOR, { staffNumber: 'M3', firstName: 'A', lastName: 'B', professionCode: 'NURSE' })).specialtyCode).toBeNull();
  });

  it('modifie les champs fournis (null retire), journalise les noms de champs et ignore les valeurs identiques', async () => {
    const w = build();
    const s = must(await w.register.execute(ACTOR, CURIE));
    const updated = must(await w.manage.update(ACTOR, s.id, { lastName: 'Skłodowska', professionCode: 'NURSE', specialtyCode: null, phone: null, hiredOn: '2024-10-01' }));
    expect(updated).toMatchObject({ lastName: 'Skłodowska', professionCode: 'NURSE', specialtyCode: null, phone: null, hiredOn: '2024-10-01', staffNumber: 'MAT-001' });
    expect(w.audit.last('staff.member.update')?.metadata).toMatchObject({ changed: 'name,professionCode,specialtyCode,contact,hiredOn' });
    const before = w.audit.entries.length;
    must(await w.manage.update(ACTOR, s.id, { lastName: 'Skłodowska', email: 'm.curie@hopital.example', specialtyCode: null }));
    must(await w.manage.update(ACTOR, s.id, {}));
    expect(w.audit.entries).toHaveLength(before);
    expect(codeOf(await w.manage.update(ACTOR, s.id, { professionCode: 'WIZARD' }))).toBe('STAFF_PROFESSION_UNKNOWN');
    expect(codeOf(await w.manage.update(ACTOR, 'pas-un-uuid', { lastName: 'X' }))).toBe('STAFF_NOT_FOUND');
  });

  it('relie un compte une fois, refuse un compte inconnu ou déjà pris, détache sans rien casser', async () => {
    const w = build();
    const a = must(await w.register.execute(ACTOR, CURIE));
    const b = must(await w.register.execute(ACTOR, { ...CURIE, staffNumber: 'MAT-002' }));
    expect(must(await w.manage.linkAccount(ACTOR, a.id, USER)).userId).toBe(USER);
    expect(w.audit.last('staff.member.link-account')?.metadata).toMatchObject({ userId: USER });
    const before = w.audit.entries.length;
    must(await w.manage.linkAccount(ACTOR, a.id, USER)); // déjà relié à cette fiche : rien à faire
    expect(w.audit.entries).toHaveLength(before);
    expect(codeOf(await w.manage.linkAccount(ACTOR, b.id, USER))).toBe('STAFF_USER_ALREADY_LINKED');
    expect(codeOf(await w.manage.linkAccount(ACTOR, a.id, OTHER_USER))).toBe('STAFF_ACCOUNT_ALREADY_LINKED');
    expect(codeOf(await w.manage.linkAccount(ACTOR, b.id, '99999999-9999-4999-8999-999999999999'))).toBe('STAFF_USER_UNKNOWN');
    expect(codeOf(await w.manage.linkAccount(ACTOR, b.id, 'nope'))).toBe('STAFF_USER_INVALID');

    expect(must(await w.manage.unlinkAccount(ACTOR, a.id)).userId).toBeNull();
    must(await w.manage.unlinkAccount(ACTOR, a.id)); // sans compte : sans effet
    expect(must(await w.manage.linkAccount(ACTOR, b.id, USER)).userId).toBe(USER);
  });

  it('liste avec recherche, situation à la date du jour, profession et pagination', async () => {
    const w = build();
    must(await w.register.execute(ACTOR, CURIE));
    const nurse = must(await w.register.execute(ACTOR, { staffNumber: 'MAT-002', firstName: 'Anna', lastName: 'Zola', professionCode: 'NURSE' }));
    must(await w.manage.depart(ACTOR, nurse.id, { departedOn: '2026-01-01' }));
    const names = async (o: Partial<Parameters<ListStaffUseCase['execute']>[0]> = {}) =>
      must(await w.list.execute({ offset: 0, limit: 50, ...o })).items.map((s) => s.lastName);
    expect(await names()).toEqual(['Curie', 'Zola']);
    expect(await names({ status: 'active' })).toEqual(['Curie']);
    expect(await names({ status: 'DEPARTED' })).toEqual(['Zola']);
    expect(await names({ professionCode: 'nurse' })).toEqual(['Zola']);
    expect(await names({ search: ' CURIE ' })).toEqual(['Curie']);
    expect(must(await w.list.execute({ offset: 1, limit: 1 }))).toMatchObject({ total: 2, items: [{ lastName: 'Zola' }] });
    expect(must(await w.list.execute({ offset: -4, limit: 9999 }))).toMatchObject({ offset: 0, limit: 200 });
    expect(codeOf(await w.list.execute({ status: 'RETIRED', offset: 0, limit: 5 }))).toBe('STAFF_STATUS_FILTER_INVALID');
  });
});

describe('personnel : départ', () => {
  it('date le départ, termine les affectations qui se poursuivaient et laisse intactes celles déjà terminées', async () => {
    const w = build();
    const s = must(await w.register.execute(ACTOR, CURIE));
    const open = must(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2025-01-01' }));
    const past = must(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.SERVICE_B, startDate: '2024-10-01', endDate: '2024-12-31' }));
    const later = must(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.UNIT_A, startDate: '2026-02-01', endDate: '2027-02-01' }));

    const departed = must(await w.manage.depart(ACTOR, s.id, { departedOn: '2026-06-30' }));
    expect(departed).toMatchObject({ departedOn: '2026-06-30', status: 'DEPARTED' });
    const ends = Object.fromEntries((await w.assignments.listByStaff(must(StaffId.create(s.id)))).map((a) => [a.id.value, a.endDate?.toString()]));
    expect(ends).toEqual({ [open.id]: '2026-06-30', [past.id]: '2024-12-31', [later.id]: '2026-06-30' });
    expect(w.audit.last('staff.member.depart')?.metadata).toMatchObject({ departedOn: '2026-06-30', endedAssignments: 2 });
  });

  it('refuse un second départ, un départ avant l\'embauche et un départ avant le début d\'une affectation', async () => {
    const w = build();
    const s = must(await w.register.execute(ACTOR, CURIE));
    expect(codeOf(await w.manage.depart(ACTOR, s.id, { departedOn: '2024-08-31' }))).toBe('STAFF_DATES_INCONSISTENT');
    must(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2026-12-01' }));
    expect(codeOf(await w.manage.depart(ACTOR, s.id, { departedOn: '2026-11-30' }))).toBe('STAFF_DEPARTURE_BEFORE_ASSIGNMENT_START');
    expect(codeOf(await w.manage.depart(ACTOR, s.id, { departedOn: 'bientôt' }))).toBe('STAFF_DATE_INVALID');
    must(await w.manage.depart(ACTOR, s.id, { departedOn: '2026-12-31' }));
    expect(codeOf(await w.manage.depart(ACTOR, s.id, {}))).toBe('STAFF_ALREADY_DEPARTED');
  });

  it("un départ programmé laisse la personne en poste jusqu'à la date, puis elle est « partie »", async () => {
    const w = build();
    const s = must(await w.register.execute(ACTOR, CURIE));
    expect(must(await w.manage.depart(ACTOR, s.id, { departedOn: '2026-12-31' })).status).toBe('ACTIVE');
    w.calendar.date = Temporal.PlainDate.from('2026-12-31');
    expect(must(await w.get.execute(s.id)).status).toBe('DEPARTED');
  });
});

describe('personnel : affectations', () => {
  async function staffMember(w: ReturnType<typeof build>, input: Partial<typeof CURIE> = {}) {
    return must(await w.register.execute(ACTOR, { ...CURIE, staffNumber: `M-${Math.random().toString(36).slice(2, 8)}`, ...input }));
  }

  it('affecte à un service ou une unité (début aujourd\'hui par défaut, fin ouverte) avec audit', async () => {
    const w = build();
    const s = await staffMember(w);
    const a = must(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, primary: true }));
    expect(a).toMatchObject({ staffId: s.id, nodeId: SERVICE_A, startDate: '2026-10-23', endDate: null, primary: true, current: true, facilityId: '11111111-1111-4111-8111-111111111111' });
    expect(w.audit.last('staff.assignment.create')).toMatchObject({ resourceId: a.id, metadata: { staffNumber: expect.any(String), nodeId: SERVICE_A, primary: true } });
    expect(must(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.UNIT_A, startDate: '2026-11-01' })).current).toBe(false); // à venir
  });

  it('refuse une salle, un élément désactivé ou inconnu, une personne inconnue et des dates invalides', async () => {
    const w = build();
    const s = await staffMember(w);
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.ROOM_A }))).toBe('ASSIGNMENT_NODE_KIND_INVALID');
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.OLD_SERVICE }))).toBe('ASSIGNMENT_NODE_INACTIVE');
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: '99999999-9999-4999-8999-999999999999' }))).toBe('ASSIGNMENT_NODE_NOT_FOUND');
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: 'nope' }))).toBe('ASSIGNMENT_NODE_INVALID');
    expect(codeOf(await w.assign.assign(ACTOR, '99999999-9999-4999-8999-999999999999', { nodeId: SERVICE_A }))).toBe('STAFF_NOT_FOUND');
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2026-02-30' }))).toBe('STAFF_DATE_INVALID');
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2026-11-01', endDate: '2026-10-01' }))).toBe('ASSIGNMENT_PERIOD_INVALID');
  });

  it("garde la période dans l'emploi : après l'embauche, jusqu'au départ (jour du départ travaillé)", async () => {
    const w = build();
    const s = await staffMember(w, { hiredOn: '2026-06-01' });
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2026-05-31' }))).toBe('ASSIGNMENT_OUTSIDE_EMPLOYMENT');
    must(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2026-06-01', endDate: '2026-12-31' }));
    must(await w.manage.depart(ACTOR, s.id, { departedOn: '2026-12-31' }));
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.SERVICE_B, startDate: '2026-12-31' }))).toBe('ASSIGNMENT_OUTSIDE_EMPLOYMENT'); // parti ce jour-là
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.SERVICE_B, startDate: '2026-11-01' }))).toBe('ASSIGNMENT_OUTSIDE_EMPLOYMENT'); // fin ouverte après le départ
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.SERVICE_B, startDate: '2026-11-01', endDate: '2027-01-31' }))).toBe('ASSIGNMENT_OUTSIDE_EMPLOYMENT');
    must(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.SERVICE_B, startDate: '2026-11-01', endDate: '2026-12-31' }));
  });

  it('refuse le chevauchement au même endroit, mais permet des périodes successives et des services différents', async () => {
    const w = build();
    const s = await staffMember(w);
    must(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2026-01-01', endDate: '2026-06-30' }));
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2026-06-30' }))).toBe('ASSIGNMENT_OVERLAPS'); // bornes incluses
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2025-01-01' }))).toBe('ASSIGNMENT_OVERLAPS'); // fin ouverte englobante
    must(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2026-07-01' }));
    must(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.SERVICE_B, startDate: '2026-03-01' })); // autre service, en parallèle
  });

  it('autorise une seule affectation principale à la fois', async () => {
    const w = build();
    const s = await staffMember(w);
    const first = must(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, primary: true }));
    expect(codeOf(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.SERVICE_B, primary: true }))).toBe('ASSIGNMENT_PRIMARY_CONFLICT');
    const second = must(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.SERVICE_B }));
    expect(codeOf(await w.assign.setPrimary(ACTOR, second.id, true))).toBe('ASSIGNMENT_PRIMARY_CONFLICT');
    must(await w.assign.setPrimary(ACTOR, first.id, false));
    expect(must(await w.assign.setPrimary(ACTOR, second.id, true)).primary).toBe(true);
    const before = w.audit.entries.length;
    must(await w.assign.setPrimary(ACTOR, second.id, true));
    expect(w.audit.entries).toHaveLength(before);
    expect(w.audit.last('staff.assignment.set-primary')).toBeDefined();
    // des périodes qui ne se chevauchent pas peuvent être principales toutes les deux
    must(await w.assign.end(ACTOR, second.id, { endDate: '2026-12-31' }));
    must(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.UNIT_A, startDate: '2027-01-01', primary: true }));
  });

  it("termine une affectation (une fois, jamais avant son début), et la voit « terminée » ensuite", async () => {
    const w = build();
    const s = await staffMember(w);
    const a = must(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2026-10-01' }));
    expect(codeOf(await w.assign.end(ACTOR, a.id, { endDate: '2026-09-30' }))).toBe('ASSIGNMENT_PERIOD_INVALID');
    const ended = must(await w.assign.end(ACTOR, a.id, {}));
    expect(ended).toMatchObject({ endDate: '2026-10-23', current: true });
    expect(w.audit.last('staff.assignment.end')?.metadata).toMatchObject({ endDate: '2026-10-23' });
    expect(codeOf(await w.assign.end(ACTOR, a.id, {}))).toBe('ASSIGNMENT_ALREADY_ENDED');
    w.calendar.date = Temporal.PlainDate.from('2026-10-24');
    expect(must(await w.byStaff.execute(s.id))[0]).toMatchObject({ endDate: '2026-10-23', current: false });
    expect(codeOf(await w.assign.end(ACTOR, 'pas-un-uuid', {}))).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it("liste le personnel d'un service (sans les affectations terminées, sauf demande) et refuse un service inconnu", async () => {
    const w = build();
    const marie = await staffMember(w, { lastName: 'Curie' });
    const anna = await staffMember(w, { firstName: 'Anna', lastName: 'Abel' });
    must(await w.assign.assign(ACTOR, marie.id, { nodeId: SERVICE_A, startDate: '2026-01-01' }));
    must(await w.assign.assign(ACTOR, anna.id, { nodeId: SERVICE_A, startDate: '2025-01-01', endDate: '2026-01-31' }));
    const rows = must(await w.byNode.execute(SERVICE_A, false));
    expect(rows.map((r) => r.staff.lastName)).toEqual(['Curie']);
    expect(must(await w.byNode.execute(SERVICE_A, true)).map((r) => r.staff.lastName).sort()).toEqual(['Abel', 'Curie']);
    expect(rows[0].staff).toEqual({ staffNumber: expect.any(String), firstName: 'Marie', lastName: 'Curie', professionCode: 'DOCTOR' });
    expect(codeOf(await w.byNode.execute('99999999-9999-4999-8999-999999999999', false))).toBe('ASSIGNMENT_NODE_NOT_FOUND');
    expect(codeOf(await w.byStaff.execute('99999999-9999-4999-8999-999999999999'))).toBe('STAFF_NOT_FOUND');
  });

  it("« mon profil » : la fiche reliée au compte et ses affectations en cours ou à venir (pas les terminées)", async () => {
    const w = build();
    const s = await staffMember(w);
    expect(codeOf(await w.me.execute(USER))).toBe('STAFF_PROFILE_NOT_FOUND');
    must(await w.manage.linkAccount(ACTOR, s.id, USER));
    must(await w.assign.assign(ACTOR, s.id, { nodeId: SERVICE_A, startDate: '2025-01-01', endDate: '2025-12-31' }));
    must(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.SERVICE_B, startDate: '2026-01-01' }));
    must(await w.assign.assign(ACTOR, s.id, { nodeId: NODE_IDS.UNIT_A, startDate: '2027-01-01' }));
    const profile = must(await w.me.execute(USER));
    expect(profile.staff.id).toBe(s.id);
    expect(profile.assignments.map((a) => a.nodeId).sort()).toEqual([NODE_IDS.SERVICE_B, NODE_IDS.UNIT_A].sort());
    expect(codeOf(await w.me.execute('nope'))).toBe('STAFF_PROFILE_NOT_FOUND');
  });
});
