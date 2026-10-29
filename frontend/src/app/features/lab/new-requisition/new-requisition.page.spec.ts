import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { FakeLabGateway, requisition } from '../../../core/lab/testing/fake-lab-gateway';
import { FakePatientSearchGateway } from '../../../core/patients/testing/fake-patient-search-gateway';
import { PatientSearchGateway } from '../../../core/patients/patient-search.gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { NewRequisitionPage } from './new-requisition.page';

const DOCTOR = ['lab.requisitions:order', 'lab.requisitions:read:own', 'lab.catalog:read'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('NewRequisitionPage', () => {
  let fixture: ComponentFixture<NewRequisitionPage>;
  let lab: FakeLabGateway;
  let patients: FakePatientSearchGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(permissions: readonly string[] = DOCTOR, prepare?: (g: FakeLabGateway) => void) {
    lab = new FakeLabGateway();
    patients = new FakePatientSearchGateway();
    prepare?.(lab);
    const { i18n } = configureApp({ roles: ['DOCTOR'], permissions, providers: [{ provide: LabGateway, useValue: lab }, { provide: PatientSearchGateway, useValue: patients }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(NewRequisitionPage);
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

  it('commence par la recherche du patient, sans proposer d\'analyses', async () => {
    await setup();
    expect(q('h1')?.textContent).toContain('Nouvelle demande d’analyses');
    expect(q('#patient-search')).not.toBeNull();
    expect(q('#test-search')).toBeNull();
    expect(lab.listTests).not.toHaveBeenCalled();
  });

  it('une fois le patient choisi, propose le catalogue et résume le patient', async () => {
    await setup();
    await pickPatient();
    expect(patients.search).toHaveBeenCalledWith('mbarga', 10);
    expect(lab.listTests).toHaveBeenCalledWith({}, 0, 10);
    expect(q('#patient-search')).toBeNull();
    expect(text()).toContain('Hémoglobine');
    expect(text()).toContain('Glycémie');
    expect(text()).toContain('Aucune analyse choisie.');
  });

  it('cherche une analyse par texte', async () => {
    await setup();
    await pickPatient();
    await type('#test-search-q', ' glyc ');
    await submit('test-search');
    expect(lab.listTests).toHaveBeenLastCalledWith({ search: 'glyc' }, 0, 10);
  });

  it('ajoute et retire des analyses et annonce un échantillon par type de tube', async () => {
    await setup();
    await pickPatient();
    await click(buttonNamed('Ajouter Hémoglobine'));
    expect(text()).toContain('1 échantillon(s) à prélever');
    expect(buttonNamed('Ajouter Hémoglobine')).toBeUndefined();
    await click(buttonNamed('Ajouter Glycémie'));
    expect(text()).toContain('2 échantillon(s) à prélever'); // sang/violet puis sérum/jaune
    await click(buttonNamed('Retirer Glycémie'));
    expect(text()).toContain('1 échantillon(s) à prélever');
  });

  it('envoie la demande (priorité, provenance, notes) puis ouvre la demande créée', async () => {
    await setup();
    await pickPatient();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await click(buttonNamed('Ajouter Hémoglobine'));
    const priority = q<HTMLSelectElement>('#lab-order-priority')!;
    priority.value = 'STAT';
    priority.dispatchEvent(new Event('change'));
    await type('#lab-order-notes', ' Fièvre depuis 3 jours ');
    await submit('lab-order');
    expect(lab.order).toHaveBeenCalledWith({ patientId: 'p-1', testIds: ['t-1'], priority: 'STAT', source: 'OPD', clinicalNotes: 'Fièvre depuis 3 jours' });
    expect(navigate).toHaveBeenCalledWith(['/lab/requisitions', 'r-1']);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Demande LAB-0000123 envoyée.');
  });

  it('le laboratoire ouvre sur « Extérieur » et n\'envoie pas de notes vides', async () => {
    await setup([...DOCTOR, 'lab.requisitions:read:all']);
    await pickPatient();
    await click(buttonNamed('Ajouter Hémoglobine'));
    expect(q<HTMLSelectElement>('#lab-order-source')?.value).toBe('EXTERNAL');
    await submit('lab-order');
    expect(lab.order).toHaveBeenCalledWith({ patientId: 'p-1', testIds: ['t-1'], priority: 'ROUTINE', source: 'EXTERNAL' });
  });

  it('affiche le refus du serveur sans quitter l\'écran', async () => {
    await setup(DOCTOR, (g) => g.order.mockRejectedValue(new ApiError(409, 'LAB_TEST_INACTIVE', 'L’analyse HGB est retirée du catalogue : on ne peut plus la demander.')));
    await pickPatient();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await click(buttonNamed('Ajouter Hémoglobine'));
    await submit('lab-order');
    expect(q('#lab-order [role=alert]')?.textContent).toContain('retirée du catalogue');
    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain('1 échantillon(s) à prélever');
  });

  it('change de patient : retour à la recherche, panier vidé', async () => {
    await setup();
    await pickPatient();
    await click(buttonNamed('Ajouter Hémoglobine'));
    await click(buttonNamed('Changer de patient'));
    expect(q('#patient-search')).not.toBeNull();
    expect(q('#test-search')).toBeNull();
    await pickPatient();
    expect(text()).toContain('Aucune analyse choisie.');
  });

  it('signale une erreur de chargement du catalogue', async () => {
    await setup(DOCTOR, (g) => g.listTests.mockRejectedValue(new ApiError(500, 'HTTP_500', 'Une erreur interne est survenue.')));
    await pickPatient();
    expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
    expect(requisition().id).toBe('r-1');
  });
});
