import { DynamicModule, Module } from '@nestjs/common';
import { AccessDecider } from '../modules/iam/application/access-decider';
import { SERVICE_ACCESS } from '../shared-kernel/service-access';
import type { ServiceAccess } from '../shared-kernel/service-access';

/**
 * Racine de composition : les modules métier (rendez-vous, admissions…) posent la question « sur quels services cet utilisateur
 * peut-il agir ? » via le port neutre `ServiceAccess` ; l'IAM y répond avec les portées de ses permissions.
 */
export class IamServiceAccess implements ServiceAccess {
  constructor(private readonly decider: AccessDecider) {}

  async visibleServices(userId: string, permission: string): Promise<'ALL' | readonly string[]> {
    const r = await this.decider.visibleDepartments(userId, permission);
    if (!r.ok) throw new Error(r.error.message); // permission mal formée : bug de programmation, jamais une saisie
    return r.value;
  }

  async canAccess(userId: string, permission: string, serviceId: string): Promise<boolean> {
    const r = await this.decider.decide(userId, permission, { departmentId: serviceId });
    if (!r.ok) throw new Error(r.error.message);
    return r.value.allowed;
  }
}

@Module({})
export class ServiceAccessIntegrationModule {
  static register(): DynamicModule {
    return {
      module: ServiceAccessIntegrationModule,
      // Global : les modules métier y trouvent leur contrôle d'accès par service sans importer (ni connaître) l'IAM.
      global: true,
      providers: [{ provide: SERVICE_ACCESS, inject: [AccessDecider], useFactory: (d: AccessDecider) => new IamServiceAccess(d) }],
      exports: [SERVICE_ACCESS],
    };
  }
}
