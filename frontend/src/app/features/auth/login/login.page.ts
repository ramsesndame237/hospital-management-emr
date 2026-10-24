import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginCredentials, LoginOutcome } from '../../../core/auth/auth.models';
import { SessionService } from '../../../core/auth/session.service';
import { ESTABLISHMENT } from '../../../core/config/establishment.config';
import { toApiError } from '../../../core/http/api-error';
import { Translator } from '../../../core/i18n/translator';
import { Clock } from '../../../core/time/clock';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { AuthCard } from '../shared/auth-card';
import { safeReturnUrl } from '../shared/return-url';
import { supportCode } from '../shared/support-code';
import { credentialsFields, secondFactorFields } from './login.form';

type Step = 'credentials' | 'mfa';

/** Ce que la page affiche au-dessus du formulaire après un échec ou une demande. */
type Notice =
  | { readonly kind: 'network' }
  | { readonly kind: 'error'; readonly title: string }
  | { readonly kind: 'info'; readonly title: string };

/** Connexion du personnel : identifiants, puis second facteur si le compte en a un. */
@Component({
  selector: 'app-login-page',
  imports: [AuthCard, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [eyebrow]="i18n.t('auth.eyebrow')" [title]="i18n.t(step() === 'credentials' ? 'login.title' : 'mfa.title')" [lead]="i18n.t(step() === 'credentials' ? 'login.lead' : 'mfa.lead')" titleId="login-title">
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
  private readonly establishment = inject(ESTABLISHMENT);

  protected readonly step = signal<Step>('credentials');
  protected readonly recovery = signal(false);
  protected readonly submitting = signal(false);
  protected readonly notice = signal<Notice | null>(null);

  private readonly form = viewChild.required<FormBuilderComponent>('form');
  private credentials: { username: string; password: string } | null = null;

  protected readonly fields = computed<FieldSchema[]>(() => {
    const notice = this.notice();
    if (this.step() === 'mfa') return [...this.noticeFields(notice), ...secondFactorFields(this.recovery())];
    const network = notice?.kind === 'network';
    return credentialsFields({
      submitLabel: network ? 'login.retry' : 'login.submit',
      notice: this.noticeFields(notice),
      footer: [
        { type: 'link', name: 'forgot', label: 'login.forgot' },
        ...(network
          ? ([
              { type: 'paragraph', name: 'supportCode', text: 'login.supportCode', params: { code: supportCode('N01', this.clock.now()) }, tone: 'muted', mono: true },
              { type: 'paragraph', name: 'help', text: 'login.help', params: { phone: this.establishment.supportPhone }, tone: 'muted' },
            ] as const)
          : []),
      ],
    });
  });

  private noticeFields(notice: Notice | null): FieldSchema[] {
    switch (notice?.kind) {
      case 'network':
        return [{ type: 'message', name: 'notice', tone: 'critical', title: 'login.network.title', text: 'login.network.text' }];
      case 'error':
        return [{ type: 'message', name: 'notice', tone: 'critical', title: notice.title }];
      case 'info':
        return [{ type: 'message', name: 'notice', tone: 'info', title: notice.title }];
      default:
        return [];
    }
  }

  protected onSubmit(value: Record<string, unknown>): void {
    if (this.step() === 'credentials') {
      this.credentials = { username: String(value['username']), password: String(value['password']) };
      void this.run({ ...this.credentials });
    } else if (this.credentials) {
      const code = String(value['code']);
      void this.run({ ...this.credentials, ...(this.recovery() ? { recoveryCode: code } : { totpCode: code }) });
    }
  }

  protected onAction(event: FormAction): void {
    switch (event.action) {
      case 'forgot':
        this.notice.set({ kind: 'info', title: this.i18n.t('login.forgotInfo') });
        break;
      case 'toggleRecovery':
        this.recovery.update((v) => !v);
        this.notice.set(null);
        this.form().reset();
        break;
      case 'back':
        this.credentials = null;
        this.recovery.set(false);
        this.notice.set(null);
        this.step.set('credentials');
        break;
    }
  }

  private async run(credentials: LoginCredentials): Promise<void> {
    this.notice.set(null);
    this.submitting.set(true);
    try {
      const outcome: LoginOutcome = await this.session.login(credentials);
      if (outcome.kind === 'mfa_required') {
        this.step.set('mfa');
        return;
      }
      this.credentials = null;
      await this.router.navigateByUrl(outcome.setupRequired ? '/account/setup' : safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    } catch (e) {
      const error = toApiError(e);
      if (error.isNetwork) this.notice.set({ kind: 'network' });
      else this.notice.set({ kind: 'error', title: error.status >= 500 || error.code === 'UNKNOWN' ? this.i18n.t('login.errors.generic') : error.message });
      if (this.step() === 'mfa') {
        this.form().reset();
        this.form().focus('code');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
