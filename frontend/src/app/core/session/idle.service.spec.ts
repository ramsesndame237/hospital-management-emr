import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthGateway } from '../auth/auth.gateway';
import { SessionService } from '../auth/session.service';
import { SessionStore } from '../auth/session.store';
import { FakeAuthGateway, token } from '../auth/testing/fake-auth-gateway';
import { Clock } from '../time/clock';
import { Temporal } from '../time/temporal';
import { IDLE_CONFIG, IdleService } from './idle.service';

/** Horloge maîtrisée : le test avance le temps à la main, `vi.advanceTimersByTime` fait battre l'intervalle de surveillance. */
class FakeClock extends Clock {
  ms = Date.UTC(2026, 9, 24, 10, 0, 0);
  override now() {
    return Temporal.Instant.fromEpochMilliseconds(this.ms);
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

describe('IdleService', () => {
  let clock: FakeClock;
  let gateway: FakeAuthGateway;
  let service: IdleService;
  let session: SessionService;
  let store: SessionStore;
  let expire: ReturnType<typeof vi.spyOn>;
  const WARN = 60_000;
  const COUNTDOWN = 20_000;

  /** Fait passer le temps (horloge + minuteurs) puis laisse les effets s'exécuter. */
  async function pass(ms: number): Promise<void> {
    for (let elapsed = 0; elapsed < ms; elapsed += 1_000) {
      clock.advance(1_000);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    clock = new FakeClock();
    gateway = new FakeAuthGateway();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthGateway, useValue: gateway },
        { provide: Clock, useValue: clock },
        { provide: IDLE_CONFIG, useValue: { warnAfterMs: WARN, countdownMs: COUNTDOWN } },
      ],
    });
    store = TestBed.inject(SessionStore);
    session = TestBed.inject(SessionService);
    expire = vi.spyOn(session, 'expire').mockResolvedValue();
    vi.spyOn(session, 'logout').mockResolvedValue();
    store.setToken('at-1', clock.ms + 15 * 60_000, 'full');
    service = TestBed.inject(IdleService);
    TestBed.tick(); // démarre la surveillance (effet)
  });
  afterEach(() => vi.useRealTimers());

  it("ne dit rien tant que l'utilisateur est actif", async () => {
    await pass(WARN - 5_000);
    expect(service.warning()).toBe(false);
  });

  it("avertit après le délai d'inactivité, avec un compte à rebours complet", async () => {
    await pass(WARN + 1_000);
    expect(service.warning()).toBe(true);
    expect(service.remainingMs()).toBe(COUNTDOWN - 1_000);
    expect(service.remainingRatio()).toBeCloseTo(0.95, 2);
  });

  it("une activité repousse l'avertissement", async () => {
    await pass(WARN - 5_000);
    document.dispatchEvent(new Event('pointerdown'));
    await pass(WARN - 5_000);
    expect(service.warning()).toBe(false);
  });

  it("pendant l'avertissement, les mouvements ne comptent pas : il faut confirmer explicitement", async () => {
    await pass(WARN + 1_000);
    document.dispatchEvent(new Event('keydown'));
    await pass(5_000);
    expect(service.warning()).toBe(true);
  });

  it('ferme la session côté serveur à la fin du compte à rebours', async () => {
    await pass(WARN + COUNTDOWN + 1_000);
    expect(expire).toHaveBeenCalledWith(true);
    expect(service.warning()).toBe(false);
  });

  it("« Rester connecté » renouvelle la session et ferme l'avertissement", async () => {
    gateway.refresh.mockImplementation(async () => token('at-2'));
    await pass(WARN + 1_000);
    await service.stayConnected();
    expect(gateway.refresh).toHaveBeenCalled();
    expect(service.warning()).toBe(false);
    await pass(WARN - 5_000);
    expect(service.warning()).toBe(false); // le délai repart de zéro
  });

  it('un poste réveillé après des heures est déconnecté tout de suite, sans nouveau délai', async () => {
    clock.advance(3 * 3_600_000); // mise en veille
    await vi.advanceTimersByTimeAsync(1_000);
    expect(expire).toHaveBeenCalledWith(true);
  });

  it("n'écoute plus rien une fois déconnecté", async () => {
    store.clear();
    TestBed.tick();
    await pass(WARN * 2);
    expect(service.warning()).toBe(false);
    expect(expire).not.toHaveBeenCalled();
  });
});
