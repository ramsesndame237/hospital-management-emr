import { TestBed } from '@angular/core/testing';
import fr from '../../i18n/catalogs/fr.json';
import en from '../../i18n/catalogs/en.json';
import { JsonTranslator } from './json-translator';
import { Translator } from './translator';

type Catalog = { readonly [key: string]: string | Catalog };
const keysOf = (node: Catalog, prefix = ''): string[] =>
  Object.entries(node).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keysOf(v, `${prefix}${k}.`)));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('JsonTranslator', () => {
  let t: Translator;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: Translator, useClass: JsonTranslator }] });
    t = TestBed.inject(Translator);
    t.setLocale('fr'); // jsdom annonce « en-US » : on part d'un état connu
  });

  it('démarre en français quand rien ne dit le contraire, et met à jour <html lang>', () => {
    t.setLocale('fr');
    expect(t.locale()).toBe('fr');
    expect(t.t('login.submit')).toBe('Se connecter');
    expect(document.documentElement.lang).toBe('fr');
  });

  it("change de langue, retient le choix et l'annonce au document", () => {
    t.setLocale('en');
    expect(t.t('login.submit')).toBe('Sign in');
    expect(localStorage.getItem('sanjeevani.locale')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('ignore une langue non supportée', () => {
    t.setLocale('fr');
    t.setLocale('de');
    expect(t.locale()).toBe('fr');
  });

  it('remplit les paramètres et laisse visible celui qui manque', () => {
    expect(t.t('home.welcome', { name: 'Marie' })).toBe('Bonjour, Marie');
    expect(t.t('home.welcome')).toBe('Bonjour, {name}');
  });

  it("renvoie la clé quand elle n'existe pas (on repère l'oubli sans casser l'écran)", () => {
    expect(t.t('une.cle.inconnue')).toBe('une.cle.inconnue');
    expect(t.t('login')).toBe('login'); // un nœud n'est pas un message
  });

  it('retombe sur le français si une clé manque dans la langue choisie', () => {
    t.setLocale('en');
    expect(t.t('app.name')).toBe('Sanjeevani EMR');
  });

  it('fonctionne même si le stockage du navigateur est indisponible', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => t.setLocale('en')).not.toThrow();
    expect(t.locale()).toBe('en');
    spy.mockRestore();
  });
});

describe('catalogues de traduction', () => {
  it('ont exactement les mêmes clés en français et en anglais', () => {
    expect(keysOf(en as Catalog).sort()).toEqual(keysOf(fr as Catalog).sort());
  });

  it('utilisent les mêmes paramètres {…} dans les deux langues', () => {
    const get = (c: Catalog, key: string): string => key.split('.').reduce<string | Catalog>((n, p) => (n as Catalog)[p], c) as string;
    for (const key of keysOf(fr as Catalog)) {
      expect({ key, p: placeholders(get(en as Catalog, key)) }).toEqual({ key, p: placeholders(get(fr as Catalog, key)) });
    }
  });
});
