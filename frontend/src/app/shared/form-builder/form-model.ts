import { signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Condition, FieldSchema, InputFieldSchema, Normalizer, isInputField } from './form-schema';
import { ValidatorRegistry } from './validator-registry';

const NORMALIZERS: Readonly<Record<Normalizer, (text: string) => string>> = {
  trim: (text) => text.trim(),
  lowercase: (text) => text.trim().toLowerCase(),
  uppercase: (text) => text.trim().toUpperCase(),
  digits: (text) => text.replace(/\D/g, ''),
};

/** Évalue une condition sur les valeurs courantes. Sans critère explicite, la condition est « le champ est renseigné ». */
export function evaluateCondition(condition: Condition | undefined, values: Readonly<Record<string, unknown>>): boolean {
  if (!condition) return true;
  const current = values[condition.field];
  if ('equals' in condition) return current === condition.equals;
  if ('notEquals' in condition) return current !== condition.notEquals;
  if (condition.in) return condition.in.includes(current);
  const filled = current !== undefined && current !== null && current !== '' && current !== false;
  return condition.truthy === false ? !filled : filled;
}

function defaultValue(field: InputFieldSchema): unknown {
  if (field.value !== undefined) return field.value;
  return field.type === 'checkbox' ? false : '';
}

/** Applique la normalisation déclarée par le champ (et convertit les nombres) à la valeur brute saisie. */
function finalValue(field: InputFieldSchema, raw: unknown): unknown {
  if (field.type === 'number') return raw === '' || raw === null ? null : Number(raw);
  if (typeof raw === 'string' && field.normalize) return NORMALIZERS[field.normalize](raw);
  return raw;
}

/**
 * État d'un formulaire décrit en JSON : construit et tient à jour le `FormGroup` Angular à partir du tableau de champs.
 * Quand le tableau change (message d'erreur ajouté, libellé de bouton modifié…), les contrôles existants sont CONSERVÉS avec
 * leur valeur : l'utilisateur ne perd jamais sa saisie parce que l'écran s'est redessiné.
 */
export class FormModel {
  /** Contrôles indexés par nom de champ (un contrôle Angular par champ de saisie). */
  readonly group: FormGroup = new FormGroup({});

  private readonly valuesState = signal<Readonly<Record<string, unknown>>>({});
  private readonly versionState = signal(0);
  private fields: readonly FieldSchema[] = [];
  private dependencySubscriptions = new Subscription();
  private readonly eventsSubscription: Subscription;

  /** Valeurs brutes courantes (tous les contrôles, y compris masqués) : sert aux conditions d'affichage. */
  readonly values = this.valuesState.asReadonly();
  /** Compteur incrémenté à chaque événement du formulaire (valeur, état, « touché »…) : les gabarits qui le lisent se redessinent. */
  readonly version = this.versionState.asReadonly();

  constructor(private readonly validators: ValidatorRegistry) {
    this.eventsSubscription = this.group.events.subscribe(() => {
      this.valuesState.set(this.group.getRawValue());
      this.versionState.update((v) => v + 1);
    });
  }

  destroy(): void {
    this.dependencySubscriptions.unsubscribe();
    this.eventsSubscription.unsubscribe();
  }

  /** Rapproche le `FormGroup` du nouveau tableau de champs : ajoute, retire, remet à jour les règles, conserve les valeurs. */
  update(fields: readonly FieldSchema[]): void {
    this.assertUniqueNames(fields);
    this.fields = fields;
    const inputs = fields.filter(isInputField);
    const names = new Set(inputs.map((f) => f.name));

    for (const existing of Object.keys(this.group.controls)) {
      if (!names.has(existing)) this.group.removeControl(existing, { emitEvent: false });
    }
    for (const field of inputs) {
      let control = this.group.controls[field.name];
      if (!control) {
        control = new FormControl(defaultValue(field), { nonNullable: true });
        this.group.addControl(field.name, control, { emitEvent: false });
      }
      control.setValidators(this.validators.build(field));
    }
    this.watchDependencies(inputs);
    this.applyConditions();
    for (const control of Object.values(this.group.controls)) control.updateValueAndValidity({ emitEvent: false });
    this.group.updateValueAndValidity({ emitEvent: true });
  }

  /** Valeur à envoyer : champs visibles et actifs seulement, normalisés. Comme un formulaire HTML, un champ désactivé n'est pas envoyé. */
  value(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of this.fields.filter(isInputField)) {
      const control = this.group.controls[field.name];
      if (control?.enabled) result[field.name] = finalValue(field, control.value);
    }
    return result;
  }

  patch(values: Readonly<Record<string, unknown>>): void {
    const known = Object.fromEntries(Object.entries(values).filter(([name]) => name in this.group.controls));
    this.group.patchValue(known);
  }

  /** Remet chaque champ à sa valeur initiale (ou à celle fournie) et efface l'état « touché ». */
  reset(values: Readonly<Record<string, unknown>> = {}): void {
    for (const field of this.fields.filter(isInputField)) {
      this.group.controls[field.name]?.reset(values[field.name] ?? defaultValue(field), { emitEvent: false });
    }
    this.applyConditions();
    this.group.updateValueAndValidity({ emitEvent: true });
  }

  /**
   * Affiche sur chaque champ l'erreur renvoyée par l'API (`errors: [{ field, message }]`). L'erreur disparaît dès que
   * l'utilisateur modifie le champ. Renvoie les erreurs qui ne correspondent à aucun champ, à afficher autrement.
   */
  applyServerErrors(errors: readonly { readonly field: string; readonly message: string }[]): { readonly field: string; readonly message: string }[] {
    const unmatched: { field: string; message: string }[] = [];
    for (const error of errors) {
      const control = this.group.controls[error.field.split('.').pop() ?? error.field];
      if (control) {
        control.setErrors({ ...control.errors, server: error.message });
        control.markAsTouched();
      } else {
        unmatched.push({ ...error });
      }
    }
    return unmatched;
  }

  markAllTouched(): void {
    this.group.markAllAsTouched();
  }

  /** Premier champ visible et invalide, dans l'ordre d'affichage (pour y placer le curseur après un envoi refusé). */
  firstInvalidName(): string | null {
    return this.fields.filter(isInputField).find((f) => this.group.controls[f.name]?.enabled && this.group.controls[f.name].invalid)?.name ?? null;
  }

  isVisible(field: FieldSchema, values = this.values()): boolean {
    return evaluateCondition(field.showIf, values);
  }

  private applyConditions(): void {
    const values = this.group.getRawValue();
    for (const field of this.fields.filter(isInputField)) {
      const control = this.group.controls[field.name];
      const enabled = evaluateCondition(field.showIf, values) && !field.disabled && (field.disabledIf ? !evaluateCondition(field.disabledIf, values) : true);
      if (enabled && control.disabled) control.enable({ emitEvent: false });
      if (!enabled && control.enabled) control.disable({ emitEvent: false });
    }
  }

  /** Une règle qui lit un autre champ (confirmation, identité) doit être recalculée quand celui-ci change. */
  private watchDependencies(inputs: readonly InputFieldSchema[]): void {
    this.dependencySubscriptions.unsubscribe();
    this.dependencySubscriptions = new Subscription();
    for (const field of inputs) {
      for (const dependency of this.validators.dependencies(field)) {
        const source = this.group.controls[dependency];
        const target = this.group.controls[field.name];
        if (source && target) this.dependencySubscriptions.add(source.valueChanges.subscribe(() => target.updateValueAndValidity({ onlySelf: true })));
      }
    }
    // Les conditions d'affichage dépendent de toutes les valeurs : on les réévalue à chaque changement.
    this.dependencySubscriptions.add(
      this.group.valueChanges.subscribe(() => {
        this.applyConditions();
      }),
    );
  }

  private assertUniqueNames(fields: readonly FieldSchema[]): void {
    const seen = new Set<string>();
    for (const field of fields) {
      if (seen.has(field.name)) throw new Error(`Formulaire invalide : le nom de champ « ${field.name} » est utilisé deux fois.`);
      seen.add(field.name);
    }
  }
}
