import { Injectable } from '@angular/core';
import { ValidatorFn } from '@angular/forms';
import { InputFieldSchema, ValidatorSpec } from './form-schema';
import { identityValuesOf, unmetRules } from './password-policy';

/** Un type de règle : comment fabriquer le validateur, et de quels autres champs il dépend (pour le recalculer quand ils changent). */
export interface ValidatorDefinition {
  create(spec: ValidatorSpec, field: InputFieldSchema): ValidatorFn;
  dependsOn?(spec: ValidatorSpec): readonly string[];
}

const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

const asText = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));
const num = (spec: ValidatorSpec): number => Number(spec.value);

/** Chaque validateur renvoie une erreur nommée comme son type (`{ minLength: {…} }`) : c'est ce qui relie la règle à son message. */
const BUILT_IN: Readonly<Record<string, ValidatorDefinition>> = {
  required: {
    create: (_spec, field) => (control) => {
      const value = control.value as unknown;
      return (field.type === 'checkbox' ? value !== true : isEmpty(value)) ? { required: true } : null;
    },
  },
  minLength: {
    create: (spec) => (control) => {
      const text = asText(control.value);
      return isEmpty(control.value) || text.length >= num(spec) ? null : { minLength: { min: num(spec), actual: text.length } };
    },
  },
  maxLength: {
    create: (spec) => (control) => {
      const text = asText(control.value);
      return text.length <= num(spec) ? null : { maxLength: { max: num(spec), actual: text.length } };
    },
  },
  min: {
    create: (spec) => (control) => (isEmpty(control.value) || Number(control.value) >= num(spec) ? null : { min: { min: num(spec) } }),
  },
  max: {
    create: (spec) => (control) => (isEmpty(control.value) || Number(control.value) <= num(spec) ? null : { max: { max: num(spec) } }),
  },
  pattern: {
    create: (spec) => {
      const regex = new RegExp(String(spec.value), spec.flags);
      return (control) => (isEmpty(control.value) || regex.test(asText(control.value)) ? null : { pattern: true });
    },
  },
  email: {
    create: () => (control) => (isEmpty(control.value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asText(control.value).trim()) ? null : { email: true }),
  },
  equalsField: {
    create: (spec) => (control) => {
      if (isEmpty(control.value)) return null;
      const other = control.parent?.get(String(spec.field));
      return other && other.value === control.value ? null : { equalsField: { field: spec.field } };
    },
    dependsOn: (spec) => [String(spec.field)],
  },
  passwordPolicy: {
    create: (spec) => (control) => {
      const identityValues = identityValuesOf(spec, (name) => asText(control.parent?.get(name)?.value));
      const unmet = unmetRules(asText(control.value), spec, { identityValues });
      return unmet.length === 0 ? null : { passwordPolicy: { unmet } };
    },
    dependsOn: (spec) => [...(spec.identityFields ?? [])],
  },
};

/**
 * Catalogue des types de règles. Extensible sans toucher au constructeur : `registry.register('iban', {...})` rend
 * `{ "type": "iban" }` disponible dans tous les formulaires JSON de l'application (principe ouvert/fermé).
 */
@Injectable({ providedIn: 'root' })
export class ValidatorRegistry {
  private readonly definitions = new Map<string, ValidatorDefinition>(Object.entries(BUILT_IN));

  register(type: string, definition: ValidatorDefinition): void {
    this.definitions.set(type, definition);
  }

  /** Validateurs d'un champ, dans l'ordre déclaré. Un type inconnu est une erreur de programmation : on la signale tout de suite. */
  build(field: InputFieldSchema): ValidatorFn[] {
    return (field.validators ?? []).map((spec) => this.definition(spec, field).create(spec, field));
  }

  /** Champs dont dépend la validation de `field` (confirmation de mot de passe, identité à exclure…). */
  dependencies(field: InputFieldSchema): readonly string[] {
    return (field.validators ?? []).flatMap((spec) => this.definition(spec, field).dependsOn?.(spec) ?? []);
  }

  private definition(spec: ValidatorSpec, field: InputFieldSchema): ValidatorDefinition {
    const definition = this.definitions.get(spec.type);
    if (!definition) throw new Error(`Règle de validation inconnue « ${spec.type} » (champ « ${field.name} »). Enregistrez-la avec ValidatorRegistry.register().`);
    return definition;
  }
}
