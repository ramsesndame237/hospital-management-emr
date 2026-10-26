import { ChangeDetectionStrategy, Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import { SessionStore } from '../../../core/auth/session.store';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { Translator } from '../../../core/i18n/translator';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema } from '../../../shared/form-builder/form-schema';
import { StepProgress } from '../../../shared/step-progress';

/** Erreurs de l'API qui visent le NOUVEAU mot de passe (les autres s'affichent en haut du formulaire). */
const NEW_PASSWORD_ERRORS = ['PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG', 'PASSWORD_TOO_COMMON', 'PASSWORD_CONTAINS_IDENTITY', 'PASSWORD_UNCHANGED'];

/**
 * Étape 1 sur 3 : remplacer le mot de passe temporaire. La politique (12 caractères, ni courant, ni dérivé de l'identité) est une
 * règle déclarée en JSON. Un mot de passe présent dans une fuite connue (refus du serveur) met la jauge en alerte et bloque
 * l'envoi jusqu'à ce que l'utilisateur en choisisse un autre.
 */
@Component({
  selector: 'app-password-step',
  imports: [FormBuilderComponent, StepProgress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5' },
  template: `
    <app-step-progress [current]="1" [total]="3" nameKey="setup.steps.password" />
    <app-form-builder #form [fields]="fields()" [busy]="submitting()" formId="setup" (submitted)="onSubmit($event)" (valueChange)="onChange($event)" />
  `,
})
export class PasswordStep {
  private readonly i18n = inject(Translator);
  private readonly session = inject(SessionService);
  private readonly user = inject(SessionStore).user;

  /** Le mot de passe a été remplacé : la session reste restreinte tant que la double authentification n'est pas faite. */
  readonly done = output<void>();

  protected readonly submitting = signal(false);
  private readonly banner = signal<string | null>(null);
  /** Mot de passe refusé parce qu'il figure dans une fuite : le bouton reste inactif tant que le champ n'a pas changé. */
  private readonly breached = signal<string | null>(null);
  private readonly form = viewChild.required<FormBuilderComponent>('form');

  protected readonly fields = computed<FieldSchema[]>(() => {
    const user = this.user();
    const banner = this.banner();
    const breached = this.breached() !== null;
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
        compromised: breached,
        validators: [
          { type: 'required' },
          { type: 'maxLength', value: 1024 },
          { type: 'passwordPolicy', value: 12, rules: ['notCommon', 'noIdentity'], identityValues: [user?.username ?? '', user?.email ?? ''] },
        ],
      },
      ...(breached ? ([{ type: 'message', name: 'breached', tone: 'critical', title: 'setup.breached.title', text: 'setup.breached.text' }] as const) : []),
      {
        type: 'password',
        name: 'confirmPassword',
        label: 'setup.confirmPassword',
        autocomplete: 'new-password',
        validators: [{ type: 'required' }, { type: 'equalsField', field: 'newPassword', message: 'setup.errors.mismatch' }],
      },
      { type: 'submit', name: 'submit', label: 'setup.continue', busyLabel: 'setup.saving', disabled: breached },
    ];
  });

  protected async onSubmit(value: Record<string, unknown>): Promise<void> {
    this.banner.set(null);
    this.submitting.set(true);
    try {
      await this.session.changePassword(String(value['currentPassword']), String(value['newPassword']));
      this.done.emit();
    } catch (e) {
      this.showError(toApiError(e), String(value['newPassword']));
    } finally {
      this.submitting.set(false);
    }
  }

  /** Changer le mot de passe refusé lève le blocage ; seul un nouveau choix permet de réessayer. */
  protected onChange(value: Record<string, unknown>): void {
    const breached = this.breached();
    if (breached !== null && value['newPassword'] !== breached) this.breached.set(null);
  }

  /** Une erreur qui vise un champ s'affiche sur ce champ ; sinon en haut du formulaire. */
  private showError(error: ApiError, attempted: string): void {
    const form = this.form();
    if (error.isNetwork) return this.banner.set(this.i18n.t('login.network.title'));
    if (error.code === 'PASSWORD_BREACHED') return this.breached.set(attempted);
    if (error.code === 'CURRENT_PASSWORD_INVALID') return void form.applyServerErrors([{ field: 'currentPassword', message: error.message }]);
    if (NEW_PASSWORD_ERRORS.includes(error.code)) return void form.applyServerErrors([{ field: 'newPassword', message: error.message }]);
    const unmatched = error.fieldErrors.length ? form.applyServerErrors(error.fieldErrors) : [{ field: '', message: error.message }];
    if (unmatched.length) this.banner.set(error.isServerError || error.code === 'UNKNOWN' ? this.i18n.t('login.errors.generic') : unmatched[0].message);
  }
}
