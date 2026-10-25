import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PasswordResetGateway } from '../../../core/auth/password-reset.gateway';
import { toApiError } from '../../../core/http/api-error';
import { Translator } from '../../../core/i18n/translator';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema } from '../../../shared/form-builder/form-schema';
import { AuthCard } from '../shared/auth-card';

type Outcome = 'idle' | 'sent' | 'unavailable' | 'failed';

/**
 * « Mot de passe oublié ? » (design AUTH-11). La réponse est la même que le compte existe ou non : l'écran ne permet jamais de
 * deviner quels identifiants sont valides.
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [AuthCard, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [eyebrow]="i18n.t('auth.eyebrow')" [title]="i18n.t('forgot.title')" [lead]="i18n.t('forgot.lead')" titleId="forgot-title">
      <app-form-builder [fields]="fields()" [busy]="submitting()" formId="forgot" (submitted)="onSubmit($event)" />
    </app-auth-card>
  `,
})
export class ForgotPasswordPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PasswordResetGateway);

  protected readonly submitting = signal(false);
  private readonly outcome = signal<Outcome>('idle');

  protected readonly fields = computed<FieldSchema[]>(() => {
    const outcome = this.outcome();
    return [
      {
        type: 'text',
        name: 'identifier',
        label: 'forgot.identifier',
        autocomplete: 'username',
        autofocus: true,
        normalize: 'trim',
        validators: [{ type: 'required', message: 'forgot.errors.required' }, { type: 'maxLength', value: 254 }],
      },
      ...this.messageFor(outcome),
      { type: 'submit', name: 'submit', label: 'forgot.submit', busyLabel: 'forgot.sending' },
      { type: 'link', name: 'back', label: 'forgot.back', routerLink: '/login' },
    ];
  });

  private messageFor(outcome: Outcome): FieldSchema[] {
    switch (outcome) {
      case 'sent':
      case 'idle':
        return [{ type: 'message', name: 'privacy', tone: outcome === 'sent' ? 'success' : 'info', title: outcome === 'sent' ? 'forgot.sent.title' : 'forgot.privacy.title', text: outcome === 'sent' ? 'forgot.sent.text' : 'forgot.privacy.text' }];
      case 'unavailable':
        return [{ type: 'message', name: 'privacy', tone: 'warning', title: 'forgot.unavailable.title', text: 'forgot.unavailable.text' }];
      default:
        return [{ type: 'message', name: 'privacy', tone: 'critical', title: 'forgot.failed.title', text: 'forgot.failed.text' }];
    }
  }

  protected async onSubmit(value: Record<string, unknown>): Promise<void> {
    this.submitting.set(true);
    try {
      await this.gateway.request(String(value['identifier']));
      this.outcome.set('sent');
    } catch (e) {
      this.outcome.set(toApiError(e).code === 'NOT_AVAILABLE' ? 'unavailable' : 'failed');
    } finally {
      this.submitting.set(false);
    }
  }
}
