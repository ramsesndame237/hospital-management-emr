import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { InpatientGateway } from '../../../core/inpatient/inpatient.gateway';
import { FakeInpatientGateway, patientCard, stay, wardRow } from '../../../core/inpatient/testing/fake-inpatient-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { WardPage } from './ward.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('WardPage (patients hospitalisés)', () => {
  let fixture: ComponentFixture<WardPage>;
  let inpatient: FakeInpatientGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...root().querySelectorAll('tbody tr')].map((tr) => norm(tr.textContent ?? ''));

  async function setup(prepare?: (g: FakeInpatientGateway) => void) {
    inpatient = new FakeInpatientGateway();
    prepare?.(inpatient);
    const { i18n } = configureApp({ roles: ['NURSE'], permissions: ['inpatient.chart:read:department'], providers: [{ provide: InpatientGateway, useValue: inpatient }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(WardPage);
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les hospitalisés avec leur lit, le jour, et le dernier score en toutes lettres', async () => {
    await setup();
    const list = rows();
    expect(list).toHaveLength(2);
    expect(list[0]).toContain('Lit 1');
    expect(list[0]).toContain('Mbarga Élisabeth');
    expect(list[0]).toContain('PAT-0000001');
    expect(list[0]).toContain('NEWS2 1 · Faible');
    expect(list[1]).toContain('Ndom Berthe');
    expect(list[1]).toContain('Aucun relevé');
  });

  it('ouvre le dossier de soins de chaque patient', async () => {
    await setup();
    expect(root().querySelector('a[href="/ward/adm-1"]')).not.toBeNull();
    expect(root().querySelector('a[href="/ward/adm-2"]')).not.toBeNull();
  });

  it('signale en rouge les patients à score élevé, avec leur nombre', async () => {
    await setup((g) => g.ward.mockResolvedValue([
      wardRow({ latest: { recordedAt: '2026-11-20T09:30:00Z', news2: 9, risk: 'HIGH' } }),
      wardRow({ stay: stay({ admissionId: 'adm-3', bed: 'Lit 3' }), patient: { ...patientCard, id: 'p-3', lastName: 'Nkoa' }, latest: { recordedAt: '2026-11-20T09:30:00Z', news2: 6, risk: 'MEDIUM' } }),
    ]));
    expect(norm(root().querySelector('[role=alert]')?.textContent ?? '')).toContain('Patient(s) à score élevé : 1');
    expect(rows()[0]).toContain('NEWS2 9 · Élevé');
    expect(rows()[1]).toContain('NEWS2 6 · Moyen');
  });

  it("dit qu'aucun patient n'est hospitalisé", async () => {
    await setup((g) => g.ward.mockResolvedValue([]));
    expect(norm(root().textContent ?? '')).toContain('Aucun patient hospitalisé dans vos services.');
  });

  it("affiche le refus du serveur sans détail technique", async () => {
    await setup((g) => g.ward.mockRejectedValue(new ApiError(503, 'UNKNOWN', 'SELECT admissions failed')));
    expect(root().querySelector('[role=alert]')?.textContent).toContain('momentanément indisponible');
    expect(norm(root().textContent ?? '')).not.toContain('SELECT');
  });
});
