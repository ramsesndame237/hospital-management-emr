import { Admission } from '../../src/modules/admissions/domain/admission';
import {
  AdmissionId, AdmissionNumber, AdmissionStatus, AdmissionType, BedRef, DischargeType, parseEnum, parseInstant, PatientRef, ServiceRef,
} from '../../src/modules/admissions/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';

const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (s: string) => Temporal.Instant.from(s);
const T0 = at('2026-11-02T08:00:00Z');
const NOW = at('2026-11-05T12:00:00Z');
const service = (n: number) => must(ServiceRef.create(uuid(n)));
const bed = (n: number) => must(BedRef.create(uuid(n)));

function open(type: AdmissionType, withBed: number | null): ReturnType<typeof Admission.open> {
  return Admission.open({
    id: must(AdmissionId.create(uuid(1))), number: must(AdmissionNumber.fromSequence(1)), patientId: must(PatientRef.create(uuid(2))), type, serviceId: service(10),
    bedId: withBed === null ? null : bed(withBed), practitionerId: null, appointmentId: null, reasonCode: null, admittedAt: T0,
  });
}

describe('admission : valeurs', () => {
  it('valide numéro, énumérations et dates avec fuseau', () => {
    expect(must(AdmissionNumber.fromSequence(45)).value).toBe('ADM-0000045');
    expect(codeOf(AdmissionNumber.create('ADM-1'))).toBe('ADMISSION_NUMBER_INVALID');
    expect(must(parseEnum(AdmissionType, ' inpatient ', 'type'))).toBe(AdmissionType.INPATIENT);
    expect(codeOf(parseEnum(AdmissionType, 'HOTEL', 'type'))).toBe('ADMISSION_ENUM_INVALID');
    expect(must(parseEnum(DischargeType, 'left_against_advice', 'type'))).toBe(DischargeType.LEFT_AGAINST_ADVICE);
    expect(must(parseInstant('2026-11-02T09:00:00+01:00', 'at')).toString()).toBe('2026-11-02T08:00:00Z');
    for (const bad of ['2026-11-02T09:00', '2026-11-02', 'maintenant', '']) expect(codeOf(parseInstant(bad, 'at'))).toBe('ADMISSION_DATETIME_INVALID');
  });
});

describe('admission : ouverture', () => {
  it('une hospitalisation occupe un lit, les autres admissions n\'en ont pas', () => {
    expect(open(AdmissionType.INPATIENT, 20).ok).toBe(true);
    expect(open(AdmissionType.OUTPATIENT, null).ok).toBe(true);
    expect(open(AdmissionType.EMERGENCY, null).ok).toBe(true);
    expect(codeOf(open(AdmissionType.INPATIENT, null))).toBe('ADMISSION_BED_REQUIRED');
    expect(codeOf(open(AdmissionType.OUTPATIENT, 20))).toBe('ADMISSION_BED_NOT_ALLOWED');
    expect(codeOf(open(AdmissionType.EMERGENCY, 20))).toBe('ADMISSION_BED_NOT_ALLOWED');
  });

  it('démarre « en cours », sans sortie ni annulation', () => {
    expect(must(open(AdmissionType.INPATIENT, 20)).state).toMatchObject({ status: 'IN_PROGRESS', dischargedAt: null, dischargeType: null, cancellationReason: null });
  });
});

describe('admission : transfert', () => {
  it('change de lit (le service suit) et refuse de rester au même endroit', () => {
    const a = must(open(AdmissionType.INPATIENT, 20));
    must(a.transfer({ serviceId: service(10), bedId: bed(21) }));
    expect(a.state.bedId?.value).toBe(uuid(21));
    expect(codeOf(a.transfer({ serviceId: service(10), bedId: bed(21) }))).toBe('ADMISSION_SAME_LOCATION');
    must(a.transfer({ serviceId: service(11), bedId: bed(30) }));
    expect(a.state.serviceId.value).toBe(uuid(11));
  });

  it('change de service sans lit pour une admission externe, et garde la règle du lit', () => {
    const a = must(open(AdmissionType.OUTPATIENT, null));
    must(a.transfer({ serviceId: service(11), bedId: null }));
    expect(a.state.serviceId.value).toBe(uuid(11));
    expect(codeOf(a.transfer({ serviceId: service(11), bedId: null }))).toBe('ADMISSION_SAME_LOCATION');
    expect(codeOf(a.transfer({ serviceId: service(12), bedId: bed(20) }))).toBe('ADMISSION_BED_NOT_ALLOWED');
    const inpatient = must(open(AdmissionType.INPATIENT, 20));
    expect(codeOf(inpatient.transfer({ serviceId: service(11), bedId: null }))).toBe('ADMISSION_BED_REQUIRED');
  });
});

describe('admission : sortie et annulation', () => {
  it('enregistre la sortie, libère le lit, et la date doit être entre l\'arrivée et maintenant', () => {
    const a = must(open(AdmissionType.INPATIENT, 20));
    expect(codeOf(a.discharge(DischargeType.HOME, at('2026-11-02T07:59:59Z'), NOW))).toBe('ADMISSION_DISCHARGE_DATE_INVALID'); // avant l'arrivée
    expect(codeOf(a.discharge(DischargeType.HOME, at('2026-11-05T12:00:01Z'), NOW))).toBe('ADMISSION_DISCHARGE_DATE_INVALID'); // dans le futur
    expect(a.inProgress).toBe(true);
    must(a.discharge(DischargeType.HOME, at('2026-11-05T11:00:00Z'), NOW));
    expect(a.state).toMatchObject({ status: 'DISCHARGED', dischargeType: 'HOME', bedId: null });
    expect(a.state.dischargedAt?.toString()).toBe('2026-11-05T11:00:00Z');
  });

  it('accepte une sortie à l\'instant exact de l\'arrivée ou de maintenant', () => {
    const exact = must(open(AdmissionType.OUTPATIENT, null));
    must(exact.discharge(DischargeType.HOME, T0, NOW));
    const now = must(open(AdmissionType.OUTPATIENT, null));
    must(now.discharge(DischargeType.OTHER, NOW, NOW));
  });

  it('annule avec un motif et libère le lit', () => {
    const a = must(open(AdmissionType.INPATIENT, 20));
    must(a.cancel('Mauvais patient'));
    expect(a.state).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Mauvais patient', bedId: null });
  });

  it('une admission terminée ou annulée ne bouge plus', () => {
    const done = must(open(AdmissionType.INPATIENT, 20));
    must(done.discharge(DischargeType.HOME, T0, NOW));
    const cancelled = must(open(AdmissionType.INPATIENT, 21));
    must(cancelled.cancel('Erreur'));
    for (const a of [done, cancelled]) {
      expect(a.ensureInProgress().ok).toBe(false);
      for (const result of [a.transfer({ serviceId: service(11), bedId: bed(30) }), a.discharge(DischargeType.HOME, T0, NOW), a.cancel('x')]) {
        expect(codeOf(result)).toBe('ADMISSION_NOT_IN_PROGRESS');
      }
    }
    expect(done.state.status).toBe(AdmissionStatus.DISCHARGED);
  });
});
