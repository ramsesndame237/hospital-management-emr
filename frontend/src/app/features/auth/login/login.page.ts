import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginCredentials, LoginOutcome } from '../../../core/auth/auth.models';
import { SessionService } from '../../../core/auth/session.service';
import { ESTABLISHMENT } from '../../../core/config/establishment.config';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { Translator } from '../../../core/i18n/translator';
import { Clock } from '../../../core/time/clock';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { ToastService } from '../../../shared/toast/toast.service';
import { AuthCard } from '../shared/auth-card';
import { safeReturnUrl } from '../shared/return-url';
import { supportCode } from '../shared/support-code';
import { Notice, credentialsFields, recoveryFields, supportKindOf, totpFields, verifiedFields } from './login.form';

type Step = 'credentials' | 'mfa' | 'recovery' | 'verified';

/** Titre et chapeau de chaque étape (clés de catalogue). */
const HEADINGS: Readonly<Record<Step, { title: string; lead: string }>> = {
  credentials: { title: 'login.title', lead: 'login.lead' },
  mfa: { title: 'mfa.title', lead: 'mfa.lead' },
  recovery: { title: 'recovery.title', lead: 'recovery.lead' },
  verified: { title: 'recovery.verifiedTitle', lead: 'recovery.lead' },
};

/**
 * Connexion du personnel : identifiants → second facteur (code à 6 chiffres, ou code de récupération) → espace de travail.
 * Chaque incident (réseau, identifiants, trop de tentatives, service indisponible) a son message, son code d'assistance et,
 * pour la suspension temporaire, un compte à rebours qui réactive le bouton.
 */
@Component({
  selector: 'app-login-page',
  imports: [AuthCard, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [eyebrow]="i18n.t('auth.eyebrow')" [title]="i18n.t(heading().title)" [lead]="i18n.t(heading().lead)" titleId="login-title">
      <app-form-builder #form [fields]="fields()" [busy]="submitting()" formId="login" (submitted)="onSubmit($event)" (action)="onAction($event)" />
    </app-auth-card>
  `,
})
export class LoginPage {
  protected readonly i18n = inject(Translator);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly clock = inject(Clock);
  private readonly formatter = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly establishment = inject(ESTABLISHMENT);

  protected readonly step = signal<Step>('credentials');
  protected readonly submitting = signal(false);
  private readonly notice = signal<Notice | null>(null);
  private readonly remaining = signal<number | undefined>(undefined);
  private readonly username = signal('');

  /** Suspension temporaire demandée par le serveur (HTTP 429) : instant de fin et horloge locale qui avance chaque seconde. */
  private readonly lockUntilMs = signal<number | null>(null);
  private readonly nowMs = signal(this.clock.nowMs());
  private lockTimer: ReturnType<typeof setInterval> | null = null;
  protected readonly lockSeconds = computed(() => {
    const until = this.lockUntilMs();
    return until === null ? 0 : Math.max(0, Math.ceil((until - this.nowMs()) / 1000));
  });

  private readonly form = viewChild.required<FormBuilderComponent>('form');
  private password = '';

  protected readonly heading = computed(() => HEADINGS[this.step()]);

  protected readonly fields = computed<FieldSchema[]>(() => {
    const notice = this.notice();
    const locked = this.lockSeconds() > 0;
    const base = (idle: string) => (locked ? this.i18n.t('login.retryIn', { time: this.formatter.countdown(this.lockSeconds()) }) : idle);
    switch (this.step()) {
      case 'mfa':
        return totpFields({ notice, username: this.username(), submitLabel: base(this.i18n.t('mfa.verify')), locked });
      case 'recovery':
        return recoveryFields({ notice, username: this.username(), submitLabel: base(this.i18n.t('recovery.verify')), locked });
      case 'verified':
        return verifiedFields(this.remaining());
      default: {
        const kind = supportKindOf(notice);
        const retry = notice?.kind === 'network' || notice?.kind === 'unavailable';
        return credentialsFields({
          notice,
          locked,
          submitLabel: base(this.i18n.t(retry ? 'login.retry' : 'login.submit')),
          supportCode: kind ? supportCode(kind, this.clock.now()) : null,
          supportPhone: this.establishment.supportPhone,
          statusUrl: this.establishment.statusUrl,
        });
      }
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopLockTimer());
  }

  protected onSubmit(value: Record<string, unknown>): void {
    const step = this.step();
    if (step === 'credentials') {
      this.username.set(String(value['username']));
      this.password = String(value['password']);
      void this.run({ username: this.username(), password: this.password });
    } else if (step === 'mfa') {
      void this.run({ username: this.username(), password: this.password, totpCode: String(value['code']) });
    } else if (step === 'recovery') {
      void this.run({ username: this.username(), password: this.password, recoveryCode: String(value['recoveryCode']) });
    }
  }

  protected onAction(event: FormAction): void {
    switch (event.action) {
      case 'toRecovery':
        this.go('recovery');
        break;
      case 'backToApp':
        this.go('mfa');
        break;
      case 'back':
        this.password = '';
        this.go('credentials');
        break;
      case 'continue':
        void this.enter();
        break;
    }
  }

  private go(step: Step): void {
    this.notice.set(null);
    this.step.set(step);
  }

  private async run(credentials: LoginCredentials): Promise<void> {
    this.notice.set(null);
    this.submitting.set(true);
    try {
      const outcome: LoginOutcome = await this.session.login(credentials);
      if (outcome.kind === 'mfa_required') {
        this.step.set('mfa');
      } else if (this.step() === 'recovery') {
        // Un code de récupération vient d'être consommé : on le dit avant de poursuivre.
        this.remaining.set(outcome.recoveryCodesRemaining);
        if (outcome.recoveryCodesRemaining !== undefined) this.toast.show(this.i18n.t('recovery.remaining.title', { count: outcome.recoveryCodesRemaining }));
        this.password = '';
        this.step.set('verified');
        if (outcome.setupRequired) await this.router.navigateByUrl('/account/setup');
      } else {
        this.password = '';
        await this.enter(outcome.setupRequired);
      }
    } catch (e) {
      this.fail(toApiError(e));
    } finally {
      this.submitting.set(false);
    }
  }

  /** Ouvre l'espace de travail (ou l'assistant de finalisation d'un compte neuf). */
  private async enter(setupRequired = false): Promise<void> {
    await this.router.navigateByUrl(setupRequired ? '/account/setup' : safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
  }

  /** Choisit le message adapté à l'incident ; la saisie est conservée pour que l'utilisateur n'ait qu'à réessayer. */
  private fail(error: ApiError): void {
    const secondFactor = this.step() === 'mfa' || this.step() === 'recovery';
    if (error.isNetwork) this.notice.set({ kind: 'network' });
    else if (error.isRateLimited) this.suspend(error.retryAfterSeconds ?? 60);
    else if (error.isServerError || error.code === 'UNKNOWN') this.notice.set({ kind: 'unavailable' });
    else if (secondFactor && error.code === 'MFA_CODE_INVALID') {
      this.notice.set({ kind: 'code' });
      this.form().markInvalid(this.step() === 'recovery' ? 'recoveryCode' : 'code');
    } else if (error.code === 'INVALID_CREDENTIALS') this.notice.set({ kind: 'invalid', text: `${error.message} ${this.i18n.t('login.invalid.hint')}` });
    else this.notice.set({ kind: 'error', title: error.message });
  }

  private suspend(seconds: number): void {
    const wait = seconds >= 60 ? this.i18n.t('login.rate.minutes', { n: Math.ceil(seconds / 60) }) : this.i18n.t('login.rate.seconds', { n: seconds });
    this.notice.set({ kind: 'rate', wait });
    this.nowMs.set(this.clock.nowMs());
    this.lockUntilMs.set(this.nowMs() + seconds * 1000);
    this.lockTimer ??= setInterval(() => {
      this.nowMs.set(this.clock.nowMs());
      if (this.lockSeconds() === 0) {
        this.stopLockTimer();
        this.lockUntilMs.set(null);
        this.notice.set(null);
      }
    }, 1000);
  }

  private stopLockTimer(): void {
    if (this.lockTimer !== null) clearInterval(this.lockTimer);
    this.lockTimer = null;
  }
}
