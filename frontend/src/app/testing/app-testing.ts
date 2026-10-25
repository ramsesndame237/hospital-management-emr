import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthGateway } from '../core/auth/auth.gateway';
import { SessionStore } from '../core/auth/session.store';
import { CurrentUser } from '../core/auth/auth.models';
import { FakeAuthGateway, user } from '../core/auth/testing/fake-auth-gateway';
import { JsonTranslator } from '../core/i18n/json-translator';
import { Translator } from '../core/i18n/translator';
import { Clock } from '../core/time/clock';
import { Temporal } from '../core/time/temporal';
import { DashboardGateway, SampleDashboardGateway } from '../features/dashboard/dashboard.gateway';

/** Horloge figée au 24 octobre 2026, midi UTC. */
export const FIXED_CLOCK: Clock = {
  now: () => Temporal.Instant.from('2026-10-24T12:00:00Z'),
  nowMs: () => Date.parse('2026-10-24T12:00:00Z'),
};

export interface AppTestOptions {
  /** Champs du profil à remplacer (ex. `{ mustChangePassword: true }` pour un compte neuf). */
  readonly profile?: Partial<CurrentUser>;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
  readonly signedIn?: boolean;
  readonly providers?: readonly Provider[];
}

/** Configure le module de test avec les ports habituels (faux serveur d'identité, traducteur JSON, horloge figée, session ouverte). */
export function configureApp(options: AppTestOptions = {}): { gateway: FakeAuthGateway; store: SessionStore; i18n: Translator } {
  localStorage.clear();
  const gateway = new FakeAuthGateway();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthGateway, useValue: gateway },
      { provide: Translator, useClass: JsonTranslator },
      { provide: Clock, useValue: FIXED_CLOCK },
      { provide: DashboardGateway, useClass: SampleDashboardGateway },
      ...(options.providers ?? []),
    ],
  });
  const i18n = TestBed.inject(Translator);
  i18n.setLocale('fr');
  const store = TestBed.inject(SessionStore);
  if (options.signedIn !== false) {
    store.setToken('at-1', Date.parse('2026-10-24T12:15:00Z'), 'full');
    store.setUser(user({ roles: [...(options.roles ?? ['DOCTOR'])], permissions: [...(options.permissions ?? ['files.clinical:read:department'])], ...options.profile }));
  }
  return { gateway, store, i18n };
}

/** Laisse se terminer les promesses en chaîne puis redessine (le mode sans zone n'attend pas toutes les chaînes). */
export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

const KEY_SHAPE = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/;

/**
 * Espionne le traducteur : renvoie les clés de catalogue demandées mais introuvables. Un texte littéral (message de l'API)
 * n'a pas la forme d'une clé et n'est pas signalé ; une faute de frappe dans un JSON de formulaire l'est.
 */
export function watchMissingKeys(i18n: Translator): () => string[] {
  const requested = new Set<string>();
  const original = i18n.t.bind(i18n);
  i18n.t = (key, params) => {
    requested.add(key);
    return original(key, params);
  };
  return () => [...requested].filter((key) => KEY_SHAPE.test(key) && !i18n.has(key));
}

/** Saisit un code dans les cases séparées d'un champ `otp`, un chiffre par case, comme un utilisateur. */
export function typeOtp(fixture: ComponentFixture<unknown>, code: string): void {
  const cells = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('app-otp-field input')];
  [...code].forEach((digit, index) => {
    cells[index].value = digit;
    cells[index].dispatchEvent(new Event('input'));
  });
  fixture.detectChanges();
}
