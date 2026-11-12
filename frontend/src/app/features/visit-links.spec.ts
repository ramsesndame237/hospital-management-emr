import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BillingGateway } from '../core/billing/billing.gateway';
import { FakeBillingGateway } from '../core/billing/testing/fake-billing-gateway';
import { ClinicalGateway } from '../core/clinical/clinical.gateway';
import { FakeClinicalGateway, encounter } from '../core/clinical/testing/fake-clinical-gateway';
import { ApiError } from '../core/http/api-error';
import { LabGateway } from '../core/lab/lab.gateway';
import { FakeLabGateway, summary } from '../core/lab/testing/fake-lab-gateway';
import { PatientSearchGateway } from '../core/patients/patient-search.gateway';
import { FakePatientSearchGateway } from '../core/patients/testing/fake-patient-search-gateway';
import { ReceptionGateway } from '../core/reception/reception.gateway';
import { FakeReceptionGateway, admission, page } from '../core/reception/testing/fake-reception-gateway';
import { configureApp, settle, watchMissingKeys } from '../testing/app-testing';
import { NewInvoicePage } from './billing/invoice-new/new-invoice.page';
import { EncounterPage } from './clinical/encounter/encounter.page';
import { NewRequisitionPage } from './lab/new-requisition/new-requisition.page';
import { AdmissionsPage } from './reception/admissions/admissions.page';

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('liens avec la visite', () => {
  let missingKeys: () => string[];
  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('analyses de la consultation (espace de consultation)', () => {
    let fixture: ComponentFixture<EncounterPage>;
    let lab: FakeLabGateway;
    const root = () => fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

    async function setup(permissions: readonly string[], arrange?: (g: FakeLabGateway) => void) {
      lab = new FakeLabGateway();
      arrange?.(lab);
      const { i18n } = configureApp({
        roles: ['DOCTOR'], permissions: ['clinical.encounters:read:department', ...permissions], profile: { id: 'u-doc' },
        providers: [{ provide: ClinicalGateway, useValue: new FakeClinicalGateway() }, { provide: LabGateway, useValue: lab }],
      });
      missingKeys = watchMissingKeys(i18n);
      fixture = TestBed.createComponent(EncounterPage);
      fixture.componentRef.setInput('id', 'e-1');
      await settle(fixture);
    }

    it('liste les demandes d\'analyses de la consultation avec leur avancement, et offre d\'en demander d\'autres avec le patient et la consultation déjà renseignés', async () => {
      await setup(['lab.requisitions:read:own', 'lab.requisitions:order'], (g) => g.listRequisitions.mockResolvedValue(page([summary({ priority: 'URGENT', testCodes: ['HGB', 'GLU'] })])));
      expect(lab.listRequisitions).toHaveBeenCalledWith({ encounterId: 'e-1' }, 0, 50);
      const row = textOf(q('[data-test="LAB-0000123"]'));
      expect(row).toContain('À prélever');
      expect(row).toContain('HGB, GLU');
      expect(q('[data-test="LAB-0000123"] a')?.getAttribute('href')).toBe('/lab/requisitions/r-1');
      const link = q<HTMLAnchorElement>('a[href^="/lab/requisitions/new"]')!;
      expect(link.getAttribute('href')).toContain('patientNumber=PAT-0000001');
      expect(link.getAttribute('href')).toContain('encounterId=e-1');
    });

    it('dit qu\'aucune analyse n\'a été demandée', async () => {
      await setup(['lab.requisitions:read:own', 'lab.requisitions:order'], (g) => g.listRequisitions.mockResolvedValue(page([])));
      expect(textOf(root())).toContain('Aucune analyse demandée pendant cette consultation.');
    });

    it('n\'offre pas de demander sans le droit de prescrire, ni de section sans le droit de lire', async () => {
      await setup(['lab.requisitions:read:own']);
      expect(q('a[href^="/lab/requisitions/new"]')).toBeNull();
      expect(textOf(root())).toContain('Analyses');
    });

    it('n\'affiche pas la section sans le droit de lire les demandes', async () => {
      await setup([]);
      expect(lab.listRequisitions).not.toHaveBeenCalled();
    });

    it('n\'offre plus de demander quand la consultation est annulée', async () => {
      lab = new FakeLabGateway();
      const clinical = new FakeClinicalGateway();
      clinical.getEncounter.mockResolvedValue(encounter({ status: 'CANCELLED', cancelledBy: { id: 'u-doc', username: 'medecin' }, cancellationReason: 'Erreur', cancelledAt: '2026-10-24T08:10:00Z' }));
      const { i18n } = configureApp({
        roles: ['DOCTOR'], permissions: ['clinical.encounters:read:department', 'lab.requisitions:read:own', 'lab.requisitions:order'], profile: { id: 'u-doc' },
        providers: [{ provide: ClinicalGateway, useValue: clinical }, { provide: LabGateway, useValue: lab }],
      });
      missingKeys = watchMissingKeys(i18n);
      fixture = TestBed.createComponent(EncounterPage);
      fixture.componentRef.setInput('id', 'e-1');
      await settle(fixture);
      expect(q('a[href^="/lab/requisitions/new"]')).toBeNull();
    });
  });

  describe('nouvelle demande d\'analyses depuis la consultation', () => {
    let fixture: ComponentFixture<NewRequisitionPage>;
    let lab: FakeLabGateway;
    let patients: FakePatientSearchGateway;
    const root = () => fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

    async function setup(inputs: Record<string, string>, arrange?: (p: FakePatientSearchGateway) => void) {
      lab = new FakeLabGateway();
      patients = new FakePatientSearchGateway();
      arrange?.(patients);
      const { i18n } = configureApp({
        roles: ['DOCTOR'], permissions: ['lab.requisitions:order', 'lab.requisitions:read:own', 'lab.catalog:read'],
        providers: [{ provide: LabGateway, useValue: lab }, { provide: PatientSearchGateway, useValue: patients }],
      });
      missingKeys = watchMissingKeys(i18n);
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      fixture = TestBed.createComponent(NewRequisitionPage);
      for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
      await settle(fixture);
    }

    it('préchoisit le patient du numéro donné (le bon, pas son homonyme) et annonce le rattachement à la consultation', async () => {
      await setup({ patientNumber: 'PAT-0000002', encounterId: 'e-1' });
      expect(patients.search).toHaveBeenCalledWith('PAT-0000002', 5);
      expect(textOf(root())).toContain('PAT-0000002');
      expect(q('#patient-search')).toBeNull();
      expect(q('[data-test=linked]')?.textContent).toContain('rattachée à la consultation');
    });

    it('n\'annonce rien et laisse chercher le patient sans consultation d\'origine', async () => {
      await setup({});
      expect(patients.search).not.toHaveBeenCalled();
      expect(q('#patient-search')).not.toBeNull();
      expect(q('[data-test=linked]')).toBeNull();
    });

    it('laisse chercher à la main quand le patient donné est introuvable', async () => {
      await setup({ patientNumber: 'PAT-9999999', encounterId: 'e-1' });
      expect(q('#patient-search')).not.toBeNull();
    });

    it('laisse chercher à la main quand la recherche échoue', async () => {
      await setup({ patientNumber: 'PAT-0000001' }, (p) => p.search.mockRejectedValue(new ApiError(0, 'NETWORK', 'réseau')));
      expect(q('#patient-search')).not.toBeNull();
    });
  });

  describe('nouvelle facture depuis une admission', () => {
    let fixture: ComponentFixture<NewInvoicePage>;
    let billing: FakeBillingGateway;
    let patients: FakePatientSearchGateway;
    let navigate: ReturnType<typeof vi.spyOn>;
    const root = () => fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

    async function setup(inputs: Record<string, string>) {
      billing = new FakeBillingGateway();
      patients = new FakePatientSearchGateway();
      const { i18n } = configureApp({
        roles: ['CASHIER'], permissions: ['billing.invoices:read', 'billing.invoices:write', 'patients:read'],
        providers: [{ provide: PatientSearchGateway, useValue: patients }, { provide: BillingGateway, useValue: billing }],
      });
      missingKeys = watchMissingKeys(i18n);
      navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      fixture = TestBed.createComponent(NewInvoicePage);
      for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
      await settle(fixture);
    }

    it('propose le patient de l\'admission sans rien créer, puis ouvre la facture rattachée à l\'admission au choix', async () => {
      await setup({ patientNumber: 'PAT-0000001', admissionId: 'adm-1' });
      expect(patients.search).toHaveBeenCalledWith('PAT-0000001', 5);
      expect(billing.createInvoice).not.toHaveBeenCalled();
      expect(q('[data-test=linked]')?.textContent).toContain('rattachée à l’admission');
      q<HTMLButtonElement>('table button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(billing.createInvoice).toHaveBeenCalledWith('p-1', 'adm-1');
      expect(navigate).toHaveBeenCalledWith(['/billing/invoices', 'inv-1']);
    });

    it('sans admission, la facture reste libre (aucun rattachement envoyé)', async () => {
      await setup({});
      expect(patients.search).not.toHaveBeenCalled();
      expect(q('[data-test=linked]')).toBeNull();
      const input = q<HTMLInputElement>('#patient-search-q')!;
      input.value = 'mbarga';
      input.dispatchEvent(new Event('input'));
      q<HTMLFormElement>('#patient-search')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      q<HTMLButtonElement>('table button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(billing.createInvoice).toHaveBeenCalledWith('p-1', undefined);
    });

    it('affiche le refus du serveur (admission d\'un autre patient)', async () => {
      await setup({ patientNumber: 'PAT-0000001', admissionId: 'adm-9' });
      billing.createInvoice.mockRejectedValue(new ApiError(409, 'BILLING_ADMISSION_PATIENT_MISMATCH', 'Cette admission concerne un autre patient.'));
      q<HTMLButtonElement>('table button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(q('[role=alert]')?.textContent).toContain('autre patient');
    });
  });

  describe('« Facturer » depuis la liste des admissions', () => {
    let fixture: ComponentFixture<AdmissionsPage>;
    const root = () => fixture.nativeElement as HTMLElement;

    async function setup(permissions: readonly string[], rows = [admission()]) {
      const reception = new FakeReceptionGateway();
      reception.listAdmissions.mockResolvedValue(page(rows));
      const { i18n } = configureApp({ roles: ['CASHIER'], permissions, providers: [{ provide: ReceptionGateway, useValue: reception }] });
      missingKeys = watchMissingKeys(i18n);
      fixture = TestBed.createComponent(AdmissionsPage);
      await settle(fixture);
    }

    it('la caisse peut facturer une admission (le patient et l\'admission sont donnés à la nouvelle facture), sans aucune action d\'accueil', async () => {
      await setup(['admissions:read:all', 'billing.invoices:write']);
      const link = root().querySelector<HTMLAnchorElement>('a[href^="/billing/invoices/new"]')!;
      expect(link.getAttribute('href')).toContain('patientNumber=PAT-0000001');
      expect(link.getAttribute('href')).toContain('admissionId=adm-1');
      expect([...root().querySelectorAll('button')].some((b) => /Enregistrer la sortie|Transférer|Annuler/.test(b.getAttribute('aria-label') ?? ''))).toBe(false);
    });

    it('une admission annulée ne se facture pas, et sans le droit de facturer il n\'y a pas de lien', async () => {
      await setup(['admissions:read:all', 'billing.invoices:write'], [admission({ status: 'CANCELLED', cancellationReason: 'Erreur' })]);
      expect(root().querySelector('a[href^="/billing/invoices/new"]')).toBeNull();
    });

    it('sans le droit de facturer il n\'y a pas de lien', async () => {
      await setup(['admissions:read:all']);
      expect(root().querySelector('a[href^="/billing/invoices/new"]')).toBeNull();
    });
  });
});
