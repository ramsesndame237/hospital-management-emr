import { DynamicModule, Module } from '@nestjs/common';
import { allergyAlertsFor, Prescription } from '../modules/clinical/domain/prescription';
import { ALLERGY_REPOSITORY, CLINICAL_DISPENSING, PRESCRIPTION_REPOSITORY } from '../modules/clinical/domain/ports';
import type { AllergyRepository, DispensingDirectory, PrescriptionRepository } from '../modules/clinical/domain/ports';
import { PatientRef, PrescriptionId } from '../modules/clinical/domain/values';
import { PATIENT_REPOSITORY } from '../modules/patients/domain/ports';
import type { PatientRepository } from '../modules/patients/domain/ports';
import { PatientId } from '../modules/patients/domain/values';
import { DISPENSATION_REPOSITORY, DRUG_REPOSITORY, PHARMACY_PRESCRIPTIONS } from '../modules/pharmacy/domain/ports';
import type { DispensationRepository, DrugRepository, PrescriptionDirectory, RxInfo } from '../modules/pharmacy/domain/ports';
import { DrugId } from '../modules/pharmacy/domain/values';

/**
 * Racine de composition : c'est ici, et seulement ici, que la Pharmacie est reliée aux ordonnances de la Clinique (pour délivrer) et que la Clinique
 * est reliée aux délivrances de la Pharmacie (pour dire ce qui est délivré et refuser d'annuler une ordonnance délivrée). Aucun des deux ne connaît l'autre.
 */
export class PrescriptionsForPharmacy implements PrescriptionDirectory {
  constructor(
    private readonly prescriptions: PrescriptionRepository,
    private readonly allergies: AllergyRepository,
    private readonly patients: PatientRepository,
    private readonly drugs: DrugRepository,
  ) {}

  async find(rawId: string): Promise<RxInfo | null> {
    const id = PrescriptionId.create(rawId);
    const found = id.ok ? await this.prescriptions.findById(id.value) : null;
    return found ? (await this.toRx([found]))[0] : null;
  }

  async listIssued(offset: number, limit: number): Promise<{ items: RxInfo[]; total: number }> {
    const page = await this.prescriptions.listIssued(offset, limit);
    return { total: page.total, items: await this.toRx(page.items) };
  }

  private async toRx(prescriptions: readonly Prescription[]): Promise<RxInfo[]> {
    const drugIds = [...new Set(prescriptions.flatMap((p) => p.state.lines.map((l) => l.drugId.value)))].flatMap((raw) => {
      const id = DrugId.create(raw);
      return id.ok ? [id.value] : [];
    });
    const drugs = new Map((await this.drugs.findByIds(drugIds)).map((d) => [d.id.value, d]));
    const patientIds = [...new Set(prescriptions.map((p) => p.state.patientId.value))];
    const patients = new Map<string, RxInfo['patient']>();
    const allergies = new Map<string, { id: string; substance: string; severity: string }[]>();
    for (const raw of patientIds) {
      const id = PatientId.create(raw);
      const patient = id.ok ? await this.patients.findById(id.value) : null;
      if (patient) {
        const s = patient.state;
        patients.set(raw, { id: patient.id.value, number: patient.number.value, lastName: s.lastName.value, firstName: s.firstName.value, sex: s.sex, birthDate: s.birthDate.toString() });
      }
      const ref = PatientRef.create(raw);
      allergies.set(raw, ref.ok ? (await this.allergies.listOf(ref.value, false)).map((a) => ({ id: a.id.value, substance: a.state.substance, severity: a.state.severity })) : []);
    }
    return prescriptions.map((p): RxInfo => {
      const s = p.state;
      return {
        id: s.id.value, number: s.number.value, status: s.status, issuedAt: s.issuedAt, doctorId: s.doctorId, notes: s.notes, patient: patients.get(s.patientId.value) ?? null,
        lines: s.lines.map((l, position) => {
          const drug = drugs.get(l.drugId.value);
          const alerts = drug ? allergyAlertsFor({ name: drug.state.name.value, genericName: drug.state.genericName.value }, allergies.get(s.patientId.value) ?? []) : [];
          return {
            position, drugId: l.drugId.value, dose: l.dose, frequency: l.frequency, durationDays: l.durationDays, quantity: l.quantity, instructions: l.instructions, allergyOverride: l.allergyOverride,
            allergyAlerts: alerts.map((a) => ({ substance: a.substance, severity: a.severity })),
          };
        }),
      };
    });
  }
}

export class DispensingForClinical implements DispensingDirectory {
  constructor(private readonly dispensations: DispensationRepository) {}

  dispensedQuantities(prescriptionIds: readonly string[]): Promise<Map<string, Map<number, number>>> {
    return this.dispensations.dispensedQuantities(prescriptionIds);
  }
}

@Module({})
export class DispensingIntegrationModule {
  static register(): DynamicModule {
    return {
      module: DispensingIntegrationModule,
      // Global : la Pharmacie et la Clinique y trouvent leurs annuaires sans importer (ni connaître) l'autre module.
      global: true,
      providers: [
        {
          provide: PHARMACY_PRESCRIPTIONS, inject: [PRESCRIPTION_REPOSITORY, ALLERGY_REPOSITORY, PATIENT_REPOSITORY, DRUG_REPOSITORY],
          useFactory: (p: PrescriptionRepository, a: AllergyRepository, pt: PatientRepository, d: DrugRepository) => new PrescriptionsForPharmacy(p, a, pt, d),
        },
        { provide: CLINICAL_DISPENSING, inject: [DISPENSATION_REPOSITORY], useFactory: (d: DispensationRepository) => new DispensingForClinical(d) },
      ],
      exports: [PHARMACY_PRESCRIPTIONS, CLINICAL_DISPENSING],
    };
  }
}
