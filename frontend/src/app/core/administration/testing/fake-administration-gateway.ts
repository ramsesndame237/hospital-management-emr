import { AdministrationGateway } from '../administration.gateway';
import {
  ChildInput, Facility, FacilityInput, FacilityStatus, NodeChanges, Organization, ReferenceOption, ServiceInput, StructureNode, StructureTree, childKindOf,
} from '../administration.models';

export const facility = (over: Partial<Facility> = {}): Facility => ({
  id: 'f-1', organizationId: 'o-1', code: 'YDE1-hcy-01', name: 'Hôpital Central de Yaoundé', status: 'OPERATIONAL_OPEN', operational: true, ...over,
});

export const node = (over: Partial<StructureNode> & Pick<StructureNode, 'id' | 'kind' | 'code' | 'name'>): StructureNode => ({
  facilityId: 'f-1', parentId: null, active: true, serviceType: null, specialtyCode: null, floor: null, children: [], ...over,
});

/** Un service (Pédiatrie) avec une unité, une salle et deux lits : de quoi afficher les quatre niveaux. */
export const sampleTree = (): StructureTree => ({
  facilityId: 'f-1',
  totals: { services: 1, units: 1, rooms: 1, beds: 2 },
  services: [
    node({
      id: 's-1', kind: 'SERVICE', code: 'PED', name: 'Pédiatrie', serviceType: 'CLINICAL', specialtyCode: 'PEDIATRICS',
      children: [
        node({
          id: 'u-1', kind: 'UNIT', code: 'NEO', name: 'Néonatologie', parentId: 's-1',
          children: [
            node({
              id: 'r-1', kind: 'ROOM', code: 'S1', name: 'Salle 1', parentId: 'u-1', floor: 'RDC',
              children: [
                node({ id: 'b-1', kind: 'BED', code: 'B1', name: 'Lit 1', parentId: 'r-1' }),
                node({ id: 'b-2', kind: 'BED', code: 'B2', name: 'Lit 2', parentId: 'r-1' }),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});

/** Double de test du port `AdministrationGateway` : chaque méthode est un mock Vitest que le test configure. */
export class FakeAdministrationGateway extends AdministrationGateway {
  override getOrganization = vi.fn<() => Promise<Organization | null>>().mockResolvedValue({ id: 'o-1', name: 'Groupe Hospitalier Sanjeevani' });
  override saveOrganization = vi.fn<(name: string) => Promise<Organization>>().mockImplementation((name) => Promise.resolve({ id: 'o-1', name }));
  override listFacilities = vi.fn<() => Promise<readonly Facility[]>>().mockResolvedValue([facility(), facility({ id: 'f-2', code: 'DLA1-cad-02', name: 'Clinique Annexe de Douala', status: 'OPERATIONAL_UNDER_CONSTRUCTION', operational: false })]);
  override registerFacility = vi.fn<(input: FacilityInput) => Promise<Facility>>().mockImplementation((input) =>
    Promise.resolve(facility({ id: 'f-new', ...input, status: input.status ?? 'OPERATIONAL_UNDER_CONSTRUCTION', operational: input.status === 'OPERATIONAL_OPEN' })),
  );
  override updateFacility = vi.fn<(id: string, changes: { name?: string; code?: string }) => Promise<Facility>>().mockImplementation((id, changes) => Promise.resolve(facility({ id, ...changes })));
  override changeFacilityStatus = vi.fn<(id: string, status: FacilityStatus) => Promise<Facility>>().mockImplementation((id, status) =>
    Promise.resolve(facility({ id, status, operational: status === 'OPERATIONAL_OPEN' })),
  );
  override structure = vi.fn<(facilityId: string, includeInactive: boolean) => Promise<StructureTree>>().mockImplementation(() => Promise.resolve(sampleTree()));
  override createService = vi.fn<(facilityId: string, input: ServiceInput) => Promise<StructureNode>>().mockImplementation((facilityId, input) =>
    Promise.resolve(node({ id: 's-new', kind: 'SERVICE', facilityId, code: input.code.toUpperCase(), name: input.name, serviceType: input.serviceType, specialtyCode: input.specialtyCode ?? null })),
  );
  override createChild = vi.fn<(parentId: string, input: ChildInput) => Promise<StructureNode>>().mockImplementation((parentId, input) =>
    Promise.resolve(node({ id: 'c-new', kind: childKindOf('SERVICE') ?? 'UNIT', parentId, code: input.code.toUpperCase(), name: input.name, floor: input.floor ?? null })),
  );
  override updateNode = vi.fn<(id: string, changes: NodeChanges) => Promise<StructureNode>>().mockImplementation((id, changes) =>
    Promise.resolve(node({ id, kind: 'SERVICE', code: 'PED', name: changes.name ?? 'Pédiatrie' })),
  );
  override setNodeActive = vi.fn<(id: string, active: boolean) => Promise<StructureNode>>().mockImplementation((id, active) =>
    Promise.resolve(node({ id, kind: 'BED', code: 'B1', name: 'Lit 1', active })),
  );
  override specialties = vi.fn<() => Promise<readonly ReferenceOption[]>>().mockResolvedValue([
    { code: 'PEDIATRICS', label: 'Pédiatrie' }, { code: 'GENERAL_SURGERY', label: 'Chirurgie générale' },
  ]);
}
