import { DynamicModule, Module } from '@nestjs/common';
import { STRUCTURE_REPOSITORY } from '../modules/administration/domain/ports';
import type { StructureRepository } from '../modules/administration/domain/ports';
import { NodeId } from '../modules/administration/domain/structure/values';
import {
  APPOINTMENT_LOCATIONS, APPOINTMENT_PATIENTS, APPOINTMENT_PRACTITIONERS, APPOINTMENT_REASONS,
} from '../modules/appointments/domain/ports';
import type {
  LocationDirectory, LocationInfo, PatientDirectory, PatientInfo, PractitionerAvailability, PractitionerDirectory, PractitionerInfo, VisitReasons,
} from '../modules/appointments/domain/ports';
import type { LocationRef } from '../modules/appointments/domain/values';
import { PATIENT_REPOSITORY } from '../modules/patients/domain/ports';
import type { PatientRepository } from '../modules/patients/domain/ports';
import { PatientId } from '../modules/patients/domain/values';
import { ENTRY_REPOSITORY } from '../modules/referentials/domain/ports';
import type { EntryRepository } from '../modules/referentials/domain/ports';
import { CatalogCode, EntryCode } from '../modules/referentials/domain/value-objects/codes';
import { ASSIGNMENT_REPOSITORY, STAFF_REPOSITORY } from '../modules/staff/domain/ports';
import type { AssignmentRepository, StaffRepository } from '../modules/staff/domain/ports';
import { StaffId } from '../modules/staff/domain/values';
import type { PlainDate } from '../shared-kernel/temporal';

/**
 * Racine de composition : c'est ici, et seulement ici, que le module Rendez-vous est relié aux Patients, au Personnel, à
 * l'Administration (structure) et aux Référentiels. Aucun de ces modules ne connaît les autres.
 */
export class PatientsForAppointments implements PatientDirectory {
  constructor(private readonly patients: PatientRepository) {}

  async find(ids: readonly string[]): Promise<Map<string, PatientInfo>> {
    const found = new Map<string, PatientInfo>();
    for (const raw of ids) {
      const id = PatientId.create(raw);
      const patient = id.ok ? await this.patients.findById(id.value) : null;
      if (patient) {
        found.set(patient.id.value, { id: patient.id.value, number: patient.number.value, lastName: patient.state.lastName.value, firstName: patient.state.firstName.value, alive: !patient.isDeceased });
      }
    }
    return found;
  }
}

/** Service dont dépend un élément de la structure : le service lui-même, ou le service qui contient l'unité. */
async function serviceOf(structure: StructureRepository, rawId: string): Promise<{ kind: LocationInfo['kind']; active: boolean; serviceId: string } | null> {
  const id = NodeId.create(rawId);
  const node = id.ok ? await structure.findById(id.value) : null;
  if (!node) return null;
  if (node.kind === 'SERVICE') return { kind: node.kind, active: node.active, serviceId: node.id.value };
  // Unité : son parent est le service. Salle et lit : on remonte, mais ces niveaux ne servent pas de lieu de rendez-vous.
  let current = node;
  while (current.kind !== 'SERVICE' && current.parentId) {
    const parent = await structure.findById(current.parentId);
    if (!parent) return null;
    current = parent;
  }
  return { kind: node.kind, active: node.active, serviceId: current.id.value };
}

export class LocationsForAppointments implements LocationDirectory {
  constructor(private readonly structure: StructureRepository) {}

  async describe(id: LocationRef): Promise<LocationInfo | null> {
    const info = await serviceOf(this.structure, id.value);
    return info ? { id: id.value, kind: info.kind, active: info.active, serviceId: info.serviceId } : null;
  }
}

export class PractitionersForAppointments implements PractitionerDirectory {
  constructor(private readonly staff: StaffRepository, private readonly assignments: AssignmentRepository, private readonly structure: StructureRepository) {}

  async find(ids: readonly string[]): Promise<Map<string, PractitionerInfo>> {
    const found = new Map<string, PractitionerInfo>();
    for (const raw of ids) {
      const id = StaffId.create(raw);
      const member = id.ok ? await this.staff.findById(id.value) : null;
      if (member) found.set(member.id.value, { id: member.id.value, staffNumber: member.staffNumber.value, lastName: member.lastName.value, firstName: member.firstName.value });
    }
    return found;
  }

  async availability(practitionerId: string, serviceId: string, date: PlainDate): Promise<PractitionerAvailability> {
    const id = StaffId.create(practitionerId);
    const member = id.ok ? await this.staff.findById(id.value) : null;
    if (!member) return 'UNKNOWN';
    if (!member.isEmployedOn(date)) return 'NOT_EMPLOYED';
    for (const assignment of await this.assignments.listByStaff(member.id)) {
      if (!assignment.isCurrentOn(date)) continue;
      const service = await serviceOf(this.structure, assignment.nodeId.value);
      if (service?.serviceId === serviceId) return 'OK';
    }
    return 'NOT_ASSIGNED';
  }
}

export class VisitReasonsFromReferentials implements VisitReasons {
  constructor(private readonly entries: EntryRepository) {}

  async isActive(code: string): Promise<boolean> {
    const catalog = CatalogCode.create('VISIT_REASON');
    const entry = EntryCode.create(code);
    return catalog.ok && entry.ok && (await this.entries.findByCode(catalog.value, entry.value))?.active === true;
  }
}

@Module({})
export class AppointmentsIntegrationModule {
  static register(): DynamicModule {
    return {
      module: AppointmentsIntegrationModule,
      // Global : le module Rendez-vous y trouve ses annuaires sans importer (ni connaître) les modules qu'ils interrogent.
      global: true,
      providers: [
        { provide: APPOINTMENT_PATIENTS, inject: [PATIENT_REPOSITORY], useFactory: (p: PatientRepository) => new PatientsForAppointments(p) },
        { provide: APPOINTMENT_LOCATIONS, inject: [STRUCTURE_REPOSITORY], useFactory: (s: StructureRepository) => new LocationsForAppointments(s) },
        {
          provide: APPOINTMENT_PRACTITIONERS,
          inject: [STAFF_REPOSITORY, ASSIGNMENT_REPOSITORY, STRUCTURE_REPOSITORY],
          useFactory: (s: StaffRepository, a: AssignmentRepository, st: StructureRepository) => new PractitionersForAppointments(s, a, st),
        },
        { provide: APPOINTMENT_REASONS, inject: [ENTRY_REPOSITORY], useFactory: (e: EntryRepository) => new VisitReasonsFromReferentials(e) },
      ],
      exports: [APPOINTMENT_PATIENTS, APPOINTMENT_LOCATIONS, APPOINTMENT_PRACTITIONERS, APPOINTMENT_REASONS],
    };
  }
}
