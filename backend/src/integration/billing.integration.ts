import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STRUCTURE_REPOSITORY } from '../modules/administration/domain/ports';
import type { StructureRepository } from '../modules/administration/domain/ports';
import { NodeId } from '../modules/administration/domain/structure/values';
import { BILLING_CURRENCY, BILLING_PATIENTS, BILLING_SERVICES } from '../modules/billing/domain/ports';
import type { PatientDirectory, PatientInfo, ServiceDirectory, ServiceInfo } from '../modules/billing/domain/ports';
import { Currency } from '../modules/billing/domain/values';
import type { ServiceRef } from '../modules/billing/domain/values';
import { PATIENT_REPOSITORY } from '../modules/patients/domain/ports';
import type { PatientRepository } from '../modules/patients/domain/ports';
import { PatientId } from '../modules/patients/domain/values';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module Facturation est relié aux Patients et à l'Administration
 * (structure), et que la devise de l'installation est lue dans la configuration. Aucun de ces modules ne connaît les autres.
 */
export class PatientsForBilling implements PatientDirectory {
  constructor(private readonly patients: PatientRepository) {}

  async find(ids: readonly string[]): Promise<Map<string, PatientInfo>> {
    const found = new Map<string, PatientInfo>();
    for (const raw of ids) {
      const id = PatientId.create(raw);
      const patient = id.ok ? await this.patients.findById(id.value) : null;
      if (patient) found.set(patient.id.value, { id: patient.id.value, number: patient.number.value, lastName: patient.state.lastName.value, firstName: patient.state.firstName.value });
    }
    return found;
  }
}

/** Un acte se rattache à un SERVICE (premier niveau de la structure), pas à une unité, une salle ou un lit. */
export class ServicesForBilling implements ServiceDirectory {
  constructor(private readonly structure: StructureRepository) {}

  async find(ref: ServiceRef): Promise<ServiceInfo | null> {
    const id = NodeId.create(ref.value);
    const node = id.ok ? await this.structure.findById(id.value) : null;
    return node && node.kind === 'SERVICE' ? { id: node.id.value, active: node.active } : null;
  }
}

@Module({})
export class BillingIntegrationModule {
  static register(): DynamicModule {
    return {
      module: BillingIntegrationModule,
      // Global : le module Facturation y trouve ses annuaires et sa devise sans importer (ni connaître) les modules qu'ils interrogent.
      global: true,
      providers: [
        { provide: BILLING_PATIENTS, inject: [PATIENT_REPOSITORY], useFactory: (p: PatientRepository) => new PatientsForBilling(p) },
        { provide: BILLING_SERVICES, inject: [STRUCTURE_REPOSITORY], useFactory: (s: StructureRepository) => new ServicesForBilling(s) },
        {
          provide: BILLING_CURRENCY,
          inject: [ConfigService],
          useFactory: (cfg: ConfigService): Currency => {
            const currency = Currency.create(cfg.get<string>('BILLING_CURRENCY') ?? 'XAF');
            if (!currency.ok) throw new Error(currency.error.message);
            return currency.value;
          },
        },
      ],
      exports: [BILLING_PATIENTS, BILLING_SERVICES, BILLING_CURRENCY],
    };
  }
}
