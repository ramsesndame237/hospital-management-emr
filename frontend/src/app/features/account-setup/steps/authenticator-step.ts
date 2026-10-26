import { ChangeDetectionStrategy, Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { MfaEnrollment } from '../../../core/auth/auth.models';
import { SessionService } from '../../../core/auth/session.service';
import { SessionStore } from '../../../core/auth/session.store';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { Translator } from '../../../core/i18n/translator';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { StepProgress } from '../../../shared/step-progress';

type Enrollment = { readonly state: 'loading' } | { readonly state: 'ready'; readonly value: MfaEnrollment } | { readonly state: 'failed'; readonly message: string };

/**
 * Étape 2 sur 3 : associer une application d'authentification (Google Authenticator, Microsoft Authenticator, Aegis…).
 * Le serveur génère un secret ; on l'affiche en QR code (calculé ici, rien ne part vers un service tiers) et en clé à recopier.
 * Un premier code valide prouve que l'association fonctionne : le serveur renvoie alors les codes de récupération.
 */
@Component({
  selector: 'app-authenticator-step',
  imports: [FormBuilderComponent, StepProgress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5' },
  template: `
    <app-step-progress [current]="2" [total]="3" nameKey="setup.steps.authenticator" />
    <app-form-builder #form [fields]="fields()" [busy]="submitting()" formId="authenticator" (submitted)="onSubmit($event)" (action)="onAction($event)" />
  `,
})
export class AuthenticatorStep {
  private readonly i18n = inject(Translator);
  private readonly session = inject(SessionService);
  private readonly user = inject(SessionStore).user;

  /** L'authentificateur est associé : le serveur renvoie les codes de récupération, à montrer une seule fois. */
  readonly done = output<readonly string[]>();

  protected readonly submitting = signal(false);
  private readonly enrollment = signal<Enrollment>({ state: 'loading' });
  private readonly notice = signal<{ readonly tone: 'warning' | 'critical'; readonly title: string; readonly text?: string } | null>(null);
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly fields = computed<FieldSchema[]>(() => {
    const enrollment = this.enrollment();
    if (enrollment.state === 'loading') return [{ type: 'message', name: 'loading', tone: 'info', title: 'authenticator.loading' }];
    if (enrollment.state === 'failed') {
      return [
        { type: 'message', name: 'failed', tone: 'critical', title: 'authenticator.failed', text: enrollment.message },
        { type: 'button', name: 'retry', label: 'login.retry', variant: 'primary' },
      ];
    }
    const notice = this.notice();
    return [
      {
        type: 'qr',
        name: 'qr',
        value: enrollment.value.keyUri,
        title: 'authenticator.scan.title',
        text: 'authenticator.scan.text',
        caption: 'authenticator.scan.account',
        params: { username: this.user()?.username ?? '' },
      },
      { type: 'secret', name: 'secret', label: 'authenticator.manual', value: enrollment.value.secret, copyLabel: 'common.copy', copiedLabel: 'common.copied' },
      { type: 'paragraph', name: 'confirm', text: 'authenticator.confirm', size: 'sm', strong: true },
      ...(notice ? ([{ type: 'message', name: 'notice', tone: notice.tone, title: notice.title, text: notice.text }] as const) : []),
      {
        type: 'otp',
        name: 'code',
        label: 'mfa.code',
        hint: 'mfa.hint',
        autofocus: true,
        validators: [
          { type: 'required', message: 'mfa.errors.codeRequired' },
          { type: 'pattern', value: '^\\d{6}$', message: 'mfa.errors.codeFormat' },
        ],
      },
      { type: 'submit', name: 'submit', label: 'authenticator.submit', busyLabel: 'mfa.verifying' },
      { type: 'disclosure', name: 'help', title: 'authenticator.help.title', text: 'authenticator.help.text', open: notice !== null },
    ];
  });

  constructor() {
    void this.enroll();
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'retry') void this.enroll();
  }

  protected async onSubmit(value: Record<string, unknown>): Promise<void> {
    this.notice.set(null);
    this.submitting.set(true);
    try {
      this.done.emit(await this.session.activateMfa(String(value['code'])));
    } catch (e) {
      this.showError(toApiError(e));
    } finally {
      this.submitting.set(false);
    }
  }

  private async enroll(): Promise<void> {
    this.enrollment.set({ state: 'loading' });
    try {
      this.enrollment.set({ state: 'ready', value: await this.session.enrollMfa() });
    } catch (e) {
      const error = toApiError(e);
      this.enrollment.set({ state: 'failed', message: error.isNetwork ? this.i18n.t('login.network.text') : error.isServerError || error.code === 'UNKNOWN' ? this.i18n.t('login.errors.generic') : error.message });
    }
  }

  /** Code refusé : l'heure du téléphone est la cause la plus fréquente, d'où l'aide dépliée. Les cases passent en rouge. */
  private showError(error: ApiError): void {
    if (error.code === 'MFA_CODE_INVALID') {
      this.notice.set({ tone: 'warning', title: 'mfa.invalid.title', text: 'mfa.invalid.text' });
      this.form()?.markInvalid('code');
    } else if (error.isNetwork) {
      this.notice.set({ tone: 'critical', title: 'login.network.title', text: 'login.network.text' });
    } else {
      this.notice.set({ tone: 'critical', title: error.isServerError || error.code === 'UNKNOWN' ? this.i18n.t('login.errors.generic') : error.message });
    }
  }
}
