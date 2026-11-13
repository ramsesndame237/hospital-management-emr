import { ResultsForPortal } from '../../src/integration/portal.integration';
import type { PatientReportsUseCase, ReportView } from '../../src/modules/lab/application/use-cases/reports';

const item = (over: Partial<ReportView['items'][number]> = {}): ReportView['items'][number] => ({
  testCode: 'HGB', testName: 'Hémoglobine', section: 'HAEMATOLOGY', status: 'RELEASED', value: '12,4', unit: 'g/dL', flag: null, refLow: 12, refHigh: 16, criticalLow: 7, criticalHigh: 20, version: 1,
  amended: false, amendmentReason: null, verifiedBy: { id: 'u1', username: 'labo' }, releasedBy: { id: 'u2', username: 'labo2' }, releasedAt: '2026-11-02T10:00:00Z', ...over,
});

const report = (items: ReportView['items'][number][]): ReportView => ({
  number: 'LAB-0000123', patient: null, priority: 'ROUTINE', source: 'OPD', orderedBy: { id: 'u3', username: 'medecin' }, orderedAt: '2026-11-02T08:00:00Z', clinicalNotes: 'Fièvre depuis 3 jours',
  complete: items.every((i) => i.status === 'RELEASED'), items, generatedAt: '2026-11-02T11:00:00Z',
});

describe('portail : résultats du patient', () => {
  const reports = (...r: ReportView[]) => ({ execute: async () => r }) as unknown as PatientReportsUseCase;

  it('ne montre que des résultats publiés, sans note clinique, sans prescripteur et sans signatures', async () => {
    const [r] = await new ResultsForPortal(reports(report([item(), item({ testName: 'Glycémie', status: 'PENDING', value: null, unit: null })]))).listOf('p-1', 10);
    expect(r.number).toBe('LAB-0000123');
    expect(r.orderedAt.toString()).toBe('2026-11-02T08:00:00Z');
    expect(r.items).toEqual([{ testName: 'Hémoglobine', value: '12,4', unit: 'g/dL', flag: null, refLow: 12, refHigh: 16, amended: false }]);
    expect(JSON.stringify(r)).not.toMatch(/Fièvre|medecin|labo2|criticalLow/);
  });

  it('signale un résultat corrigé après sa publication, et son drapeau', async () => {
    const [r] = await new ResultsForPortal(reports(report([item({ flag: 'HIGH', amended: true, version: 2, amendmentReason: 'Erreur de saisie' })]))).listOf('p-1', 10);
    expect(r.items[0]).toMatchObject({ flag: 'HIGH', amended: true });
    expect(JSON.stringify(r)).not.toContain('Erreur de saisie');
  });

  it('rend une liste vide quand rien n\'est publié', async () => {
    expect(await new ResultsForPortal(reports()).listOf('p-1', 10)).toEqual([]);
  });
});
