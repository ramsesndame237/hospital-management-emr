import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthGateway } from '../../../core/auth/auth.gateway';
import { FakeAuthGateway, token } from '../../../core/auth/testing/fake-auth-gateway';
import { ApiError } from '../../../core/http/api-error';
import { JsonTranslator } from '../../../core/i18n/json-translator';
import { Translator } from '../../../core/i18n/translator';
import { Clock } from '../../../core/time/clock';
import { Temporal } from '../../../core/time/temporal';
import { ToastService } from '../../../shared/toast/toast.service';
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
    expect(supportCode('R01', noon)).toBe('AUTH-R01-241026');
  });
});

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let gateway: FakeAuthGateway;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let nowMs = Date.parse('2026-10-24T12:00:00Z');
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(sel: string) => root().querySelector<T>(sel);
  const text = () => root().textContent ?? '';

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
    nowMs = Date.parse('2026-10-24T12:00:00Z');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthGateway, useValue: gateway },
        { provide: Translator, useClass: JsonTranslator },
        { provide: Clock, useValue: { now: () => Temporal.Instant.fromEpochMilliseconds(nowMs), nowMs: () => nowMs } },
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

  /** Saisit un code dans les cases séparées, un chiffre par case, comme un utilisateur. */
  async function typeCode(code: string) {
    const cells = [...root().querySelectorAll<HTMLInputElement>('app-otp-field input')];
    [...code].forEach((digit, i) => {
      cells[i].value = digit;
      cells[i].dispatchEvent(new Event('input'));
    });
    fixture.detectChanges();
  }

  async function submit() {
    q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await settle();
  }

  async function fillCredentials(username = 'marie', password = 'x') {
    await type('#login-username', username);
    await type('#login-password', password);
  }

  const click = (label: string) => [...root().querySelectorAll('button, a')].find((e) => e.textContent?.includes(label))!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const signedIn = (extra: object = {}) => ({ status: 'authenticated' as const, ...token('at-1', 'full'), mustChangePassword: false, mfaEnrollmentRequired: false, ...extra });

  it('affiche le formulaire de connexion du personnel, en français', async () => {
    await setup();
    expect(q('h2')?.textContent).toContain('Connexion à votre espace');
    expect(q('label[for="login-username"]')?.textContent?.trim()).toBe('Identifiant *');
    expect(q<HTMLInputElement>('#login-password')?.type).toBe('password');
    expect(q('button[type=submit]')?.textContent).toContain('Se connecter');
    expect(q('a[href="/forgot-password"]')?.textContent).toContain('Mot de passe oublié ? Réinitialiser');
    expect(text()).not.toContain('Code d’assistance'); // l'aide n'apparaît qu'après un incident
  });

  it('met le curseur sur l’identifiant à l’ouverture', async () => {
    await setup();
    expect(root().ownerDocument.activeElement).toBe(q('#login-username'));
  });

  it('signale les champs obligatoires sans appeler le serveur', async () => {
    await setup();
    await submit();
    expect(text()).toContain('Saisissez votre identifiant.');
    expect(text()).toContain('Saisissez votre mot de passe.');
    expect(q('#login-username')?.getAttribute('aria-invalid')).toBe('true');
    expect(gateway.login).not.toHaveBeenCalled();
  });

  it('connecte puis ouvre la page demandée', async () => {
    await setup({ returnUrl: '/patients/42' });
    gateway.login.mockResolvedValue(signedIn());
    await fillCredentials('  Marie.Curie ', 'une phrase de passe solide');
    await submit();
    expect(gateway.login).toHaveBeenCalledWith({ username: 'Marie.Curie', password: 'une phrase de passe solide' }); // identifiant nettoyé, mot de passe intact
    expect(navigateByUrl).toHaveBeenCalledWith('/patients/42');
  });

  it("ignore une adresse de retour externe (hameçonnage) et ouvre l'accueil", async () => {
    await setup({ returnUrl: '//evil.example/phishing' });
    gateway.login.mockResolvedValue(signedIn());
    await fillCredentials();
    await submit();
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('envoie un compte à finaliser vers son assistant au lieu de la plateforme', async () => {
    await setup({ returnUrl: '/patients' });
    gateway.login.mockResolvedValue(signedIn({ scope: 'setup' }));
    await fillCredentials('nouveau', 'Provisoire-2026');
    await submit();
    expect(navigateByUrl).toHaveBeenCalledWith('/account/setup');
  });

  it('affiche et masque le mot de passe à la demande', async () => {
    await setup();
    const toggle = [...root().querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Afficher')!;
    toggle.click();
    await settle();
    expect(q<HTMLInputElement>('#login-password')?.type).toBe('text');
    expect(toggle.textContent?.trim()).toBe('Masquer');
  });

  describe('incidents de connexion (design AUTH-04)', () => {
    it('identifiants refusés : « Connexion impossible », message du serveur, code C01, saisie conservée', async () => {
      await setup();
      gateway.login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.'));
      await fillCredentials('marie', 'faux');
      await submit();
      expect(q('[role=alert]')?.textContent).toContain('Connexion impossible');
      expect(q('[role=alert]')?.textContent).toContain('Identifiant ou mot de passe incorrect. Vérifiez vos informations et réessayez.');
      expect(text()).toContain('Code d’assistance : AUTH-C01-241026');
      expect(text()).toContain('+237 6 70 12 34 56');
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(q('button[type=submit]')?.hasAttribute('disabled')).toBe(false); // on peut réessayer
      expect(q<HTMLInputElement>('#login-username')?.value).toBe('marie');
    });

    it('panne réseau : message dédié, bouton « Réessayer », code N01, sans détail technique', async () => {
      await setup();
      gateway.login.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Http failure response for /api: 0'));
      await fillCredentials();
      await submit();
      expect(q('[role=alert]')?.textContent).toContain('La connexion réseau a été interrompue');
      expect(q('button[type=submit]')?.textContent).toContain('Réessayer');
      expect(text()).toContain('Code d’assistance : AUTH-N01-241026');
      expect(text()).not.toContain('Http failure');
    });

    it('service indisponible (erreur serveur) : message, code S01, lien vers l’état du service, sans détail technique', async () => {
      await setup();
      gateway.login.mockRejectedValueOnce(new ApiError(503, 'UNKNOWN', 'SELECT * FROM users failed'));
      await fillCredentials();
      await submit();
      expect(q('[role=alert]')?.textContent).toContain('Le service de connexion est indisponible');
      expect(text()).toContain('AUTH-S01-241026');
      expect(q('a[href="/api/Health"]')?.getAttribute('target')).toBe('_blank');
      expect(text()).not.toContain('SELECT');
      expect(q('button[type=submit]')?.textContent).toContain('Réessayer');
    });

    it('trop de tentatives : bouton inactif avec compte à rebours, code R01, puis réactivation', async () => {
      await setup();
      gateway.login.mockRejectedValueOnce(new ApiError(429, 'HTTP_429', 'Trop de requêtes.', [], 60));
      await fillCredentials();
      vi.useFakeTimers();
      try {
        q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
        await vi.advanceTimersByTimeAsync(5);
        fixture.detectChanges();
        expect(q('[role=status], [role=alert]')?.textContent).toContain('Trop de tentatives, réessayez dans 1 min');
        expect(text()).toContain('AUTH-R01-241026');
        const button = q<HTMLButtonElement>('button[type=submit]')!;
        expect(button.disabled).toBe(true);
        expect(button.textContent).toContain('Réessayer dans 01:00');

        nowMs += 30_000;
        await vi.advanceTimersByTimeAsync(1_000);
        fixture.detectChanges();
        expect(q('button[type=submit]')?.textContent).toContain('Réessayer dans 00:30');

        nowMs += 31_000;
        await vi.advanceTimersByTimeAsync(1_000);
        fixture.detectChanges();
        expect(q<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(false);
        expect(q('button[type=submit]')?.textContent).toContain('Se connecter');
        expect(text()).not.toContain('Trop de tentatives');
      } finally {
        vi.useRealTimers();
      }
    });

    it('sans délai fourni par le serveur, suspend une minute', async () => {
      await setup();
      gateway.login.mockRejectedValueOnce(new ApiError(429, 'HTTP_429', 'Trop de requêtes.'));
      await fillCredentials();
      await submit();
      expect(q('button[type=submit]')?.textContent).toContain('Réessayer dans 01:00');
    });
  });

  describe('double authentification (design AUTH-02)', () => {
    async function reachSecondFactor() {
      await setup();
      gateway.login.mockResolvedValueOnce({ status: 'mfa_required' });
      await fillCredentials('docteur', 'une phrase de passe solide');
      await submit();
    }

    it('passe à la saisie du code en 6 cases, affiche le compte, curseur dans la première case', async () => {
      await reachSecondFactor();
      expect(q('h2')?.textContent).toContain('Vérifiez votre identité');
      expect(text()).toContain('Compte professionnel · docteur');
      expect(root().querySelectorAll('app-otp-field input').length).toBe(6);
      expect(q('#login-username')).toBeNull();
      expect(root().ownerDocument.activeElement).toBe(q('#login-code'));
      expect(text()).toContain('Aucun code ne vous sera demandé par téléphone.');
    });

    it("n'affiche aucune erreur en arrivant sur l'étape du code, même si l'envoi précédent avait été tenté", async () => {
      await reachSecondFactor();
      expect(text()).not.toContain('Saisissez le code.'); // (le chapeau, lui, commence bien par « Saisissez le code à 6 chiffres »)
      expect(root().querySelector('app-otp-field input')?.className).not.toContain('border-status-critical');
    });

    it('renvoie identifiants + code TOTP, puis ouvre la session', async () => {
      await reachSecondFactor();
      gateway.login.mockResolvedValueOnce(signedIn());
      await typeCode('123456');
      await submit();
      expect(gateway.login).toHaveBeenLastCalledWith({ username: 'docteur', password: 'une phrase de passe solide', totpCode: '123456' });
      expect(navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('code incorrect ou expiré : avertissement, cases en rouge, code conservé pour correction', async () => {
      await reachSecondFactor();
      gateway.login.mockRejectedValueOnce(new ApiError(401, 'MFA_CODE_INVALID', 'Code de vérification incorrect.'));
      await typeCode('284951');
      await submit();
      expect(q('[role=alert], [role=status]')?.textContent).toContain('Ce code est incorrect ou a expiré');
      expect(root().querySelector('app-otp-field input')?.className).toContain('border-status-critical');
      expect([...root().querySelectorAll<HTMLInputElement>('app-otp-field input')].map((i) => i.value).join('')).toBe('284951');
      expect(q('h2')?.textContent).toContain('Vérifiez votre identité');
    });

    it('exige 6 chiffres avant tout appel serveur', async () => {
      await reachSecondFactor();
      gateway.login.mockClear();
      await typeCode('12');
      await submit();
      expect(text()).toContain('Le code comporte 6 chiffres.');
      expect(gateway.login).not.toHaveBeenCalled();
    });

    it("permet de revenir à la connexion sans conserver le mot de passe", async () => {
      await reachSecondFactor();
      click('Retour à la connexion');
      await settle();
      expect(q('#login-username')).not.toBeNull();
      expect(root().querySelector('app-otp-field')).toBeNull();
    });

    describe('code de récupération (design AUTH-03)', () => {
      async function openRecovery() {
        await reachSecondFactor();
        click('Utiliser un code de récupération');
        await settle();
      }

      it('affiche le formulaire de récupération avec son avertissement « usage unique »', async () => {
        await openRecovery();
        expect(q('h2')?.textContent).toContain('Utiliser un code de récupération');
        expect(text()).toContain('Chaque code est à usage unique');
        expect(text()).toContain('Format : 5 caractères, tiret, 5 caractères.');
        expect(text()).toContain('Aucun code disponible ?');
      });

      it('vérifie le format avant d’appeler le serveur', async () => {
        await openRecovery();
        gateway.login.mockClear();
        await type('#login-recoveryCode', 'ABC');
        await submit();
        expect(text()).toContain('Le code comporte 5 caractères, un tiret, puis 5 caractères.');
        expect(gateway.login).not.toHaveBeenCalled();
      });

      it('envoie le code en majuscules et affiche « Identité vérifiée » avec le nombre de codes restants', async () => {
        await openRecovery();
        gateway.login.mockResolvedValueOnce(signedIn({ recoveryCodesRemaining: 7 }));
        await type('#login-recoveryCode', 'abcde-fghjk');
        await submit();
        expect(gateway.login).toHaveBeenLastCalledWith({ username: 'docteur', password: 'une phrase de passe solide', recoveryCode: 'ABCDE-FGHJK' });
        expect(q('h2')?.textContent).toContain('Identité vérifiée');
        expect(text()).toContain('7 codes restants');
        expect(TestBed.inject(ToastService).toasts().map((t) => t.message)).toEqual(['7 codes restants']);
        expect(navigateByUrl).not.toHaveBeenCalled(); // on laisse lire avant de poursuivre
      });

      it('sans décompte fourni par l’API, ne prétend pas en connaître un', async () => {
        await openRecovery();
        gateway.login.mockResolvedValueOnce(signedIn());
        await type('#login-recoveryCode', 'ABCDE-FGHJK');
        await submit();
        expect(text()).toContain('Code de récupération accepté');
        expect(text()).not.toContain('codes restants');
        expect(TestBed.inject(ToastService).toasts()).toEqual([]);
      });

      it('« Choisir mon contexte de travail » ouvre la page demandée', async () => {
        await openRecovery();
        gateway.login.mockResolvedValueOnce(signedIn());
        await type('#login-recoveryCode', 'ABCDE-FGHJK');
        await submit();
        click('Choisir mon contexte de travail');
        await settle();
        expect(navigateByUrl).toHaveBeenCalledWith('/');
      });

      it('code de récupération refusé : avertissement et saisie conservée', async () => {
        await openRecovery();
        gateway.login.mockRejectedValueOnce(new ApiError(401, 'MFA_CODE_INVALID', 'Code de vérification incorrect.'));
        await type('#login-recoveryCode', 'ABCDE-FGHJK');
        await submit();
        expect(text()).toContain('Ce code est incorrect ou a expiré');
        expect(q<HTMLInputElement>('#login-recoveryCode')?.value).toBe('ABCDE-FGHJK');
      });

      it('la saisie du code à 6 chiffres ne se retrouve pas dans le champ du code de récupération', async () => {
        await reachSecondFactor();
        await typeCode('123456');
        click('Utiliser un code de récupération');
        await settle();
        expect(q<HTMLInputElement>('#login-recoveryCode')?.value).toBe('');
      });

      it('permet de revenir à l’application d’authentification', async () => {
        await openRecovery();
        click('Revenir à l’application d’authentification');
        await settle();
        expect(root().querySelectorAll('app-otp-field input').length).toBe(6);
      });
    });
  });
});
