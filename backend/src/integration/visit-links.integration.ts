import { DynamicModule, Module } from '@nestjs/common';
import { ADMISSION_REPOSITORY } from '../modules/admissions/domain/ports';
import type { AdmissionRepository } from '../modules/admissions/domain/ports';
import { AdmissionId } from '../modules/admissions/domain/values';
import { BILLING_ADMISSIONS } from '../modules/billing/domain/ports';
import type { AdmissionDirectory, AdmissionInfo } from '../modules/billing/domain/ports';
import { ENCOUNTER_REPOSITORY } from '../modules/clinical/domain/ports';
import type { EncounterRepository } from '../modules/clinical/domain/ports';
import { EncounterId } from '../modules/clinical/domain/values';
import { LAB_ENCOUNTERS } from '../modules/lab/domain/ports';
import type { EncounterDirectory, EncounterInfo } from '../modules/lab/domain/ports';

/**
 * Racine de composition : c'est ici, et seulement ici, que le Laboratoire est relié aux consultations de la Clinique (une demande d'analyses se rattache à la
 * consultation qui l'a prescrite) et la Facturation aux admissions (une facture règle une admission). Aucun de ces modules ne connaît les autres.
 */
export class EncountersForLab implements EncounterDirectory {
  constructor(private readonly encounters: EncounterRepository) {}

  async find(raw: string): Promise<EncounterInfo | null> {
    const id = EncounterId.create(raw);
    const encounter = id.ok ? await this.encounters.findById(id.value) : null;
    return encounter ? { id: encounter.id.value, patientId: encounter.state.patientId.value, status: encounter.status } : null;
  }
}

export class AdmissionsForBilling implements AdmissionDirectory {
  constructor(private readonly admissions: AdmissionRepository) {}

  async find(raw: string): Promise<AdmissionInfo | null> {
    const id = AdmissionId.create(raw);
    const admission = id.ok ? await this.admissions.findById(id.value) : null;
    return admission ? { id: admission.id.value, patientId: admission.state.patientId.value, number: admission.state.number.value } : null;
  }
}

@Module({})
export class VisitLinksIntegrationModule {
  static register(): DynamicModule {
    return {
      module: VisitLinksIntegrationModule,
      // Global : le Laboratoire et la Facturation y trouvent leurs annuaires sans importer (ni connaître) la Clinique ni les Admissions.
      global: true,
      providers: [
        { provide: LAB_ENCOUNTERS, inject: [ENCOUNTER_REPOSITORY], useFactory: (e: EncounterRepository) => new EncountersForLab(e) },
        { provide: BILLING_ADMISSIONS, inject: [ADMISSION_REPOSITORY], useFactory: (a: AdmissionRepository) => new AdmissionsForBilling(a) },
      ],
      exports: [LAB_ENCOUNTERS, BILLING_ADMISSIONS],
    };
  }
}
