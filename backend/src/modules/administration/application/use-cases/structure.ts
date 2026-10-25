import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { FacilityRepository, SpecialtyDirectory, StructureRepository } from '../../domain/ports';
import { StructureNode } from '../../domain/structure/structure-node';
import { FloorLabel, NodeCode, NodeId, NodeName, parseServiceType, SpecialtyCode } from '../../domain/structure/values';
import { FacilityId } from '../../domain/value-objects/facility-id';

const FACILITY_NOT_FOUND = new DomainError('FACILITY_NOT_FOUND', 'Établissement introuvable.');
const NODE_NOT_FOUND = new DomainError('STRUCTURE_NODE_NOT_FOUND', 'Élément de structure introuvable.');
const DUPLICATE_CODE = new DomainError('STRUCTURE_CODE_ALREADY_EXISTS', 'Un élément de même niveau utilise déjà ce code à cet endroit.');
const SPECIALTY_UNKNOWN = new DomainError('STRUCTURE_SPECIALTY_UNKNOWN', "Cette spécialité n'existe pas ou n'est plus active.");
const SERVICE_TYPE_REQUIRED = new DomainError('STRUCTURE_SERVICE_TYPE_INVALID', 'Le type de service est obligatoire.');
const PARENT_INACTIVE = new DomainError('STRUCTURE_PARENT_INACTIVE', "L'élément parent est désactivé : on ne peut rien y ajouter ni y réactiver.");
const HAS_ACTIVE_CHILDREN = new DomainError('STRUCTURE_HAS_ACTIVE_CHILDREN', 'Cet élément contient des éléments actifs : désactivez-les d\'abord.');

export interface NodeView {
  readonly id: string;
  readonly facilityId: string;
  readonly parentId: string | null;
  readonly kind: string;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
  readonly serviceType: string | null;
  readonly specialtyCode: string | null;
  readonly floor: string | null;
}

export interface NodeTreeView extends NodeView {
  readonly children: NodeTreeView[];
}

export interface StructureTreeView {
  readonly facilityId: string;
  /** Éléments actifs par niveau. `beds` est la capacité d'accueil de l'établissement. */
  readonly totals: { readonly services: number; readonly units: number; readonly rooms: number; readonly beds: number };
  readonly services: NodeTreeView[];
}

export const toNodeView = (n: StructureNode): NodeView => ({
  id: n.id.value,
  facilityId: n.facilityId.value,
  parentId: n.parentId?.value ?? null,
  kind: n.kind,
  code: n.code.value,
  name: n.name.value,
  active: n.active,
  serviceType: n.serviceType,
  specialtyCode: n.specialtyCode?.value ?? null,
  floor: n.floor?.value ?? null,
});

async function loadNode(structure: StructureRepository, rawId: string): Promise<Result<StructureNode>> {
  const id = NodeId.create(rawId);
  if (!id.ok) return err(NODE_NOT_FOUND); // un identifiant mal formé ne désigne aucun élément
  const node = await structure.findById(id.value);
  return node ? ok(node) : err(NODE_NOT_FOUND);
}

async function loadFacilityId(facilities: FacilityRepository, rawId: string): Promise<Result<FacilityId>> {
  const id = FacilityId.create(rawId);
  if (!id.ok) return err(FACILITY_NOT_FOUND);
  return (await facilities.findById(id.value)) ? ok(id.value) : err(FACILITY_NOT_FOUND);
}

export class GetStructureNodeUseCase {
  constructor(private readonly structure: StructureRepository) {}

  async execute(id: string): Promise<Result<NodeView>> {
    const node = await loadNode(this.structure, id);
    return node.ok ? ok(toNodeView(node.value)) : err(node.error);
  }
}

/** Arbre complet d'un établissement (services → unités → salles → lits) avec ses totaux. Les éléments désactivés sont masqués par défaut. */
export class GetStructureTreeUseCase {
  constructor(private readonly facilities: FacilityRepository, private readonly structure: StructureRepository) {}

  async execute(facilityId: string, includeInactive: boolean): Promise<Result<StructureTreeView>> {
    const facility = await loadFacilityId(this.facilities, facilityId);
    if (!facility.ok) return err(facility.error);
    const nodes = await this.structure.listByFacility(facility.value, includeInactive);

    const byParent = new Map<string | null, NodeTreeView[]>();
    const totals = { services: 0, units: 0, rooms: 0, beds: 0 };
    for (const node of nodes) {
      const view: NodeTreeView = { ...toNodeView(node), children: [] };
      const siblings = byParent.get(view.parentId) ?? [];
      siblings.push(view);
      byParent.set(view.parentId, siblings);
      if (node.active) totals[{ SERVICE: 'services', UNIT: 'units', ROOM: 'rooms', BED: 'beds' }[node.kind] as keyof typeof totals] += 1;
    }
    for (const siblings of byParent.values()) for (const view of siblings) view.children.push(...(byParent.get(view.id) ?? []));
    return ok({ facilityId: facility.value.value, totals, services: byParent.get(null) ?? [] });
  }
}

/** Création et modification de la structure. Chaque changement réel est journalisé ; rien n'est écrit si rien ne change. */
export class ManageStructureUseCases {
  constructor(
    private readonly facilities: FacilityRepository,
    private readonly structure: StructureRepository,
    private readonly specialties: SpecialtyDirectory,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async createService(
    actorId: string,
    facilityId: string,
    input: { code: string; name: string; serviceType: string; specialtyCode?: string | null },
  ): Promise<Result<NodeView>> {
    const code = NodeCode.create(input.code);
    if (!code.ok) return err(code.error);
    const name = NodeName.create(input.name);
    if (!name.ok) return err(name.error);
    const serviceType = input.serviceType ? parseServiceType(input.serviceType) : err(SERVICE_TYPE_REQUIRED);
    if (!serviceType.ok) return err(serviceType.error);
    const specialty = await this.checkedSpecialty(input.specialtyCode);
    if (!specialty.ok) return err(specialty.error);
    const facility = await loadFacilityId(this.facilities, facilityId);
    if (!facility.ok) return err(facility.error);
    if (await this.structure.findSibling(facility.value, null, code.value)) return err(DUPLICATE_CODE);

    const id = NodeId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const node = StructureNode.createService({ id: id.value, facilityId: facility.value, code: code.value, name: name.value, serviceType: serviceType.value, specialtyCode: specialty.value });
    await this.structure.save(node);
    await this.record(actorId, 'administration.structure.create', node, {});
    return ok(toNodeView(node));
  }

  /** Ajoute une unité (sous un service), une salle (sous une unité) ou un lit (sous une salle) : le niveau suit celui du parent. */
  async createChild(actorId: string, parentId: string, input: { code: string; name: string; floor?: string | null }): Promise<Result<NodeView>> {
    const code = NodeCode.create(input.code);
    if (!code.ok) return err(code.error);
    const name = NodeName.create(input.name);
    if (!name.ok) return err(name.error);
    const floor = input.floor ? FloorLabel.create(input.floor) : undefined;
    if (floor && !floor.ok) return err(floor.error);
    const parent = await loadNode(this.structure, parentId);
    if (!parent.ok) return err(parent.error);
    if (await this.structure.findSibling(parent.value.facilityId, parent.value.id, code.value)) return err(DUPLICATE_CODE);

    const id = NodeId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const child = StructureNode.createChild(parent.value, { id: id.value, code: code.value, name: name.value, floor: floor?.value });
    if (!child.ok) return err(child.error);
    await this.structure.save(child.value);
    await this.record(actorId, 'administration.structure.create', child.value, {});
    return ok(toNodeView(child.value));
  }

  /**
   * Champs absents : inchangés. `specialtyCode` et `floor` à `null` : valeur retirée.
   * Le code et le rattachement ne changent jamais (d'autres données y renverront).
   */
  async update(
    actorId: string,
    id: string,
    input: { name?: string; serviceType?: string; specialtyCode?: string | null; floor?: string | null },
  ): Promise<Result<NodeView>> {
    const name = input.name === undefined ? undefined : NodeName.create(input.name);
    if (name && !name.ok) return err(name.error);
    const serviceType = input.serviceType === undefined ? undefined : parseServiceType(input.serviceType);
    if (serviceType && !serviceType.ok) return err(serviceType.error);
    const floor = input.floor === undefined ? undefined : input.floor === null ? null : FloorLabel.create(input.floor);
    if (floor && !floor.ok) return err(floor.error);
    const loaded = await loadNode(this.structure, id);
    if (!loaded.ok) return err(loaded.error);
    const node = loaded.value;

    const changed: string[] = [];
    if (name?.ok && !node.name.equals(name.value)) {
      node.rename(name.value);
      changed.push('name');
    }
    if (serviceType?.ok && serviceType.value !== node.serviceType) {
      const r = node.changeServiceType(serviceType.value);
      if (!r.ok) return err(r.error);
      changed.push('serviceType');
    }
    if (input.specialtyCode !== undefined) {
      const specialty = await this.checkedSpecialty(input.specialtyCode);
      if (!specialty.ok) return err(specialty.error);
      if ((specialty.value?.value ?? null) !== (node.specialtyCode?.value ?? null)) {
        const r = node.assignSpecialty(specialty.value);
        if (!r.ok) return err(r.error);
        changed.push('specialtyCode');
      }
    }
    if (floor !== undefined && (floor?.value.value ?? null) !== (node.floor?.value ?? null)) {
      const r = node.moveToFloor(floor?.value ?? null);
      if (!r.ok) return err(r.error);
      changed.push('floor');
    }
    if (changed.length === 0) return ok(toNodeView(node));

    await this.structure.save(node);
    await this.record(actorId, 'administration.structure.update', node, { changed: changed.join(',') });
    return ok(toNodeView(node));
  }

  /** Désactiver exige qu'aucun enfant ne soit actif ; réactiver exige un parent actif. Sans effet si l'état est déjà celui demandé. */
  async setActive(actorId: string, id: string, active: boolean): Promise<Result<NodeView>> {
    const loaded = await loadNode(this.structure, id);
    if (!loaded.ok) return err(loaded.error);
    const node = loaded.value;
    if (node.active === active) return ok(toNodeView(node));

    if (active) {
      if (node.parentId) {
        const parent = await this.structure.findById(node.parentId);
        if (!parent?.active) return err(PARENT_INACTIVE);
      }
      node.activate();
    } else {
      if (await this.structure.hasActiveChildren(node.id)) return err(HAS_ACTIVE_CHILDREN);
      node.deactivate();
    }
    await this.structure.save(node);
    await this.record(actorId, active ? 'administration.structure.activate' : 'administration.structure.deactivate', node, {});
    return ok(toNodeView(node));
  }

  /** Spécialité facultative : absente ou `null` → aucune ; sinon elle doit exister et être active dans le référentiel. */
  private async checkedSpecialty(raw: string | null | undefined): Promise<Result<SpecialtyCode | null>> {
    if (raw === undefined || raw === null || raw.trim() === '') return ok(null);
    const code = SpecialtyCode.create(raw);
    if (!code.ok) return err(SPECIALTY_UNKNOWN);
    return (await this.specialties.isActive(code.value)) ? ok(code.value) : err(SPECIALTY_UNKNOWN);
  }

  private record(actorId: string, action: string, node: StructureNode, extra: Record<string, string>): Promise<void> {
    return this.audit.record({
      action,
      outcome: 'SUCCESS',
      actorId,
      resourceType: 'structure-node',
      resourceId: node.id.value,
      metadata: { facilityId: node.facilityId.value, kind: node.kind, code: node.code.value, name: node.name.value, active: node.active, ...extra },
      occurredAt: this.clock.now(),
    });
  }
}
