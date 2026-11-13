import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { FakeReceptionGateway, patient, summary } from '../../../core/reception/testing/fake-reception-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { PatientFormPage } from './patient-form.page';

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('PatientFormPage', () => {
  let fixture: ComponentFixture<PatientFormPage>;
  let reception: FakeReceptionGateway;
  let navigate: ReturnType<typeof vi.spyOn>;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());

  async function setup(options: { id?: string; prepare?: (g: FakeReceptionGateway) => void } = {}) {
    reception = new FakeReceptionGateway();
    options.prepare?.(reception);
    const { i18n } = configureApp({ roles: ['RECEPTIONIST'], permissions: ['patients:read', 'patients:write'], providers: [{ provide: ReceptionGateway, useValue: reception }] });
    missingKeys = watchMissingKeys(i18n);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(PatientFormPage);
    if (options.id) fixture.componentRef.setInput('id', options.id);
    await settle(fixture);
  }

  async function type(name: string, value: string) {
    const input = q<HTMLInputElement>(`#patient-${name}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  async function choose(name: string, value: string) {
    const select = q<HTMLSelectElement>(`#patient-${name}`)!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }

  async function submit() {
    q<HTMLFormElement>('#patient')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  async function fillIdentity() {
    await type('lastName', '  Ndongo ');
    await type('firstName', 'Paul');
    await choose('sex', 'MALE');
    await type('birthDate', '1985-06-02');
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('ouverture d\'un dossier', () => {
    it('ouvre le dossier avec les champs obligatoires, sans rien envoyer de vide, et ouvre le dossier créé', async () => {
      await setup();
      expect(text()).toContain('Nouveau dossier patient');
      await fillIdentity();
      await submit();
      expect(reception.registerPatient).toHaveBeenCalledWith({
        identityStatus: 'CONFIRMED', lastName: 'Ndongo', firstName: 'Paul', sex: 'MALE', birthDate: '1985-06-02', birthDateEstimated: false,
      });
      expect(navigate).toHaveBeenCalledWith(['/patients', 'p-new']);
    });

    it('envoie les coordonnées, la pièce d\'identité et la personne à prévenir saisies', async () => {
      await setup();
      await fillIdentity();
      await type('phone', '+237 655 00 00 00');
      await type('addressCity', 'Yaoundé');
      await type('nationality', 'cm');
      await choose('documentType', 'NATIONAL_ID');
      await type('documentNumber', '123456789');
      await type('kinName', 'Jeanne Ngo');
      await choose('kinRelationship', 'SPOUSE');
      await type('kinPhone', '+237 677 00 00 00');
      await submit();
      expect(reception.registerPatient).toHaveBeenCalledWith(expect.objectContaining({
        phone: '+237 655 00 00 00', nationality: 'CM', address: { line: null, quarter: null, city: 'Yaoundé', region: null, country: null },
        identityDocument: { type: 'NATIONAL_ID', number: '123456789' }, nextOfKin: { name: 'Jeanne Ngo', relationship: 'SPOUSE', phone: '+237 677 00 00 00' },
      }));
    });

    it('refuse un dossier sans les champs obligatoires ou avec une date mal écrite, sans appeler le serveur', async () => {
      await setup();
      await submit();
      expect(reception.registerPatient).not.toHaveBeenCalled();
      expect(text()).toContain('Ce champ est obligatoire.');
      await fillIdentity();
      await type('birthDate', '02/06/1985');
      await submit();
      expect(text()).toContain('Saisissez la date au format AAAA-MM-JJ.');
      expect(reception.registerPatient).not.toHaveBeenCalled();
    });

    it('refuse une pièce d\'identité ou une personne à prévenir incomplète', async () => {
      await setup();
      await fillIdentity();
      await type('documentNumber', '123');
      await submit();
      expect(text()).toContain('Indiquez le type et le numéro de la pièce d’identité');
      await type('documentNumber', '');
      await type('kinName', 'Jeanne');
      await submit();
      expect(text()).toContain('Indiquez le nom, le lien et le téléphone de la personne à prévenir');
      expect(reception.registerPatient).not.toHaveBeenCalled();
    });

    it('liste les dossiers qui ressemblent, propose de les ouvrir, et n\'enregistre un doublon que sur confirmation', async () => {
      const candidate = { ...summary({ id: 'p-9', number: 'PAT-0000009', lastName: 'Ndongo', firstName: 'Paul', birthDate: '1985-06-02' }), reasons: ['NAME_AND_BIRTH_DATE'] };
      await setup({ prepare: (g) => g.registerPatient.mockRejectedValueOnce(new ApiError(409, 'PATIENT_POSSIBLE_DUPLICATE', 'Des dossiers ressemblent.', [], null, { candidates: [candidate] })) });
      await fillIdentity();
      await submit();
      const panel = textOf(q('[data-test=duplicates]'));
      expect(panel).toContain('Ndongo Paul');
      expect(panel).toContain('PAT-0000009');
      expect(panel).toContain('même nom et même date de naissance');
      expect(q('[data-test=duplicates] a')?.getAttribute('href')).toBe('/patients/p-9');
      expect(navigate).not.toHaveBeenCalled();

      [...root().querySelectorAll<HTMLButtonElement>('[data-test=duplicates] button')].find((b) => b.textContent!.includes('enregistrer quand même'))!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(reception.registerPatient).toHaveBeenLastCalledWith(expect.objectContaining({ lastName: 'Ndongo', ignoreDuplicates: true }));
      expect(navigate).toHaveBeenCalledWith(['/patients', 'p-new']);
    });

    it('affiche un autre refus du serveur en bandeau', async () => {
      await setup({ prepare: (g) => g.registerPatient.mockRejectedValue(new ApiError(422, 'PATIENT_BIRTH_DATE_INVALID', 'La date de naissance est invalide.')) });
      await fillIdentity();
      await submit();
      expect(q('[role=alert]')?.textContent).toContain('date de naissance est invalide');
      expect(q('[data-test=duplicates]')).toBeNull();
    });

    it('revient à la recherche quand on annule', async () => {
      await setup();
      [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Annuler')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(fixture);
      expect(navigate).toHaveBeenCalledWith(['/patients']);
    });
  });

  describe('correction d\'un dossier', () => {
    it('charge le dossier, préremplit le formulaire et exige un motif', async () => {
      await setup({ id: 'p-1' });
      expect(reception.getPatient).toHaveBeenCalledWith('p-1');
      expect(text()).toContain('Corriger le dossier');
      expect(q<HTMLInputElement>('#patient-lastName')!.value).toBe('Mbarga');
      expect(q<HTMLInputElement>('#patient-documentNumber')!.value).toBe('123456789');
      await type('lastName', 'Mbarga-Ndongo');
      await submit();
      expect(reception.updatePatient).not.toHaveBeenCalled();
      expect(text()).toContain('Le motif de la correction est obligatoire.');
    });

    it('envoie la correction avec son motif ; une valeur vidée est retirée', async () => {
      await setup({ id: 'p-1' });
      await type('lastName', 'Mbarga-Ndongo');
      await type('occupation', '');
      await type('reason', 'Mariage');
      await submit();
      expect(reception.updatePatient).toHaveBeenCalledWith('p-1', expect.objectContaining({ lastName: 'Mbarga-Ndongo', occupation: null, reason: 'Mariage', birthDateEstimated: false }));
      expect(navigate).toHaveBeenCalledWith(['/patients', 'p-1']);
    });

    it('signale un dossier introuvable', async () => {
      await setup({ id: 'p-404', prepare: (g) => g.getPatient.mockRejectedValue(new ApiError(404, 'PATIENT_NOT_FOUND', 'Dossier patient introuvable.')) });
      expect(q('[role=alert]')?.textContent).toContain('introuvable');
      expect(q('#patient')).toBeNull();
    });

    it('permet de confirmer une identité provisoire', async () => {
      await setup({ id: 'p-1', prepare: (g) => g.getPatient.mockResolvedValue(patient({ identityStatus: 'PROVISIONAL' })) });
      expect(q<HTMLSelectElement>('#patient-identityStatus')!.value).toBe('PROVISIONAL');
    });
  });
});
