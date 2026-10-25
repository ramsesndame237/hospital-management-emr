import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { token } from '../../core/auth/testing/fake-auth-gateway';
import { ApiError } from '../../core/http/api-error';
import { ToastService } from '../../shared/toast/toast.service';
import { configureApp, settle, typeOtp, watchMissingKeys } from '../../testing/app-testing';
import { AccountSetupPage } from './account-setup.page';

const SECRET = 'JBSWY3DPEHPK3PXP';
const ENROLLMENT = { keyUri: `otpauth://totp/Sanjeevani:marie.curie?secret=${SECRET}&issuer=Sanjeevani`, secret: SECRET };
const CODES = ['R7K9M-T2X4P', 'A3N6Q-V8C5L', 'D9F2H-K4M7R', 'W6B8T-Y3P5N', 'L2C7X-Q9A4F', 'H8V3R-N6D2K', 'P4Y9A-M7T5C', 'X5Q2L-B8W6H', 'N3K7F-R4V9D', 'C6M8P-A2L5Y'];
const STRONG = 'Cheval-pile-agrafe-2026';

const text = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent ?? '';
const el = <T extends HTMLElement>(f: ComponentFixture<unknown>, sel: string) => (f.nativeElement as HTMLElement).querySelector<T>(sel);
const click = (f: ComponentFixture<unknown>, label: string) => [...(f.nativeElement as HTMLElement).querySelectorAll('button, a')].find((e) => e.textContent?.includes(label))!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

async function type(f: ComponentFixture<unknown>, selector: string, value: string): Promise<void> {
  const input = el<HTMLInputElement>(f, selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  f.detectChanges();
}

describe('AccountSetupPage (première connexion)', () => {
  let fixture: ComponentFixture<AccountSetupPage>;
  let ctx: ReturnType<typeof configureApp>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let copy: ReturnType<typeof vi.fn>;
  let missing: () => string[];

  async function setup(profile: object = { mustChangePassword: true }, beforeCreate?: () => void) {
    copy = vi.fn().mockReturnValue(true);
    ctx = configureApp({ roles: ['DOCTOR'], profile, providers: [{ provide: Clipboard, useValue: { copy } }] });
    ctx.store.setToken('at-setup', Date.parse('2026-10-24T12:15:00Z'), 'setup');
    ctx.gateway.enrollMfa.mockResolvedValue(ENROLLMENT);
    beforeCreate?.();
    missing = watchMissingKeys(ctx.i18n);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(AccountSetupPage);
    await settle(fixture);
  }

  const submit = async () => {
    el<HTMLFormElement>(fixture, 'form')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  };

  async function fillPasswords(current: string, next: string, confirm = next) {
    await type(fixture, '#setup-currentPassword', current);
    await type(fixture, '#setup-newPassword', next);
    await type(fixture, '#setup-confirmPassword', confirm);
  }

  async function reachAuthenticator() {
    await setup();
    ctx.gateway.changePassword.mockResolvedValue(token('at-2', 'setup'));
    await fillPasswords('provisoire', STRONG);
    await submit();
  }

  async function reachRecoveryCodes() {
    await reachAuthenticator();
    ctx.gateway.activateMfa.mockResolvedValue(CODES);
    typeOtp(fixture, '123456');
    await submit();
  }

  describe('étape 1 sur 3 : mot de passe', () => {
    it('affiche la barre de progression et la politique de mot de passe', async () => {
      await setup();
      expect(text(fixture)).toContain('Créez votre mot de passe');
      expect(text(fixture)).toContain('ÉTAPE 1 / 3');
      expect(text(fixture)).toContain('Mot de passe temporaire *');
      expect(text(fixture)).toContain('Au moins 12 caractères');
      expect(missing()).toEqual([]);
    });

    it('refuse deux mots de passe différents, sans appeler le serveur', async () => {
      await setup();
      await fillPasswords('provisoire', STRONG, 'autre chose');
      await submit();
      expect(el(fixture, '#setup-confirmPassword-error')?.textContent).toContain('ne sont pas identiques');
      expect(ctx.gateway.changePassword).not.toHaveBeenCalled();
    });

    it('refuse un nouveau mot de passe trop court avant même d’interroger le serveur', async () => {
      await setup();
      await fillPasswords('provisoire', 'court');
      await submit();
      expect(el(fixture, '#setup-newPassword-error')).not.toBeNull();
      expect(ctx.gateway.changePassword).not.toHaveBeenCalled();
    });

    it('enregistre le mot de passe puis passe à l’étape 2', async () => {
      await reachAuthenticator();
      expect(ctx.gateway.changePassword).toHaveBeenCalledWith('provisoire', STRONG);
      expect(text(fixture)).toContain('Ajoutez un authentificateur');
      expect(text(fixture)).toContain('ÉTAPE 2 / 3');
    });

    it('affiche sur le bon champ le refus du serveur (mot de passe actuel faux)', async () => {
      await setup();
      ctx.gateway.changePassword.mockRejectedValueOnce(new ApiError(401, 'CURRENT_PASSWORD_INVALID', 'Le mot de passe actuel est incorrect.'));
      await fillPasswords('faux', STRONG);
      await submit();
      expect(el(fixture, '#setup-currentPassword-error')?.textContent).toContain('Le mot de passe actuel est incorrect.');
    });

    it('signale une panne réseau en haut du formulaire', async () => {
      await setup();
      ctx.gateway.changePassword.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
      await fillPasswords('provisoire', STRONG);
      await submit();
      expect(el(fixture, '[role=alert]')?.textContent).toContain('La connexion réseau a été interrompue');
    });

    it('mot de passe compromis : jauge en alerte, message, bouton inactif tant que le champ n’a pas changé (design AUTH-07)', async () => {
      await setup();
      ctx.gateway.changePassword.mockRejectedValueOnce(new ApiError(422, 'PASSWORD_BREACHED', 'Ce mot de passe figure dans une liste de mots de passe compromis.'));
      await fillPasswords('provisoire', STRONG);
      await submit();
      expect(text(fixture)).toContain('Force élevée · mot de passe compromis');
      expect(el(fixture, '[role=alert]')?.textContent).toContain('Ce mot de passe est apparu dans une fuite de données');
      expect(el<HTMLButtonElement>(fixture, 'button[type=submit]')?.disabled).toBe(true);
      expect(el(fixture, '.bg-status-warning')).not.toBeNull();

      await type(fixture, '#setup-newPassword', 'Autre-phrase-solide-2026');
      await settle(fixture);
      expect(el<HTMLButtonElement>(fixture, 'button[type=submit]')?.disabled).toBe(false);
      expect(text(fixture)).not.toContain('mot de passe compromis');
    });
  });

  describe('étape 2 sur 3 : authentificateur (design AUTH-08)', () => {
    it('démarre l’inscription, affiche le QR code, la clé à recopier et les 6 cases', async () => {
      await reachAuthenticator();
      await vi.waitFor(() => expect(el(fixture, 'app-qr-field img')).not.toBeNull());
      fixture.detectChanges();
      expect(ctx.gateway.enrollMfa).toHaveBeenCalledTimes(1);
      expect(text(fixture)).toContain('1. Scannez ce QR code');
      expect(text(fixture)).toContain('Compte : marie.curie');
      expect(text(fixture)).toContain('JBSW Y3DP EHPK 3PXP'); // clé groupée par 4
      expect(text(fixture)).toContain('2. Confirmez l’association');
      expect(el(fixture, 'app-qr-field img')?.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(el(fixture, 'app-otp-field')).not.toBeNull();
      expect(missing()).toEqual([]);
    });

    it('copie la clé brute (sans espaces) et confirme par une notification', async () => {
      await reachAuthenticator();
      click(fixture, 'Copier');
      expect(copy).toHaveBeenCalledWith(SECRET);
      expect(TestBed.inject(ToastService).toasts().map((t) => t.message)).toEqual(['Copié']);
    });

    it('reprend à l’étape 2 si le mot de passe a déjà été remplacé, et propose de réessayer quand la préparation échoue', async () => {
      await setup({ mustChangePassword: false }, () => ctx.gateway.enrollMfa.mockRejectedValueOnce(new ApiError(500, 'UNKNOWN', 'boum')));
      expect(text(fixture)).toContain('Ajoutez un authentificateur');
      expect(el(fixture, '[role=alert]')?.textContent).toContain('Impossible de préparer l’association');
      expect(text(fixture)).not.toContain('boum'); // pas de détail technique
      click(fixture, 'Réessayer');
      await vi.waitFor(() => expect(el(fixture, 'app-qr-field')).not.toBeNull());
      expect(ctx.gateway.enrollMfa).toHaveBeenCalledTimes(2);
    });

    it('code incorrect : avertissement, cases en rouge, aide dépliée, saisie conservée', async () => {
      await reachAuthenticator();
      ctx.gateway.activateMfa.mockRejectedValueOnce(new ApiError(401, 'MFA_CODE_INVALID', 'Code de vérification incorrect.'));
      typeOtp(fixture, '284951');
      await submit();
      expect(el(fixture, '[role=status], [role=alert]')?.textContent).toContain('Ce code est incorrect ou a expiré');
      expect(el(fixture, 'app-otp-field input')?.className).toContain('border-status-critical');
      expect(el<HTMLDetailsElement>(fixture, 'details')?.open).toBe(true);
      expect(text(fixture)).toContain('ÉTAPE 2 / 3');
    });

    it('exige 6 chiffres avant d’appeler le serveur', async () => {
      await reachAuthenticator();
      typeOtp(fixture, '12');
      await submit();
      expect(ctx.gateway.activateMfa).not.toHaveBeenCalled();
      expect(text(fixture)).toContain('Le code comporte 6 chiffres.');
    });

    it('code valide : passe à l’étape 3 avec les codes de récupération', async () => {
      await reachRecoveryCodes();
      expect(ctx.gateway.activateMfa).toHaveBeenCalledWith('123456');
      expect(text(fixture)).toContain('Conservez vos codes');
      expect(text(fixture)).toContain('ÉTAPE 3 / 3');
    });
  });

  describe('étape 3 sur 3 : codes de récupération (design AUTH-09)', () => {
    it('affiche les 10 codes, avertit qu’ils sont à usage unique, et bloque la fin tant que la case n’est pas cochée', async () => {
      await reachRecoveryCodes();
      expect(text(fixture)).toContain('10 codes confidentiels à usage unique');
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-codes-field li').length).toBe(10);
      expect(text(fixture)).toContain('R7K9M-T2X4P');
      expect(el<HTMLButtonElement>(fixture, 'button[type=submit]')?.disabled).toBe(true);
      expect(text(fixture)).toContain('Confirmez la conservation des codes pour continuer.');
      expect(missing()).toEqual([]);
    });

    it('cocher « J’ai conservé ces codes » active le bouton et change le texte d’aide', async () => {
      await reachRecoveryCodes();
      el<HTMLInputElement>(fixture, 'input[type=checkbox]')!.click();
      await settle(fixture);
      expect(el<HTMLButtonElement>(fixture, 'button[type=submit]')?.disabled).toBe(false);
      expect(text(fixture)).toContain('La conservation des codes est confirmée. Vous pouvez continuer.');
    });

    it('« Copier » met les 10 codes dans le presse-papiers, un par ligne', async () => {
      await reachRecoveryCodes();
      click(fixture, 'Copier');
      expect(copy).toHaveBeenCalledWith(CODES.join('\n'));
      expect(TestBed.inject(ToastService).toasts().map((t) => t.message)).toContain('Codes copiés');
    });

    it('« Télécharger .txt » crée un fichier local sans passer par le serveur', async () => {
      await reachRecoveryCodes();
      const create = vi.fn().mockReturnValue('blob:codes');
      const revoke = vi.fn();
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
      const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      click(fixture, 'Télécharger .txt');
      expect(create).toHaveBeenCalledTimes(1);
      const blob = create.mock.calls[0][0] as Blob;
      expect(await blob.text()).toContain('R7K9M-T2X4P');
      expect(anchorClick).toHaveBeenCalled();
      expect(revoke).toHaveBeenCalledWith('blob:codes');
      anchorClick.mockRestore();
    });

    it('« Imprimer » lance l’impression', async () => {
      await reachRecoveryCodes();
      const print = vi.fn();
      Object.assign(window, { print });
      click(fixture, 'Imprimer');
      expect(print).toHaveBeenCalled();
    });

    it('terminer renouvelle la session puis affiche « Votre compte est prêt » (design AUTH-10)', async () => {
      await reachRecoveryCodes();
      ctx.gateway.refresh.mockResolvedValue(token('at-full', 'full'));
      el<HTMLInputElement>(fixture, 'input[type=checkbox]')!.click();
      await settle(fixture);
      await submit();
      expect(ctx.gateway.refresh).toHaveBeenCalled();
      expect(text(fixture)).toContain('Votre compte est prêt');
      expect(text(fixture)).toContain('Bienvenue, marie.curie');
      expect(text(fixture)).toContain('Sécurisation terminée');
      expect(text(fixture)).toContain('Mot de passe personnel défini');
      expect(text(fixture)).toContain('10 codes de récupération conservés');
      expect(text(fixture)).not.toContain('R7K9M-T2X4P'); // les codes ne restent pas à l'écran ni en mémoire
      expect(missing()).toEqual([]);
    });

    it('si la session ne peut pas être renouvelée, le dit et reste sur l’étape', async () => {
      await reachRecoveryCodes();
      ctx.gateway.refresh.mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'));
      el<HTMLInputElement>(fixture, 'input[type=checkbox]')!.click();
      await settle(fixture);
      await submit();
      expect(text(fixture)).toContain('Conservez vos codes');
      expect(el(fixture, '[role=alert]')?.textContent).toContain('Une erreur est survenue');
    });

    it('« Accéder à mon espace » ouvre l’application', async () => {
      await reachRecoveryCodes();
      ctx.gateway.refresh.mockResolvedValue(token('at-full', 'full'));
      el<HTMLInputElement>(fixture, 'input[type=checkbox]')!.click();
      await settle(fixture);
      await submit();
      click(fixture, 'Accéder à mon espace');
      expect(navigateByUrl).toHaveBeenCalledWith('/');
    });
  });
});
