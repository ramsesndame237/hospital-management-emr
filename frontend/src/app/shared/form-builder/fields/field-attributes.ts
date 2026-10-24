import { Signal, computed, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Translator } from '../../../core/i18n/translator';
import { FieldContext } from '../field-context';
import { InputFieldSchema } from '../form-schema';

/** Attributs HTML communs à tous les éléments de saisie, calculés une fois (accessibilité, placeholder, longueur maximale). */
export function useFieldAttributes(field: Signal<InputFieldSchema>, control: Signal<FormControl>) {
  const ctx = inject(FieldContext);
  const i18n = inject(Translator);

  const id = computed(() => ctx.inputId(field().name));
  const placeholder = computed(() => (field().placeholder ? i18n.t(field().placeholder!) : null));
  const maxLength = computed(() => {
    const spec = (field().validators ?? []).find((v) => v.type === 'maxLength');
    return spec ? Number(spec.value) : null;
  });
  const required = computed(() => (field().validators ?? []).some((v) => v.type === 'required'));
  const invalid = computed(() => {
    ctx.version();
    return ctx.showError(control()) && control().invalid;
  });
  /** `aria-describedby` : relie la saisie à son aide et, si elle est affichée, à son erreur. */
  const describedBy = computed(() => {
    ctx.version();
    const ids = [field().hint ? `${id()}-hint` : null, invalid() ? `${id()}-error` : null].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  return { id, placeholder, maxLength, required, invalid, describedBy };
}
