import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ValueObject } from '../../../../shared-kernel/value-object';

const LOCALE = /^[a-z]{2,3}(-[A-Z]{2})?$/;
const MAX_LOCALES = 10;
const MAX_TEXT = 200;

const INVALID = (reason: string) => new DomainError('REFERENTIAL_LABELS_INVALID', `Libellés invalides : ${reason}`, { reason });

/**
 * Libellé d'une entrée dans plusieurs langues (`{ fr: 'Pédiatrie', en: 'Paediatrics' }`). Au moins une langue ; chaque texte
 * est non vide (200 caractères au plus). Les langues réellement acceptées par l'installation ne sont pas connues du domaine :
 * l'interface choisit le texte de la langue demandée, sinon de la langue par défaut, sinon du premier disponible.
 */
export class LocalizedLabels extends ValueObject<Readonly<Record<string, string>>> {
  static create(raw: Record<string, unknown> | null | undefined): Result<LocalizedLabels> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return err(INVALID('un objet { langue: texte } est attendu'));
    const entries = Object.entries(raw);
    if (entries.length === 0) return err(INVALID('au moins une langue est requise'));
    if (entries.length > MAX_LOCALES) return err(INVALID(`au plus ${MAX_LOCALES} langues`));
    const labels: Record<string, string> = {};
    for (const [locale, text] of entries.sort(([a], [b]) => a.localeCompare(b))) {
      if (!LOCALE.test(locale)) return err(INVALID(`langue « ${locale} » invalide`));
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (trimmed.length === 0) return err(INVALID(`le texte « ${locale} » est vide`));
      if (trimmed.length > MAX_TEXT) return err(INVALID(`le texte « ${locale} » dépasse ${MAX_TEXT} caractères`));
      labels[locale] = trimmed;
    }
    return ok(new LocalizedLabels(Object.freeze(labels)));
  }

  toRecord(): Record<string, string> {
    return { ...this.value };
  }

  /** Texte dans la langue demandée, à défaut dans `fallback`, à défaut le premier disponible. */
  in(locale: string, fallback?: string): string {
    return this.value[locale] ?? (fallback ? this.value[fallback] : undefined) ?? Object.values(this.value)[0];
  }

  equals(other: ValueObject<Readonly<Record<string, string>>> | null | undefined): boolean {
    return !!other && other instanceof LocalizedLabels && JSON.stringify(other.value) === JSON.stringify(this.value);
  }
}
