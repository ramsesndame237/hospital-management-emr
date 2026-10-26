import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasswordResetGateway } from '../../../core/auth/password-reset.gateway';
import { ApiError } from '../../../core/http/api-error';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ForgotPasswordPage } from './forgot-password.page';

describe('ForgotPasswordPage (design AUTH-11)', () => {
  let fixture: ComponentFixture<ForgotPasswordPage>;
  let request: ReturnType<typeof vi.fn>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = <T extends HTMLElement>(sel: string) => (fixture.nativeElement as HTMLElement).querySelector<T>(sel);

  async function setup(behaviour: () => Promise<void>) {
    request = vi.fn(behaviour);
    const { i18n } = configureApp({ signedIn: false, providers: [{ provide: PasswordResetGateway, useValue: { request } }] });
    const missing = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ForgotPasswordPage);
    await settle(fixture);
    return missing;
  }

  async function submitWith(identifier: string) {
    const input = el<HTMLInputElement>('#forgot-identifier')!;
    input.value = identifier;
    input.dispatchEvent(new Event('input'));
    el<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  it('affiche le champ, le message de confidentialité et le retour à la connexion', async () => {
    const missing = await setup(() => Promise.resolve());
    expect(el('h2')?.textContent).toContain('Mot de passe oublié ?');
    expect(el('label[for="forgot-identifier"]')?.textContent?.trim()).toBe('Identifiant ou adresse e-mail *');
    expect(text()).toContain('Votre confidentialité est préservée');
    expect(el('button[type=submit]')?.textContent).toContain('Envoyer un lien de réinitialisation');
    expect(el('a[href="/login"]')?.textContent).toContain('Retour à la connexion');
    expect(missing()).toEqual([]);
  });

  it('exige un identifiant avant tout appel', async () => {
    await setup(() => Promise.resolve());
    await submitWith('   ');
    expect(text()).toContain('Saisissez votre identifiant ou votre adresse e-mail.');
    expect(request).not.toHaveBeenCalled();
  });

  it('demande la réinitialisation et répond de la même façon que le compte existe ou non', async () => {
    await setup(() => Promise.resolve());
    await submitWith('  amina.essomba@bonapriso.example ');
    expect(request).toHaveBeenCalledWith('amina.essomba@bonapriso.example');
    expect(text()).toContain('Demande enregistrée');
    expect(text()).toContain('Si un compte correspond à ces informations');
  });

  it('dit honnêtement que la réinitialisation n’est pas encore disponible, sans simuler un envoi', async () => {
    await setup(() => Promise.reject(new ApiError(501, 'NOT_AVAILABLE', 'nope')));
    await submitWith('amina');
    expect(text()).toContain('Réinitialisation par e-mail pas encore disponible');
    expect(text()).toContain('Contactez l’administrateur');
    expect(text()).not.toContain('Demande enregistrée');
  });

  it('signale une erreur inattendue sans détail technique', async () => {
    await setup(() => Promise.reject(new ApiError(500, 'UNKNOWN', 'SELECT * FROM users')));
    await submitWith('amina');
    expect(text()).toContain('Demande impossible');
    expect(text()).not.toContain('SELECT');
  });
});
