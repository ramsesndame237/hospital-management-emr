import { Locale } from '../domain/locale';
import { LocaleSupport } from '../domain/ports';

/**
 * Langues proposées, avec la règle de rapprochement commune à tous les adaptateurs :
 * `fr-CM` → `fr-CM` si supportée, sinon `fr`, sinon rien.
 */
export class StaticLocaleSupport implements LocaleSupport {
  readonly supportedLocales: readonly Locale[];

  constructor(
    supported: readonly Locale[],
    readonly defaultLocale: Locale,
  ) {
    const all = new Map(supported.map((l) => [l.value, l]));
    all.set(defaultLocale.value, defaultLocale);
    this.supportedLocales = [...all.values()];
  }

  match(candidate: string): Locale | null {
    const parsed = Locale.create(candidate);
    if (!parsed.ok) return null;
    for (let l: Locale | null = parsed.value; l; l = l.parent) {
      const hit = this.supportedLocales.find((s) => s.equals(l));
      if (hit) return hit;
    }
    return null;
  }
}
