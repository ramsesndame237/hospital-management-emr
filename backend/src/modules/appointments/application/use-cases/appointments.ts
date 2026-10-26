import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Calendar, Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ServiceAccess } from '../../../../shared-kernel/service-access';
import { Instant, Temporal } from '../../../../shared-kernel/temporal';
import { Appointment } from '../../domain/appointment';
import {
  AppointmentRepository, LocationDirectory, LocationInfo, PatientDirectory, PractitionerDirectory, VisitReasons,
} from '../../domain/ports';
import {
  AppointmentId, AppointmentStatus, LocationRef, parseStatus, PatientRef, PractitionerRef, ReasonCode, ServiceRef, TimeSlot,
} from '../../domain/values';

const NOT_FOUND = new DomainError('APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable.');
const OUT_OF_SCOPE = new DomainError('APPOINTMENT_OUT_OF_SCOPE', "Ce service n'est pas dans votre périmètre.");
const IN_PAST = new DomainError('APPOINTMENT_IN_PAST', 'Le rendez-vous doit commencer dans le futur.');
const TOO_FAR = new DomainError('APPOINTMENT_TOO_FAR', 'Le rendez-vous ne peut pas être pris plus d\'un an à l\'avance.');
const PATIENT_NOT_FOUND = new DomainError('APPOINTMENT_PATIENT_NOT_FOUND', 'Patient introuvable.');
const PATIENT_DECEASED = new DomainError('APPOINTMENT_PATIENT_DECEASED', 'Ce patient est décédé : on ne lui donne pas de rendez-vous.');
const PRACTITIONER_NOT_FOUND = new DomainError('APPOINTMENT_PRACTITIONER_NOT_FOUND', 'Professionnel introuvable.');
const NOT_EMPLOYED = new DomainError('APPOINTMENT_PRACTITIONER_NOT_EMPLOYED', "Ce professionnel n'est pas en poste à cette date.");
const NOT_ASSIGNED = new DomainError('APPOINTMENT_PRACTITIONER_NOT_ASSIGNED', "Ce professionnel n'est pas affecté à ce service à cette date.");
const LOCATION_NOT_FOUND = new DomainError('APPOINTMENT_LOCATION_NOT_FOUND', 'Service ou unité introuvable.');
const LOCATION_KIND = new DomainError('APPOINTMENT_LOCATION_KIND_INVALID', 'Un rendez-vous a lieu dans un service ou une unité, pas dans une salle ni à un lit.');
const LOCATION_INACTIVE = new DomainError('APPOINTMENT_LOCATION_INACTIVE', 'Ce service ou cette unité est désactivé.');
const REASON_UNKNOWN = (value: string) => new DomainError('APPOINTMENT_REASON_UNKNOWN', "Ce motif n'existe pas ou n'est plus actif.", { value });
const PRACTITIONER_BUSY = new DomainError('APPOINTMENT_PRACTITIONER_BUSY', 'Le professionnel a déjà un rendez-vous sur ce créneau.');
const PATIENT_BUSY = new DomainError('APPOINTMENT_PATIENT_BUSY', 'Le patient a déjà un rendez-vous sur ce créneau.');
const MAX_ADVANCE_DAYS = 366;

export interface AppointmentView {
  readonly id: string;
  readonly number: string;
  readonly status: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly durationMinutes: number;
  readonly patient: { readonly id: string; readonly number: string; readonly lastName: string; readonly firstName: string } | null;
  readonly practitioner: { readonly id: string; readonly staffNumber: string; readonly lastName: string; readonly firstName: string } | null;
  readonly locationId: string;
  readonly serviceId: string;
  readonly reasonCode: string | null;
  readonly cancellationReason: string | null;
}

export interface Dependencies {
  readonly appointments: AppointmentRepository;
  readonly patients: PatientDirectory;
  readonly practitioners: PractitionerDirectory;
  readonly locations: LocationDirectory;
  readonly reasons: VisitReasons;
  readonly access: ServiceAccess;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly calendar: Calendar;
}

/** Affichage : le patient et le professionnel sont résolus ensemble (une requête par module, pas une par rendez-vous). */
async function toViews(d: Dependencies, items: readonly Appointment[]): Promise<AppointmentView[]> {
  const patients = await d.patients.find([...new Set(items.map((a) => a.state.patientId.value))]);
  const practitioners = await d.practitioners.find([...new Set(items.map((a) => a.state.practitionerId.value))]);
  return items.map((a) => {
    const s = a.state;
    const patient = patients.get(s.patientId.value);
    const practitioner = practitioners.get(s.practitionerId.value);
    return {
      id: s.id.value,
      number: s.number.value,
      status: s.status,
      startsAt: s.slot.start.toString(),
      endsAt: s.slot.end.toString(),
      durationMinutes: s.slot.durationMinutes,
      patient: patient ? { id: patient.id, number: patient.number, lastName: patient.lastName, firstName: patient.firstName } : null,
      practitioner: practitioner ? { id: practitioner.id, staffNumber: practitioner.staffNumber, lastName: practitioner.lastName, firstName: practitioner.firstName } : null,
      locationId: s.locationId.value,
      serviceId: s.serviceId.value,
      reasonCode: s.reasonCode?.value ?? null,
      cancellationReason: s.cancellationReason,
    };
  });
}

async function loadAppointment(d: Dependencies, rawId: string): Promise<Result<Appointment>> {
  const id = AppointmentId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.appointments.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

async function resolveLocation(d: Dependencies, raw: string): Promise<Result<LocationInfo>> {
  const ref = LocationRef.create(raw);
  if (!ref.ok) return err(ref.error);
  const info = await d.locations.describe(ref.value);
  if (!info) return err(LOCATION_NOT_FOUND);
  if (info.kind !== 'SERVICE' && info.kind !== 'UNIT') return err(LOCATION_KIND);
  return info.active ? ok(info) : err(LOCATION_INACTIVE);
}

/** Le professionnel doit être en poste ce jour-là (dans le fuseau de l'établissement) et affecté au service. */
async function checkPractitioner(d: Dependencies, practitionerId: string, serviceId: string, slot: TimeSlot): Promise<Result<void>> {
  const availability = await d.practitioners.availability(practitionerId, serviceId, d.calendar.dateOf(slot.start));
  if (availability === 'OK') return ok(undefined);
  return err(availability === 'UNKNOWN' ? PRACTITIONER_NOT_FOUND : availability === 'NOT_EMPLOYED' ? NOT_EMPLOYED : NOT_ASSIGNED);
}

function checkStart(d: Dependencies, slot: TimeSlot): Result<void> {
  const now = d.clock.now();
  if (Temporal.Instant.compare(slot.start, now) < 0) return err(IN_PAST);
  if (Temporal.Instant.compare(slot.start, now.add({ hours: 24 * MAX_ADVANCE_DAYS })) > 0) return err(TOO_FAR);
  return ok(undefined);
}

async function checkReason(d: Dependencies, raw: string | null | undefined): Promise<Result<ReasonCode | null | undefined>> {
  if (raw === undefined) return ok(undefined);
  if (raw === null || raw.trim() === '') return ok(null);
  const code = ReasonCode.create(raw);
  if (!code.ok) return err(code.error);
  return (await d.reasons.isActive(code.value.value)) ? ok(code.value) : err(REASON_UNKNOWN(raw));
}

function record(d: Dependencies, actorId: string, action: string, a: Appointment, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  return d.audit.record({
    action, outcome: 'SUCCESS', actorId, resourceType: 'appointment', resourceId: a.id.value,
    metadata: { appointmentNumber: a.state.number.value, serviceId: a.state.serviceId.value, ...extra }, occurredAt: d.clock.now(),
  });
}

export class ScheduleAppointmentUseCase {
  constructor(private readonly d: Dependencies, private readonly ids: IdGenerator) {}

  async execute(
    actorId: string,
    input: { patientId: string; practitionerId: string; locationId: string; startsAt: string; durationMinutes: number; reasonCode?: string | null },
  ): Promise<Result<AppointmentView>> {
    const patientRef = PatientRef.create(input.patientId);
    if (!patientRef.ok) return err(patientRef.error);
    const practitionerRef = PractitionerRef.create(input.practitionerId);
    if (!practitionerRef.ok) return err(practitionerRef.error);
    const slot = TimeSlot.create(input.startsAt, input.durationMinutes);
    if (!slot.ok) return err(slot.error);
    const start = checkStart(this.d, slot.value);
    if (!start.ok) return err(start.error);

    const location = await resolveLocation(this.d, input.locationId);
    if (!location.ok) return err(location.error);
    if (!(await this.d.access.canAccess(actorId, 'appointments:write', location.value.serviceId))) return err(OUT_OF_SCOPE);

    const patient = (await this.d.patients.find([patientRef.value.value])).get(patientRef.value.value);
    if (!patient) return err(PATIENT_NOT_FOUND);
    if (!patient.alive) return err(PATIENT_DECEASED);
    const practitioner = await checkPractitioner(this.d, practitionerRef.value.value, location.value.serviceId, slot.value);
    if (!practitioner.ok) return err(practitioner.error);
    const reason = await checkReason(this.d, input.reasonCode);
    if (!reason.ok) return err(reason.error);

    const conflicts = await this.d.appointments.findConflicts(practitionerRef.value, patientRef.value, slot.value);
    if (conflicts.practitionerBusy) return err(PRACTITIONER_BUSY);
    if (conflicts.patientBusy) return err(PATIENT_BUSY);

    const id = AppointmentId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const locationRef = LocationRef.create(location.value.id);
    const serviceRef = ServiceRef.create(location.value.serviceId);
    if (!locationRef.ok || !serviceRef.ok) return err(LOCATION_NOT_FOUND);
    const appointment = Appointment.schedule({
      id: id.value, number: await this.d.appointments.nextNumber(), patientId: patientRef.value, practitionerId: practitionerRef.value,
      locationId: locationRef.value, serviceId: serviceRef.value, slot: slot.value, reasonCode: reason.value ?? null,
    });
    const saved = await this.d.appointments.save(appointment);
    if (saved.practitionerBusy) return err(PRACTITIONER_BUSY);
    if (saved.patientBusy) return err(PATIENT_BUSY);
    await record(this.d, actorId, 'appointment.record.schedule', appointment, { startsAt: slot.value.start.toString() });
    return ok((await toViews(this.d, [appointment]))[0]);
  }
}

export class ManageAppointmentUseCases {
  constructor(private readonly d: Dependencies) {}

  /** Champs absents : inchangés. Les mêmes règles qu'à la prise de rendez-vous s'appliquent à ce qui change. */
  async reschedule(
    actorId: string,
    id: string,
    input: { startsAt?: string; durationMinutes?: number; practitionerId?: string; locationId?: string; reasonCode?: string | null },
  ): Promise<Result<AppointmentView>> {
    const loaded = await loadAppointment(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const appointment = loaded.value;
    const before = appointment.state;
    if (!(await this.d.access.canAccess(actorId, 'appointments:write', before.serviceId.value))) return err(NOT_FOUND);
    const modifiable = appointment.reschedule({}); // un rendez-vous clos est refusé d'emblée, avant toute autre vérification
    if (!modifiable.ok) return err(modifiable.error);

    const slot = TimeSlot.create(input.startsAt ?? before.slot.start.toString(), input.durationMinutes ?? before.slot.durationMinutes);
    if (!slot.ok) return err(slot.error);
    const practitioner = input.practitionerId === undefined ? ok(before.practitionerId) : PractitionerRef.create(input.practitionerId);
    if (!practitioner.ok) return err(practitioner.error);
    const reason = await checkReason(this.d, input.reasonCode);
    if (!reason.ok) return err(reason.error);

    let locationId = before.locationId;
    let serviceId = before.serviceId;
    if (input.locationId !== undefined) {
      const location = await resolveLocation(this.d, input.locationId);
      if (!location.ok) return err(location.error);
      if (!(await this.d.access.canAccess(actorId, 'appointments:write', location.value.serviceId))) return err(OUT_OF_SCOPE);
      const l = LocationRef.create(location.value.id);
      const s = ServiceRef.create(location.value.serviceId);
      if (!l.ok || !s.ok) return err(LOCATION_NOT_FOUND);
      locationId = l.value;
      serviceId = s.value;
    }

    const moved = !slot.value.equals(before.slot);
    const changedPractitioner = !practitioner.value.equals(before.practitionerId);
    if (moved) {
      const start = checkStart(this.d, slot.value);
      if (!start.ok) return err(start.error);
    }
    if (moved || changedPractitioner || !serviceId.equals(before.serviceId)) {
      const available = await checkPractitioner(this.d, practitioner.value.value, serviceId.value, slot.value);
      if (!available.ok) return err(available.error);
      const conflicts = await this.d.appointments.findConflicts(practitioner.value, before.patientId, slot.value, appointment.id);
      if (conflicts.practitionerBusy) return err(PRACTITIONER_BUSY);
      if (conflicts.patientBusy) return err(PATIENT_BUSY);
    }

    const changed = appointment.reschedule({
      slot: slot.value, practitionerId: practitioner.value, locationId, serviceId, reasonCode: reason.value,
    });
    if (!changed.ok) return err(changed.error);
    const after = appointment.state;
    const fields = [
      moved && 'slot', changedPractitioner && 'practitioner', !locationId.equals(before.locationId) && 'location', reason.value !== undefined && (reason.value?.value ?? null) !== (before.reasonCode?.value ?? null) && 'reason',
    ].filter(Boolean) as string[];
    if (fields.length === 0) return ok((await toViews(this.d, [appointment]))[0]);

    const saved = await this.d.appointments.save(appointment);
    if (saved.practitionerBusy) return err(PRACTITIONER_BUSY);
    if (saved.patientBusy) return err(PATIENT_BUSY);
    await record(this.d, actorId, 'appointment.record.reschedule', appointment, { changed: fields.join(','), startsAt: after.slot.start.toString(), previousStartsAt: before.slot.start.toString() });
    return ok((await toViews(this.d, [appointment]))[0]);
  }

  async cancel(actorId: string, id: string, reason: string): Promise<Result<AppointmentView>> {
    const text = (reason ?? '').trim();
    if (text.length === 0 || text.length > 200) return err(new DomainError('APPOINTMENT_REASON_REQUIRED', 'Le motif d\'annulation est obligatoire (200 caractères au plus).'));
    const loaded = await loadAppointment(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const appointment = loaded.value;
    if (!(await this.d.access.canAccess(actorId, 'appointments:write', appointment.state.serviceId.value))) return err(NOT_FOUND);
    const done = appointment.cancel(text);
    if (!done.ok) return err(done.error);
    await this.d.appointments.save(appointment);
    await record(this.d, actorId, 'appointment.record.cancel', appointment);
    return ok((await toViews(this.d, [appointment]))[0]);
  }

  async markNoShow(actorId: string, id: string): Promise<Result<AppointmentView>> {
    const loaded = await loadAppointment(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const appointment = loaded.value;
    if (!(await this.d.access.canAccess(actorId, 'appointments:write', appointment.state.serviceId.value))) return err(NOT_FOUND);
    const done = appointment.markNoShow(this.d.clock.now());
    if (!done.ok) return err(done.error);
    await this.d.appointments.save(appointment);
    await record(this.d, actorId, 'appointment.record.no-show', appointment);
    return ok((await toViews(this.d, [appointment]))[0]);
  }
}

/**
 * Le patient s'est présenté : appelé quand une admission est ouverte à partir du rendez-vous (voir le module Admissions, relié
 * par la racine de composition). Vérifie que le rendez-vous est bien celui de ce patient ; le contrôle d'accès a déjà été fait
 * par l'admission.
 */
export class ArriveAppointmentUseCase {
  constructor(private readonly d: Dependencies) {}

  /** Lecture seule : le rendez-vous peut-il servir à une admission de ce patient ? Renvoie son service. */
  async check(rawId: string, patientId: string): Promise<Result<{ serviceId: string }>> {
    const loaded = await loadAppointment(this.d, rawId);
    if (!loaded.ok) return err(loaded.error);
    const a = loaded.value;
    if (a.state.patientId.value !== patientId.toLowerCase()) return err(new DomainError('APPOINTMENT_PATIENT_MISMATCH', "Ce rendez-vous concerne un autre patient."));
    if (a.status !== AppointmentStatus.SCHEDULED) return err(new DomainError('APPOINTMENT_NOT_MODIFIABLE', 'Ce rendez-vous ne peut plus servir à une admission.', { status: a.status }));
    return ok({ serviceId: a.state.serviceId.value });
  }

  async execute(actorId: string, rawId: string, patientId: string): Promise<Result<void>> {
    const checked = await this.check(rawId, patientId);
    if (!checked.ok) return err(checked.error);
    const loaded = await loadAppointment(this.d, rawId);
    if (!loaded.ok) return err(loaded.error);
    const done = loaded.value.markArrived();
    if (!done.ok) return err(done.error);
    await this.d.appointments.save(loaded.value);
    await record(this.d, actorId, 'appointment.record.arrive', loaded.value);
    return ok(undefined);
  }
}

export class GetAppointmentUseCase {
  constructor(private readonly d: Dependencies) {}

  /** Un rendez-vous hors de votre périmètre est « introuvable » : on ne révèle pas son existence. */
  async execute(actorId: string, id: string): Promise<Result<AppointmentView>> {
    const loaded = await loadAppointment(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    if (!(await this.d.access.canAccess(actorId, 'appointments:read', loaded.value.state.serviceId.value))) return err(NOT_FOUND);
    await record(this.d, actorId, 'appointment.record.read', loaded.value);
    return ok((await toViews(this.d, [loaded.value]))[0]);
  }
}

export interface AppointmentListInput {
  from?: string;
  to?: string;
  practitionerId?: string;
  patientId?: string;
  serviceId?: string;
  status?: string;
  offset: number;
  limit: number;
}

/** Agenda : limité aux services que l'utilisateur peut voir (tous, ou les siens). La consultation est tracée (critères et nombre). */
export class ListAppointmentsUseCase {
  constructor(private readonly d: Dependencies) {}

  async execute(actorId: string, input: AppointmentListInput): Promise<Result<{ items: AppointmentView[]; total: number; offset: number; limit: number }>> {
    const instant = (raw: string | undefined, field: string): Result<Instant | undefined> => {
      if (!raw?.trim()) return ok(undefined);
      if (!/(Z|[+-]\d{2}:\d{2})$/i.test(raw.trim())) return err(new DomainError('APPOINTMENT_START_INVALID', `Le filtre « ${field} » doit être une date et heure ISO 8601 avec fuseau.`, { field }));
      try {
        return ok(Temporal.Instant.from(raw.trim()));
      } catch {
        return err(new DomainError('APPOINTMENT_START_INVALID', `Le filtre « ${field} » doit être une date et heure ISO 8601 avec fuseau.`, { field }));
      }
    };
    const from = instant(input.from, 'from');
    if (!from.ok) return err(from.error);
    const to = instant(input.to, 'to');
    if (!to.ok) return err(to.error);
    const practitionerId = input.practitionerId?.trim() ? PractitionerRef.create(input.practitionerId) : ok(undefined);
    if (!practitionerId.ok) return err(practitionerId.error);
    const patientId = input.patientId?.trim() ? PatientRef.create(input.patientId) : ok(undefined);
    if (!patientId.ok) return err(patientId.error);
    const status = input.status?.trim() ? parseStatus(input.status) : ok(undefined);
    if (!status.ok) return err(status.error);

    const visible = await this.d.access.visibleServices(actorId, 'appointments:read');
    let serviceIds: readonly string[] | null = visible === 'ALL' ? null : visible;
    if (input.serviceId?.trim()) {
      const wanted = ServiceRef.create(input.serviceId);
      if (!wanted.ok) return err(wanted.error);
      serviceIds = serviceIds === null || serviceIds.includes(wanted.value.value) ? [wanted.value.value] : [];
    }

    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = serviceIds !== null && serviceIds.length === 0
      ? { items: [], total: 0 }
      : await this.d.appointments.list({ from: from.value?.toString(), to: to.value?.toString(), practitionerId: practitionerId.value, patientId: patientId.value, status: status.value, serviceIds }, offset, limit);
    await this.d.audit.record({
      action: 'appointment.record.list', outcome: 'SUCCESS', actorId,
      metadata: {
        criteria: ['from', 'to', 'practitionerId', 'patientId', 'serviceId', 'status'].filter((k) => (input as unknown as Record<string, unknown>)[k]).join(','), returned: page.items.length, total: page.total,
      },
      occurredAt: this.d.clock.now(),
    });
    return ok({ items: await toViews(this.d, page.items), total: page.total, offset, limit });
  }
}
