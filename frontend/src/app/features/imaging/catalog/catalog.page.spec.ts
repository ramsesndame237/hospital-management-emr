import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import { FakeImagingGateway, examType, page } from '../../../core/imaging/testing/fake-imaging-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ImagingCatalogPage } from './catalog.page';

const READ = ['imaging.catalog:read'];
const MANAGE = ['imaging.catalog:read', 'imaging.catalog:manage'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('ImagingCatalogPage', () => {
  let fixture: ComponentFixture<ImagingCatalogPage>;
  let imaging: FakeImagingGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => norm(root().textContent ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(permissions: readonly string[], prepare?: (g: FakeImagingGateway) => void) {
    imaging = new FakeImagingGateway();
    prepare?.(imaging);
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions, providers: [{ provide: ImagingGateway, useValue: imaging }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ImagingCatalogPage);
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

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les examens avec leur modalité, leur durée, leur région et leur préparation', async () => {
    await setup(READ);
    expect(imaging.listExamTypes).toHaveBeenCalledWith({}, 0, 25);
    const row = norm(q('[data-test="ECHO-ABD"]')?.textContent ?? '');
    expect(row).toContain('Échographie abdominale');
    expect(row).toContain('Échographie');
    expect(row).toContain('Abdomen');
    expect(row).toContain('Préparation : À jeun depuis 6 heures.');
    expect(row).toContain('20 min');
  });

  it('signale le produit de contraste et un examen retiré', async () => {
    await setup(READ, (g) => g.listExamTypes.mockResolvedValue(page([examType({ usesContrast: true, modality: 'CT' }), examType({ id: 'e-3', code: 'OLD', name: 'Ancien examen', active: false })])));
    expect(norm(q('[data-test="RX-THORAX"]')?.textContent ?? '')).toContain('Produit de contraste');
    expect(norm(q('[data-test="OLD"]')?.textContent ?? '')).toContain('Retiré');
  });

  it('filtre par texte et par modalité ; qui ne gère pas ne voit pas les examens retirés', async () => {
    await setup(READ);
    expect(q('#imaging-catalog-filter-inactive')).toBeNull();
    await type('#imaging-catalog-filter-q', ' thorax ');
    const select = q<HTMLSelectElement>('#imaging-catalog-filter-modality')!;
    select.value = 'XRAY';
    select.dispatchEvent(new Event('change'));
    await submit('imaging-catalog-filter');
    expect(imaging.listExamTypes).toHaveBeenLastCalledWith({ search: 'thorax', modality: 'XRAY' }, 0, 25);
  });

  it('sans le droit de gérer : aucune action', async () => {
    await setup(READ);
    expect(buttonNamed('Nouvel examen')).toBeUndefined();
    expect(buttonNamed('Modifier l’examen Radiographie du thorax de face')).toBeUndefined();
  });

  it('pagine au-delà de 25 examens', async () => {
    await setup(READ, (g) => g.listExamTypes.mockResolvedValue(page([examType()], { total: 60 })));
    expect(q('nav')?.textContent).toContain('1 à 25 sur 60');
    await click(buttonNamed('Suivant'));
    expect(imaging.listExamTypes).toHaveBeenLastCalledWith({}, 25, 25);
  });

  it('signale une liste vide', async () => {
    await setup(READ, (g) => g.listExamTypes.mockResolvedValue(page([])));
    expect(text()).toContain('Aucun examen ne correspond.');
  });

  it('signale une erreur de chargement', async () => {
    await setup(READ, (g) => g.listExamTypes.mockRejectedValue(new ApiError(500, 'HTTP_500', 'Une erreur interne est survenue.')));
    expect(q('[role=alert]')?.textContent).toContain('momentanément indisponible');
  });

  describe('gestion', () => {
    it('crée un examen : code et modalité choisis à la création', async () => {
      await setup(MANAGE);
      await click(buttonNamed('Nouvel examen'));
      expect(q('aside h2')?.textContent).toContain('Nouvel examen');
      await submit('imaging-exam-new');
      expect(text()).toContain('Ce champ est obligatoire.');
      expect(imaging.createExamType).not.toHaveBeenCalled();
      await type('#imaging-exam-new-code', 'irm-genou');
      await type('#imaging-exam-new-name', ' IRM du genou ');
      const modality = q<HTMLSelectElement>('#imaging-exam-new-modality')!;
      modality.value = 'MRI';
      modality.dispatchEvent(new Event('change'));
      await type('#imaging-exam-new-durationMinutes', '40');
      await type('#imaging-exam-new-bodyPart', 'Genou');
      await submit('imaging-exam-new');
      expect(imaging.createExamType).toHaveBeenCalledWith({ code: 'IRM-GENOU', name: 'IRM du genou', modality: 'MRI', bodyPart: 'Genou', usesContrast: false, durationMinutes: 40, preparation: null });
      expect(q('aside')).toBeNull();
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Examen IRM du genou créé.');
    });

    it('modifie un examen sans proposer de changer le code ni la modalité', async () => {
      await setup(MANAGE);
      await click(buttonNamed('Modifier l’examen Radiographie du thorax de face'));
      expect(q('#imaging-exam-e-1-code')).toBeNull();
      expect(q('#imaging-exam-e-1-modality')).toBeNull();
      expect(q<HTMLInputElement>('#imaging-exam-e-1-name')?.value).toBe('Radiographie du thorax de face');
      await type('#imaging-exam-e-1-name', 'Radiographie thoracique');
      await type('#imaging-exam-e-1-preparation', '');
      await submit('imaging-exam-e-1');
      expect(imaging.updateExamType).toHaveBeenCalledWith('e-1', { name: 'Radiographie thoracique', bodyPart: 'Thorax', usesContrast: false, durationMinutes: 20, preparation: null });
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Examen Radiographie thoracique modifié.');
    });

    it('retire puis remet un examen', async () => {
      await setup(MANAGE);
      await click(buttonNamed('Retirer l’examen Radiographie du thorax de face du catalogue'));
      expect(imaging.setExamTypeActive).toHaveBeenCalledWith('e-1', false);
      expect(TestBed.inject(ToastService).toasts()[0].message).toContain('retiré du catalogue');
    });

    it('affiche le refus du serveur (code déjà pris) dans le panneau, sans effacer la saisie', async () => {
      await setup(MANAGE, (g) => g.createExamType.mockRejectedValue(new ApiError(409, 'IMG_EXAM_CODE_ALREADY_EXISTS', 'Un examen utilise déjà ce code.')));
      await click(buttonNamed('Nouvel examen'));
      await type('#imaging-exam-new-code', 'RX-THORAX');
      await type('#imaging-exam-new-name', 'Autre');
      await submit('imaging-exam-new');
      expect(q('#imaging-exam-new [role=alert]')?.textContent).toContain('utilise déjà ce code');
      expect(q<HTMLInputElement>('#imaging-exam-new-name')?.value).toBe('Autre');
      expect(q('aside')).not.toBeNull();
    });
  });
});
