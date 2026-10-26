import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Calendar, Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ServiceAccess } from '../../../../shared-kernel/service-access';
import { Temporal } from '../../../../shared-kernel/temporal';
import { Admission, Movement, MovementKind } from '../../domain/admission';
import {
  AdmissionRepository, AppointmentDirectory, NodeInfo, PatientDirectory, PractitionerDirectory, SaveOutcome, StructureDirectory, VisitReasons,
} from '../../domain/ports';
import {
  AdmissionId, AdmissionStatus, AdmissionType, AppointmentRef, BedRef, DischargeType, parseEnum, parseInstant, PatientRef, PractitionerRef, ReasonCode, ServiceRef,
} from '../../domain/values';

const NOT_FOUND = new DomainError('ADMISSION_NOT_FOUND', 'Admission introuvable.');
const OUT_OF_SCOPE = new DomainError('ADMISSION_OUT_OF_SCOPE', "Ce service n'est pas dans votre périmètre.");
const PATIENT_NOT_FOUND = new DomainError('ADMISSION_PATIENT_NOT_FOUND', 'Patient introuvable.');
const PATIENT_DECEASED = new DomainError('ADMISSION_PATIENT_DECEASED', 'Ce patient est décédé : on ne l\'admet pas.');
const SERVICE_NOT_FOUND = new DomainError('ADMISSION_SERVICE_NOT_FOUND', 'Service ou unité introuvable.');
const SERVICE_KIND = new DomainError('ADMISSION_SERVICE_KIND_INVALID', 'Une admission se fait dans un service ou une unité, pas dans une salle ni à un lit.');
const SERVICE_REQUIRED = new DomainError('ADMISSION_SERVICE_REQUIRED', 'Indiquez le service ou l\'unité.');
const SERVICE_INACTIVE = new DomainError('ADMISSION_SERVICE_INACTIVE', 'Ce service ou cette unité est désactivé.');
const SERVICE_MISMATCH = new DomainError('ADMISSION_SERVICE_MISMATCH', 'Le service indiqué ne correspond pas à celui du lit ou du rendez-vous.');
const BED_NOT_FOUND = new DomainError('ADMISSION_BED_NOT_FOUND', 'Lit introuvable.');
const BED_KIND = new DomainError('ADMISSION_BED_INVALID', "L'élément indiqué n'est pas un lit.");
const BED_INACTIVE = new DomainError('ADMISSION_BED_INACTIVE', 'Ce lit est désactivé.');
const BED_OCCUPIED = new DomainError('ADMISSION_BED_OCCUPIED', 'Ce lit est déjà occupé.');
const ALREADY_INPATIENT = new DomainError('ADMISSION_PATIENT_ALREADY_INPATIENT', 'Ce patient est déjà hospitalisé.');
const APPOINTMENT_USED = new DomainError('ADMISSION_APPOINTMENT_ALREADY_USED', 'Ce rendez-vous a déjà donné lieu à une admission.');
const PRACTITIONER_NOT_FOUND = new DomainError('ADMISSION_PRACTITIONER_NOT_FOUND', 'Professionnel introuvable.');
const NOT_EMPLOYED = new DomainError('ADMISSION_PRACTITIONER_NOT_EMPLOYED', "Ce professionnel n'est pas en poste à cette date.");
const NOT_ASSIGNED = new DomainError('ADMISSION_PRACTITIONER_NOT_ASSIGNED', "Ce professionnel n'est pas affecté à ce service à cette date.");
const DATE_INVALID = new DomainError('ADMISSION_DATE_INVALID', "L'heure d'arrivée ne peut être ni dans le futur ni antérieure de plus de 48 heures.");
const MAX_BACKDATE_HOURS = 48;

export interface AdmissionView {
  readonly id: string;
  readonly number: string;
  readonly type: string;
  readonly status: string;
  readonly patient: { id: string; number: string; lastName: string; firstName: string } | null;
  readonly serviceId: string;
  readonly bed: { id: string; code: string; name: string; location: string } | null;
  readonly practitioner: { id: string; staffNumber: string; lastName: string; firstName: string } | null;
  readonly appointmentId: string | null;
  readonly reasonCode: string | null;
  readonly admittedAt: string;
  readonly dischargedAt: string | null;
  readonly dischargeType: string | null;
  readonly cancellationReason: string | null;
}

export interface Dependencies {
  readonly admissions: AdmissionRepository;
  readonly patients: PatientDirectory;
  readonly practitioners: PractitionerDirectory;
  readonly structure: StructureDirectory;
  readonly appointments: AppointmentDirectory;
  readonly reasons: VisitReasons;
  readonly access: ServiceAccess;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly calendar: Calendar;
}

async function toViews(d: Dependencies, items: readonly Admission[]): Promise<AdmissionView[]> {
  const patients = await d.patients.find([...new Set(items.map((a) => a.state.patientId.value))]);
  const practitioners = await d.practitioners.find([...new Set(items.flatMap((a) => (a.state.practitionerId ? [a.state.practitionerId.value] : [])))]);
  const beds = await d.structure.describeMany([...new Set(items.flatMap((a) => (a.state.bedId ? [a.state.bedId.value] : [])))]);
  return items.map((a) => {
    const s = a.state;
    const patient = patients.get(s.patientId.value);
    const practitioner = s.practitionerId ? practitioners.get(s.practitionerId.value) : undefined;
    const bed = s.bedId ? beds.get(s.bedId.value) : undefined;
    return {
      id: s.id.value,
      number: s.number.value,
      type: s.type,
      status: s.status,
      patient: patient ? { id: patient.id, number: patient.number, lastName: patient.lastName, firstName: patient.firstName } : null,
      serviceId: s.serviceId.value,
      bed: bed ? { id: bed.id, code: bed.code, name: bed.name, location: bed.location } : null,
      practitioner: practitioner ? { id: practitioner.id, staffNumber: practitioner.staffNumber, lastName: practitioner.lastName, firstName: practitioner.firstName } : null,
      appointmentId: s.appointmentId?.value ?? null,
      reasonCode: s.reasonCode?.value ?? null,
      admittedAt: s.admittedAt.toString(),
      dischargedAt: s.dischargedAt?.toString() ?? null,
      dischargeType: s.dischargeType,
      cancellationReason: s.cancellationReason,
    };
  });
}

async function loadAdmission(d: Dependencies, rawId: string): Promise<Result<Admission>> {
  const id = AdmissionId.create(rawId);
  if (!id.ok) return err(NOT_FOUND);
  const found = await d.admissions.findById(id.value);
  return found ? ok(found) : err(NOT_FOUND);
}

/** Un service ou une unité actif : renvoie le service dont il dépend. */
async function resolveService(d: Dependencies, raw: string): Promise<Result<NodeInfo>> {
  const ref = ServiceRef.create(raw);
  if (!ref.ok) return err(ref.error);
  const info = await d.structure.describe(ref.value.value);
  if (!info) return err(SERVICE_NOT_FOUND);
  if (info.kind !== 'SERVICE' && info.kind !== 'UNIT') return err(SERVICE_KIND);
  return info.active ? ok(info) : err(SERVICE_INACTIVE);
}

/** Un lit actif, libre (ou occupé par `except`) : renvoie le lit et son service. */
async function resolveFreeBed(d: Dependencies, raw: string, except?: Admission): Promise<Result<{ bed: BedRef; serviceId: string }>> {
  const ref = BedRef.create(raw);
  if (!ref.ok) return err(ref.error);
  const info = await d.structure.describe(ref.value.value);
  if (!info) return err(BED_NOT_FOUND);
  if (info.kind !== 'BED') return err(BED_KIND);
  if (!info.active) return err(BED_INACTIVE);
  const occupant = (await d.admissions.occupants([ref.value])).get(ref.value.value);
  if (occupant && !(except && occupant.id.equals(except.id))) return err(BED_OCCUPIED);
  return ok({ bed: ref.value, serviceId: info.serviceId });
}

function outcomeError(outcome: SaveOutcome): DomainError | null {
  switch (outcome) {
    case 'BED_OCCUPIED': return BED_OCCUPIED;
    case 'PATIENT_ALREADY_INPATIENT': return ALREADY_INPATIENT;
    case 'APPOINTMENT_ALREADY_USED': return APPOINTMENT_USED;
    default: return null;
  }
}

function record(d: Dependencies, actorId: string, action: string, a: Admission, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  return d.audit.record({
    action, outcome: 'SUCCESS', actorId, resourceType: 'admission', resourceId: a.id.value,
    metadata: { admissionNumber: a.state.number.value, type: a.state.type, serviceId: a.state.serviceId.value, ...extra }, occurredAt: d.clock.now(),
  });
}

const movement = (kind: MovementKind, a: Admission, actorId: string, at: Movement['at'], serviceId = a.state.serviceId.value, bedId: string | null = a.state.bedId?.value ?? null): Movement => ({
  kind, at, actorId, serviceId, bedId,
});

export interface OpenAdmissionInput {
  patientId: string;
  type: string;
  serviceId?: string;
  bedId?: string;
  practitionerId?: string;
  appointmentId?: string;
  reasonCode?: string;
  admittedAt?: string;
}

export class OpenAdmissionUseCase {
  constructor(private readonly d: Dependencies, private readonly ids: IdGenerator) {}

  /**
   * Ouvre une admission. Hospitalisation : un lit libre est exigé (le service est celui du lit) et le patient ne doit pas déjà être
   * hospitalisé. Autres admissions : un service ou une unité. Avec `appointmentId`, le rendez-vous du patient passe à « honoré ».
   * Aucune écriture si un contrôle échoue ; la base tranche les réservations simultanées d'un même lit.
   */
  async execute(actorId: string, input: OpenAdmissionInput): Promise<Result<AdmissionView>> {
    const type = parseEnum(AdmissionType, input.type, 'type');
    if (!type.ok) return err(type.error);
    const patientRef = PatientRef.create(input.patientId);
    if (!patientRef.ok) return err(patientRef.error);
    const now = this.d.clock.now();
    const admittedAt = input.admittedAt ? parseInstant(input.admittedAt, 'admittedAt') : ok(now);
    if (!admittedAt.ok) return err(admittedAt.error);
    if (Temporal.Instant.compare(admittedAt.value, now) > 0 || Temporal.Instant.compare(admittedAt.value, now.subtract({ hours: MAX_BACKDATE_HOURS })) < 0) return err(DATE_INVALID);

    const patient = (await this.d.patients.find([patientRef.value.value])).get(patientRef.value.value);
    if (!patient) return err(PATIENT_NOT_FOUND);
    if (!patient.alive) return err(PATIENT_DECEASED);

    // Rendez-vous : lecture seule d'abord ; il n'est marqué « honoré » qu'une fois l'admission écrite.
    let appointmentService: string | null = null;
    let appointmentRef: AppointmentRef | null = null;
    if (input.appointmentId) {
      const ref = AppointmentRef.create(input.appointmentId);
      if (!ref.ok) return err(ref.error);
      const checked = await this.d.appointments.check(ref.value.value, patientRef.value.value);
      if (!checked.ok) return err(new DomainError(checked.code, checked.message));
      appointmentService = checked.serviceId;
      appointmentRef = ref.value;
    }

    // Lieu : le lit détermine le service d'une hospitalisation ; sinon le service est indiqué, ou celui du rendez-vous.
    let bed: BedRef | null = null;
    let serviceId: string;
    if (type.value === AdmissionType.INPATIENT) {
      if (!input.bedId) return err(new DomainError('ADMISSION_BED_REQUIRED', 'Une hospitalisation occupe un lit : indiquez-le.'));
      const resolved = await resolveFreeBed(this.d, input.bedId);
      if (!resolved.ok) return err(resolved.error);
      bed = resolved.value.bed;
      serviceId = resolved.value.serviceId;
      if (input.serviceId) {
        const given = await resolveService(this.d, input.serviceId);
        if (!given.ok) return err(given.error);
        if (given.value.serviceId !== serviceId) return err(SERVICE_MISMATCH);
      }
    } else {
      if (input.bedId) return err(new DomainError('ADMISSION_BED_NOT_ALLOWED', 'Seule une hospitalisation occupe un lit.'));
      if (!input.serviceId && !appointmentService) return err(SERVICE_REQUIRED);
      if (input.serviceId) {
        const given = await resolveService(this.d, input.serviceId);
        if (!given.ok) return err(given.error);
        serviceId = given.value.serviceId;
      } else {
        serviceId = appointmentService as string;
      }
    }
    if (appointmentService && appointmentService !== serviceId) return err(SERVICE_MISMATCH);
    if (!(await this.d.access.canAccess(actorId, 'admissions:write', serviceId))) return err(OUT_OF_SCOPE);

    let practitionerRef: PractitionerRef | null = null;
    if (input.practitionerId) {
      const ref = PractitionerRef.create(input.practitionerId);
      if (!ref.ok) return err(ref.error);
      const availability = await this.d.practitioners.availability(ref.value.value, serviceId, this.d.calendar.dateOf(admittedAt.value));
      if (availability !== 'OK') return err(availability === 'UNKNOWN' ? PRACTITIONER_NOT_FOUND : availability === 'NOT_EMPLOYED' ? NOT_EMPLOYED : NOT_ASSIGNED);
      practitionerRef = ref.value;
    }
    let reason: ReasonCode | null = null;
    if (input.reasonCode) {
      const code = ReasonCode.create(input.reasonCode);
      if (!code.ok) return err(code.error);
      if (!(await this.d.reasons.isActive(code.value.value))) return err(new DomainError('ADMISSION_REASON_UNKNOWN', "Ce motif n'existe pas ou n'est plus actif.", { value: input.reasonCode }));
      reason = code.value;
    }
    if (type.value === AdmissionType.INPATIENT && (await this.d.admissions.findInpatientOf(patientRef.value))) return err(ALREADY_INPATIENT);

    const id = AdmissionId.create(this.ids.next());
    const service = ServiceRef.create(serviceId);
    if (!id.ok || !service.ok) return err(SERVICE_NOT_FOUND);
    const admission = Admission.open({
      id: id.value, number: await this.d.admissions.nextNumber(), patientId: patientRef.value, type: type.value, serviceId: service.value, bedId: bed,
      practitionerId: practitionerRef, appointmentId: appointmentRef, reasonCode: reason, admittedAt: admittedAt.value,
    });
    if (!admission.ok) return err(admission.error);

    const outcome = await this.d.admissions.save(admission.value, movement('ADMISSION', admission.value, actorId, admittedAt.value));
    const refused = outcomeError(outcome);
    if (refused) return err(refused);
    await record(this.d, actorId, 'admission.record.open', admission.value, { patientId: patientRef.value.value, ...(appointmentRef ? { appointmentId: appointmentRef.value } : {}) });

    if (appointmentRef) {
      try {
        await this.d.appointments.markArrived(actorId, appointmentRef.value, patientRef.value.value);
      } catch (e) {
        // L'admission existe : on ne l'annule pas. Le défaut de liaison est journalisé pour qu'un administrateur reprenne le rendez-vous.
        await this.d.audit.record({
          action: 'admission.record.appointment-link-failed', outcome: 'FAILURE', actorId, resourceType: 'admission', resourceId: admission.value.id.value,
          reason: e instanceof Error ? e.message.slice(0, 200) : 'unknown', metadata: { appointmentId: appointmentRef.value }, occurredAt: this.d.clock.now(),
        });
      }
    }
    return ok((await toViews(this.d, [admission.value]))[0]);
  }
}

export class ManageAdmissionUseCases {
  constructor(private readonly d: Dependencies) {}

  /** Un patient hospitalisé change de lit (le service suit le lit) ; une autre admission change de service ou d'unité. */
  async transfer(actorId: string, id: string, input: { bedId?: string; serviceId?: string }): Promise<Result<AdmissionView>> {
    const loaded = await loadAdmission(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const admission = loaded.value;
    if (!(await this.d.access.canAccess(actorId, 'admissions:write', admission.state.serviceId.value))) return err(NOT_FOUND);
    const open = admission.ensureInProgress();
    if (!open.ok) return err(open.error);

    let bed: BedRef | null = null;
    let serviceId: string;
    if (admission.state.type === AdmissionType.INPATIENT) {
      if (!input.bedId) return err(new DomainError('ADMISSION_BED_REQUIRED', 'Une hospitalisation occupe un lit : indiquez-le.'));
      const resolved = await resolveFreeBed(this.d, input.bedId, admission);
      if (!resolved.ok) return err(resolved.error);
      bed = resolved.value.bed;
      serviceId = resolved.value.serviceId;
    } else {
      if (input.bedId) return err(new DomainError('ADMISSION_BED_NOT_ALLOWED', 'Seule une hospitalisation occupe un lit.'));
      if (!input.serviceId) return err(SERVICE_REQUIRED);
      const given = await resolveService(this.d, input.serviceId);
      if (!given.ok) return err(given.error);
      serviceId = given.value.serviceId;
    }
    if (!(await this.d.access.canAccess(actorId, 'admissions:write', serviceId))) return err(OUT_OF_SCOPE);
    const service = ServiceRef.create(serviceId);
    if (!service.ok) return err(SERVICE_NOT_FOUND);

    const before = admission.state;
    const moved = admission.transfer({ serviceId: service.value, bedId: bed });
    if (!moved.ok) return err(moved.error);
    const outcome = await this.d.admissions.save(admission, movement('TRANSFER', admission, actorId, this.d.clock.now()));
    const refused = outcomeError(outcome);
    if (refused) return err(refused);
    await record(this.d, actorId, 'admission.record.transfer', admission, { fromServiceId: before.serviceId.value, fromBedId: before.bedId?.value ?? null, toBedId: bed?.value ?? null });
    return ok((await toViews(this.d, [admission]))[0]);
  }

  async discharge(actorId: string, id: string, input: { type: string; at?: string }): Promise<Result<AdmissionView>> {
    const type = parseEnum(DischargeType, input.type, 'type');
    if (!type.ok) return err(type.error);
    const now = this.d.clock.now();
    const at = input.at ? parseInstant(input.at, 'at') : ok(now);
    if (!at.ok) return err(at.error);
    const loaded = await loadAdmission(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const admission = loaded.value;
    if (!(await this.d.access.canAccess(actorId, 'admissions:write', admission.state.serviceId.value))) return err(NOT_FOUND);

    const freedBed = admission.state.bedId?.value ?? null;
    const done = admission.discharge(type.value, at.value, now);
    if (!done.ok) return err(done.error);
    await this.d.admissions.save(admission, movement('DISCHARGE', admission, actorId, at.value, admission.state.serviceId.value, freedBed));
    await record(this.d, actorId, 'admission.record.discharge', admission, { dischargeType: type.value });
    return ok((await toViews(this.d, [admission]))[0]);
  }

  async cancel(actorId: string, id: string, reason: string): Promise<Result<AdmissionView>> {
    const text = (reason ?? '').trim();
    if (text.length === 0 || text.length > 200) return err(new DomainError('ADMISSION_REASON_REQUIRED', "Le motif d'annulation est obligatoire (200 caractères au plus)."));
    const loaded = await loadAdmission(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    const admission = loaded.value;
    if (!(await this.d.access.canAccess(actorId, 'admissions:write', admission.state.serviceId.value))) return err(NOT_FOUND);

    const freedBed = admission.state.bedId?.value ?? null;
    const done = admission.cancel(text);
    if (!done.ok) return err(done.error);
    await this.d.admissions.save(admission, movement('CANCELLATION', admission, actorId, this.d.clock.now(), admission.state.serviceId.value, freedBed));
    await record(this.d, actorId, 'admission.record.cancel', admission);
    return ok((await toViews(this.d, [admission]))[0]);
  }
}

export class GetAdmissionUseCase {
  constructor(private readonly d: Dependencies) {}

  /** Une admission hors de votre périmètre est « introuvable ». Chaque ouverture est tracée. */
  async execute(actorId: string, id: string): Promise<Result<AdmissionView>> {
    const loaded = await loadAdmission(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    if (!(await this.d.access.canAccess(actorId, 'admissions:read', loaded.value.state.serviceId.value))) return err(NOT_FOUND);
    await record(this.d, actorId, 'admission.record.read', loaded.value);
    return ok((await toViews(this.d, [loaded.value]))[0]);
  }

  async movements(actorId: string, id: string): Promise<Result<{ seq: number; kind: string; at: string; actorId: string; serviceId: string; bedId: string | null }[]>> {
    const loaded = await loadAdmission(this.d, id);
    if (!loaded.ok) return err(loaded.error);
    if (!(await this.d.access.canAccess(actorId, 'admissions:read', loaded.value.state.serviceId.value))) return err(NOT_FOUND);
    const list = await this.d.admissions.movements(loaded.value.id);
    await record(this.d, actorId, 'admission.record.read-movements', loaded.value, { movements: list.length });
    return ok(list.map((m) => ({ seq: m.seq, kind: m.kind, at: m.at.toString(), actorId: m.actorId, serviceId: m.serviceId, bedId: m.bedId })));
  }
}

export interface AdmissionListInput {
  status?: string;
  type?: string;
  patientId?: string;
  practitionerId?: string;
  serviceId?: string;
  from?: string;
  to?: string;
  offset: number;
  limit: number;
}

export class ListAdmissionsUseCase {
  constructor(private readonly d: Dependencies) {}

  async execute(actorId: string, input: AdmissionListInput): Promise<Result<{ items: AdmissionView[]; total: number; offset: number; limit: number }>> {
    const status = input.status?.trim() ? parseEnum(AdmissionStatus, input.status, 'status') : ok(undefined);
    if (!status.ok) return err(status.error);
    const type = input.type?.trim() ? parseEnum(AdmissionType, input.type, 'type') : ok(undefined);
    if (!type.ok) return err(type.error);
    const patientId = input.patientId?.trim() ? PatientRef.create(input.patientId) : ok(undefined);
    if (!patientId.ok) return err(patientId.error);
    const practitionerId = input.practitionerId?.trim() ? PractitionerRef.create(input.practitionerId) : ok(undefined);
    if (!practitionerId.ok) return err(practitionerId.error);
    const from = input.from?.trim() ? parseInstant(input.from, 'from') : ok(undefined);
    if (!from.ok) return err(from.error);
    const to = input.to?.trim() ? parseInstant(input.to, 'to') : ok(undefined);
    if (!to.ok) return err(to.error);

    const visible = await this.d.access.visibleServices(actorId, 'admissions:read');
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
      : await this.d.admissions.list({ status: status.value, type: type.value, patientId: patientId.value, practitionerId: practitionerId.value, from: from.value?.toString(), to: to.value?.toString(), serviceIds }, offset, limit);
    await this.d.audit.record({
      action: 'admission.record.list', outcome: 'SUCCESS', actorId,
      metadata: { criteria: ['status', 'type', 'patientId', 'practitionerId', 'serviceId', 'from', 'to'].filter((k) => (input as unknown as Record<string, unknown>)[k]).join(','), returned: page.items.length, total: page.total },
      occurredAt: this.d.clock.now(),
    });
    return ok({ items: await toViews(this.d, page.items), total: page.total, offset, limit });
  }
}

export interface OccupancyView {
  readonly serviceId: string;
  /** Lits actifs du service. */
  readonly capacity: number;
  /** Lits actifs occupés. */
  readonly occupied: number;
  /** Lits actifs libres. */
  readonly free: number;
  readonly beds: readonly {
    readonly bedId: string;
    readonly code: string;
    readonly name: string;
    /** Où se trouve le lit : « Néonatologie › Salle 1 ». */
    readonly location: string;
    readonly active: boolean;
    readonly occupied: boolean;
    readonly admissionId: string | null;
    readonly patient: { id: string; number: string; lastName: string; firstName: string } | null;
  }[];
}

/** Tableau des lits d'un service : qui occupe quoi, et ce qui est libre. */
export class GetOccupancyUseCase {
  constructor(private readonly d: Dependencies) {}

  async execute(actorId: string, rawServiceId: string): Promise<Result<OccupancyView>> {
    const service = ServiceRef.create(rawServiceId);
    if (!service.ok) return err(SERVICE_NOT_FOUND);
    const info = await this.d.structure.describe(service.value.value);
    if (!info || info.kind !== 'SERVICE') return err(SERVICE_NOT_FOUND);
    if (!(await this.d.access.canAccess(actorId, 'admissions:read', service.value.value))) return err(SERVICE_NOT_FOUND);

    const beds = await this.d.structure.bedsOf(service.value.value);
    const refs = beds.flatMap((b) => {
      const r = BedRef.create(b.id);
      return r.ok ? [r.value] : [];
    });
    const occupants = refs.length ? await this.d.admissions.occupants(refs) : new Map<string, Admission>();
    const patients = await this.d.patients.find([...new Set([...occupants.values()].map((a) => a.state.patientId.value))]);
    const rows = beds.map((b) => {
      const admission = occupants.get(b.id);
      const patient = admission ? patients.get(admission.state.patientId.value) : undefined;
      return {
        bedId: b.id, code: b.code, name: b.name, location: b.location, active: b.active, occupied: !!admission, admissionId: admission?.id.value ?? null,
        patient: patient ? { id: patient.id, number: patient.number, lastName: patient.lastName, firstName: patient.firstName } : null,
      };
    });
    const capacity = rows.filter((r) => r.active).length;
    const occupied = rows.filter((r) => r.active && r.occupied).length;
    await this.d.audit.record({
      action: 'admission.record.occupancy', outcome: 'SUCCESS', actorId, resourceType: 'service', resourceId: service.value.value,
      metadata: { capacity, occupied }, occurredAt: this.d.clock.now(),
    });
    return ok({ serviceId: service.value.value, capacity, occupied, free: capacity - occupied, beds: rows });
  }
}
