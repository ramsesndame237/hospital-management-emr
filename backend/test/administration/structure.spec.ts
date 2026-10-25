import { GetStructureNodeUseCase, GetStructureTreeUseCase, ManageStructureUseCases } from '../../src/modules/administration/application/use-cases/structure';
import { Facility } from '../../src/modules/administration/domain/entities/facility';
import { FacilityRepository, SpecialtyDirectory, StructureRepository } from '../../src/modules/administration/domain/ports';
import { StructureNode } from '../../src/modules/administration/domain/structure/structure-node';
import { childKindOf, FloorLabel, NodeCode, NodeId, NodeKind, NodeName, parseServiceType, ServiceType, SpecialtyCode } from '../../src/modules/administration/domain/structure/values';
import { FacilityCode } from '../../src/modules/administration/domain/value-objects/facility-code';
import { FacilityId } from '../../src/modules/administration/domain/value-objects/facility-id';
import { FacilityName } from '../../src/modules/administration/domain/value-objects/facility-name';
import { OrganizationId } from '../../src/modules/administration/domain/value-objects/organization-id';
import { FixedClock, MemoryAudit, must, SeqIds } from '../iam/fakes';

const FACILITY = '11111111-1111-4111-8111-111111111111';
const OTHER_FACILITY = '22222222-2222-4222-8222-222222222222';

class InMemoryFacilities implements FacilityRepository {
  private readonly byId = new Map<string, Facility>();
  constructor(ids: string[]) {
    ids.forEach((id, i) => this.byId.set(id, must(Facility.create(must(FacilityName.create(`Site ${i}`)), must(FacilityCode.create(`A1B2-abc-0${i}`)), must(FacilityId.create(id)), must(OrganizationId.create('33333333-3333-4333-8333-333333333333'))))));
  }
  async findById(id: FacilityId) { return this.byId.get(id.value) ?? null; }
  async findByCode() { return null; }
  async save() { /* inutilisé */ }
  async list() { return { items: [...this.byId.values()], total: this.byId.size }; }
}

class InMemoryStructure implements StructureRepository {
  readonly byId = new Map<string, StructureNode>();
  async findById(id: NodeId) { return this.byId.get(id.value) ?? null; }
  async findSibling(facilityId: FacilityId, parentId: NodeId | null, code: NodeCode) {
    return [...this.byId.values()].find((n) => n.facilityId.equals(facilityId) && (n.parentId?.value ?? null) === (parentId?.value ?? null) && n.code.equals(code)) ?? null;
  }
  async save(n: StructureNode) { this.byId.set(n.id.value, n); }
  async listByFacility(facilityId: FacilityId, includeInactive: boolean) {
    return [...this.byId.values()].filter((n) => n.facilityId.equals(facilityId) && (includeInactive || n.active)).sort((a, b) => a.code.value.localeCompare(b.code.value));
  }
  async hasActiveChildren(id: NodeId) { return [...this.byId.values()].some((n) => n.parentId?.equals(id) && n.active); }
}

const specialties: SpecialtyDirectory = { isActive: async (c: SpecialtyCode) => ['PEDIATRICS', 'CARDIOLOGY'].includes(c.value) };

function build() {
  const structure = new InMemoryStructure();
  const facilities = new InMemoryFacilities([FACILITY, OTHER_FACILITY]);
  const audit = new MemoryAudit();
  return {
    structure, audit,
    manage: new ManageStructureUseCases(facilities, structure, specialties, new SeqIds(), audit, new FixedClock()),
    tree: new GetStructureTreeUseCase(facilities, structure),
    node: new GetStructureNodeUseCase(structure),
  };
}

const ACTOR = 'admin-1';
const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const PED = { code: 'ped', name: 'Pédiatrie', serviceType: 'clinical', specialtyCode: 'pediatrics' };

/** Service > unité > salle > lit. */
async function chain(w: ReturnType<typeof build>) {
  const service = must(await w.manage.createService(ACTOR, FACILITY, PED));
  const unit = must(await w.manage.createChild(ACTOR, service.id, { code: 'u1', name: 'Néonatologie' }));
  const room = must(await w.manage.createChild(ACTOR, unit.id, { code: 'r1', name: 'Salle 1', floor: '1' }));
  const bed = must(await w.manage.createChild(ACTOR, room.id, { code: 'b1', name: 'Lit 1' }));
  return { service, unit, room, bed };
}

describe('structure : valeurs', () => {
  it('normalise les codes et refuse les formes invalides', () => {
    expect(must(NodeCode.create(' b-01.a ')).value).toBe('B-01.A');
    for (const bad of ['', '-A', 'a b', 'é', 'A'.repeat(33)]) expect(codeOf(NodeCode.create(bad))).toBe('STRUCTURE_CODE_INVALID');
    expect(codeOf(NodeName.create(' '))).toBe('STRUCTURE_NAME_INVALID');
    expect(codeOf(NodeName.create('x'.repeat(201)))).toBe('STRUCTURE_NAME_INVALID');
    expect(codeOf(FloorLabel.create(''))).toBe('STRUCTURE_FLOOR_INVALID');
    expect(codeOf(parseServiceType('Hôtellerie'))).toBe('STRUCTURE_SERVICE_TYPE_INVALID');
    expect(must(parseServiceType(' clinical '))).toBe(ServiceType.CLINICAL);
  });

  it('enchaîne les niveaux : service > unité > salle > lit, le lit étant une feuille', () => {
    expect([NodeKind.SERVICE, NodeKind.UNIT, NodeKind.ROOM, NodeKind.BED].map(childKindOf)).toEqual([NodeKind.UNIT, NodeKind.ROOM, NodeKind.BED, null]);
  });
});

describe('structure : création', () => {
  it('crée la chaîne complète, chaque niveau découlant de son parent, avec audit', async () => {
    const w = build();
    const { service, unit, room, bed } = await chain(w);
    expect([service, unit, room, bed].map((n) => n.kind)).toEqual(['SERVICE', 'UNIT', 'ROOM', 'BED']);
    expect(service).toMatchObject({ code: 'PED', serviceType: 'CLINICAL', specialtyCode: 'PEDIATRICS', parentId: null, facilityId: FACILITY, active: true });
    expect(room).toMatchObject({ floor: '1', parentId: unit.id });
    expect(bed.facilityId).toBe(FACILITY);
    expect(w.audit.last('administration.structure.create')).toMatchObject({ actorId: ACTOR, resourceType: 'structure-node', resourceId: bed.id });
    expect(w.audit.entries).toHaveLength(4);
  });

  it('refuse un établissement inconnu, un type de service absent ou invalide, et une spécialité inconnue', async () => {
    const w = build();
    expect(codeOf(await w.manage.createService(ACTOR, '99999999-9999-4999-8999-999999999999', PED))).toBe('FACILITY_NOT_FOUND');
    expect(codeOf(await w.manage.createService(ACTOR, 'pas-un-uuid', PED))).toBe('FACILITY_NOT_FOUND');
    expect(codeOf(await w.manage.createService(ACTOR, FACILITY, { ...PED, serviceType: '' }))).toBe('STRUCTURE_SERVICE_TYPE_INVALID');
    expect(codeOf(await w.manage.createService(ACTOR, FACILITY, { ...PED, serviceType: 'HOTEL' }))).toBe('STRUCTURE_SERVICE_TYPE_INVALID');
    expect(codeOf(await w.manage.createService(ACTOR, FACILITY, { ...PED, specialtyCode: 'ASTROLOGY' }))).toBe('STRUCTURE_SPECIALTY_UNKNOWN');
    expect(codeOf(await w.manage.createService(ACTOR, FACILITY, { ...PED, specialtyCode: 'a b' }))).toBe('STRUCTURE_SPECIALTY_UNKNOWN');
    expect(must(await w.manage.createService(ACTOR, FACILITY, { ...PED, specialtyCode: null })).specialtyCode).toBeNull();
  });

  it('refuse un code déjà pris parmi les frères, mais l\'accepte ailleurs', async () => {
    const w = build();
    const { service, unit } = await chain(w);
    expect(codeOf(await w.manage.createService(ACTOR, FACILITY, PED))).toBe('STRUCTURE_CODE_ALREADY_EXISTS');
    expect(codeOf(await w.manage.createChild(ACTOR, service.id, { code: 'U1', name: 'Autre' }))).toBe('STRUCTURE_CODE_ALREADY_EXISTS');
    // même code : autre établissement, ou autre parent
    must(await w.manage.createService(ACTOR, OTHER_FACILITY, PED));
    const other = must(await w.manage.createChild(ACTOR, service.id, { code: 'U2', name: 'Autre unité' }));
    must(await w.manage.createChild(ACTOR, other.id, { code: 'R1', name: 'Salle 1' }));
    must(await w.manage.createChild(ACTOR, unit.id, { code: 'R2', name: 'Salle 2' }));
  });

  it('refuse un enfant sous un lit ou sous un élément désactivé, un étage hors salle, et un parent inconnu', async () => {
    const w = build();
    const { service, unit, room, bed } = await chain(w);
    expect(codeOf(await w.manage.createChild(ACTOR, bed.id, { code: 'X', name: 'X' }))).toBe('STRUCTURE_CHILD_NOT_ALLOWED');
    expect(codeOf(await w.manage.createChild(ACTOR, service.id, { code: 'U9', name: 'U9', floor: '2' }))).toBe('STRUCTURE_ATTRIBUTE_NOT_APPLICABLE');
    expect(codeOf(await w.manage.createChild(ACTOR, '99999999-9999-4999-8999-999999999999', { code: 'X', name: 'X' }))).toBe('STRUCTURE_NODE_NOT_FOUND');
    await w.manage.setActive(ACTOR, bed.id, false);
    await w.manage.setActive(ACTOR, room.id, false);
    expect(codeOf(await w.manage.createChild(ACTOR, room.id, { code: 'B2', name: 'Lit 2' }))).toBe('STRUCTURE_PARENT_INACTIVE');
    expect(unit.active).toBe(true);
  });
});

describe('structure : modification', () => {
  it('modifie nom, type, spécialité et étage selon le niveau, et ne journalise que les vrais changements', async () => {
    const w = build();
    const { service, room } = await chain(w);
    const renamed = must(await w.manage.update(ACTOR, service.id, { name: 'Pédiatrie générale', serviceType: 'MEDICO_TECHNICAL', specialtyCode: 'CARDIOLOGY' }));
    expect(renamed).toMatchObject({ name: 'Pédiatrie générale', serviceType: 'MEDICO_TECHNICAL', specialtyCode: 'CARDIOLOGY', code: 'PED' });
    expect(w.audit.last('administration.structure.update')?.metadata).toMatchObject({ changed: 'name,serviceType,specialtyCode' });
    expect(must(await w.manage.update(ACTOR, room.id, { floor: '2' })).floor).toBe('2');
    expect(must(await w.manage.update(ACTOR, room.id, { floor: null })).floor).toBeNull();
    expect(must(await w.manage.update(ACTOR, service.id, { specialtyCode: null })).specialtyCode).toBeNull();

    const before = w.audit.entries.length;
    must(await w.manage.update(ACTOR, service.id, { name: 'Pédiatrie générale', specialtyCode: null }));
    must(await w.manage.update(ACTOR, service.id, {}));
    expect(w.audit.entries).toHaveLength(before);
  });

  it("refuse un attribut étranger au niveau, une spécialité inconnue et des valeurs invalides — sans rien écrire", async () => {
    const w = build();
    const { service, unit, room } = await chain(w);
    const before = w.audit.entries.length;
    expect(codeOf(await w.manage.update(ACTOR, unit.id, { serviceType: 'CLINICAL' }))).toBe('STRUCTURE_ATTRIBUTE_NOT_APPLICABLE');
    expect(codeOf(await w.manage.update(ACTOR, unit.id, { specialtyCode: 'CARDIOLOGY' }))).toBe('STRUCTURE_ATTRIBUTE_NOT_APPLICABLE');
    expect(codeOf(await w.manage.update(ACTOR, service.id, { floor: '2' }))).toBe('STRUCTURE_ATTRIBUTE_NOT_APPLICABLE');
    expect(codeOf(await w.manage.update(ACTOR, service.id, { specialtyCode: 'ASTROLOGY' }))).toBe('STRUCTURE_SPECIALTY_UNKNOWN');
    expect(codeOf(await w.manage.update(ACTOR, room.id, { name: ' ' }))).toBe('STRUCTURE_NAME_INVALID');
    expect(codeOf(await w.manage.update(ACTOR, 'pas-un-uuid', { name: 'X' }))).toBe('STRUCTURE_NODE_NOT_FOUND');
    expect(w.audit.entries).toHaveLength(before);
  });
});

describe('structure : activation', () => {
  it("refuse de désactiver un élément qui contient des éléments actifs ; la désactivation se fait de bas en haut", async () => {
    const w = build();
    const { service, unit, room, bed } = await chain(w);
    for (const node of [service, unit, room]) expect(codeOf(await w.manage.setActive(ACTOR, node.id, false))).toBe('STRUCTURE_HAS_ACTIVE_CHILDREN');
    for (const node of [bed, room, unit, service]) expect(must(await w.manage.setActive(ACTOR, node.id, false)).active).toBe(false);
    expect(w.audit.last('administration.structure.deactivate')).toMatchObject({ resourceId: service.id });
  });

  it("refuse de réactiver sous un parent désactivé ; la réactivation se fait de haut en bas ; idempotent", async () => {
    const w = build();
    const { service, unit, room, bed } = await chain(w);
    for (const node of [bed, room, unit, service]) await w.manage.setActive(ACTOR, node.id, false);
    expect(codeOf(await w.manage.setActive(ACTOR, bed.id, true))).toBe('STRUCTURE_PARENT_INACTIVE');
    expect(codeOf(await w.manage.setActive(ACTOR, unit.id, true))).toBe('STRUCTURE_PARENT_INACTIVE');
    for (const node of [service, unit, room, bed]) expect(must(await w.manage.setActive(ACTOR, node.id, true)).active).toBe(true);
    const before = w.audit.entries.length;
    must(await w.manage.setActive(ACTOR, bed.id, true));
    expect(w.audit.entries).toHaveLength(before);
  });
});

describe('structure : lecture', () => {
  it("construit l'arbre trié par code avec les totaux d'éléments actifs (capacité = lits actifs)", async () => {
    const w = build();
    const { unit, room } = await chain(w);
    must(await w.manage.createChild(ACTOR, room.id, { code: 'B0', name: 'Lit 0' }));
    must(await w.manage.createChild(ACTOR, unit.id, { code: 'R0', name: 'Salle 0' }));
    must(await w.manage.createService(ACTOR, FACILITY, { code: 'ADM', name: 'Accueil', serviceType: 'ADMINISTRATIVE' }));
    must(await w.manage.createService(ACTOR, OTHER_FACILITY, PED));

    const tree = must(await w.tree.execute(FACILITY, false));
    expect(tree.totals).toEqual({ services: 2, units: 1, rooms: 2, beds: 2 });
    expect(tree.services.map((s) => s.code)).toEqual(['ADM', 'PED']);
    const ped = tree.services[1];
    expect(ped.children[0].children.map((r) => r.code)).toEqual(['R0', 'R1']);
    expect(ped.children[0].children[1].children.map((b) => b.code)).toEqual(['B0', 'B1']);
    // l'autre établissement n'apparaît pas
    expect(must(await w.tree.execute(OTHER_FACILITY, false)).totals).toEqual({ services: 1, units: 0, rooms: 0, beds: 0 });
  });

  it('masque les éléments désactivés par défaut, les montre sur demande, et ne les compte pas', async () => {
    const w = build();
    const { bed } = await chain(w);
    await w.manage.setActive(ACTOR, bed.id, false);
    expect(must(await w.tree.execute(FACILITY, false)).totals.beds).toBe(0);
    const all = must(await w.tree.execute(FACILITY, true));
    expect(all.totals.beds).toBe(0);
    expect(all.services[0].children[0].children[0].children).toMatchObject([{ code: 'B1', active: false }]);
    expect(codeOf(await w.tree.execute('pas-un-uuid', false))).toBe('FACILITY_NOT_FOUND');
  });

  it('lit un élément, ou répond « introuvable » pour un identifiant inconnu ou mal formé', async () => {
    const w = build();
    const { room } = await chain(w);
    expect(must(await w.node.execute(room.id))).toMatchObject({ code: 'R1', kind: 'ROOM' });
    expect(codeOf(await w.node.execute('99999999-9999-4999-8999-999999999999'))).toBe('STRUCTURE_NODE_NOT_FOUND');
    expect(codeOf(await w.node.execute('nope'))).toBe('STRUCTURE_NODE_NOT_FOUND');
  });
});
