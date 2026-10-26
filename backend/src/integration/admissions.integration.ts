import { DynamicModule, Module } from '@nestjs/common';
import { STRUCTURE_REPOSITORY } from '../modules/administration/domain/ports';
import type { StructureRepository } from '../modules/administration/domain/ports';
import { NodeId } from '../modules/administration/domain/structure/values';
import { ArriveAppointmentUseCase } from '../modules/appointments/application/use-cases/appointments';
import {
  ADMISSION_APPOINTMENTS, ADMISSION_PATIENTS, ADMISSION_PRACTITIONERS, ADMISSION_REASONS, ADMISSION_STRUCTURE,
} from '../modules/admissions/domain/ports';
import type { AppointmentDirectory, NodeInfo, StructureDirectory } from '../modules/admissions/domain/ports';
import { PATIENT_REPOSITORY } from '../modules/patients/domain/ports';
import type { PatientRepository } from '../modules/patients/domain/ports';
import { ENTRY_REPOSITORY } from '../modules/referentials/domain/ports';
import type { EntryRepository } from '../modules/referentials/domain/ports';
import { ASSIGNMENT_REPOSITORY, STAFF_REPOSITORY } from '../modules/staff/domain/ports';
import type { AssignmentRepository, StaffRepository } from '../modules/staff/domain/ports';
import { PatientsForAppointments, PractitionersForAppointments, VisitReasonsFromReferentials } from './appointments.integration';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module Admissions est relié aux Patients, au Personnel, à
 * l'Administration (structure), aux Rendez-vous et aux Référentiels. Aucun de ces modules ne connaît les autres.
 * Patients, personnel et nomenclatures répondent comme pour les rendez-vous : mêmes questions, mêmes adaptateurs.
 */
export class StructureForAdmissions implements StructureDirectory {
  constructor(private readonly structure: StructureRepository) {}

  /** Service dont dépend un élément : lui-même, ou le premier ancêtre de niveau service. */
  private async toInfo(rawId: string): Promise<NodeInfo | null> {
    const id = NodeId.create(rawId);
    const node = id.ok ? await this.structure.findById(id.value) : null;
    if (!node) return null;
    let current = node;
    const above: string[] = [];
    while (current.kind !== 'SERVICE' && current.parentId) {
      const parent = await this.structure.findById(current.parentId);
      if (!parent) return null;
      current = parent;
      if (parent.kind !== 'SERVICE') above.unshift(parent.name.value);
    }
    return { id: node.id.value, kind: node.kind, code: node.code.value, name: node.name.value, active: node.active, serviceId: current.id.value, location: above.join(' › ') };
  }

  describe(id: string): Promise<NodeInfo | null> {
    return this.toInfo(id);
  }

  async describeMany(ids: readonly string[]): Promise<Map<string, NodeInfo>> {
    const found = new Map<string, NodeInfo>();
    for (const id of ids) {
      const info = await this.toInfo(id);
      if (info) found.set(info.id, info);
    }
    return found;
  }

  async bedsOf(serviceId: string): Promise<NodeInfo[]> {
    const id = NodeId.create(serviceId);
    const service = id.ok ? await this.structure.findById(id.value) : null;
    if (!service) return [];
    const nodes = await this.structure.listByFacility(service.facilityId, true);
    const byId = new Map(nodes.map((n) => [n.id.value, n]));
    const belongsToService = (start: (typeof nodes)[number]): boolean => {
      for (let n: (typeof nodes)[number] | undefined = start; n; n = n.parentId ? byId.get(n.parentId.value) : undefined) if (n.id.equals(service.id)) return true;
      return false;
    };
    return nodes
      .filter((n) => n.kind === 'BED' && belongsToService(n))
      .map((n): NodeInfo => {
        const above: string[] = [];
        for (let p = n.parentId ? byId.get(n.parentId.value) : undefined; p && p.kind !== 'SERVICE'; p = p.parentId ? byId.get(p.parentId.value) : undefined) above.unshift(p.name.value);
        return { id: n.id.value, kind: n.kind, code: n.code.value, name: n.name.value, active: n.active, serviceId: service.id.value, location: above.join(' › ') };
      })
      .sort((a, b) => a.location.localeCompare(b.location) || a.code.localeCompare(b.code));
  }
}

export class AppointmentsForAdmissions implements AppointmentDirectory {
  constructor(private readonly arrive: ArriveAppointmentUseCase) {}

  async check(appointmentId: string, patientId: string): Promise<{ ok: true; serviceId: string } | { ok: false; code: string; message: string }> {
    const r = await this.arrive.check(appointmentId, patientId);
    return r.ok ? { ok: true, serviceId: r.value.serviceId } : { ok: false, code: r.error.code, message: r.error.message };
  }

  async markArrived(actorId: string, appointmentId: string, patientId: string): Promise<void> {
    const r = await this.arrive.execute(actorId, appointmentId, patientId);
    if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  }
}

@Module({})
export class AdmissionsIntegrationModule {
  static register(): DynamicModule {
    return {
      module: AdmissionsIntegrationModule,
      // Global : le module Admissions y trouve ses annuaires sans importer (ni connaître) les modules qu'ils interrogent.
      global: true,
      providers: [
        { provide: ADMISSION_PATIENTS, inject: [PATIENT_REPOSITORY], useFactory: (p: PatientRepository) => new PatientsForAppointments(p) },
        {
          provide: ADMISSION_PRACTITIONERS,
          inject: [STAFF_REPOSITORY, ASSIGNMENT_REPOSITORY, STRUCTURE_REPOSITORY],
          useFactory: (s: StaffRepository, a: AssignmentRepository, st: StructureRepository) => new PractitionersForAppointments(s, a, st),
        },
        { provide: ADMISSION_STRUCTURE, inject: [STRUCTURE_REPOSITORY], useFactory: (s: StructureRepository) => new StructureForAdmissions(s) },
        { provide: ADMISSION_APPOINTMENTS, inject: [ArriveAppointmentUseCase], useFactory: (a: ArriveAppointmentUseCase) => new AppointmentsForAdmissions(a) },
        { provide: ADMISSION_REASONS, inject: [ENTRY_REPOSITORY], useFactory: (e: EntryRepository) => new VisitReasonsFromReferentials(e) },
      ],
      exports: [ADMISSION_PATIENTS, ADMISSION_PRACTITIONERS, ADMISSION_STRUCTURE, ADMISSION_APPOINTMENTS, ADMISSION_REASONS],
    };
  }
}
