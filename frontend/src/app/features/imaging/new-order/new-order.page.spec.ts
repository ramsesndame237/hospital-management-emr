import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import { FakeImagingGateway, examType, page } from '../../../core/imaging/testing/fake-imaging-gateway';
import { FakePatientSearchGateway } from '../../../core/patients/testing/fake-patient-search-gateway';
import { PatientSearchGateway } from '../../../core/patients/patient-search.gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ImagingNewOrderPage } from './new-order.page';

const DOCTOR = ['imaging.orders:order', 'imaging.orders:read:own', 'imaging.catalog:read'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('ImagingNewOrderPage', () => {
  let fixture: ComponentFixture<ImagingNewOrderPage>;
  let imaging: FakeImagingGateway;
  let patients: FakePatientSearchGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(options: { permissions?: readonly string[]; prepare?: (g: FakeImagingGateway) => void; inputs?: Record<string, string> } = {}) {
    imaging = new FakeImagingGateway();
    patients = new FakePatientSearchGateway();
    options.prepare?.(imaging);
    const { i18n } = configureApp({ roles: ['DOCTOR'], permissions: options.permissions ?? DOCTOR, providers: [{ provide: ImagingGateway, useValue: imaging }, { provide: PatientSearchGateway, useValue: patients }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ImagingNewOrderPage);
    for (const [name, value] of Object.entries(options.inputs ?? {})) fixture.componentRef.setInput(name, value);
    await settle(fixture);
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  async function pickPatient() {
    await type('#patient-search-q', 'mbarga');
    await submit('patient-search');
    await click(q<HTMLButtonElement>('table button')!);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('commence par la recherche du patient, sans proposer d\'examens', async () => {
    await setup();
    expect(q('h1')?.textContent).toContain('Nouvelle demande d’examen');
    expect(q('#patient-search')).not.toBeNull();
    expect(q('#exam-search')).toBeNull();
    expect(imaging.listExamTypes).not.toHaveBeenCalled();
  });

  it('une fois le patient choisi, propose le catalogue et attend le choix d\'un examen', async () => {
    await setup();
    await pickPatient();
    expect(patients.search).toHaveBeenCalledWith('mbarga', 10);
    expect(imaging.listExamTypes).toHaveBeenCalledWith({}, 0, 10);
    expect(q('#patient-search')).toBeNull();
    expect(text()).toContain('Radiographie du thorax de face');
    expect(text()).toContain('Échographie abdominale');
    expect(text()).toContain('Aucun examen choisi.');
    expect(q('#imaging-order')).toBeNull();
  });

  it('cherche un examen par texte', async () => {
    await setup();
    await pickPatient();
    await type('#exam-search-q', ' thorax ');
    await submit('exam-search');
    expect(imaging.listExamTypes).toHaveBeenLastCalledWith({ search: 'thorax' }, 0, 10);
  });

  it('un examen irradiant est signalé avant l\'envoi, un examen à contraste aussi, et la préparation est rappelée', async () => {
    await setup({ prepare: (g) => g.listExamTypes.mockResolvedValue(page([examType({ usesContrast: true, modality: 'CT', preparation: 'À jeun depuis 4 heures.' }), examType({ id: 'e-2', code: 'ECHO', name: 'Échographie', modality: 'ULTRASOUND' })])) });
    await pickPatient();
    await click(buttonNamed('Choisir Radiographie du thorax de face'));
    expect(q('[data-test=ionizing]')?.textContent).toContain('Examen irradiant');
    expect(q('[data-test=contrast]')?.textContent).toContain('produit de contraste');
    expect(q('[data-test=preparation]')?.textContent).toContain('À jeun depuis 4 heures.');
    await click(buttonNamed('Retirer Radiographie du thorax de face'));
    await click(buttonNamed('Choisir Échographie'));
    expect(q('[data-test=ionizing]')).toBeNull();
    expect(q('[data-test=contrast]')).toBeNull();
  });

  it('la question clinique est obligatoire : rien n\'est envoyé sans elle', async () => {
    await setup();
    await pickPatient();
    await click(buttonNamed('Choisir Radiographie du thorax de face'));
    await submit('imaging-order');
    expect(text()).toContain('La question clinique est obligatoire.');
    expect(imaging.order).not.toHaveBeenCalled();
  });

  it('envoie la demande (examen, priorité, provenance, question) puis ouvre la demande créée', async () => {
    await setup();
    await pickPatient();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await click(buttonNamed('Choisir Radiographie du thorax de face'));
    const priority = q<HTMLSelectElement>('#imaging-order-priority')!;
    priority.value = 'STAT';
    priority.dispatchEvent(new Event('change'));
    await type('#imaging-order-question', ' Douleur thoracique après chute. ');
    await submit('imaging-order');
    expect(imaging.order).toHaveBeenCalledWith({ patientId: 'p-1', examTypeId: 'e-1', clinicalQuestion: 'Douleur thoracique après chute.', priority: 'STAT', source: 'OPD' });
    expect(navigate).toHaveBeenCalledWith(['/imaging/orders', 'o-1']);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Demande IMG-0000123 envoyée.');
  });

  it('le service d\'imagerie ouvre sur « Extérieur »', async () => {
    await setup({ permissions: [...DOCTOR, 'imaging.orders:read:all'] });
    await pickPatient();
    await click(buttonNamed('Choisir Radiographie du thorax de face'));
    expect(q<HTMLSelectElement>('#imaging-order-source')?.value).toBe('EXTERNAL');
  });

  it('affiche le refus du serveur sans quitter l\'écran ni perdre la saisie', async () => {
    await setup({ prepare: (g) => g.order.mockRejectedValue(new ApiError(409, 'IMG_EXAM_INACTIVE', 'L’examen RX-THORAX est retiré du catalogue : on ne peut plus le demander.')) });
    await pickPatient();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await click(buttonNamed('Choisir Radiographie du thorax de face'));
    await type('#imaging-order-question', 'Toux.');
    await submit('imaging-order');
    expect(q('#imaging-order [role=alert]')?.textContent).toContain('retiré du catalogue');
    expect(q<HTMLTextAreaElement>('#imaging-order-question')?.value).toBe('Toux.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('change de patient : retour à la recherche, choix vidé', async () => {
    await setup();
    await pickPatient();
    await click(buttonNamed('Choisir Radiographie du thorax de face'));
    await click(buttonNamed('Changer de patient'));
    expect(q('#patient-search')).not.toBeNull();
    expect(q('#exam-search')).toBeNull();
    await pickPatient();
    expect(text()).toContain('Aucun examen choisi.');
  });

  it('venu de la consultation : le patient est déjà choisi, la demande est rattachée à la consultation', async () => {
    await setup({ inputs: { patientNumber: 'PAT-0000001', encounterId: 'enc-1' } });
    expect(patients.search).toHaveBeenCalledWith('PAT-0000001', 5);
    expect(q('[data-test=linked]')).not.toBeNull();
    expect(q('#patient-search')).toBeNull();
    expect(text()).toContain('Mbarga Élisabeth');
    await click(buttonNamed('Choisir Radiographie du thorax de face'));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await type('#imaging-order-question', 'Contrôle.');
    await submit('imaging-order');
    expect(imaging.order).toHaveBeenCalledWith({ patientId: 'p-1', examTypeId: 'e-1', clinicalQuestion: 'Contrôle.', priority: 'ROUTINE', source: 'OPD', encounterId: 'enc-1' });
  });

  it('signale une erreur de chargement du catalogue', async () => {
    await setup({ prepare: (g) => g.listExamTypes.mockRejectedValue(new ApiError(500, 'HTTP_500', 'Une erreur interne est survenue.')) });
    await pickPatient();
    expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
  });
});
