import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ClinicalGateway } from '../../../core/clinical/clinical.gateway';
import { ApiError } from '../../../core/http/api-error';
import { InpatientGateway } from '../../../core/inpatient/inpatient.gateway';
import { FakeInpatientGateway, chart, medication, observation, stay } from '../../../core/inpatient/testing/fake-inpatient-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { InpatientChartPage } from './chart.page';

const NURSE = ['inpatient.chart:read:department', 'inpatient.observations:record:department', 'inpatient.administrations:record:department', 'inpatient.notes:write:department'];
const DOCTOR = ['inpatient.chart:read:department', 'inpatient.observations:record:department', 'inpatient.notes:write:department', 'clinical.encounters:write:department'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('InpatientChartPage (dossier de soins)', () => {
  let fixture: ComponentFixture<InpatientChartPage>;
  let inpatient: FakeInpatientGateway;
  let clinical: { startEncounter: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => norm(b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label));

  async function setup(permissions: readonly string[] = NURSE, prepare?: (g: FakeInpatientGateway) => void) {
    inpatient = new FakeInpatientGateway();
    prepare?.(inpatient);
    clinical = { startEncounter: vi.fn().mockResolvedValue({ id: 'enc-1' }) };
    const { i18n } = configureApp({
      roles: ['NURSE'], permissions,
      providers: [
        { provide: InpatientGateway, useValue: inpatient },
        { provide: ClinicalGateway, useValue: clinical },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'adm-1' }) } } },
      ],
    });
    missingKeys = watchMissingKeys(i18n);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(InpatientChartPage);
    await settle(fixture);
  }

  async function click(button: HTMLElement | undefined) {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  function type(selector: string, value: string) {
    const input = q<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  function fillObservation(over: Record<string, string> = {}) {
    const values: Record<string, string> = { temperature: '37,2', pulse: '88', systolic: '124', diastolic: '78', respiratoryRate: '16', spo2: '97', ...over };
    for (const [name, value] of Object.entries(values)) type(`#inpatient-obs-0-${name}`, value);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('montre le patient, son lit et le jour, les constantes avec leur score, les médicaments et les notes', async () => {
    await setup();
    const content = text();
    expect(content).toContain('Mbarga Élisabeth');
    expect(content).toContain('Lit Lit 1 · jour 3 d’hospitalisation');
    expect(content).toContain('NEWS2 0 · Faible');
    expect(content).toContain('Amoxicilline 500 mg');
    expect(content).toContain('1 gélule · 3 fois par jour');
    expect(content).toContain('Rien n’a encore été fait.');
    expect(content).toContain('Pansement refait.');
    expect(inpatient.chart).toHaveBeenCalledWith('adm-1');
  });

  it('enregistre un relevé avec les nombres convertis (virgule décimale) et remet le formulaire à zéro', async () => {
    await setup();
    fillObservation();
    await submit('inpatient-obs-0');
    expect(inpatient.recordObservation).toHaveBeenCalledWith('adm-1', {
      temperature: 37.2, pulse: 88, systolic: 124, diastolic: 78, respiratoryRate: 16, spo2: 97, supplementalOxygen: false, consciousness: 'ALERT', note: null,
    });
    expect(q('#inpatient-obs-1')).not.toBeNull(); // formulaire recréé, champs vides
    expect(inpatient.chart).toHaveBeenCalledTimes(2);
  });

  it('exige les paramètres du score : un relevé incomplet n\'est pas envoyé', async () => {
    await setup();
    fillObservation({ spo2: '' });
    await submit('inpatient-obs-0');
    expect(inpatient.recordObservation).not.toHaveBeenCalled();
    expect(q('#inpatient-obs-0-spo2-error')).not.toBeNull();
  });

  it('un score élevé affiche un bandeau rouge « prévenez le médecin sans attendre »', async () => {
    await setup(NURSE, (g) => g.recordObservation.mockResolvedValue({ ...observation({ id: 'o-high', news2: 12, risk: 'HIGH' }), escalate: true }));
    fillObservation({ spo2: '88' });
    await submit('inpatient-obs-0');
    expect(norm(q('[role=alert]')?.textContent ?? '')).toContain('Score NEWS2 12 : état préoccupant. Prévenez le médecin sans attendre.');
  });

  it("un dernier relevé à risque élevé est signalé dès l'ouverture du dossier", async () => {
    await setup(NURSE, (g) => g.chart.mockResolvedValue(chart({ observations: [observation({ news2: 9, risk: 'HIGH' })] })));
    expect(norm(q('[role=alert]')?.textContent ?? '')).toContain('Dernier score NEWS2 : 9');
  });

  it('note un médicament comme donné en un clic', async () => {
    await setup();
    await click(buttonNamed('Noter Amoxicilline 500 mg comme donné'));
    expect(inpatient.recordAdministration).toHaveBeenCalledWith('adm-1', { prescriptionId: 'rx-1', position: 0, status: 'GIVEN' });
  });

  it('un refus ou une suspension demande un motif avant d\'être noté', async () => {
    await setup();
    await click(buttonNamed('Noter Amoxicilline 500 mg comme refusé par le patient'));
    await submit('inpatient-reason-rx-1-0');
    expect(inpatient.recordAdministration).not.toHaveBeenCalled(); // motif obligatoire
    type('#inpatient-reason-rx-1-0-reason', 'Nausées');
    await submit('inpatient-reason-rx-1-0');
    expect(inpatient.recordAdministration).toHaveBeenCalledWith('adm-1', { prescriptionId: 'rx-1', position: 0, status: 'REFUSED', reason: 'Nausées' });
    expect(q('#inpatient-reason-rx-1-0')).toBeNull(); // le formulaire de motif se referme

    await click(buttonNamed('Suspendre Amoxicilline 500 mg'));
    type('#inpatient-reason-rx-1-0-reason', 'À jeun');
    await submit('inpatient-reason-rx-1-0');
    expect(inpatient.recordAdministration).toHaveBeenLastCalledWith('adm-1', { prescriptionId: 'rx-1', position: 0, status: 'HELD', reason: 'À jeun' });
  });

  it("montre la dernière action sur chaque médicament et l'avertissement d'allergie", async () => {
    await setup(NURSE, (g) => g.chart.mockResolvedValue(chart({ medications: [medication({ allergyWarning: true, givenCount: 2, last: { status: 'HELD', at: '2026-11-20T11:00:00Z', by: 'nurse', reason: 'À jeun' } })] })));
    const content = text();
    expect(content).toContain('Prescrit malgré une allergie connue');
    expect(content).toContain('suspendu le');
    expect(content).toContain('À jeun');
    expect(content).toContain('doses données : 2');
  });

  it('ajoute une note de soins', async () => {
    await setup();
    type('#inpatient-note-0-text', 'Pansement refait, plaie propre.');
    await submit('inpatient-note-0');
    expect(inpatient.addNote).toHaveBeenCalledWith('adm-1', 'Pansement refait, plaie propre.');
  });

  it("après la sortie, le dossier reste lisible mais aucun formulaire ni bouton d'action n'est proposé", async () => {
    await setup(NURSE, (g) => g.chart.mockResolvedValue(chart({ stay: stay({ active: false }) })));
    expect(text()).toContain('Hospitalisation terminée');
    expect(q('#inpatient-obs-0')).toBeNull();
    expect(q('#inpatient-note-0')).toBeNull();
    expect(buttonNamed('comme donné')).toBeUndefined();
    expect(text()).toContain('Amoxicilline 500 mg');
  });

  it("le médecin ne peut pas administrer un médicament, mais fait la tournée", async () => {
    await setup(DOCTOR);
    expect(buttonNamed('comme donné')).toBeUndefined();
    expect(buttonNamed('Faire la tournée')).toBeDefined();
  });

  it("l'infirmier ne fait pas la tournée du médecin", async () => {
    await setup(NURSE);
    expect(buttonNamed('Faire la tournée')).toBeUndefined();
  });

  it('la tournée ouvre la consultation du patient hospitalisé', async () => {
    await setup(DOCTOR);
    await click(buttonNamed('Faire la tournée'));
    expect(clinical.startEncounter).toHaveBeenCalledWith('adm-1');
    expect(navigate).toHaveBeenCalledWith(['/clinical/encounters', 'enc-1']);
  });

  it('la tournée reprend la consultation déjà ouverte', async () => {
    await setup(DOCTOR);
    clinical.startEncounter.mockRejectedValue(new ApiError(409, 'CLINICAL_ENCOUNTER_ALREADY_OPEN', 'Une consultation est déjà en cours.', [], null, { params: { encounterId: 'enc-open' } }));
    await click(buttonNamed('Faire la tournée'));
    expect(navigate).toHaveBeenLastCalledWith(['/clinical/encounters', 'enc-open']);
  });

  it("affiche le refus du serveur (hors du service) sans détail technique", async () => {
    await setup(NURSE, (g) => g.chart.mockRejectedValue(new ApiError(404, 'INPATIENT_STAY_NOT_FOUND', 'Hospitalisation introuvable.')));
    expect(text()).toContain('Hospitalisation introuvable.');
  });
});
