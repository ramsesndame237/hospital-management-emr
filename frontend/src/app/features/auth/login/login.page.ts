import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { LoginOutcome } from '../../../core/auth/auth.models';
import { SessionService } from '../../../core/auth/session.service';
import { toApiError } from '../../../core/http/api-error';
import { Translator } from '../../../core/i18n/translator';
import { BrandMark } from '../../../shared/brand-mark';
import { Preferences } from '../../../shared/preferences';

type Step = 'credentials' | 'mfa';

/**
 * Seules les adresses internes sont acceptées comme destination après connexion : `//evil.example` ou `https://…`
 * transformeraient la page de connexion en redirection ouverte (hameçonnage).
 */
export function safeReturnUrl(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, HlmButtonImports, HlmInputImports, HlmLabelImports, HlmCardImports, HlmAlertImports, BrandMark, Preferences],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
})
export class LoginPage {
  protected readonly i18n = inject(Translator);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly step = signal<Step>('credentials');
  protected readonly recoveryMode = signal(false);
  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  /** Message d'erreur de la dernière tentative (déjà traduit). */
  protected readonly error = signal<string | null>(null);
  protected readonly attempted = signal(false);
  protected readonly expired = this.route.snapshot.queryParamMap.get('reason') === 'expired';

  protected readonly credentials = this.fb.group({
    username: ['', [Validators.required, Validators.maxLength(64)]],
    password: ['', [Validators.required, Validators.maxLength(1024)]],
  });
  protected readonly secondFactor = this.fb.group({ code: ['', [Validators.required, Validators.maxLength(16)]] });

  private readonly codeField = viewChild<ElementRef<HTMLInputElement>>('codeField');

  protected submitCredentials(): void {
    this.attempted.set(true);
    if (this.credentials.invalid) return;
    const { username, password } = this.credentials.getRawValue();
    void this.run(() => this.session.login({ username: username.trim(), password }));
  }

  protected submitCode(): void {
    this.attempted.set(true);
    if (this.secondFactor.invalid) return;
    const { username, password } = this.credentials.getRawValue();
    const code = this.secondFactor.getRawValue().code.trim();
    const factor = this.recoveryMode() ? { recoveryCode: code } : { totpCode: code };
    void this.run(() => this.session.login({ username: username.trim(), password, ...factor }));
  }

  protected toggleRecovery(): void {
    this.recoveryMode.update((v) => !v);
    this.secondFactor.reset();
    this.error.set(null);
    this.focusCode();
  }

  protected backToCredentials(): void {
    this.secondFactor.reset();
    this.recoveryMode.set(false);
    this.error.set(null);
    this.attempted.set(false);
    this.step.set('credentials');
  }

  private async run(login: () => Promise<LoginOutcome>): Promise<void> {
    this.error.set(null);
    this.submitting.set(true);
    try {
      const outcome = await login();
      if (outcome.kind === 'mfa_required') {
        this.attempted.set(false);
        this.step.set('mfa');
        this.focusCode();
        return;
      }
      this.credentials.reset(); // le mot de passe ne reste pas en mémoire dans le formulaire
      await this.router.navigateByUrl(outcome.setupRequired ? '/account/setup' : safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    } catch (e) {
      const error = toApiError(e);
      this.error.set(error.isNetwork ? this.i18n.t('login.errors.network') : error.status >= 500 || error.code === 'UNKNOWN' ? this.i18n.t('login.errors.generic') : error.message);
      if (this.step() === 'mfa') {
        this.secondFactor.reset();
        this.focusCode();
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private focusCode(): void {
    afterNextRender(() => this.codeField()?.nativeElement.focus(), { injector: this.injector });
  }
}
