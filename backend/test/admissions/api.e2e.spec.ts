import type { Test } from 'supertest';
import { Temporal } from '../../src/shared-kernel/temporal';
import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const hoursAgo = (h: number): string => Temporal.Now.instant().subtract({ hours: h }).toString();
const tomorrow = (hours = 0): string =>
  Temporal.Now.zonedDateTimeISO('UTC').add({ days: 1 }).with({ hour: 8, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 }).add({ hours }).toInstant().toString();
const NO_PII = /Mbarga|Élisabeth|Ndongo|Nkoa|Curie|Pasteur|Abel/;

describe('API admissions /api/v1/admissions (HTTP réel, PostgreSQL réel)', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
  });
  afterAll(() => c.close());

  const [P1, P2, P3] = [0, 1, 2];
  const open = (who: string, body: object): Test => c.http().post(api('/admissions')).set(c.bearer(who)).send(body);
  const inpatient = (patient: number, bed: string, over: Record<string, unknown> = {}) => ({ patientId: ids.patients[patient], type: 'INPATIENT', bedId: bed, ...over });
  const get = (who: string, path: string): Test => c.http().get(api(path)).set(c.bearer(who));
  const act = (who: string, path: string, body: object = {}): Test => c.http().post(api(path)).set(c.bearer(who)).send(body);
  const occupancy = async (service: string, who = 'accueil') => (await get(who, `/admissions/occupancy?serviceId=${service}`).expect(200)).body;

  describe("contrôle d'accès", () => {
    const ID = '8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b';
    it.each([
      ['GET', '/admissions'], ['POST', '/admissions'], ['GET', '/admissions/occupancy?serviceId=8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b'], ['GET', `/admissions/${ID}`], ['GET', `/admissions/${ID}/movements`],
      ['POST', `/admissions/${ID}/transfer`], ['POST', `/admissions/${ID}/discharge`], ['POST', `/admissions/${ID}/cancel`],
    ])('%s %s : sans jeton → 401 ; patient et comptable → 403', async (method, url) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => Test>)[method.toLowerCase()](api(url));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      expect((await call('patient')).status).toBe(403);
      expect((await call('comptable')).status).toBe(403);
    });
  });

  describe('admissions externes et urgences', () => {
    it('ouvre une consultation dans une unité (le service en découle), avec le professionnel et le motif', async () => {
      const r = await open('accueil', { patientId: ids.patients[P1], type: 'outpatient', serviceId: ids.pedUnit, practitionerId: ids.docPed, reasonCode: 'routine_consultation', admittedAt: hoursAgo(1) });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
        number: expect.stringMatching(/^ADM-\d{7}$/), type: 'OUTPATIENT', status: 'IN_PROGRESS', serviceId: ids.ped, bed: null, reasonCode: 'ROUTINE_CONSULTATION',
        patient: { id: ids.patients[P1], lastName: 'Mbarga' }, practitioner: { id: ids.docPed, lastName: 'Curie' }, dischargedAt: null,
      });
      expect((await c.w.sql.query<{ n: number }>('SELECT count(*)::int AS n FROM admission_movements WHERE admission_id = $1', [r.body.id]))[0].n).toBe(1);
    });

    it('ouvre une urgence pour un patient non identifié (identité provisoire)', async () => {
      const unknown = (await c.http().post(api('/patients')).set(c.bearer('accueil')).send({ lastName: 'INCONNU', firstName: 'Urgence-01', sex: 'MALE', birthDate: '1985-01-01', birthDateEstimated: true, identityStatus: 'PROVISIONAL' }).expect(201)).body.id;
      const r = await open('accueil', { patientId: unknown, type: 'EMERGENCY', serviceId: ids.ped, reasonCode: 'EMERGENCY' });
      expect(r.status).toBe(201);
      expect(r.body.type).toBe('EMERGENCY');
    });

    it('autorise plusieurs admissions externes simultanées pour un même patient', async () => {
      expect((await open('accueil', { patientId: ids.patients[P2], type: 'OUTPATIENT', serviceId: ids.ped })).status).toBe(201);
      expect((await open('accueil', { patientId: ids.patients[P2], type: 'EMERGENCY', serviceId: ids.chi })).status).toBe(201);
    });
  });

  describe('validation', () => {
    it("applique les règles du lit : exigé pour une hospitalisation, interdit sinon, service obligatoire sinon", async () => {
      expect((await open('accueil', { patientId: ids.patients[P3], type: 'INPATIENT' })).body.code).toBe('ADMISSION_BED_REQUIRED');
      expect((await open('accueil', { patientId: ids.patients[P3], type: 'OUTPATIENT', serviceId: ids.ped, bedId: ids.pedBed1 })).body.code).toBe('ADMISSION_BED_NOT_ALLOWED');
      expect((await open('accueil', { patientId: ids.patients[P3], type: 'OUTPATIENT' })).body.code).toBe('ADMISSION_SERVICE_REQUIRED');
      expect((await open('accueil', inpatient(P3, ids.pedBed1, { serviceId: ids.chi }))).body.code).toBe('ADMISSION_SERVICE_MISMATCH');
    });

    it('vérifie le patient, le lieu, le professionnel, le motif et la date', async () => {
      const unknown = '99999999-9999-4999-8999-999999999999';
      const base = { patientId: ids.patients[P3], type: 'OUTPATIENT', serviceId: ids.ped };
      expect((await open('accueil', { ...base, patientId: unknown })).body.code).toBe('ADMISSION_PATIENT_NOT_FOUND');
      expect((await open('accueil', { ...base, serviceId: unknown })).body.code).toBe('ADMISSION_SERVICE_NOT_FOUND');
      expect((await open('accueil', { ...base, type: 'HOTEL' })).body.code).toBe('ADMISSION_ENUM_INVALID');
      expect((await open('accueil', { ...base, reasonCode: 'WIZARD' })).body.code).toBe('ADMISSION_REASON_UNKNOWN');
      expect((await open('accueil', { ...base, admittedAt: tomorrow() })).body.code).toBe('ADMISSION_DATE_INVALID'); // futur
      expect((await open('accueil', { ...base, admittedAt: hoursAgo(49) })).body.code).toBe('ADMISSION_DATE_INVALID'); // plus de 48 h
      expect((await open('accueil', { ...base, admittedAt: '2026-11-02T09:00' })).body.code).toBe('ADMISSION_DATETIME_INVALID'); // sans fuseau
      const unassigned = await open('accueil', { ...base, practitionerId: ids.docNowhere });
      expect([unassigned.status, unassigned.body.code]).toEqual([409, 'ADMISSION_PRACTITIONER_NOT_ASSIGNED']);
      expect((await open('accueil', { ...base, practitionerId: ids.docChi })).body.code).toBe('ADMISSION_PRACTITIONER_NOT_ASSIGNED'); // affecté à CHI
      expect((await open('accueil', { ...base, practitionerId: unknown })).body.code).toBe('ADMISSION_PRACTITIONER_NOT_FOUND');
      expect((await open('accueil', {})).status).toBe(400);
      expect((await open('accueil', { ...base, serviceId: 'nope' })).status).toBe(400);
    });

    it('refuse une salle comme lieu, un élément qui n\'est pas un lit, un lit désactivé et un service désactivé', async () => {
      const room = (await get('admin', `/facilities/${ids.facility}/structure`)).body.services.find((s: { id: string }) => s.id === ids.ped).children[0].children[0].id;
      expect((await open('accueil', { patientId: ids.patients[P3], type: 'OUTPATIENT', serviceId: room })).body.code).toBe('ADMISSION_SERVICE_KIND_INVALID');
      expect((await open('accueil', inpatient(P3, room))).body.code).toBe('ADMISSION_BED_INVALID');

      const bed = (await get('admin', `/facilities/${ids.facility}/structure`)).body.services.find((s: { id: string }) => s.id === ids.ped).children[0].children[0].children[1].id;
      await act('admin', `/structure/${bed}/deactivate`).expect(200);
      const inactive = await open('accueil', inpatient(P3, bed));
      expect([inactive.status, inactive.body.code]).toEqual([409, 'ADMISSION_BED_INACTIVE']);
      await act('admin', `/structure/${bed}/activate`).expect(200);

      const archive = (await act('admin', `/facilities/${ids.facility}/services`, { code: 'ARC', name: 'Archives', serviceType: 'ADMINISTRATIVE' }).expect(201)).body.id;
      await act('admin', `/structure/${archive}/deactivate`).expect(200);
      const gone = await open('accueil', { patientId: ids.patients[P3], type: 'OUTPATIENT', serviceId: archive });
      expect([gone.status, gone.body.code]).toEqual([409, 'ADMISSION_SERVICE_INACTIVE']);
    });

    it('refuse d\'admettre un patient décédé', async () => {
      const dead = (await c.http().post(api('/patients')).set(c.bearer('accueil')).send({ lastName: 'Defunt', firstName: 'Jean', sex: 'MALE', birthDate: '1950-01-01' }).expect(201)).body.id;
      await act('admin', `/patients/${dead}/death`).expect(200);
      const r = await open('accueil', { patientId: dead, type: 'EMERGENCY', serviceId: ids.ped });
      expect([r.status, r.body.code]).toEqual([409, 'ADMISSION_PATIENT_DECEASED']);
    });
  });

  describe('hospitalisation et lits', () => {
    let first: string;

    it('hospitalise dans un lit libre : le service est celui du lit, et le tableau des lits le montre', async () => {
      const r = await open('accueil', inpatient(P1, ids.pedBed1, { reasonCode: 'EMERGENCY' }));
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ type: 'INPATIENT', serviceId: ids.ped, bed: { id: ids.pedBed1, code: 'B1', location: 'Unité pédiatrie › Salle 1' } });
      first = r.body.id;
      const board = await occupancy(ids.ped);
      expect(board).toMatchObject({ serviceId: ids.ped, capacity: 2, occupied: 1, free: 1 });
      expect(board.beds.map((b: { code: string; occupied: boolean }) => [b.code, b.occupied])).toEqual([['B1', true], ['B2', false]]);
      expect(board.beds[0]).toMatchObject({ admissionId: first, patient: { id: ids.patients[P1], lastName: 'Mbarga', number: expect.stringMatching(/^PAT-/) } });
      expect(board.beds[1]).toMatchObject({ admissionId: null, patient: null });
      expect(board.beds.map((b: { location: string }) => b.location)).toEqual(['Unité pédiatrie › Salle 1', 'Unité pédiatrie › Salle 1']); // plusieurs lits portent le même code : l'emplacement les distingue
    });

    it('refuse un lit occupé, et un patient déjà hospitalisé', async () => {
      const occupied = await open('accueil', inpatient(P2, ids.pedBed1));
      expect([occupied.status, occupied.body.code]).toEqual([409, 'ADMISSION_BED_OCCUPIED']);
      const already = await open('accueil', inpatient(P1, ids.pedBed2));
      expect([already.status, already.body.code]).toEqual([409, 'ADMISSION_PATIENT_ALREADY_INPATIENT']);
    });

    it('un seul des deux postes obtient le lit quand deux accueils le visent en même temps', async () => {
      const results = await Promise.all([open('accueil', inpatient(P2, ids.pedBed2)), open('admin', inpatient(P3, ids.pedBed2))]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)?.body.code).toBe('ADMISSION_BED_OCCUPIED');
      expect((await occupancy(ids.ped)).occupied).toBe(2);
      const winner = results.find((r) => r.status === 201)!.body.id;
      await act('accueil', `/admissions/${winner}/cancel`, { reason: 'Test de concurrence' }).expect(200);
    });

    it('transfère vers un autre lit : l\'ancien est libéré, le mouvement est archivé', async () => {
      const moved = await act('accueil', `/admissions/${first}/transfer`, { bedId: ids.pedBed2 }).expect(200);
      expect(moved.body.bed.id).toBe(ids.pedBed2);
      const board = await occupancy(ids.ped);
      expect(board.beds.map((b: { code: string; occupied: boolean }) => [b.code, b.occupied])).toEqual([['B1', false], ['B2', true]]);
      const movements = (await get('accueil', `/admissions/${first}/movements`).expect(200)).body;
      expect(movements.map((m: { seq: number; kind: string; bedId: string }) => [m.seq, m.kind, m.bedId])).toEqual([[1, 'ADMISSION', ids.pedBed1], [2, 'TRANSFER', ids.pedBed2]]);
      expect(movements[1]).toMatchObject({ serviceId: ids.ped, actorId: expect.any(String) });
    });

    it('refuse un transfert vers le même lit, vers un lit occupé, sans lit, ou vers un lit d\'un service hors périmètre', async () => {
      expect((await act('accueil', `/admissions/${first}/transfer`, { bedId: ids.pedBed2 })).body.code).toBe('ADMISSION_SAME_LOCATION');
      const other = await open('accueil', inpatient(P2, ids.pedBed1));
      expect(other.status).toBe(201);
      expect((await act('accueil', `/admissions/${first}/transfer`, { bedId: ids.pedBed1 })).body.code).toBe('ADMISSION_BED_OCCUPIED');
      expect((await act('accueil', `/admissions/${first}/transfer`, {})).body.code).toBe('ADMISSION_BED_REQUIRED');
      expect((await act('accueil', `/admissions/${first}/transfer`, { serviceId: ids.chi })).body.code).toBe('ADMISSION_BED_REQUIRED');
      // le médecin de PED ne peut pas transférer vers CHI
      const r = await act('medecin', `/admissions/${first}/transfer`, { bedId: ids.chiBed1 });
      expect([r.status, r.body.code]).toEqual([403, 'ADMISSION_OUT_OF_SCOPE']);
      await act('accueil', `/admissions/${other.body.id}/cancel`, { reason: 'Test' }).expect(200);
    });

    it('enregistre la sortie : le lit est libéré, le statut change, les dates sont contrôlées', async () => {
      expect((await act('accueil', `/admissions/${first}/discharge`, { type: 'HOTEL' })).body.code).toBe('ADMISSION_ENUM_INVALID');
      expect((await act('accueil', `/admissions/${first}/discharge`, { type: 'HOME', at: tomorrow() })).body.code).toBe('ADMISSION_DISCHARGE_DATE_INVALID');
      expect((await act('accueil', `/admissions/${first}/discharge`, { type: 'HOME', at: '2020-01-01T00:00:00Z' })).body.code).toBe('ADMISSION_DISCHARGE_DATE_INVALID');
      const done = await act('medecin', `/admissions/${first}/discharge`, { type: 'home' }).expect(200);
      expect(done.body).toMatchObject({ status: 'DISCHARGED', dischargeType: 'HOME', bed: null, dischargedAt: expect.any(String) });
      expect((await occupancy(ids.ped)).beds.map((b: { occupied: boolean }) => b.occupied)).toEqual([false, false]);
      const movements = (await get('accueil', `/admissions/${first}/movements`)).body;
      expect(movements.map((m: { kind: string }) => m.kind)).toEqual(['ADMISSION', 'TRANSFER', 'DISCHARGE']);
      expect(movements[2].bedId).toBe(ids.pedBed2); // le lit libéré
    });

    it('une admission terminée ne bouge plus ; le patient peut être de nouveau hospitalisé', async () => {
      for (const [path, body] of [['transfer', { bedId: ids.pedBed1 }], ['discharge', { type: 'HOME' }], ['cancel', { reason: 'Erreur' }]] as const) {
        const r = await act('accueil', `/admissions/${first}/${path}`, body);
        expect([r.status, r.body.code]).toEqual([409, 'ADMISSION_NOT_IN_PROGRESS']);
      }
      expect((await open('accueil', inpatient(P1, ids.pedBed1))).status).toBe(201);
    });

    it('annule une admission ouverte par erreur (motif obligatoire) et libère le lit', async () => {
      const mistaken = await open('accueil', inpatient(P3, ids.pedBed2));
      expect(mistaken.status).toBe(201);
      expect((await act('accueil', `/admissions/${mistaken.body.id}/cancel`, {})).status).toBe(400);
      expect((await act('accueil', `/admissions/${mistaken.body.id}/cancel`, { reason: '  ' })).status).toBe(422);
      const cancelled = await act('accueil', `/admissions/${mistaken.body.id}/cancel`, { reason: 'Mauvais patient' }).expect(200);
      expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Mauvais patient', bed: null });
      expect((await occupancy(ids.ped)).beds.find((b: { code: string }) => b.code === 'B2').occupied).toBe(false);
      expect((await get('accueil', `/admissions/${mistaken.body.id}/movements`)).body.map((m: { kind: string }) => m.kind)).toEqual(['ADMISSION', 'CANCELLATION']);
    });
  });

  describe('rendez-vous', () => {
    const appointment = async (patient: number, startsAt = tomorrow(3)) =>
      (await c.http().post(api('/appointments')).set(c.bearer('accueil')).send({ patientId: ids.patients[patient], practitionerId: ids.docPed, locationId: ids.ped, startsAt, durationMinutes: 30 }).expect(201)).body.id as string;

    it('honore le rendez-vous du patient : il passe à « ARRIVED » et son service sert à l\'admission', async () => {
      const appt = await appointment(P3);
      const r = await open('accueil', { patientId: ids.patients[P3], type: 'OUTPATIENT', appointmentId: appt });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ appointmentId: appt, serviceId: ids.ped });
      expect((await get('accueil', `/appointments/${appt}`).expect(200)).body.status).toBe('ARRIVED');
    });

    it('refuse un rendez-vous déjà honoré, celui d\'un autre patient, d\'un autre service, ou inconnu', async () => {
      const done = await appointment(P2, tomorrow(5));
      await open('accueil', { patientId: ids.patients[P2], type: 'OUTPATIENT', appointmentId: done }).expect(201);
      const reused = await open('accueil', { patientId: ids.patients[P2], type: 'EMERGENCY', appointmentId: done, serviceId: ids.ped });
      expect([reused.status, reused.body.code]).toEqual([409, 'APPOINTMENT_NOT_MODIFIABLE']);

      const appt = await appointment(P1, tomorrow(7));
      expect((await open('accueil', { patientId: ids.patients[P2], type: 'OUTPATIENT', appointmentId: appt })).body.code).toBe('APPOINTMENT_PATIENT_MISMATCH');
      expect((await open('accueil', { patientId: ids.patients[P1], type: 'OUTPATIENT', appointmentId: appt, serviceId: ids.chi })).body.code).toBe('ADMISSION_SERVICE_MISMATCH');
      expect((await open('accueil', { patientId: ids.patients[P1], type: 'OUTPATIENT', appointmentId: '99999999-9999-4999-8999-999999999999' })).body.code).toBe('APPOINTMENT_NOT_FOUND');
      expect((await get('accueil', `/appointments/${appt}`)).body.status).toBe('SCHEDULED'); // aucun refus n'a touché au rendez-vous
    });
  });

  describe('périmètre par service', () => {
    let pedAdmission: string;
    let chiAdmission: string;
    beforeAll(async () => {
      pedAdmission = (await open('medecin', { patientId: ids.patients[P3], type: 'EMERGENCY', serviceId: ids.ped })).body.id; // le médecin de PED ouvre dans PED
      chiAdmission = (await open('accueil', { patientId: ids.patients[P3], type: 'OUTPATIENT', serviceId: ids.chi })).body.id;
    });

    it('le médecin de PED ne peut pas ouvrir une admission dans CHI (403)', async () => {
      const r = await open('medecin', { patientId: ids.patients[P1], type: 'OUTPATIENT', serviceId: ids.chi });
      expect([r.status, r.body.code]).toEqual([403, 'ADMISSION_OUT_OF_SCOPE']);
    });

    it('chacun ne voit que les admissions de ses services ; une admission hors périmètre est introuvable, ainsi que son tableau de lits', async () => {
      const services = async (who: string) => new Set((await get(who, '/admissions?limit=200').expect(200)).body.items.map((a: { serviceId: string }) => a.serviceId));
      expect(await services('medecin')).toEqual(new Set([ids.ped]));
      expect(await services('infirmier')).toEqual(new Set([ids.chi]));
      expect(await services('accueil')).toEqual(new Set([ids.ped, ids.chi]));
      expect(await services('admin')).toEqual(new Set([ids.ped, ids.chi]));
      await get('medecin', `/admissions/${chiAdmission}`).expect(404);
      await get('infirmier', `/admissions/${pedAdmission}`).expect(404);
      await get('infirmier', `/admissions/${pedAdmission}/movements`).expect(404);
      await get('medecin', `/admissions/${pedAdmission}`).expect(200);
      await get('infirmier', `/admissions/occupancy?serviceId=${ids.ped}`).expect(404);
      await get('infirmier', `/admissions/occupancy?serviceId=${ids.chi}`).expect(200);
      await act('medecin', `/admissions/${chiAdmission}/discharge`, { type: 'HOME' }).expect(404);
      await act('infirmier', `/admissions/${pedAdmission}/cancel`, { reason: 'x' }).expect(404);
      expect((await get('medecin', `/admissions?serviceId=${ids.chi}`).expect(200)).body).toMatchObject({ items: [], total: 0 });
    });

    it("l'infirmier agit dans son service (admission, sortie) comme le médecin", async () => {
      const r = await open('infirmier', { patientId: ids.patients[P1], type: 'OUTPATIENT', serviceId: ids.chi });
      expect(r.status).toBe(201);
      await act('infirmier', `/admissions/${r.body.id}/discharge`, { type: 'HOME' }).expect(200);
    });
  });

  describe('liste, filtres et audit', () => {
    it('filtre par statut, type, patient, service et période ; pagine', async () => {
      const list = async (qs: string) => (await get('accueil', `/admissions?${qs}`).expect(200)).body;
      const all = await list('limit=200');
      const arrivals = all.items.map((a: { admittedAt: string }) => a.admittedAt);
      expect(arrivals).toEqual([...arrivals].sort().reverse()); // les plus récentes d'abord
      expect((await list('status=DISCHARGED')).items.every((a: { status: string }) => a.status === 'DISCHARGED')).toBe(true);
      expect((await list('type=INPATIENT')).items.every((a: { type: string }) => a.type === 'INPATIENT')).toBe(true);
      expect((await list(`patientId=${ids.patients[P1]}`)).items.every((a: { patient: { id: string } }) => a.patient.id === ids.patients[P1])).toBe(true);
      expect((await list('from=2999-01-01T00:00:00Z')).items).toEqual([]);
      expect((await list('limit=2')).items).toHaveLength(2);
      for (const bad of ['status=PERDU', 'type=HOTEL', 'from=hier', 'patientId=nope']) expect([422, 400]).toContain((await get('accueil', `/admissions?${bad}`)).status);
    });

    it('trace ouvertures, consultations, mouvements, listes et tableaux de lits — sans aucune donnée personnelle — et garde la chaîne intacte', async () => {
      const rows = await c.w.sql.query<{ action: string; actor_id: string; metadata: unknown }>("SELECT action, actor_id, metadata FROM audit_log WHERE action LIKE 'admission.%'");
      for (const a of ['open', 'transfer', 'discharge', 'cancel', 'read', 'read-movements', 'list', 'occupancy']) expect(rows.map((r) => r.action)).toContain(`admission.record.${a}`);
      expect(rows.every((r) => !!r.actor_id)).toBe(true);
      expect(JSON.stringify(rows)).not.toMatch(NO_PII);
      const transfer = rows.find((r) => r.action === 'admission.record.transfer');
      expect(transfer?.metadata).toMatchObject({ fromBedId: ids.pedBed1, toBedId: ids.pedBed2 });
      expect(await c.w.audit.verifyChain()).toMatchObject({ valid: true });
    });
  });
});
