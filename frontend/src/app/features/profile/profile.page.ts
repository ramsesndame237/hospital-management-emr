import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { SessionStore } from '../../core/auth/session.store';
import { ESTABLISHMENT } from '../../core/config/establishment.config';
import { Translator } from '../../core/i18n/translator';
import { FormBuilderComponent } from '../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../shared/form-builder/form-schema';
import { PanelCard } from '../../shared/panel-card';

/** Boutons du bas de page : le bouton d'envoi appartient au formulaire d'identité (attribut `form`) mais s'affiche sous les deux colonnes. */
const ACTIONS: FieldSchema[] = [
  { type: 'submit', name: 'save', label: 'profile.save', form: 'profile', span: 6 },
  { type: 'button', name: 'cancel', label: 'profile.cancel', variant: 'outline', span: 6 },
];

/** « Mon profil » (design SHELL-08) : identité professionnelle modifiable, photo et signature, exercice et habilitations. */
@Component({
  selector: 'app-profile-page',
  imports: [PanelCard, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('profile.title') }}</h1>
        <p class="text-xs leading-6 font-semibold text-primary">{{ roleLabel() }}</p>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('profile.subtitle') }}</p>
      </header>

      <div class="grid items-start gap-6 lg:grid-cols-2">
        <div class="flex flex-col gap-6">
          <app-panel-card [heading]="i18n.t('profile.identity')">
            <app-form-builder #identity [fields]="identityFields()" [data]="initialValues()" formId="profile" (submitted)="onSaved()" />
          </app-panel-card>

          <app-panel-card [heading]="i18n.t('profile.photoSignature')">
            <div class="flex flex-col gap-4 text-sm leading-6">
              <div>
                <p>{{ i18n.t('profile.photo') }}</p>
                <p>{{ i18n.t('profile.photoHint') }}</p>
              </div>
              <div>
                <p>{{ i18n.t('profile.signature') }}</p>
                <p>{{ i18n.t('profile.signatureHint') }}</p>
              </div>
              <p class="text-xs leading-5 text-muted-foreground">{{ i18n.t('profile.signatureLogged') }}</p>
            </div>
          </app-panel-card>
        </div>

        <app-panel-card [heading]="i18n.t('profile.practice')">
          <ul class="flex flex-col gap-3 text-sm leading-6">
            <li>{{ roleLabel() }}</li>
            <li>{{ i18n.t('profile.establishment', { name: establishment.name }) }}</li>
          </ul>
        </app-panel-card>
      </div>

      <app-form-builder [fields]="actions" formId="profile-actions" [layout]="{ gap: 'gap-y-3' }" (action)="onAction($event)" />
    </div>
  `,
})
export class ProfilePage {
  protected readonly i18n = inject(Translator);
  protected readonly establishment = inject(ESTABLISHMENT);
  private readonly user = inject(SessionStore).user;
  private readonly identity = viewChild.required<FormBuilderComponent>('identity');

  protected readonly actions = ACTIONS;
  private readonly saved = signal(false);

  protected readonly roleLabel = computed(() => {
    const role = this.user()?.roles[0];
    return role ? this.i18n.t(`roles.${role}`) : '';
  });

  /** Seul l'e-mail existe dans la session : le nom complet et le téléphone seront fournis par l'API du profil. */
  protected readonly initialValues = computed(() => ({ email: this.user()?.email ?? '' }));

  protected readonly identityFields = computed<FieldSchema[]>(() => [
    ...(this.saved() ? ([{ type: 'message', name: 'notice', tone: 'info', title: 'profile.notSavedTitle', text: 'profile.notSavedText' }] as const) : []),
    {
      type: 'text',
      name: 'fullName',
      label: 'profile.fullName',
      appearance: 'boxed',
      autocomplete: 'name',
      normalize: 'trim',
      validators: [{ type: 'required' }, { type: 'maxLength', value: 120 }],
    },
    {
      type: 'email',
      name: 'email',
      label: 'profile.email',
      appearance: 'boxed',
      autocomplete: 'email',
      normalize: 'lowercase',
      validators: [{ type: 'required' }, { type: 'email' }, { type: 'maxLength', value: 254 }],
    },
    {
      type: 'tel',
      name: 'phone',
      label: 'profile.phone',
      appearance: 'boxed',
      autocomplete: 'tel',
      normalize: 'trim',
      validators: [{ type: 'pattern', value: '^\\+?[0-9 ]{6,20}$', message: 'profile.errors.phone' }],
    },
  ]);

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') {
      this.saved.set(false);
      this.identity().reset(this.initialValues());
    }
  }

  /**
   * L'API n'expose pas encore la mise à jour du profil : on valide la saisie puis on l'annonce clairement, au lieu de
   * laisser croire à un enregistrement qui n'a pas eu lieu.
   */
  protected onSaved(): void {
    this.saved.set(true);
  }
}
