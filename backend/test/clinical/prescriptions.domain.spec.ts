import { allergyAlertsFor, LineInput, Prescription } from '../../src/modules/clinical/domain/prescription';
import { DrugRef, EncounterId, PatientRef, PrescriptionId, PrescriptionNumber } from '../../src/modules/clinical/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { uuid } from '../support/seed-sql';

const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const DOC = 'u-doc';

const line = (n: number, over: Partial<Record<keyof LineInput, unknown>> = {}): LineInput =>
  ({ drugId: must(DrugRef.create(uuid(700 + n))), dose: '1 comprimé', frequency: '3 fois par jour', durationDays: 7, quantity: 21, ...over }) as LineInput;

const issue = (lines: LineInput[], notes?: string | null) =>
  Prescription.issue({
    id: must(PrescriptionId.create(uuid(1))), number: must(PrescriptionNumber.fromSequence(1)), encounterId: must(EncounterId.create(uuid(2))), patientId: must(PatientRef.create(uuid(3))),
    serviceId: uuid(4), doctorId: DOC, issuedAt: NOW, notes, lines,
  });

describe('ordonnance', () => {
  it('émet une ordonnance en cours avec ses lignes normalisées', () => {
    const p = must(issue([line(1, { dose: '  1   comprimé ', instructions: '  Pendant les repas ' }), line(2, { durationDays: null })], '  Revoir à 7 jours '));
    expect(p.state).toMatchObject({ status: 'ISSUED', number: { value: 'RX-0000001' }, doctorId: DOC, notes: 'Revoir à 7 jours', cancelledAt: null });
    expect(p.state.lines).toHaveLength(2);
    expect(p.state.lines[0]).toMatchObject({ dose: '1 comprimé', instructions: 'Pendant les repas', allergyOverride: null });
    expect(p.state.lines[1].durationDays).toBeNull();
  });

  it.each([
    [[], 'CLINICAL_PRESCRIPTION_EMPTY'],
    [Array.from({ length: 21 }, (_, i) => line(i + 1)), 'CLINICAL_PRESCRIPTION_TOO_LONG'],
    [[line(1), line(1)], 'CLINICAL_PRESCRIPTION_DUPLICATE_DRUG'],
    [[line(1, { dose: '  ' })], 'CLINICAL_LINE_DOSE_INVALID'],
    [[line(1, { dose: 'x'.repeat(61) })], 'CLINICAL_LINE_DOSE_INVALID'],
    [[line(1, { frequency: '' })], 'CLINICAL_LINE_FREQUENCY_INVALID'],
    [[line(1, { quantity: 0 })], 'CLINICAL_LINE_QUANTITY_INVALID'],
    [[line(1, { quantity: 10001 })], 'CLINICAL_LINE_QUANTITY_INVALID'],
    [[line(1, { quantity: 1.5 })], 'CLINICAL_LINE_QUANTITY_INVALID'],
    [[line(1, { durationDays: 0 })], 'CLINICAL_LINE_DURATION_INVALID'],
    [[line(1, { durationDays: 366 })], 'CLINICAL_LINE_DURATION_INVALID'],
    [[line(1, { instructions: 'x'.repeat(201) })], 'CLINICAL_LINE_INSTRUCTIONS_INVALID'],
    [[line(1, { allergyOverride: 'x'.repeat(201) })], 'CLINICAL_LINE_OVERRIDE_INVALID'],
  ])('refuse une ordonnance invalide (%#)', (lines, code) => {
    const r = issue(lines as LineInput[]);
    expect(r).toMatchObject({ ok: false, error: { code } });
  });

  it('nomme la ligne fautive dans le message', () => {
    const r = issue([line(1), line(2, { quantity: 0 })]);
    expect(r).toMatchObject({ ok: false, error: { code: 'CLINICAL_LINE_QUANTITY_INVALID', message: expect.stringContaining('Ligne 2') } });
  });

  it('refuse une remarque de plus de 300 caractères', () => {
    expect(issue([line(1)], 'x'.repeat(301))).toMatchObject({ ok: false, error: { code: 'CLINICAL_PRESCRIPTION_NOTES_INVALID' } });
  });

  describe('annulation', () => {
    it('est faite par le médecin prescripteur, avec un motif', () => {
      const p = must(issue([line(1)]));
      must(p.cancel('  Posologie erronée ', DOC, LATER));
      expect(p.state).toMatchObject({ status: 'CANCELLED', cancelledBy: DOC, cancellationReason: 'Posologie erronée' });
      expect(p.state.cancelledAt!.toString()).toBe('2026-11-02T09:00:00Z');
    });

    it('refuse un autre que le prescripteur, un motif vide et une seconde annulation', () => {
      const p = must(issue([line(1)]));
      expect(p.cancel('Erreur', 'u-other', LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_NOT_AUTHOR' } });
      expect(p.cancel('  ', DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_REASON_REQUIRED' } });
      expect(p.cancel('x'.repeat(201), DOC, LATER)).toMatchObject({ ok: false });
      must(p.cancel('Erreur', DOC, LATER));
      expect(p.cancel('Encore', DOC, LATER)).toMatchObject({ ok: false, error: { code: 'CLINICAL_PRESCRIPTION_CANCELLED' } });
    });
  });
});

describe('alertes d\'allergie', () => {
  const drug = { name: 'Amoxicilline Biogaran', genericName: 'Amoxicilline' };
  const allergy = (substance: string, severity = 'SEVERE') => ({ id: `a-${substance}`, substance, severity });

  it('rapproche la substance du nom ou de la dénomination commune, sans accent ni casse', () => {
    expect(allergyAlertsFor(drug, [allergy('AMOXICILLINE')])).toEqual([{ allergyId: 'a-AMOXICILLINE', substance: 'AMOXICILLINE', severity: 'SEVERE' }]);
    expect(allergyAlertsFor({ name: 'Pénicilline V', genericName: 'Phénoxyméthylpénicilline' }, [allergy('penicilline')])).toHaveLength(1);
    expect(allergyAlertsFor({ name: 'Doliprane', genericName: 'Paracétamol' }, [allergy('Paracetamol', 'MILD')])).toHaveLength(1);
  });

  it('attrape aussi une allergie nommée plus largement que le médicament', () => {
    expect(allergyAlertsFor({ name: 'Ibuprofène', genericName: 'Ibuprofène' }, [allergy('Ibuprofène et dérivés')])).toHaveLength(1);
  });

  it('ne dit rien quand rien ne se rapproche, ni pour une substance trop courte', () => {
    expect(allergyAlertsFor(drug, [allergy('Arachide'), allergy('Latex')])).toEqual([]);
    expect(allergyAlertsFor(drug, [allergy('am')])).toEqual([]);
    expect(allergyAlertsFor(drug, [])).toEqual([]);
  });

  it('liste toutes les allergies qui visent le médicament', () => {
    expect(allergyAlertsFor(drug, [allergy('Amoxicilline'), allergy('Biogaran', 'MILD'), allergy('Arachide')]).map((a) => a.substance)).toEqual(['Amoxicilline', 'Biogaran']);
  });
});
