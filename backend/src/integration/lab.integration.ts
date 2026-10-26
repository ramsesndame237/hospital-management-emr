import { DynamicModule, Module } from '@nestjs/common';
import { LAB_PATIENTS, LAB_USERS } from '../modules/lab/domain/ports';
import type { PatientDirectory, PatientInfo, UserDirectory } from '../modules/lab/domain/ports';
import { USER_REPOSITORY } from '../modules/iam/domain/ports';
import type { UserRepository } from '../modules/iam/domain/ports';
import { UserId } from '../modules/iam/domain/value-objects/user-id';
import { PATIENT_REPOSITORY } from '../modules/patients/domain/ports';
import type { PatientRepository } from '../modules/patients/domain/ports';
import { PatientId } from '../modules/patients/domain/values';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module Laboratoire est relié aux Patients (identité, sexe et date de
 * naissance, nécessaires au contrôle d'identité du prélèvement) et à l'IAM (noms des préleveurs). Aucun de ces modules ne connaît les autres.
 */
export class PatientsForLab implements PatientDirectory {
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

/** Les comptes appartiennent à l'IAM : le module Laboratoire n'en lit que l'identifiant de connexion (prescripteur, préleveur, réceptionnaire). */
export class UsersForLab implements UserDirectory {
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
export class LabIntegrationModule {
  static register(): DynamicModule {
    return {
      module: LabIntegrationModule,
      // Global : le module Laboratoire y trouve ses annuaires sans importer (ni connaître) les modules qu'ils interrogent.
      global: true,
      providers: [
        { provide: LAB_PATIENTS, inject: [PATIENT_REPOSITORY], useFactory: (p: PatientRepository) => new PatientsForLab(p) },
        { provide: LAB_USERS, inject: [USER_REPOSITORY], useFactory: (u: UserRepository) => new UsersForLab(u) },
      ],
      exports: [LAB_PATIENTS, LAB_USERS],
    };
  }
}
