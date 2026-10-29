import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { FakePharmacyGateway, adjustment, colleague, page } from '../../../core/pharmacy/testing/fake-pharmacy-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { AdjustmentsPage } from './adjustments.page';

const READ = ['pharmacy.stock:read'];
const DECIDE = [...READ, 'pharmacy.stock:approve'];
const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function spaced(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('AdjustmentsPage', () => {
  let fixture: ComponentFixture<AdjustmentsPage>;
  let pharmacy: FakePharmacyGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  /** L'utilisateur connecté est, par défaut, un AUTRE pharmacien que le demandeur des fixtures. */
  async function setup(permissions: readonly string[] = DECIDE, userId = colleague.id, prepare?: (g: FakePharmacyGateway) => void) {
    pharmacy = new FakePharmacyGateway();
    prepare?.(pharmacy);
    const { i18n } = configureApp({ roles: ['PHARMACIST'], permissions, profile: { id: userId }, providers: [{ provide: PharmacyGateway, useValue: pharmacy }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(AdjustmentsPage);
    await settle(fixture);
  }

  async function click(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  const toasts = () => TestBed.inject(ToastService).toasts().map((t) => t.message);

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste d\'abord les demandes à décider, avec la variation, le motif et le demandeur', async () => {
    await setup();
    expect(pharmacy.listAdjustments).toHaveBeenCalledWith({ status: 'PENDING' }, 0, 25);
    const row = spaced(q('tr[data-test="ADJ-0000001"]'));
    expect(row).toContain('Doliprane 500');
    expect(row).toContain('B2026-114');
    expect(row).toContain('−4');
    expect(row).toContain('Casse ou détérioration');
    expect(row).toContain('pharmacien');
    expect(row).toContain('À décider');
  });

  it('propose d\'approuver ou de refuser une demande d\'un autre, jamais la sienne', async () => {
    await setup();
    expect(buttonNamed('Approuver la demande ADJ-0000001')).toBeDefined();
    expect(buttonNamed('Refuser la demande ADJ-0000001')).toBeDefined();
    TestBed.resetTestingModule();
    await setup(DECIDE, 'u-pha');
    expect(buttonNamed('Approuver la demande ADJ-0000001')).toBeUndefined();
    expect(q('tr[data-test="ADJ-0000001"]')?.textContent).toContain('Votre demande : un autre pharmacien doit la décider.');
  });

  it('ne propose aucune décision sans le droit d\'approuver', async () => {
    await setup(READ);
    expect(buttonNamed('Approuver la demande ADJ-0000001')).toBeUndefined();
    expect(q('tr[data-test="ADJ-0000001"]')?.textContent).not.toContain('Votre demande');
  });

  it('approuve avec un commentaire facultatif et recharge la liste', async () => {
    await setup();
    await click(buttonNamed('Approuver la demande ADJ-0000001'));
    expect(q('aside h2')?.textContent).toContain('Approuver ADJ-0000001');
    expect(q('aside')?.textContent).toContain('−4 sur le lot B2026-114 de Doliprane 500 (Casse ou détérioration).');
    type('#adjustment-approve-comment', ' Constaté ');
    await submit('adjustment-approve');
    expect(pharmacy.approveAdjustment).toHaveBeenCalledWith('a-1', 'Constaté');
    expect(toasts()).toEqual(['Demande ADJ-0000001 approuvée : le stock est à jour.']);
    expect(q('aside')).toBeNull();
    expect(pharmacy.listAdjustments).toHaveBeenCalledTimes(2);
  });

  it('approuve sans commentaire', async () => {
    await setup();
    await click(buttonNamed('Approuver la demande ADJ-0000001'));
    await submit('adjustment-approve');
    expect(pharmacy.approveAdjustment).toHaveBeenCalledWith('a-1', null);
  });

  it('exige un motif pour refuser', async () => {
    await setup();
    await click(buttonNamed('Refuser la demande ADJ-0000001'));
    await submit('adjustment-reject');
    expect(q('aside')?.textContent).toContain('Le motif du refus est obligatoire.');
    expect(pharmacy.rejectAdjustment).not.toHaveBeenCalled();
    type('#adjustment-reject-comment', ' Recomptez d\'abord ');
    await submit('adjustment-reject');
    expect(pharmacy.rejectAdjustment).toHaveBeenCalledWith('a-1', 'Recomptez d\'abord');
    expect(toasts()).toEqual(['Demande ADJ-0000001 refusée.']);
  });

  it('garde le panneau ouvert et dit pourquoi quand le lot ne contient plus assez', async () => {
    await setup(DECIDE, colleague.id, (g) => g.approveAdjustment.mockRejectedValue(new ApiError(409, 'PHARMACY_STOCK_INSUFFICIENT', 'Le lot B2026-114 ne contient que 2 unité(s).')));
    await click(buttonNamed('Approuver la demande ADJ-0000001'));
    await submit('adjustment-approve');
    expect(q('aside [role=alert]')?.textContent).toContain('ne contient que 2 unité(s)');
    expect(toasts()).toEqual([]);
  });

  it('montre la décision prise : qui, quand, et le commentaire', async () => {
    await setup(DECIDE, colleague.id, (g) =>
      g.listAdjustments.mockResolvedValue(page([adjustment({ status: 'REJECTED', decidedBy: colleague, decidedAt: '2026-10-02T10:00:00Z', decisionComment: 'Recomptez d\'abord' })])),
    );
    const row = spaced(q('tr[data-test="ADJ-0000001"]'));
    expect(row).toContain('Refusé');
    expect(row).toContain('Par pharmacien2');
    expect(row).toContain('Recomptez d\'abord');
    expect(buttonNamed('Approuver la demande ADJ-0000001')).toBeUndefined();
  });

  it('filtre par statut et par « mes demandes »', async () => {
    await setup();
    const status = q<HTMLSelectElement>('#pharmacy-adjustments-filter-status')!;
    status.value = 'APPROVED';
    status.dispatchEvent(new Event('change'));
    const box = q<HTMLInputElement>('#pharmacy-adjustments-filter-mine')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    box.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await submit('pharmacy-adjustments-filter');
    expect(pharmacy.listAdjustments).toHaveBeenLastCalledWith({ status: 'APPROVED', mine: true }, 0, 25);
  });

  it('dit qu\'il n\'y a aucun ajustement, et affiche le refus du serveur', async () => {
    await setup(DECIDE, colleague.id, (g) => g.listAdjustments.mockResolvedValue(page([])));
    expect(root().textContent).toContain('Aucun ajustement.');
    TestBed.resetTestingModule();
    await setup(DECIDE, colleague.id, (g) => g.listAdjustments.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')));
    expect(q('[role=alert]')?.textContent).toBeTruthy();
  });
});
