import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, forwardRef, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { hlm } from '@spartan-ng/helm/utils';
import { FieldContext } from './field-context';
import { FieldRegistry } from './field-registry';
import { fieldWrapperClass } from './field-styles';
import { FormErrorResolver } from './form-error-resolver';
import { FormModel } from './form-model';
import { FieldSchema, FormAction, FormLayout, InputFieldSchema, isInputField } from './form-schema';
import { ValidatorRegistry } from './validator-registry';

let nextFormId = 0;

/**
 * Constructeur de formulaires piloté par JSON : `<app-form-builder [fields]="[…]" (submitted)="…" />`.
 *
 * Tous les champs de l'application passent par ici et par `field-styles.ts` : un champ se redessine partout d'un seul coup.
 * Le formulaire gère la validation (règles déclarées en JSON), les messages d'erreur dans la langue courante, l'affichage
 * conditionnel, l'accessibilité (étiquettes, `aria-*`, focus sur la première erreur) et les erreurs renvoyées par l'API.
 */
@Component({
  selector: 'app-form-builder',
  imports: [NgComponentOutlet, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: FieldContext, useExisting: forwardRef(() => FormBuilderComponent) }],
  template: `
    <form [formGroup]="model.group" [attr.id]="formId()" (ngSubmit)="submit()" novalidate [class]="formClass()" [attr.aria-busy]="busy() || null">
      @for (item of items(); track item.field.name) {
        <div [class]="item.wrapperClass">
          <ng-container *ngComponentOutlet="item.component; inputs: item.inputs" />
        </div>
      }
    </form>
  `,
})
export class FormBuilderComponent implements FieldContext {
  private readonly registry = inject(FieldRegistry);
  private readonly resolver = inject(FormErrorResolver);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Les champs, décrits en JSON. Remplacer le tableau (message d'erreur, libellé…) conserve les valeurs saisies. */
  readonly fields = input.required<readonly FieldSchema[]>();
  readonly layout = input<FormLayout>({});
  /** Valeurs à appliquer (chargement d'une fiche) : seuls les champs connus sont renseignés. */
  readonly data = input<Readonly<Record<string, unknown>> | null>(null);
  /** Envoi en cours : le bouton d'envoi est inactif et affiche son libellé d'attente. */
  readonly busy = input(false);
  /** Préfixe des identifiants DOM ; à fournir si deux formulaires identiques coexistent. */
  readonly formId = input(`form${nextFormId++}`);

  /** Émis quand le formulaire est valide et envoyé, avec les valeurs normalisées. */
  readonly submitted = output<Record<string, unknown>>();
  /** Émis quand l'envoi est refusé parce qu'un champ est invalide. */
  readonly invalidSubmit = output<void>();
  /** Émis par un bouton ou un lien (`action`), avec les valeurs courantes. */
  readonly action = output<FormAction>();
  /** Émis à chaque modification, avec les valeurs courantes (sauvegarde de brouillon, aperçu…). */
  readonly valueChange = output<Record<string, unknown>>();

  readonly model = new FormModel(inject(ValidatorRegistry));
  private readonly ready = signal(false);
  private readonly attemptedState = signal(false);

  // Implémentation de FieldContext
  readonly attempted = this.attemptedState.asReadonly();
  readonly version = this.model.version;
  readonly values = this.model.values;

  protected readonly formClass = computed(() => hlm('grid grid-cols-12 gap-x-4', this.layout().gap ?? 'gap-y-5', this.layout().class));

  /** Noms des éléments affichés : une chaîne, pour ne recalculer la liste que si l'affichage change vraiment. */
  private readonly visibleNames = computed(() => {
    if (!this.ready()) return '';
    const values = this.model.values();
    return this.fields()
      .filter((f) => this.model.isVisible(f, values))
      .map((f) => f.name)
      .join('\u0000');
  });

  protected readonly items = computed(() => {
    const visible = new Set(this.visibleNames().split('\u0000'));
    return this.fields()
      .filter((field) => visible.has(field.name))
      .map((field) => ({
        field,
        component: this.registry.componentFor(field.type),
        wrapperClass: fieldWrapperClass(field.span, field.class),
        inputs: isInputField(field) ? { field, control: this.model.group.controls[field.name] } : { field },
      }));
  });

  /** Champ qui reçoit le curseur à l'affichage (`autofocus`). Le curseur ne se déplace que si ce choix change. */
  private readonly autofocusName = computed(() => this.fields().find((f) => isInputField(f) && f.autofocus)?.name ?? null);
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      const name = this.autofocusName();
      if (name && this.ready()) afterNextRender(() => this.focus(name), { injector: this.injector });
    });
    effect(() => {
      const fields = this.fields();
      untracked(() => {
        this.model.update(fields);
        this.ready.set(true);
      });
    });
    effect(() => {
      const data = this.data();
      if (data) untracked(() => this.model.patch(data));
    });
    this.model.group.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.valueChange.emit(this.model.value()));
    inject(DestroyRef).onDestroy(() => this.model.destroy());
  }

  // ---- API publique -------------------------------------------------------------------------------------------------

  /** Valeurs courantes, normalisées (même contenu que l'événement `submitted`). */
  value(): Record<string, unknown> {
    return this.model.value();
  }

  /** Efface la saisie (ou la remplace par `values`) et masque les erreurs. */
  reset(values?: Readonly<Record<string, unknown>>): void {
    this.attemptedState.set(false);
    this.model.reset(values);
  }

  /** Place le curseur dans un champ (après un refus du serveur, un changement d'étape…). */
  focus(name: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(`[id="${this.inputId(name)}"]`)?.focus();
  }

  /** Affiche sur les champs les erreurs d'une réponse `VALIDATION_FAILED` de l'API ; renvoie celles qu'aucun champ ne porte. */
  applyServerErrors(errors: readonly { readonly field: string; readonly message: string }[]): { readonly field: string; readonly message: string }[] {
    return this.model.applyServerErrors(errors);
  }

  submit(): void {
    this.attemptedState.set(true);
    this.model.markAllTouched();
    if (this.model.group.invalid) {
      this.invalidSubmit.emit();
      const first = this.model.firstInvalidName();
      if (first) this.focus(first);
      return;
    }
    if (this.busy()) return;
    this.submitted.emit(this.model.value());
  }

  // ---- FieldContext -------------------------------------------------------------------------------------------------

  inputId(name: string): string {
    return `${this.formId()}-${name}`;
  }

  showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.attemptedState());
  }

  errorMessage(field: InputFieldSchema, control: AbstractControl): string | null {
    return this.resolver.message(field, control);
  }

  dispatch(action: string): void {
    this.action.emit({ action, value: this.model.value() });
  }
}
