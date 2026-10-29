import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashSessionGateway } from '../../../core/billing/cash-session.gateway';
import { FakeCashSessionGateway, session } from '../../../core/billing/testing/fake-cash-session-gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { SessionsPage } from './sessions.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('SessionsPage', () => {
  let fixture: ComponentFixture<SessionsPage>;
  let cash: FakeCashSessionGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const rows = () => [...root().querySelectorAll('tbody tr')].map((tr) => norm(tr.textContent ?? ''));

  async function setup(prepare?: (g: FakeCashSessionGateway) => void) {
    cash = new FakeCashSessionGateway();
    prepare?.(cash);
    const { i18n } = configureApp({ roles: ['ACCOUNTANT'], permissions: ['billing.sessions:read:all'], providers: [{ provide: CashSessionGateway, useValue: cash }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(SessionsPage);
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les sessions : numéro, poste, caissier, statut, encaissé et écart signé', async () => {
    await setup();
    const list = rows();
    expect(list).toHaveLength(3);
    expect(list[0]).toContain('CAI-0000008');
    expect(list[0]).toContain('Caisse URG');
    expect(list[0]).toContain('caissier.deux');
    expect(list[0]).toContain('À valider');
    expect(list[0]).toContain('− 22 000 FCFA');
    expect(list[1]).toContain('Ouverte');
    expect(list[1]).toContain('42 000 FCFA');
    expect(list[1]).toContain('—'); // pas d'écart tant que la caisse est ouverte
    expect(list[2]).toContain('Clôturée');
    expect(cash.list).toHaveBeenCalledWith({}, 0, 25);
  });

  it('ouvre le détail d\'une session', async () => {
    await setup();
    expect(q('a[aria-label="Ouvrir la session CAI-0000008"]')?.getAttribute('href')).toBe('/billing/sessions/s-2');
  });

  it('filtre les clôtures à valider', async () => {
    await setup();
    const select = q<HTMLSelectElement>('#sessions-filter-status')!;
    select.value = 'AWAITING_REVIEW';
    select.dispatchEvent(new Event('change'));
    q<HTMLFormElement>('#sessions-filter')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(cash.list).toHaveBeenLastCalledWith({ status: 'AWAITING_REVIEW' }, 0, 25);
  });

  it('pagine par 25', async () => {
    await setup((g) => g.list.mockResolvedValue({ items: Array.from({ length: 25 }, (_, i) => session({ id: `s-${i}`, number: `CAI-${String(i + 1).padStart(7, '0')}` })), total: 60, offset: 0, limit: 25 }));
    expect(norm(root().textContent ?? '')).toContain('1 à 25 sur 60');
    [...root().querySelectorAll<HTMLButtonElement>('nav button')].find((b) => b.textContent?.trim() === 'Suivant')!.click();
    await settle(fixture);
    expect(cash.list).toHaveBeenLastCalledWith({}, 25, 25);
  });

  it('dit qu\'il n\'y a aucune session', async () => {
    await setup((g) => g.list.mockResolvedValue({ items: [], total: 0, offset: 0, limit: 25 }));
    expect(norm(root().textContent ?? '')).toContain('Aucune session.');
  });

  it('signale une lecture impossible', async () => {
    await setup((g) => g.list.mockRejectedValue(new ApiError(0, 'NETWORK', 'Http failure')));
    expect(q('[role=alert]')?.textContent).toContain('connexion réseau a été interrompue');
  });
});
