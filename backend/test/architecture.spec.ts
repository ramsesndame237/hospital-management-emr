import fs from 'node:fs';
import path from 'node:path';

/**
 * Tests d'architecture : ils font respecter mécaniquement la règle de dépendance de la Clean Architecture et le
 * confinement de chaque bibliothèque à son adaptateur. Sans eux, ces règles ne vivraient que dans les discussions
 * et finiraient par être contournées « juste cette fois ».
 */
const SRC = path.join(__dirname, '../src');

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sources(p) : e.name.endsWith('.ts') ? [p] : [];
  });
}

interface Import { file: string; spec: string }
const imports: Import[] = sources(SRC).flatMap((abs) => {
  const file = path.relative(SRC, abs).split(path.sep).join('/');
  const text = fs.readFileSync(abs, 'utf8');
  return [...text.matchAll(/(?:from|import\()\s*'([^']+)'/g)].map((m) => ({ file, spec: m[1] }));
});

/** Résout un import relatif en chemin depuis `src/` ; renvoie `null` pour un paquet externe. */
function resolve(imp: Import): string | null {
  if (!imp.spec.startsWith('.')) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(imp.file), imp.spec));
}

const violations = (rule: (i: Import) => boolean) => imports.filter(rule).map((i) => `${i.file} → ${i.spec}`);
const inDir = (file: string, ...dirs: string[]) => dirs.some((d) => file.startsWith(d));

/** Couches « pures » : métier et cas d'usage. */
const isCore = (file: string) => /(^|\/)(domain|application)\//.test(file) || file.startsWith('shared-kernel/');

describe('architecture : règle de dépendance', () => {
  it('le domaine et les cas d\'usage n\'importent aucun framework ni aucune bibliothèque d\'infrastructure', () => {
    const forbidden = /^(@nestjs\/|typeorm|pg$|ioredis|argon2|otplib|@aws-sdk|express|class-validator|class-transformer|helmet|cookie-parser|rxjs|reflect-metadata)/;
    // Exceptions assumées : le point d'entrée unique de Temporal (natif ou polyfill) et la bibliothèque standard de Node.
    const allowed = (i: Import) => i.file === 'shared-kernel/temporal.ts' || i.spec.startsWith('node:');
    expect(violations((i) => isCore(i.file) && forbidden.test(i.spec) && !allowed(i))).toEqual([]);
  });

  it('le domaine et les cas d\'usage ne dépendent jamais de l\'infrastructure ni de la présentation', () => {
    expect(
      violations((i) => {
        const target = resolve(i);
        return isCore(i.file) && target !== null && /(^|\/)(infrastructure|presentation)(\/|$)/.test(target);
      }),
    ).toEqual([]);
  });

  it('le domaine ne dépend pas de la couche application', () => {
    expect(violations((i) => /(^|\/)domain\//.test(i.file) && /(^|\/)application\//.test(resolve(i) ?? ''))).toEqual([]);
  });
});

describe('architecture : indépendance des modules', () => {
  /** Qui peut dépendre de qui. Tout le reste est interdit : les modules ne se connaissent pas, la racine de composition les relie. */
  const ALLOWED: Record<string, string[]> = { iam: ['audit', 'cache', 'api-docs'], administration: ['audit', 'api-docs', 'iam'], referentials: ['audit', 'api-docs', 'iam'], staff: ['audit', 'api-docs', 'iam'], patients: ['audit', 'api-docs', 'iam'], i18n: [], 'api-docs': [], audit: ['api-docs', 'iam'], cache: [] };

  it("chaque module ne dépend que des modules qu'il déclare (iam → audit, cache, façade api-docs ; administration → audit, api-docs, décorateurs iam ; les autres : aucun)", () => {
    const bad = violations((i) => {
      const target = resolve(i);
      const own = /^modules\/([^/]+)\//.exec(i.file)?.[1];
      const other = target ? /^modules\/([^/]+)\//.exec(target)?.[1] : undefined;
      return !!own && !!other && own !== other && !(ALLOWED[own] ?? []).includes(other);
    });
    expect(bad).toEqual([]);
  });

  it("la documentation et l'internationalisation ignorent l'identité, la plateforme et la racine de composition", () => {
    expect(
      violations((i) => {
        const target = resolve(i) ?? '';
        return /^modules\/(api-docs|i18n)\//.test(i.file) && /^(integration|platform|database|modules\/iam|config)(\/|$)/.test(target);
      }),
    ).toEqual([]);
  });

  it('seule la racine de composition relie documentation, identité et internationalisation', () => {
    const linkers = new Set(imports.filter((i) => /^modules\/(i18n|iam)\//.test(resolve(i) ?? '') && i.file.startsWith('modules/api-docs/')).map((i) => i.file));
    expect([...linkers]).toEqual([]);
    expect(imports.some((i) => i.file.startsWith('integration/') && /modules\/iam/.test(resolve(i) ?? ''))).toBe(true);
    expect(imports.some((i) => i.file.startsWith('integration/') && /modules\/i18n/.test(resolve(i) ?? ''))).toBe(true);
  });
});

describe('architecture : une bibliothèque = un adaptateur', () => {
  const confined: [string, RegExp, string[]][] = [
    ['@nestjs/swagger (documentation)', /^@nestjs\/swagger/, ['modules/api-docs/infrastructure/swagger/']],
    ['@nestjs/i18n (internationalisation)', /^@nestjs\/i18n/, ['modules/i18n/infrastructure/nestjs-i18n/']],
    ['argon2 (hachage)', /^argon2$/, ['modules/iam/infrastructure/crypto/']],
    ['otplib (TOTP)', /^otplib/, ['modules/iam/infrastructure/crypto/']],
    ['ioredis (Redis)', /^ioredis/, ['modules/cache/infrastructure/', 'modules/iam/infrastructure/sessions/', 'platform/']],
    ['@nestjs/jwt (jetons)', /^@nestjs\/jwt/, ['modules/iam/infrastructure/crypto/', 'modules/iam/iam.module.ts']],
    ['pg (PostgreSQL)', /^pg$/, ['database/']],
    ['typeorm', /^(typeorm|@nestjs\/typeorm)/, ['database/', 'platform/', 'app.module.ts', 'health/']],
    ['temporal-polyfill', /^temporal-polyfill/, ['shared-kernel/temporal.ts']],
  ];

  it.each(confined)('%s n\'est importée que par son adaptateur', (_name, pattern, allowedPaths) => {
    expect(violations((i) => pattern.test(i.spec) && !inDir(i.file, ...allowedPaths))).toEqual([]);
  });

  it('chaque bibliothèque confinée est bel et bien utilisée par son adaptateur (la règle ne vise pas dans le vide)', () => {
    for (const [name, pattern, allowedPaths] of confined) {
      expect({ name, used: imports.some((i) => pattern.test(i.spec) && inDir(i.file, ...allowedPaths)) }).toEqual({ name, used: true });
    }
  });

  it('les contrôleurs et DTO documentent via la façade `modules/api-docs`, jamais par un import profond', () => {
    expect(
      violations((i) => {
        const target = resolve(i);
        return !!target && target.startsWith('modules/api-docs/') && !i.file.startsWith('modules/api-docs/');
      }),
    ).toEqual([]);
  });

  it('le reste de l\'application n\'atteint le module i18n que par ses ports, sa façade ou son module', () => {
    const allowedTargets = /^modules\/i18n\/(domain\/|application\/|presentation\/|localization\.module)/;
    expect(
      violations((i) => {
        const target = resolve(i);
        return !!target && target.startsWith('modules/i18n/') && !i.file.startsWith('modules/i18n/') && !allowedTargets.test(target);
      }),
    ).toEqual([]);
  });
});

describe.each(['administration', 'referentials', 'staff', 'audit', 'patients'])('architecture : le module %s', (moduleName) => {
  it("n'emprunte à l'IAM que ses décorateurs de présentation (permissions, utilisateur courant)", () => {
    expect(
      violations((i) => {
        const target = resolve(i);
        return i.file.startsWith(`modules/${moduleName}/`) && !!target && target.startsWith('modules/iam/') && target !== 'modules/iam/presentation/decorators';
      }),
    ).toEqual([]);
  });

  it("n'utilise l'IAM que dans sa couche de présentation", () => {
    expect(violations((i) => i.file.startsWith(`modules/${moduleName}/`) && !i.file.includes('/presentation/') && /modules\/iam/.test(resolve(i) ?? ''))).toEqual([]);
  });
});
