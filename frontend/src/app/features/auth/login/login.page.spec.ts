import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthGateway } from '../../../core/auth/auth.gateway';
import { FakeAuthGateway, token } from '../../../core/auth/testing/fake-auth-gateway';
import { ApiError } from '../../../core/http/api-error';
import { JsonTranslator } from '../../../core/i18n/json-translator';
import { Translator } from '../../../core/i18n/translator';
import { LoginPage, safeReturnUrl } from './login.page';

describe('safeReturnUrl (anti-redirection ouverte)', () => {
  it.each([
    ['/patients/42', '/patients/42'],
    ['/', '/'],
    ['/a?b=1#c', '/a?b=1#c'],
  ])('accepte une adresse interne : %s', (input, expected) => expect(safeReturnUrl(input)).toBe(expected));

  it.each(['//evil.example', 'https://evil.example', 'javascript:alert(1)', '\\\\evil', '/\\evil.example', 'patients', '', null, undefined])(
    'refuse et revient à l\'accueil : %p',
    (input) => expect(safeReturnUrl(input as string)).toBe('/'),
  );
});

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let gateway: FakeAuthGateway;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(sel: string) => root().querySelector<T>(sel);

  async function setup(queryParams: Record<string, string> = {}) {
    gateway = new FakeAuthGateway();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthGateway, useValue: gateway },
        { provide: Translator, useClass: JsonTranslator },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
      ],
    });
    TestBed.inject(Translator).setLocale('fr');
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Laisse se terminer la chaîne de promesses (connexion → profil → navigation) puis redessine : `whenStable` ne la suit pas en mode sans zone. */
  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function submit(formSelector: string) {
    q<HTMLFormElement>(formSelector)!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await flush();
  }

  const signedIn = (scope: 'full' | 'setup' = 'full') => ({ status: 'authenticated' as const, ...token('at-1', scope), mustChangePassword: false, mfaEnrollmentRequired: false });

  it('affiche le formulaire de connexion du personnel, en français', async () => {
    await setup();
    expect(q('h2')?.textContent).toContain('Connexion du personnel');
    expect(q('#username')).not.toBeNull();
    expect(q<HTMLInputElement>('#password')?.type).toBe('password');
    expect(q('button[type=submit]')?.textContent).toContain('Se connecter');
  });

  it("signale les champs obligatoires sans appeler le serveur", async () => {
    await setup();
    await submit('form');
    expect(root().textContent).toContain('Saisissez votre identifiant.');
    expect(root().textContent).toContain('Saisissez votre mot de passe.');
    expect(q('#username')?.getAttribute('aria-invalid')).toBe('true');
    expect(gateway.login).not.toHaveBeenCalled();
  });

  it('connecte puis ouvre la page demandée', async () => {
    await setup({ returnUrl: '/patients/42' });
    gateway.login.mockResolvedValue(signedIn());
    await type('#username', '  Marie.Curie ');
    await type('#password', 'une phrase de passe solide');
    await submit('form');
    expect(gateway.login).toHaveBeenCalledWith({ username: 'Marie.Curie', password: 'une phrase de passe solide' }); // identifiant nettoyé, mot de passe intact
    expect(navigateByUrl).toHaveBeenCalledWith('/patients/42');
  });

  it("ignore une adresse de retour externe (hameçonnage) et ouvre l'accueil", async () => {
    await setup({ returnUrl: '//evil.example/phishing' });
    gateway.login.mockResolvedValue(signedIn());
    await type('#username', 'marie');
    await type('#password', 'x');
    await submit('form');
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('envoie un compte à finaliser vers son assistant au lieu de la plateforme', async () => {
    await setup({ returnUrl: '/patients' });
    gateway.login.mockResolvedValue(signedIn('setup'));
    await type('#username', 'nouveau');
    await type('#password', 'Provisoire-2026');
    await submit('form');
    expect(navigateByUrl).toHaveBeenCalledWith('/account/setup');
  });

  it("affiche le message du serveur (déjà traduit) en cas d'identifiants incorrects, sans quitter la page", async () => {
    await setup();
    gateway.login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.'));
    await type('#username', 'marie');
    await type('#password', 'faux');
    await submit('form');
    expect(q('[role=alert]')?.textContent).toContain('Identifiant ou mot de passe incorrect.');
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(q('button[type=submit]')?.hasAttribute('disabled')).toBe(false); // on peut réessayer
  });

  it('traduit une panne réseau et masque le détail technique des erreurs serveur', async () => {
    await setup();
    gateway.login.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Http failure response for /api: 0'));
    await type('#username', 'marie');
    await type('#password', 'x');
    await submit('form');
    expect(q('[role=alert]')?.textContent).toContain('Impossible de joindre le serveur');
    expect(root().textContent).not.toContain('Http failure');

    gateway.login.mockRejectedValueOnce(new ApiError(500, 'UNKNOWN', 'SELECT * FROM users failed'));
    await submit('form');
    expect(root().textContent).toContain('Une erreur est survenue');
    expect(root().textContent).not.toContain('SELECT');
  });

  it('explique la session expirée', async () => {
    await setup({ reason: 'expired' });
    expect(root().textContent).toContain('Votre session a expiré');
  });

  it('affiche et masque le mot de passe à la demande', async () => {
    await setup();
    const toggle = [...root().querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Afficher')!;
    toggle.click();
    fixture.detectChanges();
    expect(q<HTMLInputElement>('#password')?.type).toBe('text');
    expect(toggle.textContent?.trim()).toBe('Masquer');
  });

  describe('double authentification', () => {
    async function reachSecondFactor() {
      await setup();
      gateway.login.mockResolvedValueOnce({ status: 'mfa_required' });
      await type('#username', 'docteur');
      await type('#password', 'une phrase de passe solide');
      await submit('form');
    }

    it('passe à la saisie du code quand le serveur le demande', async () => {
      await reachSecondFactor();
      expect(q('h2')?.textContent).toContain('Vérification en deux étapes');
      expect(q('#code')).not.toBeNull();
      expect(q('#username')).toBeNull();
    });

    it('renvoie identifiants + code TOTP, puis ouvre la session', async () => {
      await reachSecondFactor();
      gateway.login.mockResolvedValueOnce(signedIn());
      await type('#code', '123 456');
      await submit('form');
      expect(gateway.login).toHaveBeenLastCalledWith({ username: 'docteur', password: 'une phrase de passe solide', totpCode: '123 456' });
      expect(navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('permet un code de secours à la place du code TOTP', async () => {
      await reachSecondFactor();
      [...root().querySelectorAll('button')].find((b) => b.textContent?.includes('code de secours'))!.click();
      fixture.detectChanges();
      expect(root().textContent).toContain('Code de secours');
      gateway.login.mockResolvedValueOnce(signedIn());
      await type('#code', 'ABCDE-FGHJK');
      await submit('form');
      expect(gateway.login).toHaveBeenLastCalledWith({ username: 'docteur', password: 'une phrase de passe solide', recoveryCode: 'ABCDE-FGHJK' });
    });

    it('garde le formulaire du code et vide le champ quand le code est faux', async () => {
      await reachSecondFactor();
      gateway.login.mockRejectedValueOnce(new ApiError(401, 'MFA_CODE_INVALID', 'Code de vérification incorrect.'));
      await type('#code', '000000');
      await submit('form');
      expect(q('[role=alert]')?.textContent).toContain('Code de vérification incorrect.');
      expect(q<HTMLInputElement>('#code')?.value).toBe('');
      expect(q('h2')?.textContent).toContain('Vérification en deux étapes');
    });

    it('exige un code avant tout appel serveur', async () => {
      await reachSecondFactor();
      gateway.login.mockClear();
      await submit('form');
      expect(root().textContent).toContain('Saisissez le code.');
      expect(gateway.login).not.toHaveBeenCalled();
    });

    it("permet de revenir à l'identifiant sans conserver le code", async () => {
      await reachSecondFactor();
      [...root().querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Retour')!.click();
      fixture.detectChanges();
      expect(q('#username')).not.toBeNull();
      expect(q('#code')).toBeNull();
    });
  });
});
