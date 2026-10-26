import { Locale } from '../domain/locale';
import { LocaleRequest, LocaleStrategy } from '../domain/locale-strategy';
import { LocaleSupport } from '../domain/ports';

/**
 * Chaîne de responsabilité : les stratégies sont essayées dans l'ordre, la première langue candidate réellement
 * supportée l'emporte ; à défaut, la langue par défaut. Ne renvoie donc jamais « rien » : toute requête a une langue.
 */
export class LocaleResolver {
  constructor(
    private readonly strategies: readonly LocaleStrategy[],
    private readonly support: LocaleSupport,
  ) {}

  resolve(request: LocaleRequest): Locale {
    for (const strategy of this.strategies) {
      for (const candidate of strategy.candidates(request)) {
        const match = this.support.match(candidate);
        if (match) return match;
      }
    }
    return this.support.defaultLocale;
  }
}
