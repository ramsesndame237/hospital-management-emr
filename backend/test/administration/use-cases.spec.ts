import { ListFacilitiesUseCase, ManageFacilityUseCases, RegisterFacilityUseCase, GetFacilityUseCase } from '../../src/modules/administration/application/use-cases/facilities';
import { GetOrganizationUseCase, SetupOrganizationUseCase } from '../../src/modules/administration/application/use-cases/organization';
import { Facility } from '../../src/modules/administration/domain/entities/facility';
import { Organization } from '../../src/modules/administration/domain/entities/organization';
import { FacilityRepository, OrganizationRepository } from '../../src/modules/administration/domain/ports';
import { FacilityCode } from '../../src/modules/administration/domain/value-objects/facility-code';
import { FacilityId } from '../../src/modules/administration/domain/value-objects/facility-id';
import { FixedClock, MemoryAudit, must, SeqIds } from '../iam/fakes';

class InMemoryOrganizations implements OrganizationRepository {
  current: Organization | null = null;
  async find() { return this.current; }
  async save(o: Organization) { this.current = o; }
}

class InMemoryFacilities implements FacilityRepository {
  readonly byId = new Map<string, Facility>();
  async findById(id: FacilityId) { return this.byId.get(id.value) ?? null; }
  async findByCode(code: FacilityCode) { return [...this.byId.values()].find((f) => f.getCode().equals(code)) ?? null; }
  async save(f: Facility) { this.byId.set(f.getId().value, f); }
  async list(offset: number, limit: number) {
    const all = [...this.byId.values()].sort((a, b) => a.getName().value.localeCompare(b.getName().value));
    return { items: all.slice(offset, offset + limit), total: all.length };
  }
}

function build() {
  const organizations = new InMemoryOrganizations();
  const facilities = new InMemoryFacilities();
  const ids = new SeqIds();
  const audit = new MemoryAudit();
  const clock = new FixedClock();
  return {
    organizations, facilities, audit,
    getOrganization: new GetOrganizationUseCase(organizations),
    setup: new SetupOrganizationUseCase(organizations, ids, audit, clock),
    register: new RegisterFacilityUseCase(organizations, facilities, ids, audit, clock),
    manage: new ManageFacilityUseCases(facilities, audit, clock),
    get: new GetFacilityUseCase(facilities),
    list: new ListFacilitiesUseCase(facilities),
  };
}

const ACTOR = 'admin-1';
const CODE = 'A1B2-abc-01';

describe('administration : organisation', () => {
  it("n'existe pas avant sa configuration", async () => {
    const w = build();
    const res = await w.getOrganization.execute();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('ORGANIZATION_NOT_FOUND');
  });

  it('se crée au premier appel (journalisé), se renomme ensuite, et reste unique', async () => {
    const w = build();
    const created = must(await w.setup.execute(ACTOR, { name: '  Hôpital Central ' }));
    expect(created.name).toBe('Hôpital Central');
    expect(w.audit.last('administration.organization.create')).toMatchObject({ actorId: ACTOR, resourceType: 'organization', resourceId: created.id });

    const renamed = must(await w.setup.execute(ACTOR, { name: 'Groupe Hospitalier' }));
    expect(renamed.id).toBe(created.id);
    expect(w.audit.last('administration.organization.rename')?.metadata).toMatchObject({ previousName: 'Hôpital Central', name: 'Groupe Hospitalier' });
  });

  it('est idempotente : le même nom ne produit aucune entrée d\'audit de plus', async () => {
    const w = build();
    await w.setup.execute(ACTOR, { name: 'Hôpital' });
    const before = w.audit.entries.length;
    must(await w.setup.execute(ACTOR, { name: 'Hôpital' }));
    expect(w.audit.entries).toHaveLength(before);
  });

  it('refuse un nom vide', async () => {
    const res = await build().setup.execute(ACTOR, { name: '   ' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('ORGANIZATION_NAME_INVALID');
  });
});

describe('administration : établissements', () => {
  async function withOrganization() {
    const w = build();
    await w.setup.execute(ACTOR, { name: 'Hôpital' });
    return w;
  }

  it("exige que l'organisation soit configurée", async () => {
    const res = await build().register.execute(ACTOR, { name: 'Site', code: CODE });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('ORGANIZATION_NOT_FOUND');
  });

  it('enregistre un établissement « en construction » (donc non opérationnel) par défaut, avec audit', async () => {
    const w = await withOrganization();
    const f = must(await w.register.execute(ACTOR, { name: 'Site principal', code: CODE }));
    expect(f).toMatchObject({ code: CODE, name: 'Site principal', status: 'OPERATIONAL_UNDER_CONSTRUCTION', operational: false });
    expect(f.organizationId).toBe(must(await w.getOrganization.execute()).id);
    expect(w.audit.last('administration.facility.register')).toMatchObject({ actorId: ACTOR, resourceType: 'facility', resourceId: f.id });
  });

  it('accepte un statut initial valide et refuse un statut ou un code invalide', async () => {
    const w = await withOrganization();
    expect(must(await w.register.execute(ACTOR, { name: 'Ouvert', code: CODE, status: 'operational_open' })).operational).toBe(true);
    for (const [input, code] of [
      [{ name: 'X', code: 'nope' }, 'FACILITY_CODE_INVALID'],
      [{ name: 'X', code: 'B2C3-def-02', status: 'OUVERT' }, 'FACILITY_STATUS_INVALID'],
      [{ name: ' ', code: 'B2C3-def-02' }, 'FACILITY_NAME_INVALID'],
    ] as const) {
      const res = await w.register.execute(ACTOR, input);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe(code);
    }
  });

  it('refuse un code déjà utilisé', async () => {
    const w = await withOrganization();
    must(await w.register.execute(ACTOR, { name: 'A', code: CODE }));
    const res = await w.register.execute(ACTOR, { name: 'B', code: CODE });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('FACILITY_CODE_ALREADY_EXISTS');
  });

  it("modifie nom et code en gardant l'ancienne valeur dans l'audit ; ne touche à rien si rien ne change", async () => {
    const w = await withOrganization();
    const f = must(await w.register.execute(ACTOR, { name: 'Ancien', code: CODE }));
    const updated = must(await w.manage.update(ACTOR, f.id, { name: 'Nouveau', code: 'B2C3-def-02' }));
    expect(updated).toMatchObject({ name: 'Nouveau', code: 'B2C3-def-02' });
    expect(w.audit.last('administration.facility.update')?.metadata).toMatchObject({ previousName: 'Ancien', previousCode: CODE });

    const before = w.audit.entries.length;
    must(await w.manage.update(ACTOR, f.id, { name: 'Nouveau' }));
    expect(w.audit.entries).toHaveLength(before);
  });

  it('refuse de reprendre le code d\'un autre établissement, mais accepte de garder le sien', async () => {
    const w = await withOrganization();
    const a = must(await w.register.execute(ACTOR, { name: 'A', code: CODE }));
    must(await w.register.execute(ACTOR, { name: 'B', code: 'B2C3-def-02' }));
    const clash = await w.manage.update(ACTOR, a.id, { code: 'B2C3-def-02' });
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.error.code).toBe('FACILITY_CODE_ALREADY_EXISTS');
    expect(must(await w.manage.update(ACTOR, a.id, { code: CODE })).code).toBe(CODE);
  });

  it("change le statut avec l'ancien dans l'audit, et ne journalise pas un statut identique", async () => {
    const w = await withOrganization();
    const f = must(await w.register.execute(ACTOR, { name: 'Site', code: CODE }));
    const open = must(await w.manage.changeStatus(ACTOR, f.id, 'OPERATIONAL_OPEN'));
    expect(open.operational).toBe(true);
    expect(w.audit.last('administration.facility.status.change')?.metadata).toMatchObject({
      previousStatus: 'OPERATIONAL_UNDER_CONSTRUCTION', status: 'OPERATIONAL_OPEN',
    });
    const before = w.audit.entries.length;
    must(await w.manage.changeStatus(ACTOR, f.id, 'OPERATIONAL_OPEN'));
    expect(w.audit.entries).toHaveLength(before);
    const bad = await w.manage.changeStatus(ACTOR, f.id, 'FERMÉ');
    expect(bad.ok).toBe(false);
  });

  it('répond « introuvable » pour un identifiant inconnu ou mal formé', async () => {
    const w = await withOrganization();
    for (const id of ['00000000-0000-4000-8000-0000000000ff', 'pas-un-uuid']) {
      for (const res of [await w.get.execute(id), await w.manage.update(ACTOR, id, { name: 'X' }), await w.manage.changeStatus(ACTOR, id, 'OPERATIONAL_OPEN')]) {
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.code).toBe('FACILITY_NOT_FOUND');
      }
    }
  });

  it('pagine par nom et borne la taille de page', async () => {
    const w = await withOrganization();
    for (const [i, name] of ['Charlie', 'Alpha', 'Bravo'].entries()) must(await w.register.execute(ACTOR, { name, code: `A1B2-abc-0${i}` }));
    const page = await w.list.execute(1, 1);
    expect(page).toMatchObject({ total: 3, offset: 1, limit: 1 });
    expect(page.items.map((f) => f.name)).toEqual(['Bravo']);
    expect((await w.list.execute(-5, 9999))).toMatchObject({ offset: 0, limit: 200 });
  });
});
