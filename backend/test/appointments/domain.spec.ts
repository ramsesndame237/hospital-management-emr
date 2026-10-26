import { Appointment, AppointmentNumber } from '../../src/modules/appointments/domain/appointment';
import {
  AppointmentId, AppointmentStatus, isActiveStatus, LocationRef, parseStatus, PatientRef, PractitionerRef, ReasonCode, ServiceRef, TimeSlot,
} from '../../src/modules/appointments/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';

const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const slot = (startsAt = '2026-11-02T09:00:00+01:00', minutes = 30) => must(TimeSlot.create(startsAt, minutes));

function appointment(over: { slot?: TimeSlot } = {}): Appointment {
  return Appointment.schedule({
    id: must(AppointmentId.create(uuid(1))), number: must(AppointmentNumber.fromSequence(1)), patientId: must(PatientRef.create(uuid(2))), practitionerId: must(PractitionerRef.create(uuid(3))),
    locationId: must(LocationRef.create(uuid(4))), serviceId: must(ServiceRef.create(uuid(5))), slot: over.slot ?? slot(), reasonCode: null,
  });
}

describe('rendez-vous : créneau', () => {
  it('exige un fuseau explicite et un instant valide', () => {
    expect(must(TimeSlot.create('2026-11-02T09:00:00+01:00', 30)).start.toString()).toBe('2026-11-02T08:00:00Z');
    expect(must(TimeSlot.create('2026-11-02T08:00:00Z', 30)).end.toString()).toBe('2026-11-02T08:30:00Z');
    for (const bad of ['2026-11-02T09:00', '2026-11-02', 'demain 9h', '', '2026-13-02T09:00:00Z', '2026-02-30T09:00:00Z']) {
      expect(codeOf(TimeSlot.create(bad, 30))).toBe('APPOINTMENT_START_INVALID');
    }
    expect(codeOf(TimeSlot.create(undefined as never, 30))).toBe('APPOINTMENT_START_INVALID');
  });

  it('borne la durée : 5 à 240 minutes, par pas de 5, entière', () => {
    for (const ok of [5, 15, 30, 240]) expect(codeOf(TimeSlot.create('2026-11-02T08:00:00Z', ok))).toBe('OK');
    for (const bad of [0, 4, 7, 245, 300, -30, 12.5, Number.NaN]) expect(codeOf(TimeSlot.create('2026-11-02T08:00:00Z', bad))).toBe('APPOINTMENT_DURATION_INVALID');
  });

  it('détecte le chevauchement : bornes ouvertes (un créneau peut commencer quand l\'autre finit)', () => {
    const nine = slot('2026-11-02T09:00:00Z', 30);
    expect(nine.overlaps(slot('2026-11-02T09:15:00Z', 30))).toBe(true);
    expect(nine.overlaps(slot('2026-11-02T08:45:00Z', 30))).toBe(true);
    expect(nine.overlaps(slot('2026-11-02T09:05:00Z', 5))).toBe(true); // contenu dans l'autre
    expect(nine.overlaps(slot('2026-11-02T09:30:00Z', 30))).toBe(false); // enchaîné
    expect(nine.overlaps(slot('2026-11-02T08:30:00Z', 30))).toBe(false);
    expect(nine.overlaps(slot('2026-11-02T10:00:00Z', 30))).toBe(false);
    expect(nine.overlaps(nine)).toBe(true);
  });

  it('compare deux créneaux par instant et durée, quel que soit le fuseau d\'écriture', () => {
    expect(slot('2026-11-02T09:00:00+01:00', 30).equals(slot('2026-11-02T08:00:00Z', 30))).toBe(true);
    expect(slot('2026-11-02T09:00:00+01:00', 30).equals(slot('2026-11-02T09:00:00+01:00', 45))).toBe(false);
  });
});

describe('rendez-vous : valeurs', () => {
  it('valide numéro, motif, statut et références', () => {
    expect(must(AppointmentNumber.fromSequence(45)).value).toBe('RDV-0000045');
    expect(codeOf(AppointmentNumber.create('RDV-12'))).toBe('APPOINTMENT_NUMBER_INVALID');
    expect(must(ReasonCode.create(' follow_up ')).value).toBe('FOLLOW_UP');
    expect(codeOf(ReasonCode.create('a b'))).toBe('APPOINTMENT_REASON_UNKNOWN');
    expect(must(parseStatus('no_show'))).toBe(AppointmentStatus.NO_SHOW);
    expect(codeOf(parseStatus('PERDU'))).toBe('APPOINTMENT_STATUS_INVALID');
    expect(codeOf(AppointmentId.create('nope'))).toBe('APPOINTMENT_ID_INVALID');
    expect(codeOf(PatientRef.create('nope'))).toBe('APPOINTMENT_PATIENT_INVALID');
    expect(codeOf(LocationRef.create('nope'))).toBe('APPOINTMENT_LOCATION_INVALID');
  });

  it('seuls « prévu » et « patient présenté » occupent un créneau', () => {
    expect([AppointmentStatus.SCHEDULED, AppointmentStatus.ARRIVED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].map(isActiveStatus)).toEqual([true, true, false, false]);
  });
});

describe('rendez-vous : cycle de vie', () => {
  const before = Temporal.Instant.from('2026-11-02T07:59:59Z');
  const after = Temporal.Instant.from('2026-11-02T08:00:00Z');

  it('naît « prévu », sans motif d\'annulation', () => {
    expect(appointment().state).toMatchObject({ status: 'SCHEDULED', cancellationReason: null });
  });

  it('se déplace tant qu\'il est prévu : seuls les champs fournis changent', () => {
    const a = appointment();
    must(a.reschedule({ slot: slot('2026-11-03T10:00:00Z', 45), reasonCode: must(ReasonCode.create('FOLLOW_UP')) }));
    expect(a.state.slot.start.toString()).toBe('2026-11-03T10:00:00Z');
    expect(a.state.slot.durationMinutes).toBe(45);
    expect(a.state.reasonCode?.value).toBe('FOLLOW_UP');
    expect(a.state.practitionerId.value).toBe(uuid(3));
    must(a.reschedule({ reasonCode: null }));
    expect(a.state.reasonCode).toBeNull();
    must(a.reschedule({}));
    expect(a.status).toBe('SCHEDULED');
  });

  it('s\'annule avec un motif, puis ne bouge plus', () => {
    const a = appointment();
    must(a.cancel('Demande du patient'));
    expect(a.state).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Demande du patient' });
    for (const result of [a.cancel('x'), a.reschedule({ slot: slot() }), a.markNoShow(after), a.markArrived()]) expect(codeOf(result)).toBe('APPOINTMENT_NOT_MODIFIABLE');
  });

  it('constate une absence seulement une fois le créneau commencé', () => {
    const a = appointment();
    expect(codeOf(a.markNoShow(before))).toBe('APPOINTMENT_NOT_STARTED');
    expect(a.status).toBe('SCHEDULED');
    must(a.markNoShow(after));
    expect(a.status).toBe('NO_SHOW');
    expect(codeOf(a.markArrived())).toBe('APPOINTMENT_NOT_MODIFIABLE');
  });

  it('est honoré une fois : après quoi il n\'est ni annulable ni déplaçable', () => {
    const a = appointment();
    must(a.markArrived());
    expect(a.status).toBe('ARRIVED');
    for (const result of [a.markArrived(), a.cancel('x'), a.reschedule({ slot: slot() }), a.markNoShow(after)]) expect(codeOf(result)).toBe('APPOINTMENT_NOT_MODIFIABLE');
  });

  it('un statut clos explique la cause dans son message', () => {
    const a = appointment();
    must(a.markArrived());
    const r = a.cancel('x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('honoré');
  });
});
