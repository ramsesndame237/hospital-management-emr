import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PHARMACY_CURRENCY, PHARMACY_EXPIRY_ALERT_DAYS, PHARMACY_USERS } from '../modules/pharmacy/domain/ports';
import type { UserDirectory } from '../modules/pharmacy/domain/ports';
import { USER_REPOSITORY } from '../modules/iam/domain/ports';
import type { UserRepository } from '../modules/iam/domain/ports';
import { UserId } from '../modules/iam/domain/value-objects/user-id';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module Pharmacie est relié à l'IAM (identifiants de connexion des
 * réceptionnaires et des demandeurs d'ajustement) et à la configuration. Aucun des deux ne connaît l'autre.
 */
export class UsersForPharmacy implements UserDirectory {
  constructor(private readonly users: UserRepository) {}

  async find(ids: readonly string[]): Promise<Map<string, { readonly id: string; readonly username: string }>> {
    const found = new Map<string, { readonly id: string; readonly username: string }>();
    for (const raw of ids) {
      const id = UserId.create(raw);
      const user = id.ok ? await this.users.findById(id.value) : null;
      if (user) found.set(user.id.value, { id: user.id.value, username: user.username.value });
    }
    return found;
  }
}

@Module({})
export class PharmacyIntegrationModule {
  static register(): DynamicModule {
    return {
      module: PharmacyIntegrationModule,
      // Global : le module Pharmacie y trouve ses annuaires et sa configuration sans importer (ni connaître) ce qu'ils interrogent.
      global: true,
      providers: [
        { provide: PHARMACY_USERS, inject: [USER_REPOSITORY], useFactory: (u: UserRepository) => new UsersForPharmacy(u) },
        { provide: PHARMACY_EXPIRY_ALERT_DAYS, inject: [ConfigService], useFactory: (cfg: ConfigService): number => cfg.get<number>('PHARMACY_EXPIRY_ALERT_DAYS') ?? 90 },
        // La devise est celle de l'installation, déjà réglée pour la facturation : un seul réglage, une seule monnaie.
        { provide: PHARMACY_CURRENCY, inject: [ConfigService], useFactory: (cfg: ConfigService): string => cfg.get<string>('BILLING_CURRENCY') ?? 'XAF' },
      ],
      exports: [PHARMACY_USERS, PHARMACY_EXPIRY_ALERT_DAYS, PHARMACY_CURRENCY],
    };
  }
}
