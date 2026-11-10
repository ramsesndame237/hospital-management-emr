import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';

describe('API clinique : consultations et allergies', () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const put = (who: string, url: string, body: object = {}) => c.http().put(api(url)).set(c.bearer(who)).send(body);
  const patch = (who: string, url: string, body: object = {}) => c.http().patch(api(url)).set(c.bearer(who)).send(body);
  const audit = (action: string, resourceId: string) => c.w.sql.query<{ metadata: Record<string, unknown> }>('SELECT metadata FROM audit_log WHERE action = $1 AND resource_id = $2', [action, resourceId]);

  /** Admission en cours d'un patient à PED (service du médecin `medecin`) ou à CHI (`medecin2`, l'infirmier). */
  const arrive = async (patient = 0, service = ids.ped, type = 'OUTPATIENT'): Promise<string> =>
    (await post('accueil', '/admissions', { patientId: ids.patients[patient], type, serviceId: service }).expect(201)).body.id as string;
  const open = async (who = 'medecin', patient = 0, service = ids.ped) => (await post(who, '/clinical/encounters', { admissionId: await arrive(patient, service) }).expect(201)).body;
  const dx = (code: string, kind = 'PRIMARY', label = 'Pneumopathie', certainty = 'CONFIRMED') => ({ code, label, kind, certainty });
  const sign = async (id: string, who = 'medecin') => {
    await put(who, `/clinical/encounters/${id}/note`, { assessment: 'Pneumopathie franche lobaire.' }).expect(200);
    await put(who, `/clinical/encounters/${id}/diagnoses`, { diagnoses: [dx('J18.9')] }).expect(200);
    return (await post(who, `/clinical/encounters/${id}/sign`).expect(200)).body;
  };

  describe("contrôle d'accès", () => {
    const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    it.each([
      ['GET', '/clinical/queue', ['patient', 'accueil', 'caisse', 'comptable', 'labo', 'admin', 'pharmacien']],
      ['GET', '/clinical/encounters', ['patient', 'accueil', 'caisse', 'labo', 'admin', 'pharmacien']],
      ['POST', '/clinical/encounters', ['patient', 'accueil', 'infirmier', 'labo', 'admin', 'pharmacien']],
      ['GET', `/clinical/encounters/${ID}`, ['patient', 'accueil', 'labo', 'admin', 'pharmacien']],
      ['PUT', `/clinical/encounters/${ID}/vitals`, ['patient', 'accueil', 'labo', 'admin', 'pharmacien']],
      ['PUT', `/clinical/encounters/${ID}/note`, ['patient', 'accueil', 'infirmier', 'labo', 'admin', 'pharmacien']],
      ['PUT', `/clinical/encounters/${ID}/diagnoses`, ['infirmier', 'labo', 'admin']],
      ['POST', `/clinical/encounters/${ID}/sign`, ['infirmier', 'labo', 'admin', 'pharmacien']],
      ['POST', `/clinical/encounters/${ID}/addenda`, ['infirmier', 'labo', 'admin']],
      ['POST', `/clinical/encounters/${ID}/cancel`, ['infirmier', 'labo', 'admin']],
      ['GET', `/clinical/patients/${ID}/allergies`, ['patient', 'accueil', 'caisse', 'labo', 'admin']],
      ['POST', `/clinical/patients/${ID}/allergies`, ['patient', 'accueil', 'labo', 'admin', 'pharmacien']],
      ['PATCH', `/clinical/allergies/${ID}`, ['accueil', 'labo', 'admin', 'pharmacien']],
      ['POST', `/clinical/allergies/${ID}/void`, ['accueil', 'labo', 'admin', 'pharmacien']],
    ])('%s %s : sans jeton → 401, profils sans le droit → 403', async (method, path, forbidden) => {
      const call = (who?: string) => {
        const req = (c.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[method.toLowerCase()](api(path));
        return who ? req.set(c.bearer(who)) : req;
      };
      expect((await call()).status).toBe(401);
      for (const who of forbidden) expect([who, (await call(who)).status]).toEqual([who, 403]);
    });
  });

  describe('ouverture et file d\'attente', () => {
    it('ouvre la consultation d\'un patient arrivé, au nom du médecin, avec le bandeau patient', async () => {
      const adm = await arrive(0);
      const r = await post('medecin', '/clinical/encounters', { admissionId: adm }).expect(201);
      expect(r.body).toMatchObject({ status: 'IN_PROGRESS', admissionId: adm, serviceId: ids.ped, doctor: { username: 'medecin' }, vitals: null, diagnoses: [], addenda: [], allergies: [], patient: { id: ids.patients[0], lastName: 'Mbarga' } });
      expect(r.body.number).toMatch(/^CON-\d{7}$/);
      expect(r.body.missingForSignature).toEqual(['PRIMARY_DIAGNOSIS', 'ASSESSMENT']);
      expect((await audit('clinical.encounter.start', r.body.id))[0].metadata).toMatchObject({ number: r.body.number, admissionId: adm, serviceId: ids.ped });
    });

    it('une admission n\'a qu\'une consultation en cours : la file d\'attente donne celle à reprendre', async () => {
      const adm = await arrive(1);
      const first = (await post('medecin', '/clinical/encounters', { admissionId: adm }).expect(201)).body;
      const again = await post('medecin', '/clinical/encounters', { admissionId: adm });
      expect(again.status).toBe(409);
      expect(again.body).toMatchObject({ code: 'CLINICAL_ENCOUNTER_ALREADY_OPEN' });
      const queue = (await get('medecin', '/clinical/queue').expect(200)).body as { admission: { id: string }; encounter: { id: string; mine: boolean } | null }[];
      expect(queue.find((q) => q.admission.id === adm)!.encounter).toMatchObject({ id: first.id, mine: true });
    });

    it('refuse une admission inconnue, d\'un autre service, terminée ou d\'hospitalisation', async () => {
      expect((await post('medecin', '/clinical/encounters', { admissionId: UNKNOWN })).status).toBe(404);
      const chi = await arrive(0, ids.chi);
      expect((await post('medecin', '/clinical/encounters', { admissionId: chi })).status).toBe(404);
      const done = await arrive(1);
      await post('accueil', `/admissions/${done}/discharge`, { type: 'HOME' }).expect(200);
      const closed = await post('medecin', '/clinical/encounters', { admissionId: done });
      expect([closed.status, JSON.stringify(closed.body)]).toEqual([409, expect.stringContaining('CLINICAL_VISIT_CLOSED')]);
      const inpatient = (await post('accueil', '/admissions', { patientId: ids.patients[2], type: 'INPATIENT', serviceId: ids.ped, bedId: ids.pedBed1 }).expect(201)).body.id;
      const ward = await post('medecin', '/clinical/encounters', { admissionId: inpatient });
      expect([ward.status, JSON.stringify(ward.body)]).toEqual([409, expect.stringContaining('CLINICAL_VISIT_INPATIENT')]);
      expect((await post('medecin', '/clinical/encounters', { admissionId: 'pas-un-uuid' })).status).toBe(400);
    });

    it('la file montre les patients arrivés pas encore vus, ceux en cours avec leur consultation, et plus ceux dont la consultation est signée', async () => {
      const waiting = await arrive(0);
      const busy = await arrive(1);
      const seen = await arrive(2);
      const enc = (await post('medecin', '/clinical/encounters', { admissionId: busy }).expect(201)).body;
      const done = (await post('medecin', '/clinical/encounters', { admissionId: seen }).expect(201)).body;
      await sign(done.id);
      const queue = (await get('medecin', '/clinical/queue').expect(200)).body as { admission: { id: string; type: string }; patient: { lastName: string } | null; encounter: { id: string; mine: boolean; doctor: { username: string } } | null }[];
      const byAdmission = Object.fromEntries(queue.map((q) => [q.admission.id, q]));
      expect(byAdmission[waiting]).toMatchObject({ admission: { type: 'OUTPATIENT' }, encounter: null, patient: { lastName: 'Mbarga' } });
      expect(byAdmission[busy].encounter).toMatchObject({ id: enc.id, mine: true, doctor: { username: 'medecin' } });
      expect(byAdmission[seen]).toBeUndefined();
      // l'infirmier de CHI ne voit pas la file de PED
      expect((await get('infirmier', '/clinical/queue').expect(200)).body.some((q: { admission: { id: string } }) => q.admission.id === waiting)).toBe(false);
    });
  });

  describe('constantes', () => {
    it('relevées par l\'infirmier du service, remplacées, avec l\'IMC calculé', async () => {
      const e = await open('medecin2', 0, ids.chi);
      const first = (await put('infirmier', `/clinical/encounters/${e.id}/vitals`, { temperature: 38.4, pulse: 96, systolic: 130, diastolic: 85, weightKg: 70, heightCm: 175 }).expect(200)).body;
      expect(first.vitals).toMatchObject({ temperature: 38.4, pulse: 96, systolic: 130, diastolic: 85, bmi: 22.9, recordedBy: { username: 'infirmier' }, spo2: null });
      const second = (await put('medecin2', `/clinical/encounters/${e.id}/vitals`, { pulse: 80 }).expect(200)).body;
      expect(second.vitals).toMatchObject({ pulse: 80, temperature: null, bmi: null, recordedBy: { username: 'medecin2' } });
      expect((await audit('clinical.encounter.vitals', e.id))).toHaveLength(2);
    });

    it('refuse un relevé vide, hors plage, avec une pression incomplète ou incohérente, ou hors du service', async () => {
      const e = await open();
      for (const [body, code] of [[{}, 'CLINICAL_VITALS_EMPTY'], [{ temperature: 37.55 }, 'CLINICAL_VITAL_INVALID'], [{ pulse: 88.5 }, 'CLINICAL_VITAL_INVALID'], [{ systolic: 120 }, 'CLINICAL_BLOOD_PRESSURE_INCOMPLETE'], [{ systolic: 80, diastolic: 90 }, 'CLINICAL_BLOOD_PRESSURE_INVALID']] as const) {
        const r = await put('medecin', `/clinical/encounters/${e.id}/vitals`, body);
        expect([r.status, JSON.stringify(r.body)]).toEqual([422, expect.stringContaining(code)]);
      }
      expect((await put('medecin', `/clinical/encounters/${e.id}/vitals`, { pulse: 500 })).status).toBe(400);
      expect((await put('medecin', `/clinical/encounters/${e.id}/vitals`, { temperature: 29 })).status).toBe(400);
      expect((await put('infirmier', `/clinical/encounters/${e.id}/vitals`, { pulse: 80 })).status).toBe(404);
    });
  });

  describe('note, diagnostics, signature', () => {
    it('rédige la note champ par champ, sans journaliser son contenu', async () => {
      const e = await open();
      const r = (await put('medecin', `/clinical/encounters/${e.id}/note`, { chiefComplaint: ' Fièvre depuis trois jours ', history: 'Toux sèche', plan: 'Repos' }).expect(200)).body;
      expect(r.note).toEqual({ chiefComplaint: 'Fièvre depuis trois jours', history: 'Toux sèche', examination: null, assessment: null, plan: 'Repos' });
      const again = (await put('medecin', `/clinical/encounters/${e.id}/note`, { plan: '' }).expect(200)).body;
      expect(again.note).toMatchObject({ chiefComplaint: 'Fièvre depuis trois jours', plan: null });
      const entries = await audit('clinical.encounter.note', e.id);
      expect(entries.map((x) => x.metadata.fields).sort()).toEqual(['chiefComplaint,history,plan', 'plan']);
      expect(JSON.stringify(await c.w.sql.query("SELECT metadata FROM audit_log WHERE action LIKE 'clinical.%'"))).not.toMatch(/Fièvre|Toux|Repos|Mbarga/);
      expect((await put('medecin', `/clinical/encounters/${e.id}/note`, { chiefComplaint: 'x'.repeat(501) })).status).toBe(400);
    });

    it('pose les diagnostics CIM-10 : normalisés, un seul principal, sans doublon', async () => {
      const e = await open();
      const r = (await put('medecin', `/clinical/encounters/${e.id}/diagnoses`, { diagnoses: [dx(' j18.9 '), dx('r50.9', 'SECONDARY', 'Fièvre', 'PROVISIONAL'), { code: 'A09', label: 'Diarrhée', kind: 'SECONDARY' }] }).expect(200)).body;
      expect(r.diagnoses).toEqual([
        { code: 'J18.9', label: 'Pneumopathie', kind: 'PRIMARY', certainty: 'CONFIRMED' }, { code: 'R50.9', label: 'Fièvre', kind: 'SECONDARY', certainty: 'PROVISIONAL' }, { code: 'A09', label: 'Diarrhée', kind: 'SECONDARY', certainty: 'PROVISIONAL' },
      ]);
      const bad = async (diagnoses: object[]) => put('medecin', `/clinical/encounters/${e.id}/diagnoses`, { diagnoses });
      expect(JSON.stringify((await bad([dx('J18.9'), dx('R50.9')])).body)).toContain('CLINICAL_DIAGNOSIS_PRIMARY_DUPLICATE');
      expect(JSON.stringify((await bad([dx('J18.9'), dx('J18.9', 'SECONDARY')])).body)).toContain('CLINICAL_DIAGNOSIS_DUPLICATE');
      expect(JSON.stringify((await bad([dx('J1899')])).body)).toContain('CLINICAL_ICD_INVALID');
      expect((await bad([dx('J18.9', 'MAIN')])).status).toBe(400);
      expect((await bad(Array.from({ length: 11 }, (_, i) => dx(`A0${i % 10}.${i}`, 'SECONDARY')))).status).toBe(400);
      expect((await get('medecin', `/clinical/encounters/${e.id}`).expect(200)).body.diagnoses).toHaveLength(3);
      expect((await put('medecin', `/clinical/encounters/${e.id}/diagnoses`, { diagnoses: [] }).expect(200)).body.diagnoses).toEqual([]);
    });

    it('seul le médecin de la consultation la rédige, même un collègue du service', async () => {
      const e = await open();
      const r = await put('medecin2', `/clinical/encounters/${e.id}/note`, { plan: 'x' });
      expect([r.status]).toEqual([404]); // medecin2 exerce à CHI : hors périmètre
      await c.w.sql.query('UPDATE clinical_encounters SET doctor_id = $2 WHERE id = $1', [e.id, (await c.w.sql.query<{ id: string }>("SELECT id FROM iam_users WHERE username = 'medecin2'"))[0].id]);
      const author = await put('medecin', `/clinical/encounters/${e.id}/note`, { plan: 'x' });
      expect([author.status, JSON.stringify(author.body)]).toEqual([403, expect.stringContaining('CLINICAL_NOT_AUTHOR')]);
      expect((await post('medecin', `/clinical/encounters/${e.id}/sign`)).status).toBe(403);
      expect((await post('medecin', `/clinical/encounters/${e.id}/cancel`, { reason: 'x' })).status).toBe(403);
    });

    it('refuse de signer sans diagnostic principal ni évaluation, en disant ce qui manque', async () => {
      const e = await open();
      const r = await post('medecin', `/clinical/encounters/${e.id}/sign`);
      expect([r.status, JSON.stringify(r.body)]).toEqual([409, expect.stringContaining('CLINICAL_SIGNATURE_INCOMPLETE')]);
      expect(JSON.stringify(r.body)).toContain('un diagnostic principal et une évaluation');
      await put('medecin', `/clinical/encounters/${e.id}/note`, { assessment: 'x' }).expect(200);
      expect((await get('medecin', `/clinical/encounters/${e.id}`).expect(200)).body.missingForSignature).toEqual(['PRIMARY_DIAGNOSIS']);
    });

    it('signe et verrouille : plus rien ne se modifie, les corrections passent par des addenda signés', async () => {
      const e = await open();
      const signed = await sign(e.id);
      expect(signed).toMatchObject({ status: 'SIGNED', signedBy: { username: 'medecin' }, missingForSignature: [] });
      expect(signed.signedAt).toBeTruthy();
      for (const [call, expected] of [
        [() => put('medecin', `/clinical/encounters/${e.id}/note`, { plan: 'réécrit' }), 'CLINICAL_ENCOUNTER_LOCKED'],
        [() => put('medecin', `/clinical/encounters/${e.id}/diagnoses`, { diagnoses: [] }), 'CLINICAL_ENCOUNTER_LOCKED'],
        [() => put('medecin', `/clinical/encounters/${e.id}/vitals`, { pulse: 70 }), 'CLINICAL_ENCOUNTER_LOCKED'],
        [() => post('medecin', `/clinical/encounters/${e.id}/cancel`, { reason: 'x' }), 'CLINICAL_ENCOUNTER_LOCKED'],
        [() => post('medecin', `/clinical/encounters/${e.id}/sign`), 'CLINICAL_ENCOUNTER_LOCKED'],
      ] as const) {
        const r = await call();
        expect([r.status, JSON.stringify(r.body)]).toEqual([409, expect.stringContaining(expected)]);
      }
      const first = (await post('medecin', `/clinical/encounters/${e.id}/addenda`, { text: ' Radiographie reçue : pneumopathie confirmée. ' }).expect(200)).body;
      expect(first.addenda).toMatchObject([{ seq: 1, text: 'Radiographie reçue : pneumopathie confirmée.', by: { username: 'medecin' } }]);
      const second = (await post('medecin', `/clinical/encounters/${e.id}/addenda`, { text: 'Patient rappelé.' }).expect(200)).body;
      expect(second.addenda.map((a: { seq: number }) => a.seq)).toEqual([1, 2]);
      expect(second.note.assessment).toBe('Pneumopathie franche lobaire.');
      expect((await post('medecin', `/clinical/encounters/${e.id}/addenda`, { text: '' })).status).toBe(400);
      expect((await audit('clinical.encounter.addendum', e.id))).toHaveLength(2);
    });

    it('un addendum n\'est possible que sur une consultation signée', async () => {
      const e = await open();
      const r = await post('medecin', `/clinical/encounters/${e.id}/addenda`, { text: 'Trop tôt' });
      expect([r.status, JSON.stringify(r.body)]).toEqual([409, expect.stringContaining('CLINICAL_ENCOUNTER_NOT_SIGNED')]);
    });

    it('annule une consultation ouverte par erreur avec un motif, et en libère l\'admission', async () => {
      const adm = await arrive(0);
      const e = (await post('medecin', '/clinical/encounters', { admissionId: adm }).expect(201)).body;
      expect((await post('medecin', `/clinical/encounters/${e.id}/cancel`, { reason: '' })).status).toBe(400);
      const done = (await post('medecin', `/clinical/encounters/${e.id}/cancel`, { reason: 'Ouverte sur le mauvais patient' }).expect(200)).body;
      expect(done).toMatchObject({ status: 'CANCELLED', cancelledBy: { username: 'medecin' }, cancellationReason: 'Ouverte sur le mauvais patient' });
      expect((await audit('clinical.encounter.cancel', e.id))[0].metadata).not.toHaveProperty('reason');
      const reopened = await post('medecin', '/clinical/encounters', { admissionId: adm });
      expect(reopened.status).toBe(201);
    });
  });

  describe('lecture et périmètre', () => {
    it('lit une consultation de son service (accès journalisé) ; hors de son service elle n\'existe pas', async () => {
      const e = await open();
      const r = await get('medecin', `/clinical/encounters/${e.id}`).expect(200);
      expect(r.body.id).toBe(e.id);
      expect((await audit('clinical.encounter.read', e.id))).toHaveLength(1);
      expect((await get('infirmier', `/clinical/encounters/${e.id}`)).status).toBe(404);
      expect((await get('medecin2', `/clinical/encounters/${e.id}`)).status).toBe(404);
      expect((await get('medecin', `/clinical/encounters/${UNKNOWN}`)).status).toBe(404);
    });

    it('liste les consultations du service, filtre par patient, statut, auteur, et ne montre pas le texte des notes', async () => {
      const mine = await open('medecin', 1);
      const signed = await open('medecin', 1);
      await sign(signed.id);
      const page = (await get('medecin', `/clinical/encounters?patientId=${ids.patients[1]}&limit=200`).expect(200)).body;
      expect(page.items.map((i: { id: string }) => i.id)).toEqual(expect.arrayContaining([mine.id, signed.id]));
      const row = page.items.find((i: { id: string }) => i.id === signed.id);
      expect(row).toMatchObject({ status: 'SIGNED', primaryDiagnosis: { code: 'J18.9', label: 'Pneumopathie' }, patient: { lastName: 'Ndongo' }, doctor: { username: 'medecin' } });
      expect(row).not.toHaveProperty('note');
      expect((await get('medecin', '/clinical/encounters?status=signed&mine=true&limit=200').expect(200)).body.items.every((i: { status: string }) => i.status === 'SIGNED')).toBe(true);
      expect((await get('medecin2', `/clinical/encounters?patientId=${ids.patients[1]}`).expect(200)).body.total).toBe(0);
      expect((await get('medecin', '/clinical/encounters?status=NOPE')).status).toBe(422);
      expect((await get('medecin', '/clinical/encounters?patientId=pas-un-uuid')).status).toBe(422);
    });
  });

  describe('allergies', () => {
    it('enregistre, liste, corrige et déclare erronée ; la consultation affiche les allergies actives', async () => {
      const patient = ids.patients[2];
      const a = (await post('medecin', `/clinical/patients/${patient}/allergies`, { substance: ' Pénicilline ', reaction: 'Urticaire généralisée', severity: 'SEVERE' }).expect(201)).body;
      expect(a).toMatchObject({ substance: 'Pénicilline', severity: 'SEVERE', status: 'ACTIVE', recordedBy: { username: 'medecin' }, patientId: patient });
      const b = (await post('infirmier', `/clinical/patients/${patient}/allergies`, { substance: 'Latex', severity: 'MILD' }).expect(201)).body;
      const e = await open('medecin', 2);
      expect(e.allergies.map((x: { substance: string }) => x.substance).sort()).toEqual(['Latex', 'Pénicilline']);
      const fixed = (await patch('medecin', `/clinical/allergies/${b.id}`, { severity: 'MODERATE', reaction: 'Éruption' }).expect(200)).body;
      expect(fixed).toMatchObject({ severity: 'MODERATE', reaction: 'Éruption', substance: 'Latex' });
      expect((await patch('medecin', `/clinical/allergies/${b.id}`, { reaction: null }).expect(200)).body.reaction).toBeNull();
      expect((await post('medecin', `/clinical/allergies/${b.id}/void`, { reason: '' })).status).toBe(400);
      const voided = (await post('medecin', `/clinical/allergies/${b.id}/void`, { reason: 'Mauvais dossier' }).expect(200)).body;
      expect(voided).toMatchObject({ status: 'ENTERED_IN_ERROR', voidReason: 'Mauvais dossier', voidedBy: { username: 'medecin' } });
      expect((await get('pharmacien', `/clinical/patients/${patient}/allergies`).expect(200)).body.map((x: { substance: string }) => x.substance)).toEqual(['Pénicilline']);
      expect((await get('medecin', `/clinical/patients/${patient}/allergies?includeVoided=true`).expect(200)).body).toHaveLength(2);
      const after = (await get('medecin', `/clinical/encounters/${e.id}`).expect(200)).body;
      expect(after.allergies.map((x: { substance: string }) => x.substance)).toEqual(['Pénicilline']);
      const conflict = await patch('medecin', `/clinical/allergies/${b.id}`, { severity: 'MILD' });
      expect([conflict.status, JSON.stringify(conflict.body)]).toEqual([409, expect.stringContaining('CLINICAL_ALLERGY_VOIDED')]);
      expect((await audit('clinical.allergy.record', a.id))[0].metadata).toEqual({ patientId: patient, severity: 'SEVERE' });
    });

    it('refuse une substance vide, une gravité inconnue, un patient ou une allergie inconnus', async () => {
      const patient = ids.patients[0];
      expect((await post('medecin', `/clinical/patients/${patient}/allergies`, { substance: '', severity: 'MILD' })).status).toBe(400);
      expect((await post('medecin', `/clinical/patients/${patient}/allergies`, { substance: 'x', severity: 'EXTREME' })).status).toBe(400);
      expect((await post('medecin', `/clinical/patients/${UNKNOWN}/allergies`, { substance: 'x', severity: 'MILD' })).status).toBe(404);
      expect((await get('medecin', `/clinical/patients/${UNKNOWN}/allergies`)).status).toBe(404);
      expect((await patch('medecin', `/clinical/allergies/${UNKNOWN}`, { severity: 'MILD' })).status).toBe(404);
      expect((await post('medecin', `/clinical/allergies/${UNKNOWN}/void`, { reason: 'x' })).status).toBe(404);
    });

    it('le journal d\'audit ne contient jamais le nom d\'une substance ni d\'une réaction', async () => {
      const rows = await c.w.sql.query("SELECT action, metadata FROM audit_log WHERE action LIKE 'clinical.allergy.%'");
      expect(rows.length).toBeGreaterThan(2);
      expect(JSON.stringify(rows)).not.toMatch(/Pénicilline|Latex|Urticaire|Éruption/);
    });
  });
});
