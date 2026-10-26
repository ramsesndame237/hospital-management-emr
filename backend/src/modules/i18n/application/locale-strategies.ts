import { LocaleRequest, LocaleStrategy } from '../domain/locale-strategy';

/** Choix explicite : `?lang=en`. Prioritaire, utile pour tester ou partager un lien dans une langue donnée. */
export class QueryLocaleStrategy implements LocaleStrategy {
  constructor(private readonly param = 'lang') {}

  candidates(request: LocaleRequest): readonly string[] {
    const v = request.query(this.param);
    return v ? [v] : [];
  }
}

/** En-tête dédié (`X-Locale`), pour un client qui connaît la langue de son interface sans dépendre du navigateur. */
export class HeaderLocaleStrategy implements LocaleStrategy {
  constructor(private readonly header = 'x-locale') {}

  candidates(request: LocaleRequest): readonly string[] {
    const v = request.header(this.header);
    return v ? [v] : [];
  }
}

const MAX_HEADER_LENGTH = 500;
const MAX_ENTRIES = 20;

/**
 * `Accept-Language: fr-CM, fr;q=0.8, en;q=0.5, *;q=0.1` → `['fr-CM', 'fr', 'en']`.
 * Tri par poids décroissant (ordre d'origine à poids égal), `q=0` exclu (« surtout pas »), joker ignoré,
 * entrée malformée (poids hors de 0..1 ou illisible) ignorée, taille bornée contre les abus.
 */
export class AcceptLanguageStrategy implements LocaleStrategy {
  candidates(request: LocaleRequest): readonly string[] {
    const raw = request.header('accept-language');
    if (!raw || raw.length > MAX_HEADER_LENGTH) return [];
    return raw
      .split(',')
      .slice(0, MAX_ENTRIES)
      .map((part, index) => {
        const [tag, ...params] = part.trim().split(';');
        const weightParam = params.map((p) => p.trim()).find((p) => /^q\s*=/i.test(p));
        // RFC 9110 : q = 0 ou 1 avec 3 décimales au plus. Un poids présent mais illisible rend l'entrée invalide (NaN).
        const q = weightParam === undefined ? 1 : /^q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i.exec(weightParam)?.[1];
        return { tag: tag.trim(), weight: q === undefined ? Number.NaN : Number(q), index };
      })
      .filter((e) => e.tag !== '' && e.tag !== '*' && Number.isFinite(e.weight) && e.weight > 0)
      .sort((a, b) => b.weight - a.weight || a.index - b.index)
      .map((e) => e.tag);
  }
}
