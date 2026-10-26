import { DynamicModule, Module } from '@nestjs/common';
import { SPECIALTY_DIRECTORY } from '../modules/administration/domain/ports';
import type { SpecialtyDirectory } from '../modules/administration/domain/ports';
import { SpecialtyCode } from '../modules/administration/domain/structure/values';
import { ENTRY_REPOSITORY } from '../modules/referentials/domain/ports';
import type { EntryRepository } from '../modules/referentials/domain/ports';
import { CatalogCode, EntryCode } from '../modules/referentials/domain/value-objects/codes';

/**
 * Racine de composition : c'est ici, et seulement ici, que l'administration est reliée au module des référentiels.
 * L'administration ne sait pas que les spécialités sont un catalogue ; les référentiels ne savent pas qu'un service s'y réfère.
 */
export class ReferentialsSpecialtyDirectory implements SpecialtyDirectory {
  private readonly catalog: CatalogCode;

  constructor(private readonly entries: EntryRepository) {
    const catalog = CatalogCode.create('SPECIALTY');
    if (!catalog.ok) throw new Error(catalog.error.message);
    this.catalog = catalog.value;
  }

  async isActive(code: SpecialtyCode): Promise<boolean> {
    const entryCode = EntryCode.create(code.value);
    if (!entryCode.ok) return false;
    const entry = await this.entries.findByCode(this.catalog, entryCode.value);
    return entry?.active === true;
  }
}

@Module({})
export class AdministrationIntegrationModule {
  static register(): DynamicModule {
    return {
      module: AdministrationIntegrationModule,
      // Global : le module Administration y trouve son annuaire de spécialités sans importer (ni connaître) les référentiels.
      global: true,
      providers: [{ provide: SPECIALTY_DIRECTORY, inject: [ENTRY_REPOSITORY], useFactory: (e: EntryRepository) => new ReferentialsSpecialtyDirectory(e) }],
      exports: [SPECIALTY_DIRECTORY],
    };
  }
}
