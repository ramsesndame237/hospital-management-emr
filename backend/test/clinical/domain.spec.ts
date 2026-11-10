import { Allergy } from '../../src/modules/clinical/domain/allergy';
import { Diagnosis, Encounter } from '../../src/modules/clinical/domain/encounter';
import { bodyMassIndex, createVitals } from '../../src/modules/clinical/domain/vitals';
import { AllergyId, EncounterId, EncounterNumber, IcdCode, PatientRef } from '../../src/modules/clinical/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const DOC = 'u-doc';
const OTHER = 'u-other';

describe('constantes', () => {
  it('accepte un relevé complet et calcule l\'IMC', () => {
    const v = must(createVitals({ temperature: 37.8, pulse: 88, systolic: 120, diastolic: 80, respiratoryRate: 18, spo2: 97, weightKg: 68.5, heightCm: 172 }));
    expect(v).toMatchObject({ temperature: 37.8, pulse: 88, weightKg: 68.5 });
    expect(bodyMassIndex(v)).toBe(23.2);
  });

  it('accepte une seule mesure, les autres restent absentes ; pas d\'IMC sans poids et taille', () => {
    const v = must(createVitals({ temperature: 38.5 }));
    expect(v).toMatchObject({ temperature: 38.5, pulse: null, systolic: null, weightKg: null });
    expect(bodyMassIndex(v)).toBeNull();
    expect(bodyMassIndex(must(createVitals({ weightKg: 60 })))).toBeNull();
  });

  it.each([
    [{}, 'CLINICAL_VITALS_EMPTY'],
    [{ temperature: null, pulse: undefined }, 'CLINICAL_VITALS_EMPTY'],
    [{ temperature: 29.9 }, 'CLINICAL_VITAL_INVALID'],
    [{ temperature: 45.1 }, 'CLINICAL_VITAL_INVALID'],
    [{ temperature: 37.55 }, 'CLINICAL_VITAL_INVALID'],
    [{ pulse: 88.5 }, 'CLINICAL_VITAL_INVALID'],
    [{ pulse: 19 }, 'CLINICAL_VITAL_INVALID'],
    [{ spo2: 101 }, 'CLINICAL_VITAL_INVALID'],
    [{ weightKg: 0.2 }, 'CLINICAL_VITAL_INVALID'],
    [{ heightCm: 261 }, 'CLINICAL_VITAL_INVALID'],
    [{ pulse: Number.NaN }, 'CLINICAL_VITAL_INVALID'],
    [{ systolic: 120 }, 'CLINICAL_BLOOD_PRESSURE_INCOMPLETE'],
    [{ diastolic: 80 }, 'CLINICAL_BLOOD_PRESSURE_INCOMPLETE'],
    [{ systolic: 80, diastolic: 80 }, 'CLINICAL_BLOOD_PRESSURE_INVALID'],
    [{ systolic: 70, diastolic: 90 }, 'CLINICAL_BLOOD_PRESSURE_INVALID'],
  ])('refuse %j', (input, code) => {
    expect(createVitals(input)).toMatchObject({ ok: false, error: { code } });
  });

  it('accepte les bornes exactes', () => {
    expect(createVitals({ temperature: 30, pulse: 20, systolic: 300, diastolic: 200, respiratoryRate: 80, spo2: 50, weightKg: 0.3, heightCm: 260 }).ok).toBe(true);
    expect(createVitals({ temperature: 45, pulse: 300, systolic: 300, diastolic: 20, respiratoryRate: 4, spo2: 100, weightKg: 500, heightCm: 20 }).ok).toBe(true);
  });
});

describe('Encounter', () => {
  const started = () =>
    Encounter.start({ id: must(EncounterId.create(uuid(1))), number: must(EncounterNumber.fromSequence(1)), patientId: must(PatientRef.create(uuid(2))), serviceId: uuid(3), admissionId: uuid(4), doctorId: DOC, startedAt: NOW });
  const dx = (code: string, kind: 'PRIMARY' | 'SECONDARY' = 'PRIMARY', label = 'Pneumopathie'): Diagnosis => ({ code: must(IcdCode.create(code)), label, kind, certainty: 'CONFIRMED' });
  /** Une consultation prête à signer : évaluation et diagnostic principal posés. */
  const ready = () => {
    const e = started();
    must(e.updateNote(DOC, { assessment: 'Pneumopathie franche lobaire.' }));
    must(e.setDiagnoses(DOC, [dx('J18.9')]));
    return e;
  };

  it('s\'ouvre en cours, vide, au nom du médecin', () => {
    const e = started();
    expect(e.state).toMatchObject({ status: 'IN_PROGRESS', doctorId: DOC, vitals: null, diagnoses: [], addenda: [], signedAt: null });
    expect(e.state.note).toEqual({ chiefComplaint: null, history: null, examination: null, assessment: null, plan: null });
  });

  it('les codes CIM-10 sont normalisés et contrôlés', () => {
    expect(must(IcdCode.create(' j18.9 ')).value).toBe('J18.9');
    expect(must(IcdCode.create('A00')).value).toBe('A00');
    expect(must(IcdCode.create('S72.00')).value).toBe('S72.00');
    for (const bad of ['', 'J1', 'J189', '18.9', 'J18.', 'J18.99999', 'é18']) expect(IcdCode.create(bad)).toMatchObject({ ok: false, error: { code: 'CLINICAL_ICD_INVALID' } });
  });

  it('les constantes se relèvent par n\'importe quel soignant et se remplacent', () => {
    const e = started();
    must(e.recordVitals(must(createVitals({ pulse: 80 })), OTHER, NOW));
    must(e.recordVitals(must(createVitals({ pulse: 92, temperature: 38.1 })), DOC, LATER));
    expect(e.state).toMatchObject({ vitalsBy: DOC, vitals: { pulse: 92, temperature: 38.1 } });
  });

  it('la note se met à jour champ par champ : absent inchangé, vide effacé, trop long refusé', () => {
    const e = started();
    must(e.updateNote(DOC, { chiefComplaint: '  Fièvre  ', plan: 'Repos' }));
    must(e.updateNote(DOC, { plan: '   ' }));
    expect(e.state.note).toMatchObject({ chiefComplaint: 'Fièvre', plan: null, history: null });
    expect(e.updateNote(DOC, { chiefComplaint: 'x'.repeat(501) })).toMatchObject({ ok: false, error: { code: 'CLINICAL_NOTE_INVALID' } });
    expect(e.updateNote(DOC, { assessment: 'x'.repeat(2001) }).ok).toBe(false);
    expect(e.state.note.chiefComplaint).toBe('Fièvre');
  });

  it('seul le médecin de la consultation la rédige, la signe ou l\'annule', () => {
    const e = ready();
    expect(e.updateNote(OTHER, { plan: 'x' })).toMatchObject({ ok: false, error: { code: 'CLINICAL_NOT_AUTHOR' } });
    expect(e.setDiagnoses(OTHER, [])).toMatchObject({ ok: false, error: { code: 'CLINICAL_NOT_AUTHOR' } });
    expect(e.sign(OTHER, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_NOT_AUTHOR' } });
    expect(e.cancel('Erreur', OTHER, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_NOT_AUTHOR' } });
    expect(e.status).toBe('IN_PROGRESS');
  });

  it('refuse trop de diagnostics, deux principaux, un code en double, un libellé vide', () => {
    const e = started();
    const many = Array.from({ length: 11 }, (_, i) => dx(`A0${i % 10}.${i}`, 'SECONDARY'));
    expect(e.setDiagnoses(DOC, many)).toMatchObject({ ok: false, error: { code: 'CLINICAL_DIAGNOSES_INVALID' } });
    expect(e.setDiagnoses(DOC, [dx('J18.9'), dx('R50.9')])).toMatchObject({ ok: false, error: { code: 'CLINICAL_DIAGNOSIS_PRIMARY_DUPLICATE' } });
    expect(e.setDiagnoses(DOC, [dx('J18.9'), dx('J18.9', 'SECONDARY')])).toMatchObject({ ok: false, error: { code: 'CLINICAL_DIAGNOSIS_DUPLICATE' } });
    expect(e.setDiagnoses(DOC, [dx('J18.9', 'PRIMARY', '')])).toMatchObject({ ok: false, error: { code: 'CLINICAL_DIAGNOSIS_LABEL_INVALID' } });
    expect(e.state.diagnoses).toEqual([]);
    must(e.setDiagnoses(DOC, [dx('J18.9'), dx('R50.9', 'SECONDARY', 'Fièvre')]));
    expect(e.state.diagnoses.map((d) => d.code.value)).toEqual(['J18.9', 'R50.9']);
  });

  it('dit ce qui manque pour signer, et refuse de signer', () => {
    const e = started();
    expect(e.missingForSignature()).toEqual(['PRIMARY_DIAGNOSIS', 'ASSESSMENT']);
    expect(e.sign(DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_SIGNATURE_INCOMPLETE', details: { missing: 'PRIMARY_DIAGNOSIS,ASSESSMENT' } } });
    must(e.updateNote(DOC, { assessment: 'x' }));
    expect(e.missingForSignature()).toEqual(['PRIMARY_DIAGNOSIS']);
    must(e.setDiagnoses(DOC, [dx('R50.9', 'SECONDARY')]));
    expect(e.missingForSignature()).toEqual(['PRIMARY_DIAGNOSIS']);
    must(e.setDiagnoses(DOC, [dx('R50.9')]));
    expect(e.missingForSignature()).toEqual([]);
  });

  it('la signature verrouille tout : constantes, note, diagnostics, annulation', () => {
    const e = ready();
    must(e.sign(DOC, LATER));
    expect(e.state).toMatchObject({ status: 'SIGNED', signedBy: DOC });
    expect(e.recordVitals(must(createVitals({ pulse: 70 })), DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_LOCKED' } });
    expect(e.updateNote(DOC, { plan: 'x' })).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_LOCKED' } });
    expect(e.setDiagnoses(DOC, [])).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_LOCKED' } });
    expect(e.cancel('Erreur', DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_LOCKED' } });
    expect(e.sign(DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_LOCKED' } });
  });

  it('un addendum complète une consultation signée, par son médecin, dans l\'ordre', () => {
    const e = ready();
    expect(e.addAddendum('Trop tôt', DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_NOT_SIGNED' } });
    must(e.sign(DOC, LATER));
    expect(e.addAddendum('Pas moi', OTHER, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_NOT_AUTHOR' } });
    expect(e.addAddendum('   ', DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_ADDENDUM_INVALID' } });
    expect(e.addAddendum('x'.repeat(2001), DOC, LATER).ok).toBe(false);
    expect(must(e.addAddendum(' Radiographie reçue ', DOC, LATER))).toMatchObject({ seq: 1, text: 'Radiographie reçue', by: DOC });
    expect(must(e.addAddendum('Appel du patient', DOC, LATER)).seq).toBe(2);
    expect(e.state.addenda.map((a) => a.seq)).toEqual([1, 2]);
    expect(e.state.note.assessment).toBe('Pneumopathie franche lobaire.');
  });

  it('une annulation exige un motif, ferme la consultation et refuse signature et addendum', () => {
    const e = started();
    expect(e.cancel('  ', DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_REASON_REQUIRED' } });
    must(e.cancel(' Mauvais patient ', DOC, LATER));
    expect(e.state).toMatchObject({ status: 'CANCELLED', cancelledBy: DOC, cancellationReason: 'Mauvais patient' });
    expect(e.sign(DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_LOCKED' } });
    expect(e.addAddendum('x', DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_ENCOUNTER_NOT_SIGNED' } });
  });
});

describe('Allergy', () => {
  const record = (over: Record<string, unknown> = {}) =>
    Allergy.record({ id: must(AllergyId.create(uuid(1))), patientId: must(PatientRef.create(uuid(2))), substance: ' Pénicilline ', reaction: 'Urticaire', severity: 'SEVERE', by: DOC, at: NOW, ...over } as Parameters<typeof Allergy.record>[0]);

  it('s\'enregistre active, substance normalisée', () => {
    expect(must(record()).state).toMatchObject({ substance: 'Pénicilline', reaction: 'Urticaire', severity: 'SEVERE', status: 'ACTIVE', recordedBy: DOC });
    expect(must(record({ reaction: '  ' })).state.reaction).toBeNull();
  });

  it('refuse une substance vide ou trop longue et une réaction trop longue', () => {
    expect(record({ substance: ' ' })).toMatchObject({ ok: false, error: { code: 'CLINICAL_SUBSTANCE_INVALID' } });
    expect(record({ substance: 'x'.repeat(101) }).ok).toBe(false);
    expect(record({ reaction: 'x'.repeat(201) })).toMatchObject({ ok: false, error: { code: 'CLINICAL_REACTION_INVALID' } });
  });

  it('se corrige (réaction, gravité) sans changer de substance, et efface la réaction avec null', () => {
    const a = must(record());
    must(a.update({ severity: 'MILD', reaction: null }));
    expect(a.state).toMatchObject({ severity: 'MILD', reaction: null, substance: 'Pénicilline' });
    expect(a.update({ reaction: 'x'.repeat(201) }).ok).toBe(false);
    must(a.update({}));
  });

  it('se déclare erronée avec un motif, puis ne bouge plus', () => {
    const a = must(record());
    expect(a.void(' ', DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_REASON_REQUIRED' } });
    must(a.void('Mauvais dossier', DOC, LATER));
    expect(a.state).toMatchObject({ status: 'ENTERED_IN_ERROR', voidedBy: DOC, voidReason: 'Mauvais dossier' });
    expect(a.update({ severity: 'MILD' })).toMatchObject({ ok: false, error: { code: 'CLINICAL_ALLERGY_VOIDED' } });
    expect(a.void('Encore', DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_ALLERGY_VOIDED' } });
  });
});
