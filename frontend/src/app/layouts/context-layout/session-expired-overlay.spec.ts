import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { DraftStatus } from '../../core/session/draft-status';
import { Temporal } from '../../core/time/temporal';
import { ToastService } from '../../shared/toast/toast.service';
import { ToastHost } from '../../shared/toast/toast-host';
import { configureApp, settle, watchMissingKeys } from '../../testing/app-testing';
import { SessionExpiredOverlay } from './session-expired-overlay';

describe('SessionExpiredOverlay (design AUTH-05, dialogue)', () => {
  let fixture: ComponentFixture<SessionExpiredOverlay>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const click = (label: string) => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.textContent?.includes(label))!.click();

  async function setup() {
    const { i18n, store } = configureApp({ signedIn: false });
    store.markExpired({ returnUrl: '/patients/42' });
    const missing = watchMissingKeys(i18n);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(SessionExpiredOverlay);
    await settle(fixture);
    return { missing, store };
  }

  it('masque le contenu et explique : titre, avertissement, page conservée', async () => {
    const { missing } = await setup();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alertdialog]')?.getAttribute('aria-modal')).toBe('true');
    expect(text()).toContain('SÉCURITÉ DE LA SESSION');
    expect(text()).toContain('Reconnectez-vous pour continuer');
    expect(text()).toContain('Votre session a expiré');
    expect(text()).toContain('Votre page a été conservée');
    expect(text()).toContain('Données masquées pendant l’interruption');
    expect(missing()).toEqual([]);
  });

  it('n’affirme un brouillon enregistré que s’il y en a un', async () => {
    await setup();
    expect(text()).not.toContain('Brouillon enregistré');
    TestBed.inject(DraftStatus).markSaved(Temporal.Instant.from('2026-10-24T09:42:00Z'));
    await settle(fixture);
    expect(text()).toContain('✓ Brouillon enregistré · 24 oct. 2026 à ');
  });

  it('« Se reconnecter » reprend la page où l’on travaillait', async () => {
    const { store } = await setup();
    click('Se reconnecter');
    await settle(fixture);
    expect(store.expired()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/patients/42' } });
  });

  it('« Utiliser un autre compte » oublie la page', async () => {
    await setup();
    vi.spyOn(TestBed.inject(SessionService), 'leaveExpired');
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.textContent?.includes('Utiliser un autre compte'))!.click();
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });
});

describe('ToastHost', () => {
  it('affiche une notification puis la retire toute seule', async () => {
    vi.useFakeTimers();
    try {
      configureApp({ signedIn: false });
      const fixture = TestBed.createComponent(ToastHost);
      TestBed.inject(ToastService).show('✓ Copié', 'success', 1000);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('✓ Copié');
      expect((fixture.nativeElement as HTMLElement).getAttribute('role')).toBe('status');
      await vi.advanceTimersByTimeAsync(1100);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Copié');
    } finally {
      vi.useRealTimers();
    }
  });
});
