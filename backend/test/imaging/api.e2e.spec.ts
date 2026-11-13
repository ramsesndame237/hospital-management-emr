import { api, buildClinicalWorld, ClinicalWorld } from '../support/clinical-world';

const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const future = (days: number, hour = 9) => {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe("API imagerie : catalogue, demandes d'examens et comptes rendus", () => {
  let c: ClinicalWorld;
  let ids: ClinicalWorld['ids'];
  let rx: string; // radiographie du thorax (irradiante)
  let echo: string; // échographie
  let scan: string; // scanner avec produit de contraste
  beforeAll(async () => {
    c = await buildClinicalWorld();
    ids = c.ids;
    rx = (await post('admin', '/imaging/exam-types', { code: 'RX-THORAX', name: 'Radiographie du thorax de face', modality: 'XRAY', bodyPart: 'Thorax', durationMinutes: 20 }).expect(201)).body.id as string;
    echo = (await post('admin', '/imaging/exam-types', { code: 'ECHO-ABD', name: 'Échographie abdominale', modality: 'ULTRASOUND', bodyPart: 'Abdomen', preparation: 'À jeun depuis 6 heures.' }).expect(201)).body.id as string;
    scan = (await post('admin', '/imaging/exam-types', { code: 'TDM-THORAX', name: 'Scanner thoracique avec injection', modality: 'CT', usesContrast: true, durationMinutes: 45 }).expect(201)).body.id as string;
  });
  afterAll(() => c.close());

  const get = (who: string, url: string) => c.http().get(api(url)).set(c.bearer(who));
  const post = (who: string, url: string, body: object = {}) => c.http().post(api(url)).set(c.bearer(who)).send(body);
  const put = (who: string, url: string, body: object = {}) => c.http().put(api(url)).set(c.bearer(who)).send(body);
  const patch = (who: string, url: string, body: object = {}) => c.http().patch(api(url)).set(c.bearer(who)).send(body);
  const audit = (action: string, resourceId?: string) =>
    c.w.sql.query<{ metadata: Record<string, unknown>; outcome: string; reason: string | null; actor_id: string }>(
      `SELECT metadata, outcome, reason, actor_id FROM audit_log WHERE action = $1${resourceId ? ' AND resource_id = $2' : ''} ORDER BY occurred_at`, resourceId ? [action, resourceId] : [action],
    );
  const order = async (over: Record<string, unknown> = {}, who = 'medecin') =>
    (await post(who, '/imaging/orders', { patientId: ids.patients[0], examTypeId: rx, clinicalQuestion: 'Toux persistante depuis 3 semaines.', ...over }).expect(201)).body as { id: string; number: string; status: string };
  const perform = (id: string, body: object = {}, who = 'radio') => post(who, `/imaging/orders/${id}/perform`, { pregnant: false, contrastAllergy: false, ...body });
  const performed = async (over: Record<string, unknown> = {}) => { const o = await order(over); await perform(o.id).expect(200); return o; };
  const draft = (id: string, body: object = {}, who = 'radio') => put(who, `/imaging/orders/${id}/report-draft`, { technique: 'Face, debout.', findings: 'Opacité alvéolaire du lobe inférieur droit.', impression: 'Pneumopathie.', ...body });
  const call = { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', readBackConfirmed: true };

  describe("contrôle d'accès", () => {
    it('sans jeton → 401 partout', async () => {
      for (const [method, url] of [['get', '/imaging/exam-types'], ['post', '/imaging/exam-types'], ['get', '/imaging/orders'], ['post', '/imaging/orders'], ['get', `/imaging/orders/${UNKNOWN}`]] as const) {
        expect([url, (await c.http()[method](api(url))).status]).toEqual([url, 401]);
      }
    });

    it('le catalogue est lu par les médecins, le radiologue et l\'administrateur ; modifié par l\'administrateur seul', async () => {
      for (const who of ['medecin', 'radio', 'admin']) expect([who, (await get(who, '/imaging/exam-types')).status]).toEqual([who, 200]);
      for (const who of ['accueil', 'caisse', 'infirmier', 'labo', 'pharmacien', 'comptable', 'patient']) expect([who, (await get(who, '/imaging/exam-types')).status]).toEqual([who, 403]);
      const body = { code: 'X', name: 'X', modality: 'XRAY' };
      for (const who of ['medecin', 'radio', 'accueil', 'labo']) expect([who, (await post(who, '/imaging/exam-types', body)).status]).toEqual([who, 403]);
      for (const who of ['medecin', 'radio']) {
        expect([who, (await patch(who, `/imaging/exam-types/${rx}`, { name: 'Y' })).status]).toEqual([who, 403]);
        expect([who, (await post(who, `/imaging/exam-types/${rx}/deactivate`)).status]).toEqual([who, 403]);
      }
    });

    it('les demandes : ni l\'accueil, ni la caisse, ni l\'infirmier, ni le laboratoire, ni la pharmacie, ni le patient', async () => {
      for (const who of ['accueil', 'caisse', 'infirmier', 'labo', 'pharmacien', 'comptable', 'patient']) {
        expect([who, (await get(who, '/imaging/orders')).status]).toEqual([who, 403]);
        expect([who, (await post(who, '/imaging/orders', { patientId: ids.patients[0], examTypeId: rx, clinicalQuestion: 'x' })).status]).toEqual([who, 403]);
      }
    });

    it('seul le radiologue planifie, réalise, rédige, appelle et signe', async () => {
      const o = await order();
      const actions: [string, string, object][] = [
        ['post', 'schedule', { scheduledFor: future(2) }], ['post', 'perform', { pregnant: false, contrastAllergy: false }], ['put', 'report-draft', { findings: 'x' }],
        ['post', 'critical-communication', call], ['post', 'report/sign', {}], ['post', 'report/addendum', { reason: 'x', findings: 'x', impression: 'x' }],
      ];
      for (const who of ['medecin', 'admin', 'accueil', 'infirmier', 'labo', 'patient']) {
        for (const [method, action, body] of actions) {
          const res = await c.http()[method as 'post' | 'put'](api(`/imaging/orders/${o.id}/${action}`)).set(c.bearer(who)).send(body);
          expect([who, action, res.status]).toEqual([who, action, 403]);
        }
      }
    });
  });

  describe('catalogue', () => {
    it('crée, lit, modifie ; le code et la modalité ne changent pas', async () => {
      const r = await post('admin', '/imaging/exam-types', { code: ' irm-cerveau ', name: 'IRM cérébrale', modality: 'MRI', durationMinutes: 40 }).expect(201);
      expect(r.body).toMatchObject({ code: 'IRM-CERVEAU', modality: 'MRI', usesContrast: false, durationMinutes: 40, bodyPart: null, preparation: null, active: true });
      // Le code et la modalité envoyés en trop sont ignorés : ils ne changent jamais.
      const ignored = await patch('admin', `/imaging/exam-types/${r.body.id}`, { code: 'AUTRE', modality: 'CT' }).expect(200);
      expect(ignored.body).toMatchObject({ code: 'IRM-CERVEAU', modality: 'MRI' });
      const ok = await patch('admin', `/imaging/exam-types/${r.body.id}`, { name: 'IRM cérébrale (T1)', bodyPart: 'Crâne', usesContrast: true, preparation: 'Retirer les objets métalliques.' }).expect(200);
      expect(ok.body).toMatchObject({ code: 'IRM-CERVEAU', modality: 'MRI', name: 'IRM cérébrale (T1)', bodyPart: 'Crâne', usesContrast: true });
      expect((await get('medecin', `/imaging/exam-types/${r.body.id}`).expect(200)).body).toMatchObject({ name: 'IRM cérébrale (T1)' });
      expect((await audit('imaging.exam-type.update', r.body.id))[0].metadata).toMatchObject({ code: 'IRM-CERVEAU', changed: 'name,bodyPart,usesContrast,preparation' });
      await patch('admin', `/imaging/exam-types/${r.body.id}`, { bodyPart: null, preparation: '' }).expect(200);
      expect((await get('admin', `/imaging/exam-types/${r.body.id}`).expect(200)).body).toMatchObject({ bodyPart: null, preparation: null });
    });

    it('refuse un code déjà pris, un code ou une modalité invalide, une durée hors limites', async () => {
      expect((await post('admin', '/imaging/exam-types', { code: 'rx-thorax', name: 'Autre', modality: 'XRAY' }).expect(409)).body.code).toBe('IMG_EXAM_CODE_ALREADY_EXISTS');
      expect((await post('admin', '/imaging/exam-types', { code: 'a b', name: 'Autre', modality: 'XRAY' }).expect(422)).body.code).toBe('IMG_EXAM_CODE_INVALID');
      await post('admin', '/imaging/exam-types', { code: 'Z1', name: 'Autre', modality: 'PET' }).expect(400);
      await post('admin', '/imaging/exam-types', { code: 'Z1', name: 'Autre', modality: 'XRAY', durationMinutes: 3 }).expect(400);
      await post('admin', '/imaging/exam-types', { code: 'Z1', modality: 'XRAY' }).expect(400);
      await get('admin', `/imaging/exam-types/${UNKNOWN}`).expect(404);
      await get('admin', '/imaging/exam-types/pas-un-uuid').expect(400);
      expect((await get('admin', `/imaging/exam-types/${UNKNOWN}`)).body.code).toBe('IMG_EXAM_NOT_FOUND');
    });

    it('liste : actifs par défaut, filtres cumulables, examens retirés sur demande ; le retrait est réversible et journalisé', async () => {
      const r = await post('admin', '/imaging/exam-types', { code: 'MAMMO', name: 'Mammographie', modality: 'MAMMOGRAPHY' }).expect(201);
      const codes = async (query: string) => ((await get('medecin', `/imaging/exam-types${query}`).expect(200)).body.items as { code: string }[]).map((e) => e.code);
      expect(await codes('?modality=mammography')).toEqual(['MAMMO']);
      expect(await codes('?search=thorax&modality=XRAY')).toEqual(['RX-THORAX']);
      expect(await codes('?search=écho')).toEqual(['ECHO-ABD']);
      await post('admin', `/imaging/exam-types/${r.body.id}/deactivate`).expect(200);
      await post('admin', `/imaging/exam-types/${r.body.id}/deactivate`).expect(200);
      expect(await codes('?modality=MAMMOGRAPHY')).toEqual([]);
      expect(await codes('?modality=MAMMOGRAPHY&includeInactive=true')).toEqual(['MAMMO']);
      expect((await post('admin', `/imaging/exam-types/${r.body.id}/activate`).expect(200)).body.active).toBe(true);
      expect((await audit('imaging.exam-type.deactivate', r.body.id))).toHaveLength(1);
      expect((await get('medecin', '/imaging/exam-types?modality=PET')).status).toBe(422);
      expect((await get('medecin', '/imaging/exam-types?limit=1').expect(200)).body).toMatchObject({ limit: 1, offset: 0 });
    });
  });

  describe('demande', () => {
    it('le médecin demande un examen ; la demande est « ORDERED » avec son numéro, l\'audit ne contient pas la question', async () => {
      const r = await post('medecin', '/imaging/orders', { patientId: ids.patients[0], examTypeId: rx, clinicalQuestion: 'Douleur thoracique après chute.', priority: 'URGENT', source: 'ER' }).expect(201);
      expect(r.body).toMatchObject({
        status: 'ORDERED', number: expect.stringMatching(/^IMG-\d{7}$/), priority: 'URGENT', source: 'ER', examCode: 'RX-THORAX', modality: 'XRAY', clinicalQuestion: 'Douleur thoracique après chute.',
        patient: { number: expect.any(String) }, orderedBy: { username: 'medecin' }, encounterId: null, scheduledFor: null, performedAt: null,
        report: { draft: null, versions: [], communications: [], criticalRequired: false, criticalCommunicated: false },
      });
      const entry = (await audit('imaging.order.create', r.body.id))[0];
      expect(entry.metadata).toMatchObject({ orderNumber: r.body.number, examCode: 'RX-THORAX', modality: 'XRAY', priority: 'URGENT' });
      expect(JSON.stringify(entry.metadata)).not.toContain('chute');
    });

    it('refuse une demande incomplète ou invalide, sans rien écrire', async () => {
      const bad = (body: object) => post('medecin', '/imaging/orders', body);
      await bad({ examTypeId: rx, clinicalQuestion: 'x' }).expect(400);
      await bad({ patientId: ids.patients[0], clinicalQuestion: 'x' }).expect(400);
      await bad({ patientId: ids.patients[0], examTypeId: rx }).expect(400);
      await bad({ patientId: ids.patients[0], examTypeId: rx, clinicalQuestion: '' }).expect(400);
      await bad({ patientId: ids.patients[0], examTypeId: rx, clinicalQuestion: 'x'.repeat(501) }).expect(400);
      expect((await bad({ patientId: ids.patients[0], examTypeId: rx, clinicalQuestion: '   ' }).expect(422)).body.code).toBe('IMG_CLINICAL_QUESTION_REQUIRED');
      await bad({ patientId: ids.patients[0], examTypeId: rx, clinicalQuestion: 'x', priority: 'ASAP' }).expect(400);
      expect((await bad({ patientId: UNKNOWN, examTypeId: rx, clinicalQuestion: 'x' }).expect(404)).body.code).toBe('IMG_PATIENT_NOT_FOUND');
      expect((await bad({ patientId: ids.patients[0], examTypeId: UNKNOWN, clinicalQuestion: 'x' }).expect(404)).body.code).toBe('IMG_EXAM_NOT_FOUND');
    });

    it('refuse un examen retiré du catalogue (409) ; une fois remis, il se redemande', async () => {
      const e = (await post('admin', '/imaging/exam-types', { code: 'TMP', name: 'Provisoire', modality: 'ULTRASOUND' }).expect(201)).body.id as string;
      await post('admin', `/imaging/exam-types/${e}/deactivate`).expect(200);
      expect((await post('medecin', '/imaging/orders', { patientId: ids.patients[0], examTypeId: e, clinicalQuestion: 'x' }).expect(409)).body.code).toBe('IMG_EXAM_INACTIVE');
      await post('admin', `/imaging/exam-types/${e}/activate`).expect(200);
      await post('medecin', '/imaging/orders', { patientId: ids.patients[0], examTypeId: e, clinicalQuestion: 'x' }).expect(201);
    });

    it('la demande porte l\'indication de produit de contraste et la préparation du catalogue', async () => {
      expect((await get('radio', `/imaging/orders/${(await order({ examTypeId: scan })).id}`).expect(200)).body).toMatchObject({ usesContrast: true, preparation: null });
      expect((await get('radio', `/imaging/orders/${(await order({ examTypeId: echo })).id}`).expect(200)).body).toMatchObject({ usesContrast: false, preparation: 'À jeun depuis 6 heures.' });
    });

    it('une demande déjà faite garde le code et le libellé copiés même si le catalogue change', async () => {
      const e = (await post('admin', '/imaging/exam-types', { code: 'COPIE', name: 'Avant', modality: 'XRAY' }).expect(201)).body.id as string;
      const o = await order({ examTypeId: e });
      await patch('admin', `/imaging/exam-types/${e}`, { name: 'Après' }).expect(200);
      expect((await get('medecin', `/imaging/orders/${o.id}`).expect(200)).body).toMatchObject({ examCode: 'COPIE', examName: 'Avant' });
    });
  });

  describe('visibilité', () => {
    it('un prescripteur ne voit que ses demandes (« introuvable » pour celles des autres) ; le radiologue et l\'administrateur voient tout', async () => {
      const mine = await order({}, 'medecin');
      const theirs = await order({ patientId: ids.patients[1] }, 'medecin2');
      for (const who of ['medecin', 'medecin2']) {
        const listed = ((await get(who, '/imaging/orders?limit=200').expect(200)).body.items as { id: string; orderedBy: { username: string } }[]);
        expect(listed.every((i) => i.orderedBy.username === who)).toBe(true);
      }
      expect((await get('medecin', `/imaging/orders/${theirs.id}`).expect(404)).body.code).toBe('IMG_ORDER_NOT_FOUND');
      expect((await get('medecin2', `/imaging/orders/${mine.id}`).expect(404)).body.code).toBe('IMG_ORDER_NOT_FOUND');
      for (const who of ['radio', 'radio2', 'admin']) {
        expect([who, (await get(who, `/imaging/orders/${mine.id}`)).status]).toEqual([who, 200]);
        expect([who, (await get(who, `/imaging/orders/${theirs.id}`)).status]).toEqual([who, 200]);
      }
      await get('medecin', '/imaging/orders/pas-un-uuid').expect(400);
      await get('radio', `/imaging/orders/${UNKNOWN}`).expect(404);
    });

    it('un médecin ne peut ni planifier, ni annuler, ni compléter la demande d\'un confrère', async () => {
      const theirs = await order({ patientId: ids.patients[1] }, 'medecin2');
      expect((await post('medecin', `/imaging/orders/${theirs.id}/cancel`, { reason: 'Test' }).expect(404)).body.code).toBe('IMG_ORDER_NOT_FOUND');
      expect((await get('radio', `/imaging/orders/${theirs.id}`).expect(200)).body.status).toBe('ORDERED');
    });
  });

  describe('liste et filtres', () => {
    it('les actives d\'abord (STAT, urgent, routine, la plus ancienne en tête), puis les terminées ; filtres cumulables', async () => {
      const routine = await order({ patientId: ids.patients[2], examTypeId: echo, priority: 'ROUTINE' });
      const stat = await order({ patientId: ids.patients[2], examTypeId: echo, priority: 'STAT', source: 'ER' });
      const done = await order({ patientId: ids.patients[2], examTypeId: echo });
      await post('medecin', `/imaging/orders/${done.id}/cancel`, { reason: 'Doublon' }).expect(200);
      const items = (await get('radio', `/imaging/orders?patientId=${ids.patients[2]}`).expect(200)).body.items as { id: string; status: string; priority: string }[];
      expect(items.map((i) => i.id)).toEqual([stat.id, routine.id, done.id]);
      const only = async (query: string) => ((await get('radio', `/imaging/orders?patientId=${ids.patients[2]}&${query}`).expect(200)).body.items as { id: string }[]).map((i) => i.id);
      expect(await only('status=CANCELLED')).toEqual([done.id]);
      expect(await only('priority=stat')).toEqual([stat.id]);
      expect(await only('source=er&modality=ultrasound')).toEqual([stat.id]);
      expect(await only(`number=${routine.number}`)).toEqual([routine.id]);
      expect(await only('modality=MRI')).toEqual([]);
      expect((await get('radio', '/imaging/orders?status=ZZZ')).status).toBe(422);
      expect((await get('radio', '/imaging/orders?modality=PET')).status).toBe(422);
      expect((await get('radio', '/imaging/orders?number=LAB-1')).status).toBe(422);
      expect((await audit('imaging.order.list'))[0].metadata).toHaveProperty('returned');
    });
  });

  describe('lien avec la consultation', () => {
    const arrive = async (patient = 0): Promise<string> => (await post('accueil', '/admissions', { patientId: ids.patients[patient], type: 'OUTPATIENT', serviceId: ids.ped }).expect(201)).body.id as string;
    const open = async (patient = 0): Promise<{ id: string }> => (await post('medecin', '/clinical/encounters', { admissionId: await arrive(patient) }).expect(201)).body;

    it('rattache la demande à la consultation, la retrouve par consultation, le journal garde le lien', async () => {
      const e = await open(0);
      const o = await order({ encounterId: e.id });
      expect(o).toMatchObject({ id: expect.any(String) });
      expect((await get('medecin', `/imaging/orders/${o.id}`).expect(200)).body.encounterId).toBe(e.id);
      expect((await audit('imaging.order.create', o.id))[0].metadata).toMatchObject({ encounterId: e.id });
      const other = await order();
      const listed = (await get('medecin', `/imaging/orders?encounterId=${e.id}`).expect(200)).body.items as { id: string }[];
      expect(listed.map((i) => i.id)).toEqual([o.id]);
      expect(listed.map((i) => i.id)).not.toContain(other.id);
    });

    it('refuse une consultation introuvable (404), d\'un autre patient (409) ou annulée (409)', async () => {
      const e = await open(0);
      expect((await post('medecin', '/imaging/orders', { patientId: ids.patients[0], examTypeId: rx, clinicalQuestion: 'x', encounterId: UNKNOWN }).expect(404)).body.code).toBe('IMG_ENCOUNTER_NOT_FOUND');
      expect((await post('medecin', '/imaging/orders', { patientId: ids.patients[2], examTypeId: rx, clinicalQuestion: 'x', encounterId: e.id }).expect(409)).body.code).toBe('IMG_ENCOUNTER_PATIENT_MISMATCH');
      const cancelled = await open(1);
      await post('medecin', `/clinical/encounters/${cancelled.id}/cancel`, { reason: 'Erreur' }).expect(200);
      expect((await post('medecin', '/imaging/orders', { patientId: ids.patients[1], examTypeId: rx, clinicalQuestion: 'x', encounterId: cancelled.id }).expect(409)).body.code).toBe('IMG_ENCOUNTER_CANCELLED');
      await post('medecin', '/imaging/orders', { patientId: ids.patients[0], examTypeId: rx, clinicalQuestion: 'x', encounterId: 'pas-un-uuid' }).expect(400);
      expect((await get('medecin', `/imaging/orders?encounterId=${cancelled.id}`).expect(200)).body.items).toEqual([]);
    });
  });

  describe('planification, annulation', () => {
    it('le radiologue planifie puis replanifie ; le créneau passé est refusé ; tout est journalisé', async () => {
      const o = await order();
      const r = await post('radio', `/imaging/orders/${o.id}/schedule`, { scheduledFor: future(2, 9) }).expect(200);
      expect(r.body).toMatchObject({ status: 'SCHEDULED', scheduledFor: expect.any(String), scheduledBy: { username: 'radio' } });
      const again = await post('radio2', `/imaging/orders/${o.id}/schedule`, { scheduledFor: future(3, 14) }).expect(200);
      expect(again.body.scheduledBy.username).toBe('radio2');
      expect(new Date(again.body.scheduledFor).getTime()).toBe(new Date(future(3, 14)).getTime());
      expect((await post('radio', `/imaging/orders/${o.id}/schedule`, { scheduledFor: new Date(Date.now() - 3_600_000).toISOString() }).expect(409)).body.code).toBe('IMG_SCHEDULE_IN_PAST');
      expect((await post('radio', `/imaging/orders/${o.id}/schedule`, { scheduledFor: 'demain matin' }).expect(422)).body.code).toBe('IMG_SCHEDULE_INVALID');
      await post('radio', `/imaging/orders/${o.id}/schedule`, {}).expect(400);
      expect((await audit('imaging.order.schedule', o.id))).toHaveLength(2);
      expect((await get('medecin', `/imaging/orders/${o.id}`).expect(200)).body.status).toBe('SCHEDULED');
    });

    it('le prescripteur annule sa demande, le radiologue n\'importe laquelle ; motif obligatoire ; pas deux fois ; pas après l\'examen', async () => {
      const a = await order();
      await post('medecin', `/imaging/orders/${a.id}/cancel`, {}).expect(400);
      await post('medecin', `/imaging/orders/${a.id}/cancel`, { reason: '   ' }).expect(422);
      const r = await post('medecin', `/imaging/orders/${a.id}/cancel`, { reason: 'Examen demandé en double.' }).expect(200);
      expect(r.body).toMatchObject({ status: 'CANCELLED', cancelledBy: { username: 'medecin' }, cancellationReason: 'Examen demandé en double.' });
      expect((await post('medecin', `/imaging/orders/${a.id}/cancel`, { reason: 'Encore' }).expect(409)).body.code).toBe('IMG_ORDER_CANCELLED');
      expect((await post('radio', `/imaging/orders/${a.id}/schedule`, { scheduledFor: future(2) }).expect(409)).body.code).toBe('IMG_ORDER_CANCELLED');
      expect((await perform(a.id).expect(409)).body.code).toBe('IMG_ORDER_CANCELLED');
      expect((await audit('imaging.order.cancel', a.id))[0].reason).toBe('Examen demandé en double.');
      const b = await order({ patientId: ids.patients[1] }, 'medecin2');
      await post('radio', `/imaging/orders/${b.id}/cancel`, { reason: 'Contre-indication connue.' }).expect(200);
      const c2 = await performed();
      expect((await post('medecin', `/imaging/orders/${c2.id}/cancel`, { reason: 'Trop tard' }).expect(409)).body.code).toBe('IMG_ORDER_ALREADY_PERFORMED');
    });
  });

  describe('réalisation et dépistage de sécurité', () => {
    it('réalise sans planification (urgence) : « PERFORMED » avec dépistage, technicien et note ; le médecin ne voit pas le dépistage', async () => {
      const o = await order({ priority: 'STAT' });
      const r = await perform(o.id, { techniqueNote: 'Au lit du patient.' }).expect(200);
      expect(r.body).toMatchObject({ status: 'PERFORMED', performedBy: { username: 'radio' }, techniqueNote: 'Au lit du patient.', screening: { pregnant: false, contrastAllergy: false, overrideReason: null } });
      const asDoctor = (await get('medecin', `/imaging/orders/${o.id}`).expect(200)).body;
      expect(asDoctor).toMatchObject({ status: 'PERFORMED', screening: null });
      expect((await audit('imaging.order.perform', o.id))[0]).toMatchObject({ outcome: 'SUCCESS', metadata: { overridden: false } });
      expect((await perform(o.id).expect(409)).body.code).toBe('IMG_ORDER_ALREADY_PERFORMED');
    });

    it('grossesse + examen irradiant : refusé sans motif (409), tentative journalisée sans la nature ; accepté avec un motif conservé', async () => {
      const o = await order();
      const blocked = await perform(o.id, { pregnant: true }).expect(409);
      expect(blocked.body.code).toBe('IMG_PREGNANCY_RISK');
      expect((await get('radio', `/imaging/orders/${o.id}`).expect(200)).body.status).toBe('ORDERED');
      const failure = (await audit('imaging.order.perform', o.id)).find((e) => e.outcome === 'FAILURE')!;
      expect(failure.metadata).toMatchObject({ blocked: true });
      expect(JSON.stringify(failure)).not.toMatch(/pregnan|PREGNANCY|allerg/i);
      const ok = await perform(o.id, { pregnant: true, overrideReason: 'Urgence vitale : bénéfice supérieur au risque.' }).expect(200);
      expect(ok.body.screening).toEqual({ pregnant: true, contrastAllergy: false, overrideReason: 'Urgence vitale : bénéfice supérieur au risque.' });
      const success = (await audit('imaging.order.perform', o.id)).find((e) => e.outcome === 'SUCCESS')!;
      expect(success.metadata).toMatchObject({ overridden: true });
      expect(JSON.stringify(success)).not.toContain('Urgence vitale');
    });

    it('allergie + scanner avec produit de contraste : refusé sans motif ; allergie avec une radio simple : rien à lever', async () => {
      const ct = await order({ examTypeId: scan });
      expect((await perform(ct.id, { contrastAllergy: true }).expect(409)).body.code).toBe('IMG_CONTRAST_ALLERGY');
      await perform(ct.id, { contrastAllergy: true, overrideReason: 'Prémédication par corticoïdes faite.' }).expect(200);
      const plain = await order();
      expect((await perform(plain.id, { contrastAllergy: true }).expect(200)).body.screening).toEqual({ pregnant: false, contrastAllergy: true, overrideReason: null });
    });

    it('grossesse + échographie : aucune contre-indication', async () => {
      const o = await order({ examTypeId: echo });
      expect((await perform(o.id, { pregnant: true }).expect(200)).body.status).toBe('PERFORMED');
    });

    it('le dépistage est obligatoire ; textes limités', async () => {
      const o = await order();
      await post('radio', `/imaging/orders/${o.id}/perform`, {}).expect(400);
      await post('radio', `/imaging/orders/${o.id}/perform`, { pregnant: 'non', contrastAllergy: false }).expect(400);
      await perform(o.id, { techniqueNote: 'x'.repeat(501) }).expect(400);
      await perform(o.id, { overrideReason: 'x'.repeat(201) }).expect(400);
      await perform(UNKNOWN).expect(404);
    });

    it('deux radiologues qui réalisent en même temps : un seul l\'emporte', async () => {
      const o = await order();
      const results = await Promise.all([perform(o.id, {}, 'radio'), perform(o.id, {}, 'radio2')]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });
  });

  describe('compte rendu', () => {
    it('brouillon : seulement après la réalisation ; invisible du prescripteur ; remplacé à chaque enregistrement', async () => {
      const o = await order();
      expect((await draft(o.id).expect(409)).body.code).toBe('IMG_REPORT_NOT_DRAFTABLE');
      await perform(o.id).expect(200);
      const first = await draft(o.id).expect(200);
      expect(first.body.report.draft).toMatchObject({ technique: 'Face, debout.', findings: 'Opacité alvéolaire du lobe inférieur droit.', impression: 'Pneumopathie.', critical: false, by: { username: 'radio' } });
      const second = await draft(o.id, { findings: 'Opacité franche.', critical: false }, 'radio2').expect(200);
      expect(second.body.report.draft).toMatchObject({ findings: 'Opacité franche.', by: { username: 'radio2' } });
      const asDoctor = (await get('medecin', `/imaging/orders/${o.id}`).expect(200)).body;
      expect(asDoctor.report).toEqual({ draft: null, versions: [], communications: [], criticalRequired: false, criticalCommunicated: false });
      expect(JSON.stringify(asDoctor)).not.toContain('Opacité');
      await draft(o.id, { findings: 'x'.repeat(8001) }).expect(400);
      await draft(o.id, { critical: 'oui' }).expect(400);
      await draft(UNKNOWN).expect(404);
    });

    it('signe : constatations et impression obligatoires ; le prescripteur lit alors le compte rendu ; l\'audit n\'en contient pas le texte', async () => {
      const o = await performed();
      expect((await post('radio', `/imaging/orders/${o.id}/report/sign`).expect(409)).body.code).toBe('IMG_REPORT_INCOMPLETE');
      await draft(o.id, { impression: '' }).expect(200);
      expect((await post('radio', `/imaging/orders/${o.id}/report/sign`).expect(409)).body.code).toBe('IMG_REPORT_INCOMPLETE');
      await draft(o.id).expect(200);
      const r = await post('radio', `/imaging/orders/${o.id}/report/sign`).expect(200);
      expect(r.body.status).toBe('REPORTED');
      expect(r.body.report.draft).toBeNull();
      expect(r.body.report.versions).toEqual([expect.objectContaining({ version: 1, findings: 'Opacité alvéolaire du lobe inférieur droit.', impression: 'Pneumopathie.', reason: null, critical: false, signedBy: { id: expect.any(String), username: 'radio' } })]);
      const asDoctor = (await get('medecin', `/imaging/orders/${o.id}`).expect(200)).body;
      expect(asDoctor.status).toBe('REPORTED');
      expect(asDoctor.report.versions).toHaveLength(1);
      const entry = (await audit('imaging.report.sign', o.id))[0];
      expect(entry.metadata).toMatchObject({ critical: false, version: 1 });
      expect(JSON.stringify(entry)).not.toContain('Opacité');
      expect((await post('radio', `/imaging/orders/${o.id}/report/sign`).expect(409)).body.code).toBe('IMG_REPORT_NOT_SIGNABLE');
      expect((await draft(o.id).expect(409)).body.code).toBe('IMG_REPORT_NOT_DRAFTABLE');
      expect((await post('radio', `/imaging/orders/${(await order()).id}/report/sign`).expect(409)).body.code).toBe('IMG_REPORT_NOT_SIGNABLE');
    });

    it('découverte critique : signature refusée sans appel documenté ; relecture obligatoire ; puis signée avec l\'appel visible du prescripteur', async () => {
      const o = await performed();
      const d = await draft(o.id, { findings: 'Pneumothorax sous tension.', impression: 'Pneumothorax gauche complet.', critical: true }).expect(200);
      expect(d.body.report).toMatchObject({ criticalRequired: true, criticalCommunicated: false });
      expect((await post('radio', `/imaging/orders/${o.id}/report/sign`).expect(409)).body.code).toBe('IMG_CRITICAL_NOT_COMMUNICATED');
      expect((await audit('imaging.report.sign', o.id))[0]).toMatchObject({ outcome: 'FAILURE', metadata: { critical: true, blocked: true } });
      expect((await post('radio', `/imaging/orders/${o.id}/critical-communication`, { ...call, readBackConfirmed: false }).expect(422)).body.code).toBe('IMG_READ_BACK_REQUIRED');
      await post('radio', `/imaging/orders/${o.id}/critical-communication`, { ...call, method: 'FAX' }).expect(400);
      await post('radio', `/imaging/orders/${o.id}/critical-communication`, { ...call, notifiedName: '' }).expect(400);
      await post('radio', `/imaging/orders/${o.id}/critical-communication`, { notifiedName: 'Dr Curie' }).expect(400);
      const noted = await post('radio', `/imaging/orders/${o.id}/critical-communication`, call).expect(200);
      expect(noted.body.report).toMatchObject({ criticalRequired: true, criticalCommunicated: true });
      const signed = await post('radio2', `/imaging/orders/${o.id}/report/sign`).expect(200);
      expect(signed.body.report.versions[0]).toMatchObject({ critical: true });
      const asDoctor = (await get('medecin', `/imaging/orders/${o.id}`).expect(200)).body;
      expect(asDoctor.report.communications).toEqual([expect.objectContaining({ version: 1, notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE', by: { id: expect.any(String), username: 'radio' } })]);
      expect((await get('radio', `/imaging/orders?patientId=${ids.patients[0]}&status=REPORTED`).expect(200)).body.items.find((i: { id: string }) => i.id === o.id).critical).toBe(true);
      expect((await audit('imaging.report.critical-communication', o.id))).toHaveLength(2 - 1);
    });

    it('un appel n\'a de sens que pour un brouillon critique', async () => {
      const o = await performed();
      expect((await post('radio', `/imaging/orders/${o.id}/critical-communication`, call).expect(409)).body.code).toBe('IMG_REPORT_NOT_CRITICAL');
      await draft(o.id).expect(200);
      expect((await post('radio', `/imaging/orders/${o.id}/critical-communication`, call).expect(409)).body.code).toBe('IMG_REPORT_NOT_CRITICAL');
      expect((await post('radio', `/imaging/orders/${(await order()).id}/critical-communication`, call).expect(409)).body.code).toBe('IMG_REPORT_NOT_CRITICAL');
    });

    it('addendum : nouvelle version signée avec son motif ; la première reste lisible ; seulement après signature', async () => {
      const o = await performed();
      const body = { reason: 'Découverte complémentaire.', findings: 'Nodule du lobe supérieur gauche.', impression: 'Pneumopathie et nodule.' };
      expect((await post('radio', `/imaging/orders/${o.id}/report/addendum`, body).expect(409)).body.code).toBe('IMG_REPORT_NOT_SIGNED');
      await draft(o.id).expect(200);
      await post('radio', `/imaging/orders/${o.id}/report/sign`).expect(200);
      await post('radio', `/imaging/orders/${o.id}/report/addendum`, { ...body, reason: '' }).expect(400);
      await post('radio', `/imaging/orders/${o.id}/report/addendum`, { reason: 'Motif' }).expect(409);
      const r = await post('radio2', `/imaging/orders/${o.id}/report/addendum`, body).expect(200);
      expect(r.body.report.versions.map((v: { version: number; reason: string | null; signedBy: { username: string } }) => [v.version, v.reason, v.signedBy.username])).toEqual([[1, null, 'radio'], [2, 'Découverte complémentaire.', 'radio2']]);
      expect(r.body.report.versions[0].findings).toBe('Opacité alvéolaire du lobe inférieur droit.');
      expect((await get('medecin', `/imaging/orders/${o.id}`).expect(200)).body.report.versions).toHaveLength(2);
      const entry = (await audit('imaging.report.addendum', o.id))[0];
      expect(entry.metadata).toMatchObject({ version: 2, critical: false });
      expect(JSON.stringify(entry)).not.toContain('Nodule');
      expect(entry.reason).toBeNull();
    });

    it('un addendum critique exige l\'appel du clinicien, relecture comprise', async () => {
      const o = await performed();
      await draft(o.id).expect(200);
      await post('radio', `/imaging/orders/${o.id}/report/sign`).expect(200);
      const body = { reason: 'Embolie découverte à la relecture.', findings: 'Défaut de remplissage de l\'artère pulmonaire droite.', impression: 'Embolie pulmonaire.', critical: true };
      expect((await post('radio', `/imaging/orders/${o.id}/report/addendum`, body).expect(409)).body.code).toBe('IMG_CRITICAL_NOT_COMMUNICATED');
      expect((await post('radio', `/imaging/orders/${o.id}/report/addendum`, { ...body, communication: { ...call, readBackConfirmed: false } }).expect(422)).body.code).toBe('IMG_READ_BACK_REQUIRED');
      const r = await post('radio', `/imaging/orders/${o.id}/report/addendum`, { ...body, communication: call }).expect(200);
      expect(r.body.report.versions).toHaveLength(2);
      expect(r.body.report.communications).toEqual([expect.objectContaining({ version: 2 })]);
    });
  });

  describe('garde-fous en base', () => {
    it('les versions signées et les appels documentés sont en ajout seul ; une demande annulée garde son motif', async () => {
      const o = await performed();
      await draft(o.id, { critical: true }).expect(200);
      await post('radio', `/imaging/orders/${o.id}/critical-communication`, call).expect(200);
      await post('radio', `/imaging/orders/${o.id}/report/sign`).expect(200);
      await expect(c.w.sql.query('UPDATE imaging_report_versions SET findings = $1 WHERE order_id = $2', ['Réécrit', o.id])).rejects.toThrow(/ajout seul/);
      await expect(c.w.sql.query('DELETE FROM imaging_report_versions WHERE order_id = $1', [o.id])).rejects.toThrow(/ajout seul/);
      await expect(c.w.sql.query('TRUNCATE imaging_report_versions')).rejects.toThrow(/ajout seul/);
      await expect(c.w.sql.query('UPDATE imaging_critical_communications SET notified_name = $1 WHERE order_id = $2', ['Autre', o.id])).rejects.toThrow(/ajout seul/);
      await expect(c.w.sql.query('DELETE FROM imaging_critical_communications WHERE order_id = $1', [o.id])).rejects.toThrow(/ajout seul/);
      await expect(c.w.sql.query("UPDATE imaging_orders SET status = 'CANCELLED' WHERE id = $1", [o.id])).rejects.toThrow();
      await expect(c.w.sql.query("INSERT INTO imaging_critical_communications (order_id, seq, version, notified_name, notified_role, method, read_back, at, by) VALUES ($1, 9, 1, 'X', 'Y', 'PHONE', false, now(), $2)", [o.id, o.id])).rejects.toThrow();
    });
  });
});
