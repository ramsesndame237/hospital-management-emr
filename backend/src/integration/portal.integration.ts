import { DynamicModule, Module } from '@nestjs/common';
import { PatientRef as AppointmentPatientRef } from '../modules/appointments/domain/values';
import { APPOINTMENT_REPOSITORY } from '../modules/appointments/domain/ports';
import type { AppointmentRepository } from '../modules/appointments/domain/ports';
import { InvoiceStatus } from '../modules/billing/domain/values';
import { PatientRef as BillingPatientRef } from '../modules/billing/domain/values';
import { INVOICE_REPOSITORY } from '../modules/billing/domain/ports';
import type { InvoiceRepository } from '../modules/billing/domain/ports';
import { CLINICAL_DISPENSING, PRESCRIPTION_REPOSITORY } from '../modules/clinical/domain/ports';
import type { DispensingDirectory, PrescriptionRepository } from '../modules/clinical/domain/ports';
import { PatientRef as ClinicalPatientRef } from '../modules/clinical/domain/values';
import { dispensingState } from '../modules/clinical/application/views';
import { USER_REPOSITORY } from '../modules/iam/domain/ports';
import type { UserRepository } from '../modules/iam/domain/ports';
import { UserId } from '../modules/iam/domain/value-objects/user-id';
import { Username } from '../modules/iam/domain/value-objects/username';
import { PatientReportsUseCase } from '../modules/lab/application/use-cases/reports';
import { PATIENT_REPOSITORY } from '../modules/patients/domain/ports';
import type { PatientRepository } from '../modules/patients/domain/ports';
import { PatientId } from '../modules/patients/domain/values';
import { DRUG_REPOSITORY } from '../modules/pharmacy/domain/ports';
import type { DrugRepository } from '../modules/pharmacy/domain/ports';
import { DrugId } from '../modules/pharmacy/domain/values';
import {
  PORTAL_APPOINTMENTS, PORTAL_INVOICES, PORTAL_PATIENTS, PORTAL_PRESCRIPTIONS, PORTAL_RESULTS, PORTAL_USERS,
} from '../modules/portal/domain/ports';
import type {
  PortalAppointment, PortalAppointments, PortalInvoice, PortalInvoices, PortalPatient, PortalPatients, PortalPrescription, PortalPrescriptions, PortalResult, PortalResults, PortalUser, PortalUsers,
} from '../modules/portal/domain/ports';
import { Temporal } from '../shared-kernel/temporal';

/**
 * Racine de composition : c'est ici, et seulement ici, que le portail du patient est relié aux Patients, à l'IAM, aux Rendez-vous, au Laboratoire (résultats
 * PUBLIÉS), à la Clinique (ordonnances), à la Pharmacie (ce qui est délivré) et à la Facturation. Aucun de ces modules ne connaît le portail.
 */
export class PatientsForPortal implements PortalPatients {
  constructor(private readonly patients: PatientRepository) {}

  async find(raw: string): Promise<PortalPatient | null> {
    const id = PatientId.create(raw);
    const patient = id.ok ? await this.patients.findById(id.value) : null;
    if (!patient) return null;
    const s = patient.state;
    return { id: patient.id.value, number: patient.number.value, lastName: s.lastName.value, firstName: s.firstName.value, sex: s.sex, birthDate: s.birthDate.toString() };
  }
}

export class UsersForPortal implements PortalUsers {
  constructor(private readonly users: UserRepository) {}

  private toPortal(user: { id: { value: string }; username: { value: string }; roles: readonly { value: string }[]; isActive: boolean }): PortalUser {
    return { id: user.id.value, username: user.username.value, roles: user.roles.map((r) => r.value), active: user.isActive };
  }

  async findByUsername(raw: string): Promise<PortalUser | null> {
    const username = Username.create(raw);
    const user = username.ok ? await this.users.findByUsername(username.value) : null;
    return user ? this.toPortal(user) : null;
  }

  async find(ids: readonly string[]): Promise<Map<string, PortalUser>> {
    const found = new Map<string, PortalUser>();
    for (const raw of ids) {
      const id = UserId.create(raw);
      const user = id.ok ? await this.users.findById(id.value) : null;
      if (user) found.set(user.id.value, this.toPortal(user));
    }
    return found;
  }
}

export class AppointmentsForPortal implements PortalAppointments {
  constructor(private readonly appointments: AppointmentRepository) {}

  async listOf(patientId: string, limit: number): Promise<PortalAppointment[]> {
    const ref = AppointmentPatientRef.create(patientId);
    if (!ref.ok) return [];
    // Le dépôt les range du plus ancien au plus récent ; le patient veut les plus récents d'abord.
    const page = await this.appointments.list({ patientId: ref.value, serviceIds: null }, 0, 200);
    return page.items.map((a) => ({ number: a.state.number.value, status: a.state.status, startsAt: a.state.slot.start, endsAt: a.state.slot.end })).reverse().slice(0, limit);
  }
}

export class ResultsForPortal implements PortalResults {
  constructor(private readonly reports: PatientReportsUseCase) {}

  async listOf(patientId: string, limit: number): Promise<PortalResult[]> {
    return (await this.reports.execute(patientId, limit)).map((r) => ({
      number: r.number,
      orderedAt: Temporal.Instant.from(r.orderedAt),
      items: r.items.filter((i) => i.status === 'RELEASED').map((i) => ({ testName: i.testName, value: i.value, unit: i.unit, flag: i.flag, refLow: i.refLow, refHigh: i.refHigh, amended: i.amended })),
    }));
  }
}

export class PrescriptionsForPortal implements PortalPrescriptions {
  constructor(private readonly prescriptions: PrescriptionRepository, private readonly drugs: DrugRepository, private readonly dispensing: DispensingDirectory) {}

  async listOf(patientId: string, limit: number): Promise<PortalPrescription[]> {
    const ref = ClinicalPatientRef.create(patientId);
    if (!ref.ok) return [];
    const found = await this.prescriptions.listByPatient(ref.value, limit);
    const drugIds = [...new Set(found.flatMap((p) => p.state.lines.map((l) => l.drugId.value)))].flatMap((raw) => {
      const id = DrugId.create(raw);
      return id.ok ? [id.value] : [];
    });
    const drugs = new Map((await this.drugs.findByIds(drugIds)).map((d) => [d.id.value, d.state]));
    const dispensed = await this.dispensing.dispensedQuantities(found.map((p) => p.id.value));
    return found.map((p) => ({
      number: p.state.number.value, issuedAt: p.state.issuedAt, status: p.state.status,
      dispensing: dispensingState(p.state.lines.map((l, i) => ({ prescribed: l.quantity, done: dispensed.get(p.id.value)?.get(i) ?? 0 }))),
      lines: p.state.lines.map((l) => {
        const drug = drugs.get(l.drugId.value);
        return { drugName: drug?.name.value ?? '—', strength: drug?.strength ?? null, dose: l.dose, frequency: l.frequency, durationDays: l.durationDays, quantity: l.quantity, unit: drug?.unit ?? '' };
      }),
    }));
  }
}

export class InvoicesForPortal implements PortalInvoices {
  constructor(private readonly invoices: InvoiceRepository) {}

  async listOf(patientId: string, limit: number): Promise<PortalInvoice[]> {
    const ref = BillingPatientRef.create(patientId);
    if (!ref.ok) return [];
    const page = await this.invoices.list({ patientId: ref.value }, 0, 200);
    // Un brouillon (en préparation à la caisse) n'est pas encore une facture pour le patient.
    return page.items
      .filter((i) => i.status !== InvoiceStatus.DRAFT)
      .slice(0, limit)
      .map((i) => ({ number: i.number, status: i.status, currency: i.currency, total: i.total, paid: i.paid, balance: i.status === InvoiceStatus.CANCELLED ? 0 : Math.max(0, i.total - i.paid), issuedAt: i.issuedAt }));
  }
}

@Module({})
export class PortalIntegrationModule {
  static register(): DynamicModule {
    return {
      module: PortalIntegrationModule,
      // Global : le portail y trouve ses lectures sans importer (ni connaître) les modules qu'il interroge.
      global: true,
      providers: [
        { provide: PORTAL_PATIENTS, inject: [PATIENT_REPOSITORY], useFactory: (p: PatientRepository) => new PatientsForPortal(p) },
        { provide: PORTAL_USERS, inject: [USER_REPOSITORY], useFactory: (u: UserRepository) => new UsersForPortal(u) },
        { provide: PORTAL_APPOINTMENTS, inject: [APPOINTMENT_REPOSITORY], useFactory: (a: AppointmentRepository) => new AppointmentsForPortal(a) },
        { provide: PORTAL_RESULTS, inject: [PatientReportsUseCase], useFactory: (r: PatientReportsUseCase) => new ResultsForPortal(r) },
        {
          provide: PORTAL_PRESCRIPTIONS, inject: [PRESCRIPTION_REPOSITORY, DRUG_REPOSITORY, CLINICAL_DISPENSING],
          useFactory: (p: PrescriptionRepository, d: DrugRepository, x: DispensingDirectory) => new PrescriptionsForPortal(p, d, x),
        },
        { provide: PORTAL_INVOICES, inject: [INVOICE_REPOSITORY], useFactory: (i: InvoiceRepository) => new InvoicesForPortal(i) },
      ],
      exports: [PORTAL_PATIENTS, PORTAL_USERS, PORTAL_APPOINTMENTS, PORTAL_RESULTS, PORTAL_PRESCRIPTIONS, PORTAL_INVOICES],
    };
  }
}
