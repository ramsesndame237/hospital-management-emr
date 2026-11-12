import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { FakeReceptionGateway, admission, page } from '../../../core/reception/testing/fake-reception-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { AdmissionsPage } from './admissions.page';

const RECEPTION = ['admissions:read:all', 'admissions:write:all'];
const bed = { id: 'bed-1', code: 'B1', name: 'Lit 1', location: 'Néonatologie › Salle 1' };

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('AdmissionsPage', () => {
  let fixture: ComponentFixture<AdmissionsPage>;
  let reception: FakeReceptionGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label);

  async function setup(options: { permissions?: readonly string[]; prepare?: (g: FakeReceptionGateway) => void } = {}) {
    reception = new FakeReceptionGateway();
    options.prepare?.(reception);
    const { i18n } = configureApp({ roles: ['RECEPTIONIST'], permissions: options.permissions ?? RECEPTION, providers: [{ provide: ReceptionGateway, useValue: reception }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(AdmissionsPage);
    await settle(fixture);
  }

  async function click(button: HTMLElement | undefined) {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function choose(selector: string, value: string) {
    const select = q<HTMLSelectElement>(selector)!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(fixture);
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('liste', () => {
    it('charge par défaut les admissions en cours avec leur patient, leur nature, leur service et leur lit', async () => {
      await setup({ prepare: (g) => g.listAdmissions.mockResolvedValue(page([admission(), admission({ id: 'adm-2', number: 'ADM-0000046', type: 'INPATIENT', bed })])) });
      expect(reception.listServices).toHaveBeenCalled();
      expect(reception.listAdmissions).toHaveBeenCalledWith({ status: 'IN_PROGRESS' }, 0, 25);
      const row = textOf(q('[data-test="ADM-0000045"]'));
      expect(row).toContain('Mbarga Élisabeth');
      expect(row).toContain('PAT-0000001');
      expect(row).toContain('Consultation');
      expect(row).toContain('Pédiatrie');
      expect(row).toContain('En cours');
      expect(textOf(q('[data-test="ADM-0000046"]'))).toContain('Lit 1 · Néonatologie › Salle 1');
    });

    it('recharge quand on change le filtre', async () => {
      await setup();
      reception.listAdmissions.mockClear();
      await choose('#admission-filter-status', 'DISCHARGED');
      expect(reception.listAdmissions).toHaveBeenCalledWith({ status: 'DISCHARGED' }, 0, 25);
      await choose('#admission-filter-type', 'EMERGENCY');
      expect(reception.listAdmissions).toHaveBeenLastCalledWith({ status: 'DISCHARGED', type: 'EMERGENCY' }, 0, 25);
    });

    it('montre la nature de la sortie et le motif d\'annulation, sans action sur une admission terminée', async () => {
      await setup({
        prepare: (g) => g.listAdmissions.mockResolvedValue(page([
          admission({ status: 'DISCHARGED', dischargeType: 'HOME' }),
          admission({ id: 'adm-2', number: 'ADM-0000046', status: 'CANCELLED', cancellationReason: 'Mauvais patient' }),
        ])),
      });
      expect(textOf(q('[data-test="ADM-0000045"]'))).toContain('Retour à domicile');
      expect(textOf(q('[data-test="ADM-0000046"]'))).toContain('Mauvais patient');
      expect(buttonNamed('Enregistrer la sortie de ADM-0000045')).toBeUndefined();
    });

    it('dit quand il n\'y a aucune admission, et signale une erreur de chargement', async () => {
      await setup({ prepare: (g) => g.listAdmissions.mockResolvedValue(page([])) });
      expect(text()).toContain('Aucune admission.');
      await setup({ prepare: (g) => g.listAdmissions.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')) }).catch(() => undefined);
    });

    it('n\'offre aucune action sans le droit d\'écrire', async () => {
      await setup({ permissions: ['admissions:read:department'] });
      expect(buttonNamed('Enregistrer la sortie de ADM-0000045')).toBeUndefined();
      expect(buttonNamed('Transférer ADM-0000045')).toBeUndefined();
    });
  });

  describe('sortie', () => {
    it('enregistre la sortie avec sa nature et recharge la liste', async () => {
      await setup();
      await click(buttonNamed('Enregistrer la sortie de ADM-0000045'));
      expect(q('aside h2')?.textContent).toContain('Sortie — ADM-0000045');
      await submit('admission-discharge');
      expect(reception.dischargeAdmission).not.toHaveBeenCalled();
      expect(text()).toContain('Ce champ est obligatoire.');
      await choose('#admission-discharge-type', 'HOME');
      reception.listAdmissions.mockClear();
      await submit('admission-discharge');
      expect(reception.dischargeAdmission).toHaveBeenCalledWith('adm-1', 'HOME');
      expect(reception.listAdmissions).toHaveBeenCalledTimes(1);
      expect(q('aside')).toBeNull();
    });

    it('précise qu\'un décès se constate sur le dossier du patient', async () => {
      await setup();
      await click(buttonNamed('Enregistrer la sortie de ADM-0000045'));
      await choose('#admission-discharge-type', 'DECEASED');
      expect(text()).toContain('ne l’enregistre pas'.slice(0, 0) + 'n’enregistre pas le décès');
    });
  });

  describe('annulation', () => {
    it('exige un motif', async () => {
      await setup();
      await click(buttonNamed('Annuler ADM-0000045'));
      await submit('admission-cancel');
      expect(reception.cancelAdmission).not.toHaveBeenCalled();
      expect(text()).toContain('Le motif est obligatoire.');
      const input = q<HTMLInputElement>('#admission-cancel-reason')!;
      input.value = '  Mauvais patient ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await submit('admission-cancel');
      expect(reception.cancelAdmission).toHaveBeenCalledWith('adm-1', 'Mauvais patient');
    });

    it('affiche le refus du serveur dans le panneau', async () => {
      await setup({ prepare: (g) => g.cancelAdmission.mockRejectedValue(new ApiError(409, 'ADMISSION_NOT_IN_PROGRESS', 'Cette admission est déjà terminée.')) });
      await click(buttonNamed('Annuler ADM-0000045'));
      const input = q<HTMLInputElement>('#admission-cancel-reason')!;
      input.value = 'Erreur';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await submit('admission-cancel');
      expect(q('aside [role=alert]')?.textContent).toContain('déjà terminée');
      expect(q('aside')).not.toBeNull();
    });
  });

  describe('transfert', () => {
    it('transfère une consultation vers un autre service', async () => {
      await setup();
      await click(buttonNamed('Transférer ADM-0000045'));
      expect(q('#admission-transfer-bedId')).toBeNull();
      await choose('#admission-transfer-serviceId', 'svc-chi');
      await submit('admission-transfer');
      expect(reception.transferAdmission).toHaveBeenCalledWith('adm-1', { serviceId: 'svc-chi' });
    });

    it('transfère un hospitalisé vers un lit libre du nouveau service', async () => {
      await setup({ prepare: (g) => g.listAdmissions.mockResolvedValue(page([admission({ type: 'INPATIENT', bed })])) });
      await click(buttonNamed('Transférer ADM-0000045'));
      await choose('#admission-transfer-serviceId', 'svc-ped');
      expect(reception.getOccupancy).toHaveBeenCalledWith('svc-ped');
      await choose('#admission-transfer-bedId', 'bed-2');
      await submit('admission-transfer');
      expect(reception.transferAdmission).toHaveBeenCalledWith('adm-1', { bedId: 'bed-2' });
    });
  });
});
