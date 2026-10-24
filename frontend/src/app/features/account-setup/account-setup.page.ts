import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { SessionStore } from '../../core/auth/session.store';
import { ApiError, toApiError } from '../../core/http/api-error';
import { Translator } from '../../core/i18n/translator';
import { FormBuilderComponent } from '../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../shared/form-builder/form-schema';
import { StepProgress } from '../../shared/step-progress';
import { AuthCard } from '../auth/shared/auth-card';

type Step = 'password' | 'authentication';

/** Codes d'erreur de l'API qui concernent le NOUVEAU mot de passe (les autres sont affichés en haut du formulaire). */
const NEW_PASSWORD_ERRORS = ['PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG', 'PASSWORD_TOO_COMMON', 'PASSWORD_CONTAINS_IDENTITY', 'PASSWORD_BREACHED', 'PASSWORD_UNCHANGED'];

/**
 * Première connexion (session restreinte `setup`) : l'utilisateur remplace le mot de passe provisoire (étape 1 sur 3), puis
 * enregistre la double authentification (étape 2) et conserve ses codes de secours (étape 3). Le formulaire de l'étape 1 est
 * décrit en JSON : la politique de mot de passe (12 caractères, ni courant, ni dérivé de l'identité) y est une règle déclarée.
 */
@Component({
  selector: 'app-account-setup-page',
  imports: [AuthCard, FormBuilderComponent, StepProgress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [eyebrow]="i18n.t('auth.eyebrow')" [title]="i18n.t(step() === 'password' ? 'setup.title' : 'setup.authTitle')" [lead]="i18n.t(step() === 'password' ? 'setup.lead' : 'setup.authLead')" titleId="setup-title">
      <app-step-progress [current]="step() === 'password' ? 1 : 2" [total]="3" [nameKey]="step() === 'password' ? 'setup.steps.password' : 'setup.steps.authentication'" />
      @if (step() === 'password') {
        <app-form-builder #passwordForm [fields]="passwordFields()" [busy]="submitting()" formId="setup" (submitted)="onSubmit($event)" />
      } @else {
        <app-form-builder [fields]="authenticationFields" formId="setup-auth" (action)="signOut()" />
      }
    </app-auth-card>
  `,
})
export class AccountSetupPage {
  protected readonly i18n = inject(Translator);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly user = inject(SessionStore).user;

  protected readonly step = signal<Step>('password');
  protected readonly submitting = signal(false);
  private readonly banner = signal<string | null>(null);
  private readonly passwordForm = viewChild<FormBuilderComponent>('passwordForm');

  protected readonly passwordFields = computed<FieldSchema[]>(() => {
    const user = this.user();
    const banner = this.banner();
    return [
      ...(banner ? ([{ type: 'message', name: 'banner', tone: 'critical', title: banner }] as const) : []),
      {
        type: 'password',
        name: 'currentPassword',
        label: 'setup.currentPassword',
        autocomplete: 'current-password',
        autofocus: true,
        validators: [{ type: 'required' }, { type: 'maxLength', value: 1024 }],
      },
      {
        type: 'password',
        name: 'newPassword',
        label: 'setup.newPassword',
        autocomplete: 'new-password',
        validators: [
          { type: 'required' },
          { type: 'maxLength', value: 1024 },
          { type: 'passwordPolicy', value: 12, rules: ['notCommon', 'noIdentity'], identityValues: [user?.username ?? '', user?.email ?? ''] },
        ],
      },
      {
        type: 'password',
        name: 'confirmPassword',
        label: 'setup.confirmPassword',
        autocomplete: 'new-password',
        validators: [{ type: 'required' }, { type: 'equalsField', field: 'newPassword', message: 'setup.errors.mismatch' }],
      },
      { type: 'submit', name: 'submit', label: 'setup.continue', busyLabel: 'setup.saving' },
    ];
  });

  protected readonly authenticationFields: FieldSchema[] = [
    { type: 'message', name: 'soon', tone: 'info', title: 'setup.soonTitle', text: 'setup.soonText' },
    { type: 'button', name: 'signOut', label: 'common.signOut', variant: 'outline' },
  ];

  protected async onSubmit(value: Record<string, unknown>): Promise<void> {
    this.banner.set(null);
    this.submitting.set(true);
    try {
      const { setupRequired } = await this.session.changePassword(String(value['currentPassword']), String(value['newPassword']));
      if (setupRequired) this.step.set('authentication');
      else await this.router.navigateByUrl('/');
    } catch (e) {
      this.showError(toApiError(e));
    } finally {
      this.submitting.set(false);
    }
  }

  protected signOut(): void {
    void this.session.logout();
  }

  /** Une erreur qui vise un champ s'affiche sur ce champ ; sinon en haut du formulaire. */
  private showError(error: ApiError): void {
    const form = this.passwordForm();
    if (error.isNetwork) return this.banner.set(this.i18n.t('login.network.title'));
    if (error.code === 'CURRENT_PASSWORD_INVALID') return void form?.applyServerErrors([{ field: 'currentPassword', message: error.message }]);
    if (NEW_PASSWORD_ERRORS.includes(error.code)) return void form?.applyServerErrors([{ field: 'newPassword', message: error.message }]);
    const unmatched = error.fieldErrors.length ? (form?.applyServerErrors(error.fieldErrors) ?? []) : [{ field: '', message: error.message }];
    if (unmatched.length) this.banner.set(error.status >= 500 || error.code === 'UNKNOWN' ? this.i18n.t('login.errors.generic') : unmatched[0].message);
  }
}
