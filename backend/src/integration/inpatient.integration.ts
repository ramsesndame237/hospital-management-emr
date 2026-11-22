import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR } from '../database/sql-executor';
import type { SqlExecutor } from '../database/sql-executor';
import { requiredInstantFromDb } from '../database/temporal-mapping';
import { USER_REPOSITORY } from '../modules/iam/domain/ports';
import type { UserRepository } from '../modules/iam/domain/ports';
import { UserId } from '../modules/iam/domain/value-objects/user-id';
import { INPATIENT_MEDICATIONS, INPATIENT_PATIENTS, INPATIENT_STAYS, INPATIENT_USERS } from '../modules/inpatient/domain/ports';
import type { MedicationDirectory, OrderedMedication, PatientCard, PatientDirectory, Stay, StayDirectory, UserDirectory } from '../modules/inpatient/domain/ports';
import { PATIENT_REPOSITORY } from '../modules/patients/domain/ports';
import type { PatientRepository } from '../modules/patients/domain/ports';
import { PatientId } from '../modules/patients/domain/values';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module Hospitalisation lit les séjours (Admissions), les patients, les comptes et les ordonnances des
 * tournées (Clinique). Il n'en lit que ce dont le soin a besoin : identité, lit, dates, libellé et posologie des médicaments (aucune note ni aucun diagnostic).
 */
export class PatientsForInpatient implements PatientDirectory {
  constructor(private readonly patients: PatientRepository) {}

  async find(ids: readonly string[]): Promise<Map<string, PatientCard>> {
    const found = new Map<string, PatientCard>();
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

export class UsersForInpatient implements UserDirectory {
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

interface StayRow {
  id: string;
  admission_number: string;
  patient_id: string;
  service_id: string;
  bed_id: string | null;
  bed_name: string | null;
  admitted_at: Date | string;
  active: boolean;
}

const STAY_SELECT = `SELECT a.id, a.admission_number, a.patient_id, a.service_id, a.bed_id, b.name AS bed_name, a.admitted_at, (a.status = 'IN_PROGRESS') AS active
  FROM admissions a LEFT JOIN administration_structure_nodes b ON b.id = a.bed_id`;

const toStay = (r: StayRow): Stay => ({
  id: r.id, number: r.admission_number, patientId: r.patient_id, serviceId: r.service_id, bed: r.bed_id ? { id: r.bed_id, name: r.bed_name ?? '' } : null,
  admittedAt: requiredInstantFromDb(r.admitted_at), active: r.active,
});

export class SqlStayDirectory implements StayDirectory {
  constructor(private readonly sql: SqlExecutor) {}

  async find(admissionId: string): Promise<Stay | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(admissionId)) return null;
    const rows = await this.sql.query<StayRow>(`${STAY_SELECT} WHERE a.id = $1::uuid AND a.admission_type = 'INPATIENT' AND a.status <> 'CANCELLED'`, [admissionId]);
    return rows[0] ? toStay(rows[0]) : null;
  }

  async inpatients(serviceIds: readonly string[] | null): Promise<Stay[]> {
    const rows = await this.sql.query<StayRow>(
      `${STAY_SELECT} WHERE a.admission_type = 'INPATIENT' AND a.status = 'IN_PROGRESS' AND ($1::uuid[] IS NULL OR a.service_id = ANY($1::uuid[])) ORDER BY b.name NULLS LAST, a.admitted_at`,
      [serviceIds],
    );
    return rows.map(toStay);
  }
}

interface MedicationRow {
  prescription_id: string;
  prescription_number: string;
  position: number;
  drug_name: string;
  dose: string;
  frequency: string;
  instructions: string | null;
  issued_at: Date | string;
  allergy_override: string | null;
}

const MEDICATION_SELECT = `SELECT p.id AS prescription_id, p.prescription_number, l.position, d.name || COALESCE(' ' || d.strength, '') AS drug_name, l.dose, l.frequency, l.instructions, p.issued_at, l.allergy_override
  FROM clinical_prescriptions p
  JOIN clinical_encounters e ON e.id = p.encounter_id
  JOIN clinical_prescription_lines l ON l.prescription_id = p.id
  JOIN pharmacy_drugs d ON d.id = l.drug_id`;

const toMedication = (r: MedicationRow): OrderedMedication => ({
  prescriptionId: r.prescription_id, prescriptionNumber: r.prescription_number, position: r.position, drugName: r.drug_name, dose: r.dose, frequency: r.frequency, instructions: r.instructions,
  issuedAt: requiredInstantFromDb(r.issued_at), allergyWarning: r.allergy_override !== null,
});

export class SqlMedicationDirectory implements MedicationDirectory {
  constructor(private readonly sql: SqlExecutor) {}

  async forStay(admissionId: string): Promise<OrderedMedication[]> {
    const rows = await this.sql.query<MedicationRow>(`${MEDICATION_SELECT} WHERE e.admission_id = $1::uuid AND p.status = 'ISSUED' ORDER BY p.issued_at DESC, l.position`, [admissionId]);
    return rows.map(toMedication);
  }

  async find(admissionId: string, prescriptionId: string, position: number): Promise<OrderedMedication | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(prescriptionId)) return null;
    const rows = await this.sql.query<MedicationRow>(
      `${MEDICATION_SELECT} WHERE e.admission_id = $1::uuid AND p.id = $2::uuid AND l.position = $3 AND p.status = 'ISSUED'`, [admissionId, prescriptionId, position],
    );
    return rows[0] ? toMedication(rows[0]) : null;
  }
}

@Module({})
export class InpatientIntegrationModule {
  static register(): DynamicModule {
    return {
      module: InpatientIntegrationModule,
      global: true,
      providers: [
        { provide: INPATIENT_PATIENTS, inject: [PATIENT_REPOSITORY], useFactory: (p: PatientRepository) => new PatientsForInpatient(p) },
        { provide: INPATIENT_USERS, inject: [USER_REPOSITORY], useFactory: (u: UserRepository) => new UsersForInpatient(u) },
        { provide: INPATIENT_STAYS, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new SqlStayDirectory(sql) },
        { provide: INPATIENT_MEDICATIONS, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new SqlMedicationDirectory(sql) },
      ],
      exports: [INPATIENT_PATIENTS, INPATIENT_USERS, INPATIENT_STAYS, INPATIENT_MEDICATIONS],
    };
  }
}
