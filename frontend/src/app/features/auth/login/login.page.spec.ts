import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthGateway } from '../../../core/auth/auth.gateway';
import { FakeAuthGateway, token } from '../../../core/auth/testing/fake-auth-gateway';
import { ApiError } from '../../../core/http/api-error';
import { JsonTranslator } from '../../../core/i18n/json-translator';
import { Translator } from '../../../core/i18n/translator';
import { Clock } from '../../../core/time/clock';
import { Temporal } from '../../../core/time/temporal';
import { safeReturnUrl } from '../shared/return-url';
import { supportCode } from '../shared/support-code';
import { LoginPage } from './login.page';

describe('safeReturnUrl (anti-redirection ouverte)', () => {
  it.each([
    ['/patients/42', '/patients/42'],
    ['/', '/'],
    ['/a?b=1#c', '/a?b=1#c'],
  ])('accepte une adresse interne : %s', (input, expected) => expect(safeReturnUrl(input)).toBe(expected));

  it.each(['//evil.example', 'https://evil.example', 'javascript:alert(1)', '\\\\evil', '/\\evil.example', 'patients', '', null, undefined])(
    "refuse et revient à l'accueil : %p",
    (input) => expect(safeReturnUrl(input as string)).toBe('/'),
  );
});

describe('supportCode', () => {
  it('compose le type d’incident et la date (jour, mois, année sur deux chiffres)', () => {
    const noon = Temporal.Instant.from('2026-10-24T12:00:00Z');
    expect(supportCode('N01', noon)).toBe('AUTH-N01-241026');
  });
});

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let gateway: FakeAuthGateway;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(sel: string) => root().querySelector<T>(sel);

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0)); // laisse finir la chaîne de promesses (connexion → profil → navigation)
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setup(queryParams: Record<string, string> = {}) {
    gateway = new FakeAuthGateway();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthGateway, useValue: gateway },
        { provide: Translator, useClass: JsonTranslator },
        { provide: Clock, useValue: { now: () => Temporal.Instant.from('2026-10-24T12:00:00Z'), nowMs: () => 0 } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
      ],
    });
    TestBed.inject(Translator).setLocale('fr');
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    await settle();
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit() {
    q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await settle();
  }

  const signedIn = (scope: 'full' | 'setup' = 'full') => ({ status: 'authenticated' as const, ...token('at-1', scope), mustChangePassword: false, mfaEnrollmentRequired: false });

  it('affiche le formulaire de connexion du personnel, en français', async () => {
    await setup();
    expect(q('.eyebrow')?.textContent).toContain('ACCÈS PERSONNEL');
    expect(q('h2')?.textContent).toContain('Connexion à votre espace');
    expect(q('label[for="login-username"]')?.textContent?.trim()).toBe('Identifiant *');
    expect(q<HTMLInputElement>('#login-password')?.type).toBe('password');
    expect(q('button[type=submit]')?.textContent).toContain('Se connecter');
    expect(root().textContent).toContain('Mot de passe oublié ? Réinitialiser');
  });

  it('met le curseur sur l’identifiant à l’ouverture', async () => {
    await setup();
    expect(root().ownerDocument.activeElement).toBe(q('#login-username'));
  });

  it('signale les champs obligatoires sans appeler le serveur', async () => {
    await setup();
    await submit();
    expect(root().textContent).toContain('Saisissez votre identifiant.');
    expect(root().textContent).toContain('Saisissez votre mot de passe.');
    expect(q('#login-username')?.getAttribute('aria-invalid')).toBe('true');
    expect(gateway.login).not.toHaveBeenCalled();
  });

  it('connecte puis ouvre la page demandée', async () => {
    await setup({ returnUrl: '/patients/42' });
    gateway.login.mockResolvedValue(signedIn());
    await type('#login-username', '  Marie.Curie ');
    await type('#login-password', 'une phrase de passe solide');
    await submit();
    expect(gateway.login).toHaveBeenCalledWith({ username: 'Marie.Curie', password: 'une phrase de passe solide' }); // identifiant nettoyé, mot de passe intact
    expect(navigateByUrl).toHaveBeenCalledWith('/patients/42');
  });

  it("ignore une adresse de retour externe (hameçonnage) et ouvre l'accueil", async () => {
    await setup({ returnUrl: '//evil.example/phishing' });
    gateway.login.mockResolvedValue(signedIn());
    await type('#login-username', 'marie');
    await type('#login-password', 'x');
    await submit();
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('envoie un compte à finaliser vers son assistant au lieu de la plateforme', async () => {
    await setup({ returnUrl: '/patients' });
    gateway.login.mockResolvedValue(signedIn('setup'));
    await type('#login-username', 'nouveau');
    await type('#login-password', 'Provisoire-2026');
    await submit();
    expect(navigateByUrl).toHaveBeenCalledWith('/account/setup');
  });

  it("affiche le message du serveur (déjà traduit) en cas d'identifiants incorrects, sans quitter la page ni vider la saisie", async () => {
    await setup();
    gateway.login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.'));
    await type('#login-username', 'marie');
    await type('#login-password', 'faux');
    await submit();
    expect(q('[role=alert]')?.textContent).toContain('Identifiant ou mot de passe incorrect.');
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(q('button[type=submit]')?.hasAttribute('disabled')).toBe(false); // on peut réessayer
    expect(q<HTMLInputElement>('#login-username')?.value).toBe('marie');
  });

  it('panne réseau : message dédié, bouton « Réessayer », code d’assistance et contact, sans détail technique', async () => {
    await setup();
    gateway.login.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Http failure response for /api: 0'));
    await type('#login-username', 'marie');
    await type('#login-password', 'x');
    await submit();
    expect(q('[role=alert]')?.textContent).toContain('La connexion réseau a été interrompue');
    expect(q('button[type=submit]')?.textContent).toContain('Réessayer');
    expect(root().textContent).toContain('Code d’assistance : AUTH-N01-241026');
    expect(root().textContent).toContain('+237 6 70 12 34 56');
    expect(root().textContent).not.toContain('Http failure');
    expect(q<HTMLInputElement>('#login-username')?.value).toBe('marie');
  });

  it('masque le détail technique des erreurs serveur', async () => {
    await setup();
    gateway.login.mockRejectedValueOnce(new ApiError(500, 'UNKNOWN', 'SELECT * FROM users failed'));
    await type('#login-username', 'marie');
    await type('#login-password', 'x');
    await submit();
    expect(root().textContent).toContain('Une erreur est survenue');
    expect(root().textContent).not.toContain('SELECT');
  });

  it("« Mot de passe oublié » renvoie vers l'administrateur au lieu de promettre une réinitialisation inexistante", async () => {
    await setup();
    [...root().querySelectorAll('button')].find((b) => b.textContent?.includes('Mot de passe oublié'))!.click();
    await settle();
    expect(root().textContent).toContain('contactez l’administrateur');
  });

  it('affiche et masque le mot de passe à la demande', async () => {
    await setup();
    const toggle = [...root().querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Afficher')!;
    toggle.click();
    await settle();
    expect(q<HTMLInputElement>('#login-password')?.type).toBe('text');
    expect(toggle.textContent?.trim()).toBe('Masquer');
  });

  describe('double authentification', () => {
    async function reachSecondFactor() {
      await setup();
      gateway.login.mockResolvedValueOnce({ status: 'mfa_required' });
      await type('#login-username', 'docteur');
      await type('#login-password', 'une phrase de passe solide');
      await submit();
    }

    it('passe à la saisie du code quand le serveur le demande, curseur dans le champ', async () => {
      await reachSecondFactor();
      expect(q('h2')?.textContent).toContain('Vérification en deux étapes');
      expect(q('#login-code')).not.toBeNull();
      expect(q('#login-username')).toBeNull();
      expect(root().ownerDocument.activeElement).toBe(q('#login-code'));
    });

    it('renvoie identifiants + code TOTP, puis ouvre la session', async () => {
      await reachSecondFactor();
      gateway.login.mockResolvedValueOnce(signedIn());
      await type('#login-code', '123 456');
      await submit();
      expect(gateway.login).toHaveBeenLastCalledWith({ username: 'docteur', password: 'une phrase de passe solide', totpCode: '123 456' });
      expect(navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('permet un code de secours à la place du code TOTP', async () => {
      await reachSecondFactor();
      [...root().querySelectorAll('button')].find((b) => b.textContent?.includes('code de secours'))!.click();
      await settle();
      expect(root().textContent).toContain('Code de secours');
      gateway.login.mockResolvedValueOnce(signedIn());
      await type('#login-code', 'ABCDE-FGHJK');
      await submit();
      expect(gateway.login).toHaveBeenLastCalledWith({ username: 'docteur', password: 'une phrase de passe solide', recoveryCode: 'ABCDE-FGHJK' });
    });

    it('garde le formulaire du code et vide le champ quand le code est faux', async () => {
      await reachSecondFactor();
      gateway.login.mockRejectedValueOnce(new ApiError(401, 'MFA_CODE_INVALID', 'Code de vérification incorrect.'));
      await type('#login-code', '000000');
      await submit();
      expect(q('[role=alert]')?.textContent).toContain('Code de vérification incorrect.');
      expect(q<HTMLInputElement>('#login-code')?.value).toBe('');
      expect(q('h2')?.textContent).toContain('Vérification en deux étapes');
    });

    it('exige un code avant tout appel serveur', async () => {
      await reachSecondFactor();
      gateway.login.mockClear();
      await submit();
      expect(root().textContent).toContain('Saisissez le code.');
      expect(gateway.login).not.toHaveBeenCalled();
    });

    it("permet de revenir à l'identifiant sans conserver le code", async () => {
      await reachSecondFactor();
      [...root().querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Retour')!.click();
      await settle();
      expect(q('#login-username')).not.toBeNull();
      expect(q('#login-code')).toBeNull();
    });
  });
});
