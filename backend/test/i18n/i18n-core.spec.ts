import { ArgumentsHost, HttpException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { FallbackTranslator } from '../../src/modules/i18n/application/fallback-translator';
import { LocaleResolver } from '../../src/modules/i18n/application/locale-resolver';
import { AcceptLanguageStrategy, HeaderLocaleStrategy, QueryLocaleStrategy } from '../../src/modules/i18n/application/locale-strategies';
import { StaticLocaleSupport } from '../../src/modules/i18n/application/locale-support';
import { Localizer } from '../../src/modules/i18n/application/localizer';
import { Locale } from '../../src/modules/i18n/domain/locale';
import { LocaleContext, TranslationParams, Translator } from '../../src/modules/i18n/domain/ports';
import { formatMessage } from '../../src/modules/i18n/infrastructure/message-format';
import { AsyncLocalStorageLocaleContext } from '../../src/modules/i18n/infrastructure/async-local-storage-locale-context';
import { LocalizedExceptionFilter } from '../../src/modules/i18n/presentation/localized-exception.filter';

const L = (s: string) => Locale.of(s);

/** Traducteur de test : un dictionnaire par langue, sans aucune bibliothèque. */
class DictTranslator implements Translator {
  constructor(private readonly dict: Record<string, Record<string, string>>) {}
  translate(key: string, locale: Locale, params?: TranslationParams) {
    for (let l: Locale | null = locale; l; l = l.parent) {
      const m = this.dict[l.value]?.[key];
      if (m !== undefined) return formatMessage(m, params);
    }
    return null;
  }
  exists(key: string, locale: Locale) { return this.translate(key, locale) !== null; }
}

describe('Locale (value object)', () => {
  it('normalise la casse et le séparateur', () => {
    expect(Locale.of('FR').value).toBe('fr');
    expect(Locale.of('fr_cm').value).toBe('fr-CM');
    expect(Locale.of('zh-hant-tw').value).toBe('zh-Hant-TW');
  });

  it.each(['', 'f', '123', 'fr--CM', 'fr-', "fr'; DROP", 'x'.repeat(40), 'fr cm'])('refuse %p', (bad) => {
    expect(Locale.create(bad).ok).toBe(false);
  });

  it('connaît sa langue et sa locale parente', () => {
    expect(Locale.of('fr-CM').language).toBe('fr');
    expect(Locale.of('fr-CM').parent?.value).toBe('fr');
    expect(Locale.of('fr').parent).toBeNull();
    expect(Locale.of('zh-Hant-TW').parent?.parent?.value).toBe('zh');
  });

  it('est comparée par valeur', () => {
    expect(Locale.of('fr_FR').equals(Locale.of('fr-fr'))).toBe(true);
  });
});

describe('StaticLocaleSupport', () => {
  const support = new StaticLocaleSupport([L('fr'), L('en')], L('fr'));

  it.each([
    ['fr', 'fr'], ['en', 'en'], ['fr-CM', 'fr'], ['en-US', 'en'], ['FR-fr', 'fr'], ['en_GB', 'en'],
  ])('rapproche %s de %s', (asked, expected) => expect(support.match(asked)?.value).toBe(expected));

  it.each(['de', 'es-ES', '', '???', 'zh-Hant-TW'])('ne rapproche pas %p', (asked) => expect(support.match(asked)).toBeNull());

  it('privilégie une variante régionale quand elle est proposée', () => {
    const s = new StaticLocaleSupport([L('fr'), L('fr-CM')], L('fr'));
    expect(s.match('fr-CM')?.value).toBe('fr-CM');
    expect(s.match('fr-BE')?.value).toBe('fr');
  });

  it('inclut toujours la langue par défaut', () => {
    expect(new StaticLocaleSupport([L('en')], L('fr')).supportedLocales.map((l) => l.value).sort()).toEqual(['en', 'fr']);
  });
});

describe('stratégies de langue', () => {
  const req = (headers: Record<string, string> = {}, query: Record<string, string> = {}) => ({
    header: (n: string) => headers[n.toLowerCase()],
    query: (n: string) => query[n],
  });

  describe('Accept-Language', () => {
    const parse = (h: string | undefined) => new AcceptLanguageStrategy().candidates(req(h === undefined ? {} : { 'accept-language': h }));

    it('trie par poids décroissant, ordre d\'origine à poids égal', () => {
      expect(parse('fr-CM, fr;q=0.8, en;q=0.9, es;q=0.8')).toEqual(['fr-CM', 'en', 'fr', 'es']);
    });
    it('ignore le joker, q=0, les poids invalides et les entrées vides', () => {
      expect(parse('*;q=0.5, de;q=0, en;q=abc, fr;q=2, , it;q=0.4')).toEqual(['it']);
      expect(parse('*')).toEqual([]);
    });
    it('absent, vide ou démesuré → aucune candidate', () => {
      expect(parse(undefined)).toEqual([]);
      expect(parse('')).toEqual([]);
      expect(parse('fr,'.repeat(300))).toEqual([]);
    });
    it('borne le nombre d\'entrées lues', () => {
      expect(parse(Array.from({ length: 50 }, (_, i) => `l${i}x`).join(',')).length).toBeLessThanOrEqual(20);
    });
  });

  it('?lang= et X-Locale ne renvoient une candidate que s\'ils sont fournis', () => {
    expect(new QueryLocaleStrategy().candidates(req({}, { lang: 'en' }))).toEqual(['en']);
    expect(new QueryLocaleStrategy().candidates(req())).toEqual([]);
    expect(new HeaderLocaleStrategy().candidates(req({ 'x-locale': 'en' }))).toEqual(['en']);
  });
});

describe('LocaleResolver (chaîne de responsabilité)', () => {
  const support = new StaticLocaleSupport([L('fr'), L('en')], L('fr'));
  const resolver = new LocaleResolver([new QueryLocaleStrategy(), new HeaderLocaleStrategy(), new AcceptLanguageStrategy()], support);
  const resolve = (headers: Record<string, string> = {}, query: Record<string, string> = {}) =>
    resolver.resolve({ header: (n) => headers[n.toLowerCase()], query: (n) => query[n] }).value;

  it('respecte la priorité : ?lang= > X-Locale > Accept-Language > défaut', () => {
    expect(resolve({ 'accept-language': 'fr', 'x-locale': 'fr' }, { lang: 'en' })).toBe('en');
    expect(resolve({ 'accept-language': 'fr', 'x-locale': 'en' })).toBe('en');
    expect(resolve({ 'accept-language': 'en-US,en;q=0.9' })).toBe('en');
    expect(resolve()).toBe('fr');
  });

  it('saute une candidate non supportée pour essayer la suivante, puis retombe sur le défaut', () => {
    expect(resolve({ 'accept-language': 'de, es;q=0.9, en;q=0.5' })).toBe('en');
    expect(resolve({ 'accept-language': 'de, es' })).toBe('fr');
    expect(resolve({}, { lang: 'zz' })).toBe('fr');
  });

  it('ne se laisse pas tromper par une valeur malveillante', () => {
    expect(resolve({ 'x-locale': "en'; DROP TABLE users;--" })).toBe('fr');
    expect(resolve({}, { lang: '../../etc/passwd' })).toBe('fr');
  });
});

describe('FallbackTranslator (décorateur)', () => {
  const inner = new DictTranslator({ fr: { a: 'Bonjour {n}', onlyFr: 'seulement fr' }, en: { a: 'Hello {n}' } });
  const t = new FallbackTranslator(inner, L('fr'));

  it('sert la langue demandée quand elle a le message', () => {
    expect(t.translate('a', L('en'), { n: 'Eva' })).toBe('Hello Eva');
  });
  it('retombe sur la langue par défaut quand la clé manque dans la langue demandée', () => {
    expect(t.translate('onlyFr', L('en'))).toBe('seulement fr');
    expect(inner.translate('onlyFr', L('en'))).toBeNull(); // le repli vient bien du décorateur, pas de l'adaptateur
  });
  it('renvoie null si la clé n\'existe nulle part', () => {
    expect(t.translate('nope', L('en'))).toBeNull();
    expect(t.exists('nope', L('en'))).toBe(false);
    expect(t.exists('onlyFr', L('en'))).toBe(true);
  });
  it('ne consulte pas deux fois la langue par défaut', () => {
    const spy = jest.spyOn(inner, 'translate');
    t.translate('nope', L('fr'));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('Localizer (façade)', () => {
  const dict = new DictTranslator({
    fr: { 'errors.X': 'Erreur {n}', 'fields.name': 'nom' },
    en: { 'errors.X': 'Error {n}', 'fields.name': 'name' },
  });
  const ctx = new AsyncLocalStorageLocaleContext(L('fr'));
  const loc = new Localizer(new FallbackTranslator(dict, L('fr')), ctx);

  it('utilise la langue du contexte de la requête', () => {
    expect(loc.error('X', { n: 1 })).toBe('Erreur 1');
    expect(ctx.run(L('en'), () => loc.error('X', { n: 1 }))).toBe('Error 1');
  });
  it('isole les requêtes concurrentes (chacune garde sa langue)', async () => {
    const run = (lang: string, delay: number) =>
      ctx.run(L(lang), async () => {
        await new Promise((r) => setTimeout(r, delay));
        return loc.text('errors.X', { n: lang });
      });
    expect(await Promise.all([run('en', 20), run('fr', 5), run('en', 1)])).toEqual(['Error en', 'Erreur fr', 'Error en']);
  });
  it('ne tombe jamais en erreur : texte de repli, sinon la clé', () => {
    expect(loc.text('missing.key')).toBe('missing.key');
    expect(loc.text('missing.key', undefined, 'par défaut')).toBe('par défaut');
    expect(loc.hasError('X')).toBe(true);
    expect(loc.hasError('NOPE')).toBe(false);
  });
  it('traduit les noms de champs, sinon garde le nom technique', () => {
    expect(loc.field('name')).toBe('nom');
    expect(loc.field('unknownField')).toBe('unknownField');
  });
  it('revient à la langue hors requête quand aucun contexte n\'est ouvert', () => {
    expect(loc.locale.value).toBe('fr');
  });
});

describe('formatMessage', () => {
  it('remplace les paramètres et laisse visible celui qui manque', () => {
    expect(formatMessage('{a} et {b}', { a: 1 })).toBe('1 et {b}');
    expect(formatMessage('sans paramètre')).toBe('sans paramètre');
    expect(formatMessage('{a}', { a: false })).toBe('false');
  });
  it('n\'interprète pas le contenu des valeurs (pas d\'injection de gabarit)', () => {
    expect(formatMessage('{a}', { a: '{b}', b: 'piégé' })).toBe('{b}');
  });
});

describe('LocalizedExceptionFilter', () => {
  const dict = new DictTranslator({ fr: { 'errors.KNOWN': 'Connu {v}', 'errors.HTTP_500': 'Erreur interne.', 'errors.HTTP_404': 'Introuvable.' } });
  const localizer = new Localizer(new FallbackTranslator(dict, L('fr')), new AsyncLocalStorageLocaleContext(L('fr')));
  const reply = jest.fn();
  const filter = new LocalizedExceptionFilter({ httpAdapter: { reply } } as unknown as HttpAdapterHost, localizer);
  const host = { getType: () => 'http', switchToHttp: () => ({ getResponse: () => 'RES' }) } as unknown as ArgumentsHost;
  beforeEach(() => reply.mockClear());
  const lastBody = () => reply.mock.calls[0][1] as Record<string, unknown>;

  it('traduit un code connu avec ses paramètres et retire les paramètres du corps', () => {
    filter.catch(new HttpException({ statusCode: 422, code: 'KNOWN', message: 'texte de repli', params: { v: 7 } }, 422), host);
    expect(lastBody()).toEqual({ statusCode: 422, code: 'KNOWN', message: 'Connu 7' });
    expect(reply.mock.calls[0][2]).toBe(422);
  });
  it('déduit HTTP_<statut> quand il n\'y a pas de code', () => {
    filter.catch(new HttpException('Cannot GET /x', 404), host);
    expect(lastBody()).toMatchObject({ statusCode: 404, code: 'HTTP_404', message: 'Introuvable.' });
  });
  it('laisse tel quel un corps sans code ni entrée de catalogue (compatibilité des routes historiques)', () => {
    filter.catch(new HttpException({ statusCode: 418, message: 'théière' }, 418), host);
    expect(lastBody()).toEqual({ statusCode: 418, message: 'théière' });
  });
  it('ne divulgue jamais le message d\'une erreur inattendue', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    filter.catch(new Error('connexion à postgres://user:motdepasse@db échouée'), host);
    expect(reply.mock.calls[0][2]).toBe(500);
    expect(JSON.stringify(lastBody())).not.toMatch(/postgres|motdepasse/);
    expect(lastBody()).toMatchObject({ code: 'HTTP_500', message: 'Erreur interne.' });
  });
  it('refuse de traiter un contexte non HTTP', () => {
    expect(() => filter.catch(new Error('x'), { getType: () => 'rpc' } as unknown as ArgumentsHost)).toThrow('x');
  });
});

describe('contexte de langue : type', () => {
  it('respecte le port LocaleContext', () => {
    const c: LocaleContext = new AsyncLocalStorageLocaleContext(L('fr'));
    expect(c.current().value).toBe('fr');
  });
});
