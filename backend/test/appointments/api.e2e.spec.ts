import { Temporal } from '../../src/shared-kernel/temporal';
import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

/** Demain à 08:00 UTC + `hours` heures + `minutes` minutes : des créneaux futurs, alignés, sans dépendre de l'heure d'exécution. */
const tomorrow = (hours = 0, minutes = 0): string =>
  Temporal.Now.zonedDateTimeISO('UTC').add({ days: 1 }).with({ hour: 8, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 }).add({ hours, minutes }).toInstant().toString();
const NO_PII = /Mbarga|Élisabeth|Ndongo|Nkoa|Curie|Pasteur|Abel/;

describe('API rendez-vous /api/v1/appointments (HTTP réel, PostgreSQL réel)', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
  });
  afterAll(() => c.close());

  const [P1, P2, P3] = [0, 1, 2];
  const book = (who: string, body: object) => c.http().post(api('/appointments')).set(c.bearer(who)).send(body);
  const valid = (over: Record<string, unknown> = {}) => ({ patientId: ids.patients[P1], practitionerId: ids.docPed, locationId: ids.ped, startsAt: tomorrow(0), durationMinutes: 30, ...over });

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', '/appointments'], ['POST', '/appointments'], ['GET', `/appointments/${ID}`], ['POST', `/appointments/${ID}/reschedule`], ['POST', `/appointments/${ID}/cancel`], ['POST', `/appointments/${ID}/no-show`],
    ])('%s %s : sans jeton → 401 ; patient et comptable → 403', async (method, url) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(url));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      expect((await call('patient')).status).toBe(403);
      expect((await call('comptable')).status).toBe(403);
    });

    it("l'infirmier consulte mais ne peut pas écrire ; le médecin écrit dans son service", async () => {
      await book('infirmier', valid({ startsAt: tomorrow(10) })).then((r) => expect(r.status).toBe(403));
      await c.http().get(api('/appointments')).set(c.bearer('infirmier')).expect(200);
    });
  });

  describe('prise de rendez-vous', () => {
    it('crée un rendez-vous avec le patient et le professionnel résumés, et le trace sans donnée personnelle', async () => {
      const r = await book('accueil', valid({ reasonCode: 'follow_up' }));
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
        number: expect.stringMatching(/^RDV-\d{7}$/), status: 'SCHEDULED', durationMinutes: 30, reasonCode: 'FOLLOW_UP', locationId: ids.ped, serviceId: ids.ped,
        patient: { id: ids.patients[P1], lastName: 'Mbarga' }, practitioner: { id: ids.docPed, lastName: 'Curie', staffNumber: 'D-PED' },
      });
      expect(r.body.startsAt).toBe(tomorrow(0));
      expect(r.body.endsAt).toBe(tomorrow(0, 30));
      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'appointment.record.schedule' AND resource_id = $1", [r.body.id]);
      expect(entry.metadata).toMatchObject({ appointmentNumber: r.body.number, serviceId: ids.ped });
      expect(JSON.stringify(entry)).not.toMatch(NO_PII);
    });

    it('accepte un lieu de niveau « unité » et rattache le rendez-vous à son service', async () => {
      const r = await book('accueil', valid({ patientId: ids.patients[P2], locationId: ids.pedUnit, startsAt: tomorrow(2) }));
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ locationId: ids.pedUnit, serviceId: ids.ped });
    });

    it("refuse un horaire passé, trop lointain, sans fuseau, ou une durée incorrecte", async () => {
      const past = await book('accueil', valid({ startsAt: Temporal.Now.instant().subtract({ hours: 1 }).toString() }));
      expect([past.status, past.body.code]).toEqual([422, 'APPOINTMENT_IN_PAST']);
      const far = await book('accueil', valid({ startsAt: Temporal.Now.instant().add({ hours: 24 * 400 }).toString() }));
      expect([far.status, far.body.code]).toEqual([422, 'APPOINTMENT_TOO_FAR']);
      expect((await book('accueil', valid({ startsAt: '2030-01-01T09:00' }))).body.code).toBe('APPOINTMENT_START_INVALID');
      expect((await book('accueil', valid({ durationMinutes: 7 }))).body.code).toBe('APPOINTMENT_DURATION_INVALID');
      expect((await book('accueil', valid({ durationMinutes: 'long' }))).status).toBe(400);
      expect((await book('accueil', {})).status).toBe(400);
    });

    it('vérifie le patient, le lieu, le professionnel et le motif', async () => {
      const unknown = '99999999-9999-4999-8999-999999999999';
      expect((await book('accueil', valid({ patientId: unknown, startsAt: tomorrow(3) }))).body.code).toBe('APPOINTMENT_PATIENT_NOT_FOUND');
      expect((await book('accueil', valid({ practitionerId: unknown, startsAt: tomorrow(3) }))).body.code).toBe('APPOINTMENT_PRACTITIONER_NOT_FOUND');
      expect((await book('accueil', valid({ locationId: unknown, startsAt: tomorrow(3) }))).body.code).toBe('APPOINTMENT_LOCATION_NOT_FOUND');
      expect((await book('accueil', valid({ reasonCode: 'WIZARD', startsAt: tomorrow(3) }))).body.code).toBe('APPOINTMENT_REASON_UNKNOWN');
      const notAssigned = await book('accueil', valid({ practitionerId: ids.docNowhere, startsAt: tomorrow(3) }));
      expect([notAssigned.status, notAssigned.body.code]).toEqual([409, 'APPOINTMENT_PRACTITIONER_NOT_ASSIGNED']);
      const otherService = await book('accueil', valid({ practitionerId: ids.docChi, startsAt: tomorrow(3) })); // affecté à CHI, pas à PED
      expect(otherService.body.code).toBe('APPOINTMENT_PRACTITIONER_NOT_ASSIGNED');
    });

    it("refuse un lieu qui n'est pas un service ou une unité, ou qui est désactivé", async () => {
      const room = (await c.http().get(api(`/facilities/${ids.facility}/structure`)).set(c.bearer('admin'))).body.services.find((s: { id: string }) => s.id === ids.ped).children[0].children[0].id;
      expect((await book('accueil', valid({ locationId: room, startsAt: tomorrow(3) }))).body.code).toBe('APPOINTMENT_LOCATION_KIND_INVALID');
      const archive = (await c.http().post(api(`/facilities/${ids.facility}/services`)).set(c.bearer('admin')).send({ code: 'ARC', name: 'Archives', serviceType: 'ADMINISTRATIVE' }).expect(201)).body.id;
      await c.http().post(api(`/structure/${archive}/deactivate`)).set(c.bearer('admin')).expect(200);
      const r = await book('accueil', valid({ locationId: archive, startsAt: tomorrow(3) }));
      expect([r.status, r.body.code]).toEqual([409, 'APPOINTMENT_LOCATION_INACTIVE']);
    });

    it("refuse un professionnel qui n'est plus en poste à cette date, et un patient décédé", async () => {
      const gone = (await c.http().post(api('/staff')).set(c.bearer('admin')).send({ staffNumber: 'D-GONE', firstName: 'Ancien', lastName: 'Parti', professionCode: 'DOCTOR', hiredOn: '2019-01-01' }).expect(201)).body.id;
      await c.http().post(api(`/staff/${gone}/assignments`)).set(c.bearer('admin')).send({ nodeId: ids.ped, startDate: '2020-01-01' }).expect(201);
      await c.http().post(api(`/staff/${gone}/depart`)).set(c.bearer('admin')).send({ departedOn: '2022-01-01' }).expect(200);
      const r = await book('accueil', valid({ practitionerId: gone, startsAt: tomorrow(3) }));
      expect([r.status, r.body.code]).toEqual([409, 'APPOINTMENT_PRACTITIONER_NOT_EMPLOYED']);

      const dead = (await c.http().post(api('/patients')).set(c.bearer('accueil')).send({ lastName: 'Defunt', firstName: 'Jean', sex: 'MALE', birthDate: '1950-01-01' }).expect(201)).body.id;
      await c.http().post(api(`/patients/${dead}/death`)).set(c.bearer('admin')).send({}).expect(200);
      const d = await book('accueil', valid({ patientId: dead, startsAt: tomorrow(3) }));
      expect([d.status, d.body.code]).toEqual([409, 'APPOINTMENT_PATIENT_DECEASED']);
    });

    it('refuse les chevauchements du professionnel et du patient, mais accepte des créneaux enchaînés', async () => {
      const slot = 5; // heures après 08:00
      expect((await book('accueil', valid({ startsAt: tomorrow(slot) }))).status).toBe(201);
      const doctorBusy = await book('accueil', valid({ patientId: ids.patients[P3], startsAt: tomorrow(slot, 15) }));
      expect([doctorBusy.status, doctorBusy.body.code]).toEqual([409, 'APPOINTMENT_PRACTITIONER_BUSY']);
      // un autre professionnel de PED, pour le même patient : le patient est occupé
      const second = (await c.http().post(api('/staff')).set(c.bearer('admin')).send({ staffNumber: 'D-PED2', firstName: 'Second', lastName: 'Docteur', professionCode: 'DOCTOR', hiredOn: '2019-01-01' }).expect(201)).body.id;
      await c.http().post(api(`/staff/${second}/assignments`)).set(c.bearer('admin')).send({ nodeId: ids.ped, startDate: '2020-01-01' }).expect(201);
      const patientBusy = await book('accueil', valid({ practitionerId: second, startsAt: tomorrow(slot, 10) }));
      expect([patientBusy.status, patientBusy.body.code]).toEqual([409, 'APPOINTMENT_PATIENT_BUSY']);
      expect((await book('accueil', valid({ patientId: ids.patients[P3], startsAt: tomorrow(slot, 30) }))).status).toBe(201); // enchaîné
    });

    it('sérialise deux prises de rendez-vous simultanées sur le même créneau : une seule aboutit', async () => {
      const startsAt = tomorrow(7);
      const results = await Promise.all([
        book('accueil', valid({ patientId: ids.patients[P1], startsAt })),
        book('accueil', valid({ patientId: ids.patients[P2], startsAt })),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)?.body.code).toBe('APPOINTMENT_PRACTITIONER_BUSY');
    });
  });

  describe('périmètre par service', () => {
    let pedAppointment: string;
    let chiAppointment: string;

    beforeAll(async () => {
      pedAppointment = (await book('medecin', valid({ patientId: ids.patients[P2], startsAt: tomorrow(20) }))).body.id; // le médecin de PED écrit dans PED
      chiAppointment = (await book('accueil', valid({ practitionerId: ids.docChi, locationId: ids.chi, startsAt: tomorrow(20) }))).body.id;
    });

    it('le médecin de PED ne peut pas prendre un rendez-vous dans CHI (403), ni modifier ou annuler ceux de CHI', async () => {
      const r = await book('medecin', valid({ practitionerId: ids.docChi, locationId: ids.chi, startsAt: tomorrow(21) }));
      expect([r.status, r.body.code]).toEqual([403, 'APPOINTMENT_OUT_OF_SCOPE']);
      await c.http().post(api(`/appointments/${chiAppointment}/cancel`)).set(c.bearer('medecin')).send({ reason: 'x' }).expect(404);
      await c.http().post(api(`/appointments/${chiAppointment}/reschedule`)).set(c.bearer('medecin')).send({ durationMinutes: 15 }).expect(404);
    });

    it("n'affiche à chacun que les rendez-vous de ses services ; un rendez-vous hors périmètre est introuvable", async () => {
      const mine = async (who: string) => (await c.http().get(api('/appointments?limit=200')).set(c.bearer(who)).expect(200)).body.items.map((a: { serviceId: string }) => a.serviceId);
      expect(new Set(await mine('medecin'))).toEqual(new Set([ids.ped]));
      expect(new Set(await mine('infirmier'))).toEqual(new Set([ids.chi]));
      expect(new Set(await mine('accueil'))).toEqual(new Set([ids.ped, ids.chi]));
      expect(new Set(await mine('admin'))).toEqual(new Set([ids.ped, ids.chi]));
      await c.http().get(api(`/appointments/${chiAppointment}`)).set(c.bearer('medecin')).expect(404);
      await c.http().get(api(`/appointments/${pedAppointment}`)).set(c.bearer('infirmier')).expect(404);
      await c.http().get(api(`/appointments/${pedAppointment}`)).set(c.bearer('medecin')).expect(200);
      // un filtre sur un service hors périmètre ne le dévoile pas
      expect((await c.http().get(api(`/appointments?serviceId=${ids.chi}`)).set(c.bearer('medecin')).expect(200)).body).toMatchObject({ items: [], total: 0 });
    });
  });

  describe('agenda, filtres et audit', () => {
    it('filtre par période (fin exclue), professionnel, patient et statut ; trie du plus proche au plus lointain', async () => {
      const day = async (qs: string) => (await c.http().get(api(`/appointments?${qs}`)).set(c.bearer('accueil')).expect(200)).body;
      const all = await day('limit=200');
      const starts = all.items.map((a: { startsAt: string }) => a.startsAt);
      expect(starts).toEqual([...starts].sort());
      const slice = await day(`from=${encodeURIComponent(tomorrow(5))}&to=${encodeURIComponent(tomorrow(6))}&limit=200`);
      expect(slice.items.every((a: { startsAt: string }) => a.startsAt >= tomorrow(5) && a.startsAt < tomorrow(6))).toBe(true);
      expect(slice.total).toBeGreaterThan(0);
      expect((await day(`practitionerId=${ids.docChi}`)).items.every((a: { practitioner: { id: string } }) => a.practitioner.id === ids.docChi)).toBe(true);
      expect((await day(`patientId=${ids.patients[P2]}`)).items.every((a: { patient: { id: string } }) => a.patient.id === ids.patients[P2])).toBe(true);
      expect((await day('status=CANCELLED')).items).toEqual([]);
      expect((await day('limit=2')).items).toHaveLength(2);
      await c.http().get(api('/appointments?status=PERDU')).set(c.bearer('accueil')).expect(422);
      await c.http().get(api('/appointments?from=hier')).set(c.bearer('accueil')).expect(422);
      await c.http().get(api('/appointments?practitionerId=nope')).set(c.bearer('accueil')).expect(422);
    });

    it("trace la consultation de l'agenda (critères et nombre, jamais de valeurs ni de noms)", async () => {
      await c.http().get(api(`/appointments?patientId=${ids.patients[P1]}&status=SCHEDULED`)).set(c.bearer('medecin')).expect(200);
      const [entry] = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'appointment.record.list' ORDER BY id DESC LIMIT 1");
      expect(entry.metadata).toMatchObject({ criteria: 'patientId,status', returned: expect.any(Number) });
      expect(JSON.stringify(entry)).not.toContain(ids.patients[P1]);
    });
  });

  describe('déplacement, annulation, absence', () => {
    let id: string;
    beforeAll(async () => {
      id = (await book('accueil', valid({ patientId: ids.patients[P3], startsAt: tomorrow(30) }))).body.id;
    });

    it('déplace un rendez-vous à venir (même les créneaux qui chevauchent son ancienne place), en revérifiant les règles', async () => {
      const moved = await c.http().post(api(`/appointments/${id}/reschedule`)).set(c.bearer('accueil')).send({ startsAt: tomorrow(30, 10), durationMinutes: 45, reasonCode: 'FOLLOW_UP' }).expect(200);
      expect(moved.body).toMatchObject({ startsAt: tomorrow(30, 10), durationMinutes: 45, reasonCode: 'FOLLOW_UP', status: 'SCHEDULED' });
      const other = (await book('accueil', valid({ patientId: ids.patients[P2], startsAt: tomorrow(32) }))).body.id;
      const clash = await c.http().post(api(`/appointments/${id}/reschedule`)).set(c.bearer('accueil')).send({ startsAt: tomorrow(32, 10) });
      expect([clash.status, clash.body.code]).toEqual([409, 'APPOINTMENT_PRACTITIONER_BUSY']);
      await c.http().post(api(`/appointments/${id}/reschedule`)).set(c.bearer('accueil')).send({ practitionerId: ids.docChi }).expect(409); // CHI : non affecté à PED
      await c.http().post(api(`/appointments/${id}/reschedule`)).set(c.bearer('accueil')).send({ startsAt: Temporal.Now.instant().subtract({ hours: 2 }).toString() }).expect(422);
      await c.http().post(api(`/appointments/${id}/reschedule`)).set(c.bearer('accueil')).send({ locationId: ids.chi }).expect(409); // le professionnel n'est pas affecté à CHI
      expect(other).toBeTruthy();
      const history = await c.w.sql.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM audit_log WHERE action = 'appointment.record.reschedule' AND resource_id = $1", [id]);
      expect(history[0].metadata).toMatchObject({ changed: 'slot,reason', previousStartsAt: tomorrow(30), startsAt: tomorrow(30, 10) });
    });

    it('ne fait rien (et ne trace rien) si rien ne change', async () => {
      const before = (await c.w.sql.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE action = 'appointment.record.reschedule'"))[0].n;
      await c.http().post(api(`/appointments/${id}/reschedule`)).set(c.bearer('accueil')).send({}).expect(200);
      expect((await c.w.sql.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE action = 'appointment.record.reschedule'"))[0].n).toBe(before);
    });

    it("exige un motif pour annuler, libère le créneau, puis refuse toute autre modification", async () => {
      await c.http().post(api(`/appointments/${id}/cancel`)).set(c.bearer('accueil')).send({}).expect(400);
      await c.http().post(api(`/appointments/${id}/cancel`)).set(c.bearer('accueil')).send({ reason: '   ' }).expect(422);
      const cancelled = await c.http().post(api(`/appointments/${id}/cancel`)).set(c.bearer('accueil')).send({ reason: 'Demande du patient' }).expect(200);
      expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Demande du patient' });
      for (const [path, body] of [['cancel', { reason: 'bis' }], ['reschedule', { durationMinutes: 15 }], ['no-show', {}]] as const) {
        const r = await c.http().post(api(`/appointments/${id}/${path}`)).set(c.bearer('accueil')).send(body);
        expect([r.status, r.body.code]).toEqual([409, 'APPOINTMENT_NOT_MODIFIABLE']);
      }
      expect((await book('accueil', valid({ patientId: ids.patients[P3], startsAt: tomorrow(30, 10) }))).status).toBe(201); // le créneau est de nouveau libre
    });

    it("constate une absence seulement quand le créneau a commencé", async () => {
      const future = (await book('accueil', valid({ patientId: ids.patients[P2], startsAt: tomorrow(40) }))).body.id;
      const early = await c.http().post(api(`/appointments/${future}/no-show`)).set(c.bearer('accueil'));
      expect([early.status, early.body.code]).toEqual([409, 'APPOINTMENT_NOT_STARTED']);
      // un rendez-vous dont le créneau est passé (posé en SQL : l'API refuse d'en créer)
      await c.w.sql.query(
        "INSERT INTO appointments (id, appointment_number, patient_id, practitioner_id, location_id, service_id, starts_at, duration_minutes, ends_at, status) VALUES ('00000000-0000-4000-8000-000000000a01', 'RDV-0009001', $1, $2, $3, $3, now() - interval '2 hours', 30, now() - interval '90 minutes', 'SCHEDULED')",
        [ids.patients[P1], ids.docPed, ids.ped],
      );
      const absent = await c.http().post(api('/appointments/00000000-0000-4000-8000-000000000a01/no-show')).set(c.bearer('medecin')).expect(200);
      expect(absent.body.status).toBe('NO_SHOW');
      await c.http().post(api('/appointments/99999999-9999-4999-8999-999999999999/no-show')).set(c.bearer('accueil')).expect(404);
      await c.http().post(api('/appointments/pas-un-uuid/no-show')).set(c.bearer('accueil')).expect(400);
    });
  });

  it("garde le journal d'audit intact et sans donnée personnelle", async () => {
    const rows = await c.w.sql.query<{ action: string; actor_id: string; metadata: unknown }>("SELECT action, actor_id, metadata FROM audit_log WHERE action LIKE 'appointment.%'");
    for (const a of ['schedule', 'reschedule', 'cancel', 'no-show', 'read', 'list']) expect(rows.map((r) => r.action)).toContain(`appointment.record.${a}`);
    expect(rows.every((r) => !!r.actor_id)).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(NO_PII);
    expect(await c.w.audit.verifyChain()).toMatchObject({ valid: true });
  });
});
