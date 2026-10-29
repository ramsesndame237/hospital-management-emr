import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { FakeBillingGateway } from '../../../core/billing/testing/fake-billing-gateway';
import { ApiError } from '../../../core/http/api-error';
import { PatientSearchGateway } from '../../../core/patients/patient-search.gateway';
import { FakePatientSearchGateway } from '../../../core/patients/testing/fake-patient-search-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { NewInvoicePage } from './new-invoice.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('NewInvoicePage', () => {
  let fixture: ComponentFixture<NewInvoicePage>;
  let patients: FakePatientSearchGateway;
  let billing: FakeBillingGateway;
  let navigate: ReturnType<typeof vi.spyOn>;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');

  async function setup(prepare?: (p: FakePatientSearchGateway, b: FakeBillingGateway) => void) {
    patients = new FakePatientSearchGateway();
    billing = new FakeBillingGateway();
    prepare?.(patients, billing);
    const { i18n } = configureApp({
      roles: ['CASHIER'], permissions: ['billing.invoices:read', 'billing.invoices:write', 'patients:read'],
      providers: [{ provide: PatientSearchGateway, useValue: patients }, { provide: BillingGateway, useValue: billing }],
    });
    missingKeys = watchMissingKeys(i18n);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(NewInvoicePage);
    await settle(fixture);
  }

  async function search(value: string) {
    const input = q<HTMLInputElement>('#patient-search-q')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    q<HTMLFormElement>('#patient-search')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('demande un numéro de dossier ou un nom avant tout appel', async () => {
    await setup();
    await search('');
    expect(text()).toContain('Saisissez un numéro de dossier ou un nom.');
    await search('a');
    expect(text()).toContain('Saisissez au moins 2 caractères.');
    expect(patients.search).not.toHaveBeenCalled();
  });

  it('met le curseur sur la recherche à l\'ouverture', async () => {
    await setup();
    expect(root().ownerDocument.activeElement).toBe(q('#patient-search-q'));
  });

  it('affiche les patients trouvés (identité et âge seulement)', async () => {
    await setup();
    await search('  mbarga ');
    expect(patients.search).toHaveBeenCalledWith('mbarga', 10);
    const rows = [...root().querySelectorAll('tbody tr')].map((tr) => norm(tr.textContent ?? ''));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Mbarga Élisabeth');
    expect(rows[0]).toContain('PAT-0000001');
    expect(rows[0]).toContain('36 ans');
    expect(rows[0]).toContain('Douala');
  });

  it('crée un brouillon pour le patient choisi et ouvre la facture', async () => {
    await setup();
    await search('mbarga');
    (q('button[aria-label="Facturer Mbarga Élisabeth"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(billing.createInvoice).toHaveBeenCalledWith('p-1');
    expect(navigate).toHaveBeenCalledWith(['/billing/invoices', 'inv-1']);
  });

  it('signale un patient décédé sans empêcher de facturer (solde d\'un dossier)', async () => {
    await setup((p) => p.search.mockResolvedValue({ total: 1, items: [{ id: 'p-9', number: 'PAT-0000009', lastName: 'Defunt', firstName: 'Jean', sex: 'MALE', birthDate: '1950-01-01', ageYears: 76, status: 'DECEASED', city: null }] }));
    await search('defunt');
    expect(text()).toContain('Décédé');
    expect(q('button[aria-label="Facturer Defunt Jean"]')).not.toBeNull();
  });

  it('dit qu\'aucun dossier ne correspond', async () => {
    await setup((p) => p.search.mockResolvedValue({ items: [], total: 0 }));
    await search('personne');
    expect(text()).toContain('Aucun dossier ne correspond.');
  });

  it('invite à préciser quand il y a plus de résultats que d\'affichés', async () => {
    await setup((p) => p.search.mockResolvedValue({ ...({ items: [{ id: 'p-1', number: 'PAT-0000001', lastName: 'Mbarga', firstName: 'A', sex: 'FEMALE', birthDate: '1990-01-01', ageYears: 36, status: 'ACTIVE', city: null }] }), total: 42 }));
    await search('mbarga');
    expect(text()).toContain('1 dossiers affichés sur 42');
  });

  it('affiche le refus du serveur pour une recherche trop large', async () => {
    await setup((p) => p.search.mockRejectedValue(new ApiError(422, 'PATIENT_SEARCH_TOO_BROAD', 'Critère trop court : saisissez au moins 2 lettres par mot, ou 3 caractères pour une pièce.')));
    await search('mb');
    expect(q('[role=alert]')?.textContent).toContain('Critère trop court');
  });

  it('affiche l\'échec de création du brouillon et reste sur la page', async () => {
    await setup((_p, b) => b.createInvoice.mockRejectedValue(new ApiError(404, 'BILLING_PATIENT_NOT_FOUND', 'Patient introuvable.')));
    await search('mbarga');
    (q('button[aria-label="Facturer Mbarga Élisabeth"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(q('p[role=alert]')?.textContent).toContain('Patient introuvable.');
    expect(navigate).not.toHaveBeenCalled();
  });
});
