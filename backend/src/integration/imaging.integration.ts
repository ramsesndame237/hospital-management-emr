import { DynamicModule, Module } from '@nestjs/common';
import { ENCOUNTER_REPOSITORY } from '../modules/clinical/domain/ports';
import type { EncounterRepository } from '../modules/clinical/domain/ports';
import { EncounterId } from '../modules/clinical/domain/values';
import { IMAGING_ENCOUNTERS, IMAGING_PATIENTS, IMAGING_USERS } from '../modules/imaging/domain/ports';
import type { EncounterDirectory, EncounterInfo, PatientDirectory, PatientInfo, UserDirectory } from '../modules/imaging/domain/ports';
import { USER_REPOSITORY } from '../modules/iam/domain/ports';
import type { UserRepository } from '../modules/iam/domain/ports';
import { UserId } from '../modules/iam/domain/value-objects/user-id';
import { PATIENT_REPOSITORY } from '../modules/patients/domain/ports';
import type { PatientRepository } from '../modules/patients/domain/ports';
import { PatientId } from '../modules/patients/domain/values';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module Imagerie est relié aux Patients (identité), à l'IAM (noms des intervenants) et à
 * la Clinique (une demande d'examen se rattache à la consultation qui l'a prescrite). Aucun de ces modules ne connaît les autres.
 */
export class PatientsForImaging implements PatientDirectory {
  constructor(private readonly patients: PatientRepository) {}

  async find(ids: readonly string[]): Promise<Map<string, PatientInfo>> {
    const found = new Map<string, PatientInfo>();
    for (const raw of ids) {
      const id = PatientId.create(raw);
      const patient = id.ok ? await this.patients.findById(id.value) : null;
      if (patient) {
        const s = patient.state;
        found.set(patient.id.value, { id: patient.id.value, number: patient.number.value, lastName: s.lastName.value, firstName: s.firstName.value, sex: s.sex, birthDate: s.birthDate.toString() });
      }
    }
    return found;
  }
}

/** Les comptes appartiennent à l'IAM : le module Imagerie n'en lit que l'identifiant de connexion (prescripteur, radiologue). */
export class UsersForImaging implements UserDirectory {
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

export class EncountersForImaging implements EncounterDirectory {
  constructor(private readonly encounters: EncounterRepository) {}

  async find(raw: string): Promise<EncounterInfo | null> {
    const id = EncounterId.create(raw);
    const encounter = id.ok ? await this.encounters.findById(id.value) : null;
    return encounter ? { id: encounter.id.value, patientId: encounter.state.patientId.value, status: encounter.status } : null;
  }
}

@Module({})
export class ImagingIntegrationModule {
  static register(): DynamicModule {
    return {
      module: ImagingIntegrationModule,
      // Global : le module Imagerie y trouve ses annuaires sans importer (ni connaître) les modules qu'ils interrogent.
      global: true,
      providers: [
        { provide: IMAGING_PATIENTS, inject: [PATIENT_REPOSITORY], useFactory: (p: PatientRepository) => new PatientsForImaging(p) },
        { provide: IMAGING_USERS, inject: [USER_REPOSITORY], useFactory: (u: UserRepository) => new UsersForImaging(u) },
        { provide: IMAGING_ENCOUNTERS, inject: [ENCOUNTER_REPOSITORY], useFactory: (e: EncounterRepository) => new EncountersForImaging(e) },
      ],
      exports: [IMAGING_PATIENTS, IMAGING_USERS, IMAGING_ENCOUNTERS],
    };
  }
}
