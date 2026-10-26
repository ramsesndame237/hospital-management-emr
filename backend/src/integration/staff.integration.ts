import { DynamicModule, Module } from '@nestjs/common';
import { STRUCTURE_REPOSITORY } from '../modules/administration/domain/ports';
import type { StructureRepository } from '../modules/administration/domain/ports';
import { NodeId } from '../modules/administration/domain/structure/values';
import { USER_REPOSITORY } from '../modules/iam/domain/ports';
import type { UserRepository } from '../modules/iam/domain/ports';
import { UserId } from '../modules/iam/domain/value-objects/user-id';
import { ENTRY_REPOSITORY } from '../modules/referentials/domain/ports';
import type { EntryRepository } from '../modules/referentials/domain/ports';
import { CatalogCode, EntryCode } from '../modules/referentials/domain/value-objects/codes';
import { REFERENCE_CODES, STRUCTURE_DIRECTORY, USER_DIRECTORY } from '../modules/staff/domain/ports';
import type { NodeInfo, ReferenceCatalog, ReferenceCodes, StructureDirectory, UserDirectory } from '../modules/staff/domain/ports';
import { FacilityRef, NodeRef, UserRef } from '../modules/staff/domain/values';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module Personnel est relié à l'Administration (structure), à
 * l'IAM (comptes) et aux Référentiels (professions, spécialités). Aucun de ces modules ne connaît les autres.
 */
export class AdministrationStructureDirectory implements StructureDirectory {
  constructor(private readonly structure: StructureRepository) {}

  async describe(nodeId: NodeRef): Promise<NodeInfo | null> {
    const id = NodeId.create(nodeId.value);
    if (!id.ok) return null;
    const node = await this.structure.findById(id.value);
    const facilityId = node && FacilityRef.create(node.facilityId.value);
    if (!node || !facilityId?.ok) return null;
    return { facilityId: facilityId.value, kind: node.kind, active: node.active };
  }
}

export class IamUserDirectory implements UserDirectory {
  constructor(private readonly users: UserRepository) {}

  async exists(userId: UserRef): Promise<boolean> {
    const id = UserId.create(userId.value);
    return id.ok && (await this.users.findById(id.value)) !== null;
  }
}

export class ReferentialsReferenceCodes implements ReferenceCodes {
  constructor(private readonly entries: EntryRepository) {}

  async isActive(catalog: ReferenceCatalog, code: string): Promise<boolean> {
    const catalogCode = CatalogCode.create(catalog);
    const entryCode = EntryCode.create(code);
    if (!catalogCode.ok || !entryCode.ok) return false;
    return (await this.entries.findByCode(catalogCode.value, entryCode.value))?.active === true;
  }
}

@Module({})
export class StaffIntegrationModule {
  static register(): DynamicModule {
    return {
      module: StaffIntegrationModule,
      // Global : le module Personnel y trouve ses annuaires sans importer (ni connaître) les modules qu'ils interrogent.
      global: true,
      providers: [
        { provide: STRUCTURE_DIRECTORY, inject: [STRUCTURE_REPOSITORY], useFactory: (s: StructureRepository) => new AdministrationStructureDirectory(s) },
        { provide: USER_DIRECTORY, inject: [USER_REPOSITORY], useFactory: (u: UserRepository) => new IamUserDirectory(u) },
        { provide: REFERENCE_CODES, inject: [ENTRY_REPOSITORY], useFactory: (e: EntryRepository) => new ReferentialsReferenceCodes(e) },
      ],
      exports: [STRUCTURE_DIRECTORY, USER_DIRECTORY, REFERENCE_CODES],
    };
  }
}
