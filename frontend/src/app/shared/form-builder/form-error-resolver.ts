import { Injectable, inject } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { Translator, TranslationParams } from '../../core/i18n/translator';
import { InputFieldSchema } from './form-schema';

/**
 * Phrase par défaut de chaque type de règle. Quand l'API dit la même chose (champ obligatoire, trop court, adresse invalide…),
 * on reprend SA phrase (`server.validation.*`, synchronisée depuis le backend) : le même contrôle s'énonce de la même façon
 * qu'il soit détecté dans le navigateur ou par le serveur. Les autres règles ont leur phrase dans `form.errors.*`.
 */
const DEFAULT_KEYS: Readonly<Record<string, string>> = {
  required: 'server.validation.isNotEmpty',
  minLength: 'server.validation.minLength',
  maxLength: 'server.validation.maxLength',
  email: 'server.validation.isEmail',
  pattern: 'server.validation.matches',
};

@Injectable({ providedIn: 'root' })
export class FormErrorResolver {
  private readonly i18n = inject(Translator);

  /** Premier message d'erreur du contrôle, dans l'ordre où les règles sont déclarées ; `null` s'il est valide. */
  message(field: InputFieldSchema, control: AbstractControl): string | null {
    const errors = control.errors;
    if (!errors) return null;

    const server = errors['server'] as unknown;
    if (typeof server === 'string') return server; // message de l'API, déjà dans la langue de l'interface

    const spec = (field.validators ?? []).find((v) => v.type in errors);
    const type = spec?.type ?? Object.keys(errors)[0];
    const params = this.params(field, errors[type]);
    const key = spec?.message ?? DEFAULT_KEYS[type] ?? `form.errors.${type}`;
    const text = this.i18n.has(key) ? this.i18n.t(key, params) : this.i18n.t('server.validation.generic', params);
    return text;
  }

  /** Nom du champ tel que le dit l'API (`server.fields.<nom>`), sinon son libellé. */
  fieldName(field: InputFieldSchema): string {
    const shared = `server.fields.${field.name}`;
    return this.i18n.has(shared) ? this.i18n.t(shared) : this.i18n.t(field.label ?? field.name);
  }

  private params(field: InputFieldSchema, detail: unknown): TranslationParams {
    const extra = detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : {};
    const numeric = Object.fromEntries(Object.entries(extra).filter(([, v]) => typeof v === 'number' || typeof v === 'string')) as TranslationParams;
    return { ...numeric, field: this.fieldName(field) };
  }
}
