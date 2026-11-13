import { ExamType } from '../../src/modules/imaging/domain/exam-type';
import { ImagingOrder, NewOrder } from '../../src/modules/imaging/domain/order';
import {
  ExamCode, ExamName, ExamTypeId, isIonizing, OrderId, OrderNumber, parseMethod, parseModality, parsePriority, parseSource, PatientRef, Reason,
} from '../../src/modules/imaging/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';

const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const DOC = uuid(10);
const RAD = uuid(20);

function newOrder(over: Partial<NewOrder> = {}): ImagingOrder {
  return must(ImagingOrder.order({
    id: must(OrderId.create(uuid(1))), number: must(OrderNumber.fromSequence(1)), patientId: must(PatientRef.create(uuid(2))), examTypeId: must(ExamTypeId.create(uuid(3))),
    examCode: must(ExamCode.create('RX-THORAX')), examName: must(ExamName.create('Radiographie du thorax')), modality: 'XRAY', priority: 'ROUTINE', source: 'OPD',
    clinicalQuestion: 'Toux persistante.', encounterId: null, orderedBy: DOC, orderedAt: NOW, ...over,
  }));
}

const perform = (o: ImagingOrder, over: Partial<{ pregnant: boolean; contrastAllergy: boolean; overrideReason: string | null; techniqueNote: string | null }> = {}, usesContrast = false) =>
  o.perform({ by: RAD, at: LATER, pregnant: false, contrastAllergy: false, overrideReason: null, techniqueNote: null, ...over }, usesContrast);
const performed = () => { const o = newOrder(); must(perform(o)); return o; };
const draft = (o: ImagingOrder, over: Partial<{ technique: string | null; findings: string | null; impression: string | null; critical: boolean }> = {}) =>
  o.saveDraft({ technique: 'Face, debout.', findings: 'Opacité du lobe inférieur droit.', impression: 'Pneumopathie.', critical: false, ...over }, RAD, LATER);
const call = { notifiedName: 'Dr Curie', notifiedRole: 'Médecin de garde', method: 'PHONE' as const, readBackConfirmed: true };

describe('imagerie : valeurs et énumérations', () => {
  it('normalise les codes, refuse les invalides', () => {
    expect(must(ExamCode.create(' rx-thorax ')).value).toBe('RX-THORAX');
    for (const bad of ['', 'a b', '-X', 'x'.repeat(21), 'é']) expect(codeOf(ExamCode.create(bad))).toBe('IMG_EXAM_CODE_INVALID');
  });

  it('numéro de demande : format IMG-…, construit depuis une séquence', () => {
    expect(must(OrderNumber.fromSequence(42)).value).toBe('IMG-0000042');
    expect(codeOf(OrderNumber.create('LAB-0000001'))).toBe('IMG_ORDER_NUMBER_INVALID');
  });

  it('énumérations insensibles à la casse ; refus des valeurs inconnues', () => {
    expect(must(parseModality(' ct '))).toBe('CT');
    expect(must(parsePriority('stat'))).toBe('STAT');
    expect(must(parseSource('er'))).toBe('ER');
    expect(must(parseMethod('secure_message'))).toBe('SECURE_MESSAGE');
    expect(codeOf(parseModality('PET'))).toBe('IMG_MODALITY_INVALID');
    expect(codeOf(parseMethod('FAX'))).toBe('IMG_COMMUNICATION_METHOD_INVALID');
  });

  it('seules la radiographie, le scanner, la mammographie et la scopie sont irradiants', () => {
    expect(['XRAY', 'CT', 'MAMMOGRAPHY', 'FLUOROSCOPY'].every((m) => isIonizing(m as never))).toBe(true);
    expect(['ULTRASOUND', 'MRI', 'OTHER'].some((m) => isIonizing(m as never))).toBe(false);
  });
});

describe('imagerie : catalogue', () => {
  const create = (over: Partial<Parameters<typeof ExamType.create>[0]> = {}) =>
    ExamType.create({ id: must(ExamTypeId.create(uuid(3))), code: must(ExamCode.create('ECHO-ABD')), name: must(ExamName.create('Échographie abdominale')), modality: 'ULTRASOUND', bodyPart: 'Abdomen', usesContrast: false, durationMinutes: 30, preparation: null, ...over });

  it('crée un examen actif ; refuse une durée ou une région hors limites', () => {
    expect(must(create()).active).toBe(true);
    expect(codeOf(create({ durationMinutes: 4 }))).toBe('IMG_EXAM_DURATION_INVALID');
    expect(codeOf(create({ durationMinutes: 481 }))).toBe('IMG_EXAM_DURATION_INVALID');
    expect(codeOf(create({ durationMinutes: 20.5 }))).toBe('IMG_EXAM_DURATION_INVALID');
    expect(codeOf(create({ bodyPart: 'x'.repeat(61) }))).toBe('IMG_EXAM_BODY_PART_INVALID');
    expect(codeOf(create({ preparation: 'x'.repeat(501) }))).toBe('IMG_EXAM_PREPARATION_INVALID');
  });

  it('modifie sans toucher au code ni à la modalité ; refuse un état incohérent sans rien changer ; se désactive', () => {
    const exam = must(create());
    must(exam.update({ name: must(ExamName.create('Écho abdo')), durationMinutes: 45, preparation: 'À jeun.' }));
    expect(exam.state).toMatchObject({ code: { value: 'ECHO-ABD' }, modality: 'ULTRASOUND', durationMinutes: 45, preparation: 'À jeun.' });
    expect(codeOf(exam.update({ durationMinutes: 1 }))).toBe('IMG_EXAM_DURATION_INVALID');
    expect(exam.state.durationMinutes).toBe(45);
    exam.update({ bodyPart: null });
    expect(exam.state.bodyPart).toBeNull();
    exam.setActive(false);
    expect(exam.active).toBe(false);
  });
});

describe("imagerie : demande d'examen", () => {
  it('une nouvelle demande est « ORDERED » ; la question clinique est obligatoire', () => {
    expect(newOrder().status).toBe('ORDERED');
    expect(codeOf(ImagingOrder.order({ ...newOrder().state, clinicalQuestion: '   ' }))).toBe('IMG_CLINICAL_QUESTION_REQUIRED');
    expect(codeOf(ImagingOrder.order({ ...newOrder().state, clinicalQuestion: 'x'.repeat(501) }))).toBe('IMG_CLINICAL_QUESTION_REQUIRED');
  });

  it('planifie, replanifie, mais jamais dans le passé', () => {
    const o = newOrder();
    must(o.schedule(RAD, Temporal.Instant.from('2026-11-03T09:00:00Z'), NOW));
    expect(o.status).toBe('SCHEDULED');
    must(o.schedule(RAD, Temporal.Instant.from('2026-11-04T09:00:00Z'), NOW));
    expect(o.state.scheduledFor?.toString()).toBe('2026-11-04T09:00:00Z');
    expect(codeOf(o.schedule(RAD, Temporal.Instant.from('2026-11-01T09:00:00Z'), NOW))).toBe('IMG_SCHEDULE_IN_PAST');
    expect(o.state.scheduledFor?.toString()).toBe('2026-11-04T09:00:00Z');
  });

  it('annule avant l\'examen (planifié ou non) ; plus après, ni deux fois', () => {
    const planned = newOrder();
    must(planned.schedule(RAD, Temporal.Instant.from('2026-11-03T09:00:00Z'), NOW));
    must(planned.cancel(DOC, LATER, must(Reason.create('Doublon'))));
    expect(planned.status).toBe('CANCELLED');
    expect(codeOf(planned.cancel(DOC, LATER, must(Reason.create('Doublon'))))).toBe('IMG_ORDER_CANCELLED');
    expect(codeOf(planned.schedule(RAD, Temporal.Instant.from('2026-11-03T09:00:00Z'), NOW))).toBe('IMG_ORDER_CANCELLED');
    expect(codeOf(perform(planned))).toBe('IMG_ORDER_CANCELLED');
    expect(codeOf(performed().cancel(DOC, LATER, must(Reason.create('Trop tard'))))).toBe('IMG_ORDER_ALREADY_PERFORMED');
  });

  it('réalise sans planification (urgence) comme après planification', () => {
    const o = newOrder({ priority: 'STAT' });
    must(perform(o, { techniqueNote: 'Au lit du patient.' }));
    expect(o.status).toBe('PERFORMED');
    expect(o.state).toMatchObject({ performedBy: RAD, techniqueNote: 'Au lit du patient.', screening: { pregnant: false, contrastAllergy: false, overrideReason: null } });
    const planned = newOrder();
    must(planned.schedule(RAD, Temporal.Instant.from('2026-11-03T09:00:00Z'), NOW));
    must(perform(planned));
    expect(planned.status).toBe('PERFORMED');
    expect(codeOf(perform(planned))).toBe('IMG_ORDER_ALREADY_PERFORMED');
    expect(codeOf(planned.schedule(RAD, Temporal.Instant.from('2026-11-05T09:00:00Z'), NOW))).toBe('IMG_ORDER_ALREADY_PERFORMED');
  });

  describe('dépistage de sécurité', () => {
    it('grossesse + examen irradiant : bloqué sans motif ; passe avec un motif, conservé', () => {
      const o = newOrder();
      expect(codeOf(perform(o, { pregnant: true }))).toBe('IMG_PREGNANCY_RISK');
      expect(o.status).toBe('ORDERED');
      must(perform(o, { pregnant: true, overrideReason: 'Bénéfice supérieur au risque (urgence vitale).' }));
      expect(o.state.screening).toEqual({ pregnant: true, contrastAllergy: false, overrideReason: 'Bénéfice supérieur au risque (urgence vitale).' });
    });

    it('grossesse + échographie ou IRM : pas de contre-indication, le motif donné pour rien n\'est pas conservé', () => {
      const echo = newOrder({ modality: 'ULTRASOUND' });
      must(perform(echo, { pregnant: true, overrideReason: 'inutile' }));
      expect(echo.state.screening).toEqual({ pregnant: true, contrastAllergy: false, overrideReason: null });
      const irm = newOrder({ modality: 'MRI' });
      must(perform(irm, { pregnant: true }));
    });

    it('allergie + produit de contraste : bloqué sans motif ; sans produit de contraste, rien à lever', () => {
      const o = newOrder({ modality: 'CT' });
      expect(codeOf(perform(o, { contrastAllergy: true }, true))).toBe('IMG_CONTRAST_ALLERGY');
      must(perform(o, { contrastAllergy: true }, false));
      expect(o.state.screening?.overrideReason).toBeNull();
      const withContrast = newOrder({ modality: 'CT' });
      must(perform(withContrast, { contrastAllergy: true, overrideReason: 'Prémédication faite.' }, true));
      expect(withContrast.state.screening?.overrideReason).toBe('Prémédication faite.');
    });
  });
});

describe('imagerie : compte rendu', () => {
  it('le brouillon n\'existe qu\'entre la réalisation et la signature', () => {
    const o = newOrder();
    expect(codeOf(draft(o))).toBe('IMG_REPORT_NOT_DRAFTABLE');
    must(perform(o));
    must(draft(o));
    must(draft(o, { findings: 'Version 2.' }));
    expect(o.state.draft).toMatchObject({ findings: 'Version 2.', by: RAD });
    must(o.sign(RAD, LATER));
    expect(codeOf(draft(o))).toBe('IMG_REPORT_NOT_DRAFTABLE');
  });

  it('refuse les textes trop longs, sans rien changer', () => {
    const o = performed();
    must(draft(o));
    expect(codeOf(draft(o, { findings: 'x'.repeat(8001) }))).toBe('IMG_REPORT_TEXT_INVALID');
    expect(codeOf(draft(o, { impression: 'x'.repeat(2001) }))).toBe('IMG_REPORT_TEXT_INVALID');
    expect(codeOf(draft(o, { technique: 'x'.repeat(2001) }))).toBe('IMG_REPORT_TEXT_INVALID');
    expect(o.state.draft?.findings).toBe('Opacité du lobe inférieur droit.');
  });

  it('signe : constatations et impression obligatoires ; le brouillon disparaît ; la demande passe à REPORTED', () => {
    const o = performed();
    expect(codeOf(o.sign(RAD, LATER))).toBe('IMG_REPORT_INCOMPLETE');
    must(draft(o, { findings: '  ' }));
    expect(codeOf(o.sign(RAD, LATER))).toBe('IMG_REPORT_INCOMPLETE');
    must(draft(o, { impression: null }));
    expect(codeOf(o.sign(RAD, LATER))).toBe('IMG_REPORT_INCOMPLETE');
    must(draft(o));
    must(o.sign(RAD, LATER));
    expect(o.status).toBe('REPORTED');
    expect(o.state.draft).toBeNull();
    expect(o.state.versions).toEqual([expect.objectContaining({ version: 1, findings: 'Opacité du lobe inférieur droit.', reason: null, signedBy: RAD, critical: false })]);
    expect(codeOf(o.sign(RAD, LATER))).toBe('IMG_REPORT_NOT_SIGNABLE');
  });

  it('ne signe pas un examen non réalisé', () => {
    expect(codeOf(newOrder().sign(RAD, LATER))).toBe('IMG_REPORT_NOT_SIGNABLE');
  });

  describe('découverte critique', () => {
    it('la signature exige l\'appel documenté, avec relecture', () => {
      const o = performed();
      must(draft(o, { critical: true }));
      expect(codeOf(o.sign(RAD, LATER))).toBe('IMG_CRITICAL_NOT_COMMUNICATED');
      expect(codeOf(o.recordCommunication({ ...call, readBackConfirmed: false }, RAD, LATER))).toBe('IMG_READ_BACK_REQUIRED');
      expect(codeOf(o.recordCommunication({ ...call, notifiedName: ' ' }, RAD, LATER))).toBe('IMG_COMMUNICATION_INVALID');
      expect(codeOf(o.recordCommunication({ ...call, notifiedRole: 'x'.repeat(61) }, RAD, LATER))).toBe('IMG_COMMUNICATION_INVALID');
      expect(codeOf(o.sign(RAD, LATER))).toBe('IMG_CRITICAL_NOT_COMMUNICATED');
      must(o.recordCommunication(call, RAD, LATER));
      must(o.sign(RAD, LATER));
      expect(o.state.versions[0].critical).toBe(true);
      expect(o.state.communications).toEqual([expect.objectContaining({ version: 1, notifiedName: 'Dr Curie', method: 'PHONE', readBackConfirmed: true, by: RAD })]);
    });

    it('un appel n\'a de sens que pour un brouillon critique', () => {
      const o = performed();
      expect(codeOf(o.recordCommunication(call, RAD, LATER))).toBe('IMG_REPORT_NOT_CRITICAL');
      must(draft(o));
      expect(codeOf(o.recordCommunication(call, RAD, LATER))).toBe('IMG_REPORT_NOT_CRITICAL');
      expect(codeOf(newOrder().recordCommunication(call, RAD, LATER))).toBe('IMG_REPORT_NOT_CRITICAL');
    });
  });

  describe('addendum', () => {
    const signed = () => { const o = performed(); must(draft(o)); must(o.sign(RAD, LATER)); return o; };
    const addendum = (o: ImagingOrder, over: Partial<Parameters<ImagingOrder['addendum']>[0]> = {}) =>
      o.addendum({ reason: must(Reason.create('Découverte complémentaire.')), technique: null, findings: 'Nodule du lobe supérieur gauche en plus.', impression: 'Pneumopathie et nodule.', critical: false, communication: null, ...over }, RAD, LATER);

    it('ajoute une version signée avec son motif ; la version 1 reste intacte', () => {
      const o = signed();
      must(addendum(o));
      expect(o.state.versions.map((v) => [v.version, v.reason])).toEqual([[1, null], [2, 'Découverte complémentaire.']]);
      expect(o.state.versions[0].findings).toBe('Opacité du lobe inférieur droit.');
      expect(o.status).toBe('REPORTED');
    });

    it('n\'existe qu\'après la signature', () => {
      expect(codeOf(addendum(performed()))).toBe('IMG_REPORT_NOT_SIGNED');
      expect(codeOf(addendum(newOrder()))).toBe('IMG_REPORT_NOT_SIGNED');
    });

    it('exige constatations et impression', () => {
      const o = signed();
      expect(codeOf(addendum(o, { findings: ' ' }))).toBe('IMG_REPORT_INCOMPLETE');
      expect(codeOf(addendum(o, { impression: null }))).toBe('IMG_REPORT_INCOMPLETE');
      expect(codeOf(addendum(o, { findings: 'x'.repeat(8001) }))).toBe('IMG_REPORT_TEXT_INVALID');
      expect(o.state.versions).toHaveLength(1);
    });

    it('un addendum critique exige l\'appel du clinicien, rattaché à sa version', () => {
      const o = signed();
      expect(codeOf(addendum(o, { critical: true }))).toBe('IMG_CRITICAL_NOT_COMMUNICATED');
      expect(codeOf(addendum(o, { critical: true, communication: { ...call, readBackConfirmed: false } }))).toBe('IMG_READ_BACK_REQUIRED');
      expect(o.state.versions).toHaveLength(1);
      expect(o.state.communications).toHaveLength(0);
      must(addendum(o, { critical: true, communication: call }));
      expect(o.state.versions[1].critical).toBe(true);
      expect(o.state.communications).toEqual([expect.objectContaining({ version: 2 })]);
    });
  });
});
