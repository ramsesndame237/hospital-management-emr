import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, queueRow, rxLine, toDispense } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { DispensePage } from './dispense.page';
import { DispensingQueuePage } from './dispensing-queue.page';

const PHARMACIST = ['pharmacy.dispensing:read', 'pharmacy.dispensing:dispense'];

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('Dispensation en pharmacie', () => {
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];

  function prepare(permissions: readonly string[], arrange?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    arrange?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions, providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('file des ordonnances', () => {
    let fixture: ComponentFixture<DispensingQueuePage>;
    const root = () => fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

    async function setup(arrange?: (g: FakePharmacyGateway) => void) {
      prepare(PHARMACIST, arrange);
      fixture = TestBed.createComponent(DispensingQueuePage);
      await settle(fixture);
    }

    it('liste les ordonnances avec patient, reste à délivrer, état et lien vers la délivrance', async () => {
      await setup();
      expect(pharmacy.getDispensingQueue).toHaveBeenCalled();
      const row = textOf(q('[data-test="RX-0000001"]'));
      expect(row).toContain('Mbarga Élisabeth');
      expect(row).toContain('PAT-0000001');
      expect(row).toContain('21 unité(s) · 1 ligne(s)');
      expect(row).toContain('À délivrer');
      expect(q('[data-test="RX-0000001"] a')?.getAttribute('href')).toBe('/pharmacy/prescriptions/rx-1');
    });

    it('signale une ordonnance délivrée en partie et une allergie connue non levée', async () => {
      await setup();
      const row = textOf(q('[data-test="RX-0000002"]'));
      expect(row).toContain('Délivrée en partie');
      expect(row).toContain('Allergie connue');
      expect(textOf(q('[data-test="RX-0000001"]'))).not.toContain('Allergie connue');
    });

    it('dit quand rien n\'attend, recharge sur demande et signale une erreur', async () => {
      await setup((g) => g.getDispensingQueue.mockResolvedValue([]));
      expect(textOf(root())).toContain('Aucune ordonnance à délivrer.');
      pharmacy.getDispensingQueue.mockResolvedValue([queueRow()]);
      [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Actualiser')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(q('[data-test="RX-0000001"]')).not.toBeNull();
      pharmacy.getDispensingQueue.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.'));
      [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Actualiser')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(q('[role=alert]')?.textContent).toContain('Accès refusé');
    });
  });

  describe('délivrance', () => {
    let fixture: ComponentFixture<DispensePage>;
    const root = () => fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
    const text = () => textOf(root());
    const submitButton = () => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Délivrer');

    async function setup(permissions: readonly string[] = PHARMACIST, arrange?: (g: FakePharmacyGateway) => void) {
      prepare(permissions, arrange);
      fixture = TestBed.createComponent(DispensePage);
      fixture.componentRef.setInput('id', 'rx-1');
      await settle(fixture);
    }

    async function type(selector: string, value: string) {
      const input = q<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle(fixture);
    }

    async function submit() {
      submitButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
    }

    it('montre le patient, les lignes avec prescrit, délivré, reste, stock et prélèvement premier périmé, premier sorti', async () => {
      await setup();
      expect(pharmacy.getPrescription).toHaveBeenCalledWith('rx-1');
      expect(q('h1')?.textContent).toContain('RX-0000001');
      expect(textOf(q('[data-test=patient]'))).toContain('Mbarga Élisabeth');
      const line = textOf(q('[data-test="line-0"]'));
      expect(line).toContain('Amoxicilline Biogaran · 500 mg');
      expect(line).toContain('1 gélule · 3 fois par jour · 7 jours');
      expect(line).toContain('Prescrit 21 · délivré 0 · reste 21 (gélule)');
      expect(line).toContain('Stock délivrable : 120');
      expect(line).toContain('LOT-A (2027-05-31) × 21');
      expect(text()).toContain('Rien n’a encore été délivré.');
    });

    it('propose de délivrer tout le reste, dans la limite du stock délivrable', async () => {
      await setup(PHARMACIST, (g) => g.getPrescription.mockResolvedValue(toDispense({ lines: [rxLine({ dispensable: 8 })] })));
      expect(q<HTMLInputElement>('#dsp-0-qty')!.value).toBe('8');
    });

    it('délivre : envoie les quantités saisies et la remarque, puis affiche la dispensation et l\'ordonnance mise à jour', async () => {
      await setup();
      await type('#dsp-0-qty', '10');
      await type('#dsp-notes', ' Conseils donnés ');
      await submit();
      expect(pharmacy.dispense).toHaveBeenCalledWith('rx-1', { lines: [{ position: 0, quantity: 10 }], notes: 'Conseils donnés' });
      expect(textOf(q('[data-test="DSP-0000001"]'))).toContain('Ligne 1 : 21 unité(s) du lot LOT-A (péremption 2027-05-31)');
      expect(text()).toContain('Cette ordonnance est entièrement délivrée.');
      expect(q('#dsp-0-qty')).toBeNull();
      expect(submitButton()).toBeUndefined();
    });

    it('n\'envoie pas les lignes à zéro et exige au moins une quantité', async () => {
      await setup();
      await type('#dsp-0-qty', '0');
      await submit();
      expect(q('[data-test=notice]')?.textContent).toContain('Indiquez au moins une quantité à délivrer.');
      expect(pharmacy.dispense).not.toHaveBeenCalled();
    });

    it.each([
      ['abc', 'la quantité doit être un entier positif'],
      ['1,5', 'la quantité doit être un entier positif'],
      ['22', 'il ne reste que 21 unité(s) à délivrer'],
    ])('refuse la quantité « %s » sans appeler le serveur', async (value, message) => {
      await setup();
      await type('#dsp-0-qty', value);
      await submit();
      expect(q('[data-test=notice]')?.textContent).toContain(message);
      expect(pharmacy.dispense).not.toHaveBeenCalled();
    });

    it('refuse de dépasser le stock délivrable en le disant', async () => {
      await setup(PHARMACIST, (g) => g.getPrescription.mockResolvedValue(toDispense({ lines: [rxLine({ dispensable: 5 })] })));
      await type('#dsp-0-qty', '10');
      await submit();
      expect(q('[data-test=notice]')?.textContent).toContain('seulement 5 unité(s) en stock délivrable');
      expect(pharmacy.dispense).not.toHaveBeenCalled();
    });

    describe('allergies', () => {
      const alerting = (override: string | null = null) => toDispense({
        lines: [rxLine({ allergyAlerts: [{ substance: 'Amoxicilline', severity: 'SEVERE' }], needsAcknowledgement: override === null, allergyOverride: override })],
      });

      it('signale l\'allergie et exige le motif du pharmacien quand le médecin ne l\'a pas levée', async () => {
        await setup(PHARMACIST, (g) => g.getPrescription.mockResolvedValue(alerting()));
        expect(textOf(q('[data-test="alert-0"]'))).toContain('Allergie connue : Amoxicilline (gravité sévère).');
        await submit();
        expect(q('[data-test=notice]')?.textContent).toContain('une allergie est connue que le médecin n’a pas levée');
        expect(pharmacy.dispense).not.toHaveBeenCalled();
        await type('#dsp-0-ack', 'ab');
        await submit();
        expect(pharmacy.dispense).not.toHaveBeenCalled();
        await type('#dsp-0-ack', 'Discuté avec le médecin');
        await submit();
        expect(pharmacy.dispense).toHaveBeenCalledWith('rx-1', { lines: [{ position: 0, quantity: 21, allergyOverride: 'Discuté avec le médecin' }] });
      });

      it('ne demande rien quand le médecin avait levé l\'allergie, et affiche son motif', async () => {
        await setup(PHARMACIST, (g) => g.getPrescription.mockResolvedValue(alerting('Bénéfice supérieur au risque')));
        expect(q('#dsp-0-ack')).toBeNull();
        expect(text()).toContain('Le médecin a prescrit malgré une allergie connue : Bénéfice supérieur au risque');
        await submit();
        expect(pharmacy.dispense).toHaveBeenCalledWith('rx-1', { lines: [{ position: 0, quantity: 21 }] });
      });
    });

    it('affiche le refus du serveur sans effacer la saisie', async () => {
      await setup(PHARMACIST, (g) => g.dispense.mockRejectedValue(new ApiError(409, 'PHARMACY_STOCK_INSUFFICIENT_FOR_LINE', 'Ligne 1 : il manque 3 unité(s) en stock délivrable. Rien n’a été délivré.')));
      await type('#dsp-0-qty', '10');
      await submit();
      expect(q('[data-test=notice]')?.textContent).toContain('Rien n’a été délivré');
      expect(q<HTMLInputElement>('#dsp-0-qty')!.value).toBe('10');
    });

    it('ne propose pas de délivrer une ordonnance annulée, une ordonnance entièrement délivrée, ni sans le droit de délivrer', async () => {
      await setup(PHARMACIST, (g) => g.getPrescription.mockResolvedValue(toDispense({ status: 'CANCELLED' })));
      expect(text()).toContain('Cette ordonnance est annulée : elle ne se délivre pas.');
      expect(submitButton()).toBeUndefined();
    });

    it('lecture seule sans le droit de délivrer', async () => {
      await setup(['pharmacy.dispensing:read']);
      expect(q('#dsp-0-qty')).toBeNull();
      expect(submitButton()).toBeUndefined();
      expect(q('[data-test="line-0"]')).not.toBeNull();
    });

    it('signale une ordonnance introuvable', async () => {
      await setup(PHARMACIST, (g) => g.getPrescription.mockRejectedValue(new ApiError(404, 'PHARMACY_PRESCRIPTION_NOT_FOUND', 'Ordonnance introuvable.')));
      expect(q('[data-test=error]')?.textContent).toContain('introuvable');
      expect(q('h1')).toBeNull();
    });
  });
});
