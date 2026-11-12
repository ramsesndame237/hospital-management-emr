import { DynamicModule, Module } from '@nestjs/common';
import { ADMISSION_REPOSITORY } from '../modules/admissions/domain/ports';
import type { AdmissionRepository } from '../modules/admissions/domain/ports';
import { Admission } from '../modules/admissions/domain/admission';
import { AdmissionId, AdmissionStatus, AdmissionType } from '../modules/admissions/domain/values';
import { CLINICAL_DRUGS, CLINICAL_PATIENTS, CLINICAL_USERS, CLINICAL_VISITS } from '../modules/clinical/domain/ports';
import type { DrugDirectory, DrugInfo, PatientDirectory, PatientInfo, UserDirectory, VisitDirectory, VisitInfo } from '../modules/clinical/domain/ports';
import { USER_REPOSITORY } from '../modules/iam/domain/ports';
import type { UserRepository } from '../modules/iam/domain/ports';
import { UserId } from '../modules/iam/domain/value-objects/user-id';
import { DRUG_REPOSITORY } from '../modules/pharmacy/domain/ports';
import type { DrugRepository } from '../modules/pharmacy/domain/ports';
import { Drug } from '../modules/pharmacy/domain/drug';
import { DrugId } from '../modules/pharmacy/domain/values';
import { PATIENT_REPOSITORY } from '../modules/patients/domain/ports';
import type { PatientRepository } from '../modules/patients/domain/ports';
import { PatientId } from '../modules/patients/domain/values';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module Clinique est relié aux Patients (identité du bandeau), à l'IAM (noms des
 * soignants), aux Admissions (l'arrivée d'un patient ouvre la consultation) et à la Pharmacie (le formulaire des médicaments prescrits). Aucun de ces modules ne connaît les autres.
 */
export class PatientsForClinical implements PatientDirectory {
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

export class UsersForClinical implements UserDirectory {
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

const visitOf = (a: Admission): VisitInfo => ({
  id: a.id.value, number: a.state.number.value, patientId: a.state.patientId.value, serviceId: a.state.serviceId.value, type: a.state.type as VisitInfo['type'], inProgress: a.inProgress, admittedAt: a.state.admittedAt,
});

export class VisitsForClinical implements VisitDirectory {
  constructor(private readonly admissions: AdmissionRepository) {}

  async find(admissionId: string): Promise<VisitInfo | null> {
    const id = AdmissionId.create(admissionId);
    const admission = id.ok ? await this.admissions.findById(id.value) : null;
    return admission ? visitOf(admission) : null;
  }

  async waiting(serviceIds: readonly string[] | null, limit: number): Promise<VisitInfo[]> {
    const lists = await Promise.all([AdmissionType.OUTPATIENT, AdmissionType.EMERGENCY].map((type) => this.admissions.list({ status: AdmissionStatus.IN_PROGRESS, type, serviceIds }, 0, limit)));
    return lists.flatMap((l) => l.items).sort((a, b) => a.state.admittedAt.epochMilliseconds - b.state.admittedAt.epochMilliseconds).slice(0, limit).map(visitOf);
  }
}

const drugOf = (d: Drug): DrugInfo => {
  const s = d.state;
  return { id: d.id.value, code: s.code.value, name: s.name.value, genericName: s.genericName.value, strength: s.strength, form: s.form, schedule: s.schedule, unit: s.unit, active: s.active };
};

export class DrugsForClinical implements DrugDirectory {
  constructor(private readonly drugs: DrugRepository) {}

  async find(ids: readonly string[]): Promise<Map<string, DrugInfo>> {
    const refs = ids.flatMap((raw) => {
      const id = DrugId.create(raw);
      return id.ok ? [id.value] : [];
    });
    return new Map((await this.drugs.findByIds(refs)).map((d) => [d.id.value, drugOf(d)]));
  }

  async search(text: string, limit: number): Promise<DrugInfo[]> {
    return (await this.drugs.list({ search: text, includeInactive: false }, 0, limit)).items.map(drugOf);
  }
}

@Module({})
export class ClinicalIntegrationModule {
  static register(): DynamicModule {
    return {
      module: ClinicalIntegrationModule,
      // Global : le module Clinique y trouve ses annuaires sans importer (ni connaître) les modules qu'ils interrogent.
      global: true,
      providers: [
        { provide: CLINICAL_PATIENTS, inject: [PATIENT_REPOSITORY], useFactory: (p: PatientRepository) => new PatientsForClinical(p) },
        { provide: CLINICAL_USERS, inject: [USER_REPOSITORY], useFactory: (u: UserRepository) => new UsersForClinical(u) },
        { provide: CLINICAL_VISITS, inject: [ADMISSION_REPOSITORY], useFactory: (a: AdmissionRepository) => new VisitsForClinical(a) },
        { provide: CLINICAL_DRUGS, inject: [DRUG_REPOSITORY], useFactory: (d: DrugRepository) => new DrugsForClinical(d) },
      ],
      exports: [CLINICAL_PATIENTS, CLINICAL_USERS, CLINICAL_VISITS, CLINICAL_DRUGS],
    };
  }
}
