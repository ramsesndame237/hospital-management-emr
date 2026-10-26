import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { FacilityId } from '../value-objects/facility-id';
import { childKindOf, FloorLabel, NodeCode, NodeId, NodeKind, NodeName, ServiceType, SpecialtyCode } from './values';

/** `attribute` est le nom du champ de l'API (`serviceType`, `specialtyCode`, `floor`) : le message traduit le cite tel quel. */
const NOT_APPLICABLE = (attribute: string) =>
  new DomainError('STRUCTURE_ATTRIBUTE_NOT_APPLICABLE', `L'attribut « ${attribute} » ne s'applique pas à ce niveau.`, { attribute });

export interface NodeState {
  readonly id: NodeId;
  readonly facilityId: FacilityId;
  readonly parentId: NodeId | null;
  readonly kind: NodeKind;
  readonly code: NodeCode;
  readonly name: NodeName;
  readonly active: boolean;
  readonly serviceType: ServiceType | null;
  readonly specialtyCode: SpecialtyCode | null;
  readonly floor: FloorLabel | null;
}

/**
 * Élément de la structure physique et fonctionnelle d'un établissement : service → unité → salle → lit.
 * Un seul type, parce que ces niveaux se comportent de la même façon (code stable, nom, actif ou non, rattachement) ;
 * seuls quelques attributs dépendent du niveau : type et spécialité (service), étage (salle).
 *
 * Règles : le rattachement ne change jamais ; on ne crée rien sous un élément désactivé ; un élément n'est jamais supprimé
 * (les admissions et les dossiers y renverront), il est désactivé.
 */
export class StructureNode {
  private constructor(private state: NodeState) {}

  /** Reconstitue un élément lu en base (aucune règle de création n'est rejouée). */
  static restore(state: NodeState): StructureNode {
    return new StructureNode(state);
  }

  /** Nouveau service, rattaché directement à l'établissement. */
  static createService(input: { id: NodeId; facilityId: FacilityId; code: NodeCode; name: NodeName; serviceType: ServiceType; specialtyCode?: SpecialtyCode | null }): StructureNode {
    return new StructureNode({
      id: input.id, facilityId: input.facilityId, parentId: null, kind: NodeKind.SERVICE, code: input.code, name: input.name, active: true,
      serviceType: input.serviceType, specialtyCode: input.specialtyCode ?? null, floor: null,
    });
  }

  /** Nouvel élément sous `parent` : son niveau est celui qui suit le niveau du parent. */
  static createChild(parent: StructureNode, input: { id: NodeId; code: NodeCode; name: NodeName; floor?: FloorLabel | null }): Result<StructureNode> {
    const kind = childKindOf(parent.kind);
    if (!kind) return err(new DomainError('STRUCTURE_CHILD_NOT_ALLOWED', 'Un lit ne peut contenir aucun autre élément.'));
    if (!parent.active) return err(new DomainError('STRUCTURE_PARENT_INACTIVE', "L'élément parent est désactivé : on ne peut rien y ajouter."));
    if (input.floor && kind !== NodeKind.ROOM) return err(NOT_APPLICABLE('floor'));
    return ok(
      new StructureNode({
        id: input.id, facilityId: parent.facilityId, parentId: parent.id, kind, code: input.code, name: input.name, active: true,
        serviceType: null, specialtyCode: null, floor: input.floor ?? null,
      }),
    );
  }

  get id(): NodeId { return this.state.id; }
  get facilityId(): FacilityId { return this.state.facilityId; }
  get parentId(): NodeId | null { return this.state.parentId; }
  get kind(): NodeKind { return this.state.kind; }
  get code(): NodeCode { return this.state.code; }
  get name(): NodeName { return this.state.name; }
  get active(): boolean { return this.state.active; }
  get serviceType(): ServiceType | null { return this.state.serviceType; }
  get specialtyCode(): SpecialtyCode | null { return this.state.specialtyCode; }
  get floor(): FloorLabel | null { return this.state.floor; }

  rename(name: NodeName): void {
    this.state = { ...this.state, name };
  }

  changeServiceType(serviceType: ServiceType): Result<void> {
    if (this.kind !== NodeKind.SERVICE) return err(NOT_APPLICABLE('serviceType'));
    this.state = { ...this.state, serviceType };
    return ok(undefined);
  }

  /** `null` retire la spécialité. */
  assignSpecialty(specialtyCode: SpecialtyCode | null): Result<void> {
    if (this.kind !== NodeKind.SERVICE) return err(NOT_APPLICABLE('specialtyCode'));
    this.state = { ...this.state, specialtyCode };
    return ok(undefined);
  }

  /** `null` retire l'étage. */
  moveToFloor(floor: FloorLabel | null): Result<void> {
    if (this.kind !== NodeKind.ROOM) return err(NOT_APPLICABLE('floor'));
    this.state = { ...this.state, floor };
    return ok(undefined);
  }

  /** Réactiver exige un parent actif : c'est au cas d'usage de le vérifier (il connaît le parent). */
  activate(): void {
    this.state = { ...this.state, active: true };
  }

  /** Désactiver exige qu'aucun enfant ne soit actif : c'est au cas d'usage de le vérifier. */
  deactivate(): void {
    this.state = { ...this.state, active: false };
  }
}
