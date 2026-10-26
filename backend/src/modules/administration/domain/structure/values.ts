import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ValueObject } from '../../../../shared-kernel/value-object';

export class NodeId extends ValueObject<string> {
  static create(raw: string): Result<NodeId> {
    const normalized = (raw ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
      return err(new DomainError('STRUCTURE_ID_INVALID', "L'identifiant de cet élément de structure est invalide."));
    }
    return ok(new NodeId(normalized.toLowerCase()));
  }
}

/** Code d'un élément (service, unité, salle, lit) : unique parmi ses frères, jamais modifié. Majuscules, chiffres, « _ », « - », « . ». */
export class NodeCode extends ValueObject<string> {
  static create(raw: string): Result<NodeCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_.-]{0,31}$/.test(normalized)) {
      return err(new DomainError('STRUCTURE_CODE_INVALID', "Code invalide (1 à 32 caractères : lettres, chiffres, « _ », « - », « . »).", { value: String(raw) }));
    }
    return ok(new NodeCode(normalized));
  }
}

export class NodeName extends ValueObject<string> {
  static create(raw: string): Result<NodeName> {
    const normalized = (raw ?? '').trim();
    if (normalized.length === 0 || normalized.length > 200) {
      return err(new DomainError('STRUCTURE_NAME_INVALID', 'Le nom doit comporter de 1 à 200 caractères.'));
    }
    return ok(new NodeName(normalized));
  }
}

/** Étage d'une salle, tel qu'on l'écrit sur la porte : « RDC », « 1 », « -1 », « Bloc B - 2 »… (1 à 32 caractères). */
export class FloorLabel extends ValueObject<string> {
  static create(raw: string): Result<FloorLabel> {
    const normalized = (raw ?? '').trim();
    if (normalized.length === 0 || normalized.length > 32) {
      return err(new DomainError('STRUCTURE_FLOOR_INVALID', "L'étage doit comporter de 1 à 32 caractères."));
    }
    return ok(new FloorLabel(normalized));
  }
}

/** Code d'une spécialité du référentiel `SPECIALTY` (son existence et son activité sont vérifiées par le `SpecialtyDirectory`). */
export class SpecialtyCode extends ValueObject<string> {
  static create(raw: string): Result<SpecialtyCode> {
    const normalized = (raw ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_.-]{0,31}$/.test(normalized)) {
      return err(new DomainError('STRUCTURE_SPECIALTY_UNKNOWN', "Cette spécialité n'existe pas ou n'est plus active.", { value: String(raw) }));
    }
    return ok(new SpecialtyCode(normalized));
  }
}

export enum ServiceType {
  CLINICAL = 'CLINICAL',
  MEDICO_TECHNICAL = 'MEDICO_TECHNICAL',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  SUPPORT = 'SUPPORT',
}

export const parseServiceType = (raw: string): Result<ServiceType> => {
  const normalized = (raw ?? '').trim().toUpperCase();
  const found = (Object.values(ServiceType) as string[]).find((v) => v === normalized);
  return found
    ? ok(found as ServiceType)
    : err(new DomainError('STRUCTURE_SERVICE_TYPE_INVALID', `Type de service invalide : ${raw}`, { value: String(raw) }));
};

/**
 * Niveaux de la structure. Chaque élément a un niveau fixé par celui de son parent : un service est rattaché à
 * l'établissement, une unité à un service, une salle à une unité, un lit à une salle.
 */
export enum NodeKind {
  SERVICE = 'SERVICE',
  UNIT = 'UNIT',
  ROOM = 'ROOM',
  BED = 'BED',
}

const CHILD_OF: Readonly<Record<NodeKind, NodeKind | null>> = {
  [NodeKind.SERVICE]: NodeKind.UNIT,
  [NodeKind.UNIT]: NodeKind.ROOM,
  [NodeKind.ROOM]: NodeKind.BED,
  [NodeKind.BED]: null,
};

/** Niveau des éléments rattachables à un élément de ce niveau ; `null` pour un lit, qui est une feuille. */
export const childKindOf = (kind: NodeKind): NodeKind | null => CHILD_OF[kind];
