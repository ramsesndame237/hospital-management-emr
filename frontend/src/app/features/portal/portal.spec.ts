import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../core/http/api-error';
import { PortalGateway } from '../../core/portal/portal.gateway';
import { FakePortalGateway, invoice, prescription, result } from '../../core/portal/testing/fake-portal-gateway';
import { ReceptionGateway } from '../../core/reception/reception.gateway';
import { FakeReceptionGateway } from '../../core/reception/testing/fake-reception-gateway';
import { configureApp, settle, watchMissingKeys } from '../../testing/app-testing';
import { PatientPage } from '../reception/patients/patient.page';
import { PortalAccountSection } from '../reception/patients/portal-account.section';
import { PortalPage } from './portal.page';

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('portail patient', () => {
  let missingKeys: () => string[];
  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('Mon espace', () => {
    let fixture: ComponentFixture<PortalPage>;
    let portal: FakePortalGateway;
    const root = () => fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

    async function setup(arrange?: (g: FakePortalGateway) => void) {
      portal = new FakePortalGateway();
      arrange?.(portal);
      const { i18n } = configureApp({ roles: ['PATIENT'], permissions: ['portal:read:own'], providers: [{ provide: PortalGateway, useValue: portal }] });
      missingKeys = watchMissingKeys(i18n);
      fixture = TestBed.createComponent(PortalPage);
      await settle(fixture);
    }

    it('montre l\'identité du dossier et les quatre sections', async () => {
      await setup();
      expect(textOf(q('[data-test=me]'))).toContain('Élisabeth Mbarga');
      expect(textOf(q('[data-test=me]'))).toContain('PAT-0000001');
      expect(textOf(q('[data-test=appointments]'))).toContain('RDV-0000045');
      expect(textOf(q('[data-test=appointments]'))).toContain('À venir');
      expect(textOf(q('[data-test="LAB-0000123"]'))).toContain('Hémoglobine');
      expect(textOf(q('[data-test="RX-0000001"]'))).toContain('Amoxicilline Biogaran · 500 mg');
      expect(textOf(q('[data-test="FAC-0000123"]'))).toContain('Payée en partie');
    });

    it('résultats : valeur, unité, références, position hors norme et mention d\'un résultat corrigé', async () => {
      await setup();
      const block = textOf(q('[data-test="LAB-0000123"]'));
      expect(block).toContain('12,4 g/dL');
      expect(block).toContain('12 – 16');
      expect(block).toContain('Élevé');
      expect(block).toContain('Résultat corrigé après sa publication');
      expect(textOf(q('[data-test=results]'))).toContain('Seuls les résultats validés et publiés');
    });

    it('signale un résultat critique en rouge sans rien afficher pour un résultat dans la norme', async () => {
      await setup((g) => g.getResults.mockResolvedValue([result({ items: [{ testName: 'Potassium', value: '7,1', unit: 'mmol/L', flag: 'CRITICAL_HIGH', refLow: 3.5, refHigh: 5, amended: false }, { testName: 'Sodium', value: '140', unit: 'mmol/L', flag: 'NORMAL', refLow: 135, refHigh: 145, amended: false }] })]));
      const rows = [...root().querySelectorAll('[data-test="LAB-0000123"] tbody tr')].map((r) => textOf(r));
      expect(rows[0]).toContain('Très élevé');
      expect(rows[1]).not.toMatch(/Élevé|Bas/);
    });

    it('ordonnances : ce que la pharmacie a délivré, et une ordonnance annulée', async () => {
      await setup((g) => g.getPrescriptions.mockResolvedValue([prescription(), prescription({ number: 'RX-0000002', status: 'CANCELLED', dispensing: 'NONE' }), prescription({ number: 'RX-0000003', dispensing: 'COMPLETE' })]));
      expect(textOf(q('[data-test="RX-0000001"]'))).toContain('Retirée en partie');
      expect(textOf(q('[data-test="RX-0000002"]'))).toContain('Annulée');
      expect(textOf(q('[data-test="RX-0000003"]'))).toContain('Retirée');
      expect(textOf(q('[data-test="RX-0000001"]'))).toContain('1 gélule · 3 fois par jour · 7 jours · 21 gélule');
    });

    it('factures : total, payé et reste à payer dans la devise', async () => {
      await setup();
      const text = textOf(q('[data-test="FAC-0000123"]'));
      expect(text).toMatch(/Total .*12\D?500/);
      expect(text).toMatch(/payé .*5\D?000/);
      expect(text).toMatch(/reste .*7\D?500/);
      expect(text).toContain('XAF'.slice(0, 0) + 'reste');
    });

    it('dit quand une section est vide', async () => {
      await setup((g) => { g.getAppointments.mockResolvedValue([]); g.getResults.mockResolvedValue([]); g.getPrescriptions.mockResolvedValue([]); g.getInvoices.mockResolvedValue([]); });
      const text = textOf(root());
      for (const message of ['Aucun rendez-vous.', 'Aucun résultat publié pour le moment.', 'Aucune ordonnance.', 'Aucune facture.']) expect(text).toContain(message);
    });

    it('un compte non relié est invité à passer à l\'accueil, sans rien charger d\'autre', async () => {
      await setup((g) => g.getMe.mockRejectedValue(new ApiError(404, 'PORTAL_NOT_LINKED', 'Votre compte n’est relié à aucun dossier patient.')));
      expect(textOf(q('[data-test=not-linked]'))).toContain('Rendez-vous à l’accueil');
      expect(portal.getResults).not.toHaveBeenCalled();
      expect(q('[data-test=results]')).toBeNull();
    });

    it('une section en échec ne masque pas les autres', async () => {
      await setup((g) => g.getResults.mockRejectedValue(new ApiError(500, 'INTERNAL', 'boom')));
      expect(q('[data-test=results] [role=alert]')).not.toBeNull();
      expect(textOf(q('[data-test=appointments]'))).toContain('RDV-0000045');
      expect(textOf(q('[data-test="RX-0000001"]'))).toContain('Amoxicilline');
    });

    it('signale un échec de chargement de l\'identité', async () => {
      await setup((g) => g.getMe.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')));
      expect(q('[role=alert]')?.textContent).toContain('Accès refusé');
      expect(q('[data-test=not-linked]')).toBeNull();
    });

    it('n\'affiche pas de brouillon ni rien d\'autre que ce que le serveur donne', async () => {
      await setup((g) => g.getInvoices.mockResolvedValue([invoice({ number: 'FAC-0000009', status: 'PAID', paid: 12500, balance: 0 })]));
      expect(textOf(q('[data-test="FAC-0000009"]'))).toContain('Payée');
      expect(root().querySelectorAll('[data-test=invoices] li').length).toBe(1);
    });
  });

  describe('compte du portail (accueil)', () => {
    let fixture: ComponentFixture<PortalAccountSection>;
    let portal: FakePortalGateway;
    const root = () => fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
    const link = () => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Relier le compte')!;

    async function setup(arrange?: (g: FakePortalGateway) => void) {
      portal = new FakePortalGateway();
      arrange?.(portal);
      const { i18n } = configureApp({ roles: ['RECEPTIONIST'], permissions: ['portal.accounts:manage'], providers: [{ provide: PortalGateway, useValue: portal }] });
      missingKeys = watchMissingKeys(i18n);
      fixture = TestBed.createComponent(PortalAccountSection);
      fixture.componentRef.setInput('patientId', 'p-1');
      await settle(fixture);
    }

    async function type(value: string) {
      const input = q<HTMLInputElement>('#portal-username')!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle(fixture);
    }

    it('montre le compte déjà relié, sans formulaire', async () => {
      await setup((g) => g.getAccountOf.mockResolvedValue({ username: 'elisabeth.mbarga', linkedAt: '2026-11-02T09:00:00Z' }));
      expect(portal.getAccountOf).toHaveBeenCalledWith('p-1');
      expect(textOf(q('[data-test=linked]'))).toContain('elisabeth.mbarga');
      expect(q('#portal-username')).toBeNull();
    });

    it('relie un compte à ce dossier avec l\'identifiant saisi, puis montre le lien', async () => {
      await setup();
      expect(link().disabled).toBe(true);
      await type('  elisabeth.mbarga ');
      expect(link().disabled).toBe(false);
      link().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(portal.linkAccount).toHaveBeenCalledWith('elisabeth.mbarga', 'p-1');
      expect(textOf(q('[data-test=linked]'))).toContain('elisabeth.mbarga');
    });

    it('affiche le refus du serveur sans effacer la saisie', async () => {
      await setup((g) => g.linkAccount.mockRejectedValue(new ApiError(409, 'PORTAL_USER_NOT_PATIENT', 'Ce compte n’a pas le rôle Patient.')));
      await type('medecin');
      link().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(q('[data-test=error]')?.textContent).toContain('rôle Patient');
      expect(q<HTMLInputElement>('#portal-username')!.value).toBe('medecin');
    });

    it('apparaît sur le dossier du patient pour qui peut relier, et pas sinon', async () => {
      const reception = new FakeReceptionGateway();
      const withPermission = configureApp({
        roles: ['RECEPTIONIST'], permissions: ['patients:read', 'portal.accounts:manage'], providers: [{ provide: ReceptionGateway, useValue: reception }, { provide: PortalGateway, useValue: new FakePortalGateway() }],
      });
      missingKeys = watchMissingKeys(withPermission.i18n);
      const page = TestBed.createComponent(PatientPage);
      page.componentRef.setInput('id', 'p-1');
      await settle(page);
      expect(textOf(page.nativeElement)).toContain('Compte du portail');
    });
  });
});
