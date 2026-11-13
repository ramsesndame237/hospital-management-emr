import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(__dirname, '../migration/schema');
/** L'ancien schéma déduit du code C# (inventaire hérité) : il n'est pas appliqué par l'application. */
const LEGACY = 'schema.pg.sql';

describe('manifeste des migrations (migration/schema/manifest.json)', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8')) as string[];

  it('liste chaque script de module, une seule fois, et rien d\'autre : un module ajouté sans être déclaré ferait un déploiement incomplet', () => {
    const onDisk = fs.readdirSync(DIR).filter((f) => f.endsWith('.pg.sql') && f !== LEGACY).sort();
    expect([...manifest].sort()).toEqual(onDisk);
    expect(new Set(manifest).size).toBe(manifest.length);
  });

  it('commence par l\'IAM : les autres scripts complètent ses rôles système', () => {
    expect(manifest[0]).toBe('iam.pg.sql');
    expect(manifest.indexOf('administration.pg.sql')).toBeLessThan(manifest.indexOf('patients.pg.sql'));
  });

  it('le conteneur applique le manifeste, pas une liste écrite à la main', () => {
    const dockerfile = fs.readFileSync(path.join(__dirname, '../Dockerfile'), 'utf8');
    expect(dockerfile).toContain('tools/migrate.mjs');
    expect(dockerfile).not.toMatch(/apply-sql\.mjs migration/);
  });
});
