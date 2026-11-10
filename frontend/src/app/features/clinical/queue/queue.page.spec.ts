import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ClinicalGateway } from '../../../core/clinical/clinical.gateway';
import { FakeClinicalGateway, doctor, colleague, encounter, page, queueItem, summary } from '../../../core/clinical/testing/fake-clinical-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ClinicalQueuePage } from './queue.page';

const DOCTOR = ['clinical.encounters:read:department', 'clinical.encounters:write:department'];
const NURSE = ['clinical.encounters:read:department'];

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('ClinicalQueuePage', () => {
  let fixture: ComponentFixture<ClinicalQueuePage>;
  let clinical: FakeClinicalGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const row = (id: string) => root().querySelector<HTMLElement>(`[data-test="${id}"]`);
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label);

  async function setup(options: { permissions?: readonly string[]; prepare?: (g: FakeClinicalGateway) => void } = {}) {
    clinical = new FakeClinicalGateway();
    options.prepare?.(clinical);
    const { i18n } = configureApp({ roles: ['DOCTOR'], permissions: options.permissions ?? DOCTOR, profile: { id: doctor.id }, providers: [{ provide: ClinicalGateway, useValue: clinical }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ClinicalQueuePage);
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les patients en attente avec leur type, leur arrivée et leur temps d\'attente', async () => {
    await setup();
    expect(clinical.getQueue).toHaveBeenCalled();
    expect(clinical.listEncounters).toHaveBeenCalledWith({ mine: true }, 0, 10);
    const emergency = textOf(row('ADM-0000013'));
    expect(emergency).toContain('Ndongo Paul');
    expect(emergency).toContain('Urgence');
    expect(emergency).toContain('attend depuis 10 min');
    expect(emergency).toContain('À voir');
    const outpatient = textOf(row('ADM-0000012'));
    expect(outpatient).toContain('Mbarga Élisabeth');
    expect(outpatient).toContain('Consultation externe');
    expect(outpatient).toContain('attend depuis 45 min');
  });

  it('affiche l\'attente en heures au-delà de soixante minutes', async () => {
    await setup({ prepare: (g) => g.getQueue.mockResolvedValue([queueItem({ admission: { id: 'adm-9', number: 'ADM-0000009', type: 'OUTPATIENT', admittedAt: '2026-10-24T10:55:00Z', serviceId: 'svc-1' } })]) });
    expect(textOf(row('ADM-0000009'))).toContain('attend depuis 1 h 05');
  });

  it('commence la consultation d\'un patient et ouvre son espace de travail', async () => {
    await setup({ prepare: (g) => g.startEncounter.mockResolvedValue(encounter({ id: 'e-77' })) });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    buttonNamed('Commencer la consultation de Mbarga Élisabeth')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(clinical.startEncounter).toHaveBeenCalledWith('adm-1');
    expect(navigate).toHaveBeenCalledWith(['/clinical/encounters', 'e-77']);
  });

  it('propose de reprendre ma consultation en cours et d\'ouvrir celle d\'un collègue', async () => {
    await setup({
      prepare: (g) =>
        g.getQueue.mockResolvedValue([
          queueItem({ encounter: { id: 'e-1', number: 'CON-0000001', doctor, mine: true } }),
          queueItem({ admission: { id: 'adm-2', number: 'ADM-0000013', type: 'OUTPATIENT', admittedAt: '2026-10-24T11:30:00Z', serviceId: 'svc-1' }, encounter: { id: 'e-2', number: 'CON-0000002', doctor: colleague, mine: false } }),
        ]),
    });
    expect(textOf(row('ADM-0000012'))).toContain('En cours');
    expect(textOf(row('ADM-0000012'))).toContain('Reprendre');
    expect(textOf(row('ADM-0000013'))).toContain('medecin2');
    expect(textOf(row('ADM-0000013'))).toContain('Ouvrir');
    expect(buttonNamed('Commencer la consultation de Mbarga Élisabeth')).toBeUndefined();
  });

  it('ne propose pas de commencer une consultation à un infirmier', async () => {
    await setup({ permissions: NURSE });
    expect(buttonNamed('Commencer la consultation de Mbarga Élisabeth')).toBeUndefined();
    expect(row('ADM-0000012')).not.toBeNull();
  });

  it('liste mes consultations récentes avec leur diagnostic principal', async () => {
    await setup({ prepare: (g) => g.listEncounters.mockResolvedValue(page([summary(), summary({ id: 'e-2', number: 'CON-0000002', status: 'CANCELLED', primaryDiagnosis: null })])) });
    expect(textOf(row('CON-0000001'))).toContain('J18.9');
    expect(textOf(row('CON-0000001'))).toContain('Signée');
    expect(textOf(row('CON-0000002'))).toContain('Annulée');
  });

  it('dit que la file est vide', async () => {
    await setup({ prepare: (g) => { g.getQueue.mockResolvedValue([]); g.listEncounters.mockResolvedValue(page([])); } });
    expect(textOf(root())).toContain('Aucun patient n’attend dans vos services.');
    expect(textOf(root())).toContain('Aucune consultation récente.');
  });

  it('rafraîchit la file et le dit quand un collègue a ouvert la consultation entre-temps', async () => {
    await setup({ prepare: (g) => g.startEncounter.mockRejectedValue(new ApiError(409, 'CLINICAL_ENCOUNTER_ALREADY_OPEN', 'Une consultation est déjà ouverte pour cette admission.')) });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    clinical.getQueue.mockClear();
    buttonNamed('Commencer la consultation de Mbarga Élisabeth')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(root().querySelector('[role=alert]')?.textContent).toContain('déjà ouverte');
    expect(clinical.getQueue).toHaveBeenCalledTimes(1);
  });

  it('signale une erreur de chargement', async () => {
    await setup({ prepare: (g) => g.getQueue.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')) });
    expect(root().querySelector('[role=alert]')).not.toBeNull();
  });
});
