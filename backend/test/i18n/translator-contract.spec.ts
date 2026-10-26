import fs from 'node:fs';
import path from 'node:path';
import { Test } from '@nestjs/testing';
import { Locale } from '../../src/modules/i18n/domain/locale';
import { TRANSLATOR, Translator } from '../../src/modules/i18n/domain/ports';
import { RAW_TRANSLATOR } from '../../src/modules/i18n/infrastructure/adapter-wiring';
import { DEFAULT_CATALOGS_DIR, I18nAdapterName, LocalizationModule } from '../../src/modules/i18n/localization.module';

const L = (s: string) => Locale.of(s);

async function build(adapter: I18nAdapterName): Promise<{ raw: Translator; decorated: Translator; close(): Promise<void> }> {
  const mod = await Test.createTestingModule({
    imports: [LocalizationModule.register({ adapter, locales: ['fr', 'en'], defaultLocale: 'fr' })],
  }).compile();
  await mod.init();
  return { raw: mod.get<Translator>(RAW_TRANSLATOR), decorated: mod.get<Translator>(TRANSLATOR), close: () => mod.close() };
}

/** Toutes les clés (`errors.X`, `validation.minLength`…) d'une langue, à partir des fichiers JSON. */
function keysOf(locale: string): string[] {
  const dir = path.join(DEFAULT_CATALOGS_DIR, locale);
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => {
    const ns = f.slice(0, -5);
    const walk = (node: unknown, prefix: string): string[] =>
      typeof node === 'string' ? [prefix] : Object.entries(node as object).flatMap(([k, v]) => walk(v, `${prefix}.${k}`));
    return walk(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), ns);
  });
}

describe.each<I18nAdapterName>(['json', 'nestjs-i18n'])('contrat du port Translator — adaptateur « %s »', (adapter) => {
  let raw: Translator;
  let decorated: Translator;
  let close: () => Promise<void>;
  beforeAll(async () => { ({ raw, decorated, close } = await build(adapter)); });
  afterAll(() => close());

  it('traduit dans chaque langue avec des paramètres', () => {
    expect(raw.translate('errors.PASSWORD_TOO_SHORT', L('fr'), { min: 12 })).toBe('Le mot de passe doit contenir au moins 12 caractères.');
    expect(raw.translate('errors.PASSWORD_TOO_SHORT', L('en'), { min: 12 })).toBe('The password must be at least 12 characters long.');
  });

  it("rapproche une variante régionale de sa langue (fr-CM → fr)", () => {
    expect(raw.translate('errors.USER_NOT_FOUND', L('fr-CM'))).toBe('Utilisateur introuvable.');
    expect(raw.translate('errors.USER_NOT_FOUND', L('en-GB'))).toBe('User not found.');
  });

  it('renvoie null (jamais la clé, jamais une exception) quand le message n\'existe pas', () => {
    expect(raw.translate('errors.CODE_INEXISTANT', L('fr'))).toBeNull();
    expect(raw.translate('rien.du.tout', L('en'))).toBeNull();
    expect(raw.translate('errors', L('fr'))).toBeNull(); // un espace de noms n'est pas un message
    expect(raw.exists('errors.CODE_INEXISTANT', L('fr'))).toBe(false);
    expect(raw.exists('errors.USER_NOT_FOUND', L('fr'))).toBe(true);
  });

  it("n'applique PAS de repli vers la langue par défaut (c'est le rôle du décorateur)", () => {
    expect(raw.translate('errors.USER_NOT_FOUND', L('de'))).toBeNull();
    expect(decorated.translate('errors.USER_NOT_FOUND', L('de'))).toBe('Utilisateur introuvable.');
  });

  it('laisse visible un paramètre manquant plutôt que d\'écrire « undefined »', () => {
    expect(raw.translate('errors.PASSWORD_TOO_SHORT', L('fr'))).toContain('{min}');
  });

  it("n'interprète pas les valeurs de paramètres comme des gabarits", () => {
    const r = raw.translate('errors.PERMISSION_INVALID', L('en'), { value: '{value} <script>' });
    expect(r).toBe('Invalid permission: "{value} <script>".');
  });
});

describe('équivalence des adaptateurs', () => {
  it('produisent exactement le même texte pour chaque clé, chaque langue et chaque paramètre', async () => {
    const [a, b] = await Promise.all([build('json'), build('nestjs-i18n')]);
    try {
      const params = { min: 12, max: 128, value: 'x:y', field: 'username' };
      let compared = 0;
      for (const locale of ['fr', 'en', 'fr-CM', 'en-US', 'de']) {
        for (const key of new Set([...keysOf('fr'), ...keysOf('en'), 'inconnu.cle'])) {
          expect(b.raw.translate(key, L(locale), params)).toBe(a.raw.translate(key, L(locale), params));
          expect(b.decorated.translate(key, L(locale), params)).toBe(a.decorated.translate(key, L(locale), params));
          compared++;
        }
      }
      expect(compared).toBeGreaterThan(200);
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });
});
