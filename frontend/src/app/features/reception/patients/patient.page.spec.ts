import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { FakeReceptionGateway, admission, page, patient } from '../../../core/reception/testing/fake-reception-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { PatientPage } from './patient.page';

const RECEPTION = ['patients:read', 'patients:write', 'admissions:read:all', 'admissions:write:all'];

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('PatientPage', () => {
  let fixture: ComponentFixture<PatientPage>;
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
    fixture = TestBed.createComponent(PatientPage);
    fixture.componentRef.setInput('id', 'p-1');
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

  async function submit() {
    q<HTMLFormElement>('#open-admission')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('dossier', () => {
    it('montre l\'identité, les coordonnées, la pièce et la personne à prévenir', async () => {
      await setup();
      expect(reception.getPatient).toHaveBeenCalledWith('p-1');
      expect(q('h1')?.textContent).toContain('Mbarga Élisabeth');
      expect(text()).toContain('PAT-0000001');
      expect(text()).toContain('Femme');
      expect(text()).toContain('1990-03-14 (36 ans');
      const identity = textOf(q('[data-test=identity]'));
      expect(identity).toContain('Douala');
      expect(identity).toContain('+237 655 00 00 00');
      expect(identity).toContain('Rue de la Joie, Bastos, Yaoundé, Centre, CM');
      expect(identity).toContain('Carte nationale d’identité · 123456789');
      expect(identity).toContain('Jeanne Ngo (Conjoint(e)) · +237 677 00 00 00');
      expect(q('a[href="/patients/p-1/edit"]')).not.toBeNull();
    });

    it('signale un dossier introuvable', async () => {
      await setup({ prepare: (g) => g.getPatient.mockRejectedValue(new ApiError(404, 'PATIENT_NOT_FOUND', 'Dossier patient introuvable.')) });
      expect(q('[role=alert]')?.textContent).toContain('introuvable');
      expect(q('h1')).toBeNull();
    });

    it('signale un patient décédé et n\'offre plus d\'ouvrir d\'admission', async () => {
      await setup({ prepare: (g) => g.getPatient.mockResolvedValue(patient({ status: 'DECEASED', dateOfDeath: '2026-10-20' })) });
      expect(text()).toContain('Décédé(e) le 2026-10-20');
      expect(buttonNamed('Ouvrir une admission')).toBeUndefined();
    });

    it('liste les admissions du patient avec leur service et leur lit', async () => {
      await setup({ prepare: (g) => g.listAdmissions.mockResolvedValue(page([admission(), admission({ id: 'adm-2', number: 'ADM-0000046', type: 'INPATIENT', bed: { id: 'bed-2', code: 'B2', name: 'Lit 2', location: 'Néonatologie › Salle 1' } })])) });
      expect(reception.listAdmissions).toHaveBeenCalledWith({ patientId: 'p-1' }, 0, 10);
      expect(textOf(q('[data-test="ADM-0000045"]'))).toContain('Consultation');
      expect(textOf(q('[data-test="ADM-0000045"]'))).toContain('Pédiatrie');
      expect(textOf(q('[data-test="ADM-0000046"]'))).toContain('Hospitalisation');
      expect(textOf(q('[data-test="ADM-0000046"]'))).toContain('Lit 2 (Néonatologie › Salle 1)');
    });

    it('garde l\'identité visible quand les admissions ne se chargent pas', async () => {
      await setup({ permissions: ['patients:read'], prepare: (g) => g.listAdmissions.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')) });
      expect(q('h1')?.textContent).toContain('Mbarga');
      expect(text()).toContain('Aucune admission.');
      expect(q('a[href="/patients/p-1/edit"]')).toBeNull();
      expect(buttonNamed('Ouvrir une admission')).toBeUndefined();
    });
  });

  describe('ouverture d\'une admission', () => {
    it('ouvre une consultation dans un service et recharge la liste', async () => {
      await setup();
      await click(buttonNamed('Ouvrir une admission'));
      expect(q('aside h2')?.textContent).toContain('Admission de Mbarga Élisabeth');
      expect(q('#open-admission-bedId')).toBeNull();
      await choose('#open-admission-type', 'OUTPATIENT');
      await choose('#open-admission-serviceId', 'svc-ped');
      reception.listAdmissions.mockClear();
      await submit();
      expect(reception.openAdmission).toHaveBeenCalledWith({ patientId: 'p-1', type: 'OUTPATIENT', serviceId: 'svc-ped' });
      expect(reception.listAdmissions).toHaveBeenCalledTimes(1);
      expect(q('aside')).toBeNull();
    });

    it('exige un lit libre pour une hospitalisation et ne propose que les lits libres du service choisi', async () => {
      await setup();
      await click(buttonNamed('Ouvrir une admission'));
      await choose('#open-admission-type', 'INPATIENT');
      expect(q('#open-admission-bedId')).not.toBeNull();
      await choose('#open-admission-serviceId', 'svc-ped');
      expect(reception.getOccupancy).toHaveBeenCalledWith('svc-ped');
      const options = [...q<HTMLSelectElement>('#open-admission-bedId')!.options].map((o) => o.textContent!.trim());
      expect(options.some((o) => o.includes('Lit 2'))).toBe(true);
      expect(options.some((o) => o.includes('Lit 1'))).toBe(false);
      await submit();
      expect(reception.openAdmission).not.toHaveBeenCalled();
      await choose('#open-admission-bedId', 'bed-2');
      await submit();
      expect(reception.openAdmission).toHaveBeenCalledWith({ patientId: 'p-1', type: 'INPATIENT', serviceId: 'svc-ped', bedId: 'bed-2' });
    });

    it('dit quand le service n\'a aucun lit libre', async () => {
      await setup({ prepare: (g) => g.getOccupancy.mockResolvedValue({ serviceId: 'svc-ped', capacity: 1, occupied: 1, free: 0, beds: [{ bedId: 'bed-1', code: 'B1', name: 'Lit 1', location: 'Salle 1', active: true, occupied: true, admissionId: 'adm-9' }] }) });
      await click(buttonNamed('Ouvrir une admission'));
      await choose('#open-admission-type', 'INPATIENT');
      await choose('#open-admission-serviceId', 'svc-ped');
      expect(text()).toContain('Aucun lit libre dans ce service.');
    });

    it('affiche le refus du serveur sans fermer le panneau', async () => {
      await setup({ prepare: (g) => g.openAdmission.mockRejectedValue(new ApiError(409, 'ADMISSION_PATIENT_ALREADY_INPATIENT', 'Ce patient est déjà hospitalisé.')) });
      await click(buttonNamed('Ouvrir une admission'));
      await choose('#open-admission-type', 'OUTPATIENT');
      await choose('#open-admission-serviceId', 'svc-ped');
      await submit();
      expect(q('aside [role=alert]')?.textContent).toContain('déjà hospitalisé');
      expect(q('aside')).not.toBeNull();
    });

    it('referme le panneau quand on annule', async () => {
      await setup();
      await click(buttonNamed('Ouvrir une admission'));
      await click(buttonNamed('Annuler'));
      expect(q('aside')).toBeNull();
      expect(buttonNamed('Ouvrir une admission')).toBeDefined();
    });

    it('n\'offre pas d\'ouvrir une admission sans le droit d\'écrire', async () => {
      await setup({ permissions: ['patients:read', 'admissions:read:all'] });
      expect(buttonNamed('Ouvrir une admission')).toBeUndefined();
    });
  });
});
