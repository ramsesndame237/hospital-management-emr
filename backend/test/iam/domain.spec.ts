import { LockoutPolicy } from '../../src/modules/iam/domain/user';
import { Email } from '../../src/modules/iam/domain/value-objects/email';
import { PasswordHash } from '../../src/modules/iam/domain/value-objects/password-hash';
import { Permission } from '../../src/modules/iam/domain/value-objects/permission';
import { PlainPassword } from '../../src/modules/iam/domain/value-objects/plain-password';
import { RoleCode } from '../../src/modules/iam/domain/value-objects/role-code';
import { TotpCode } from '../../src/modules/iam/domain/value-objects/totp-code';
import { Username } from '../../src/modules/iam/domain/value-objects/username';
import { AccessPolicy, Role } from '../../src/modules/iam/domain/role';
import { must } from './fakes';

describe('Value objects', () => {
  it('Email : normalise en minuscules et refuse les formats invalides', () => {
    expect(must(Email.create('  Dr.House@Hopital.FR ')).value).toBe('dr.house@hopital.fr');
    for (const bad of ['', 'sans-arobase', 'a@b', 'a b@c.fr', 'x'.repeat(250) + '@a.fr']) {
      expect(Email.create(bad).ok).toBe(false);
    }
  });

  it('Username : 3 à 64 caractères, normalisé, sans caractères dangereux', () => {
    expect(must(Username.create('Marie.Curie')).value).toBe('marie.curie');
    for (const bad of ['ab', '.start', "o'brien", 'a;drop table', 'é'.repeat(5), 'x'.repeat(65)]) {
      expect(Username.create(bad).ok).toBe(false);
    }
  });

  it('Les value objects sont immuables et comparés par valeur', () => {
    const a = must(Email.create('a@b.fr'));
    expect(a.equals(must(Email.create('A@B.fr')))).toBe(true);
    expect(() => { (a as unknown as { value: string }).value = 'x@y.fr'; }).toThrow();
  });

  it('TotpCode : exactement 6 chiffres (espaces tolérés)', () => {
    expect(must(TotpCode.create('123 456')).value).toBe('123456');
    for (const bad of ['12345', '1234567', 'abcdef', '']) expect(TotpCode.create(bad).ok).toBe(false);
  });

  it('RoleCode : MAJUSCULES_ET_TIRETS_BAS', () => {
    expect(must(RoleCode.create('doctor')).value).toBe('DOCTOR');
    expect(RoleCode.create('1BAD').ok).toBe(false);
    expect(RoleCode.create('with space').ok).toBe(false);
  });

  it('PasswordHash : reconnaît le schéma et ne se laisse pas journaliser', () => {
    expect(PasswordHash.fromStored('$argon2id$v=19$x').scheme).toBe('argon2id');
    const legacy = PasswordHash.legacy('QUJD');
    expect(legacy.scheme).toBe('legacy-3des');
    expect(legacy.legacyPayload).toBe('QUJD');
    expect(`${legacy}`).toBe('[PasswordHash]');
  });
});

describe('PlainPassword (politique NIST 800-63B)', () => {
  it('accepte une phrase de passe longue sans règle de composition', () => {
    expect(PlainPassword.create('correct horse battery staple').ok).toBe(true);
  });

  it.each([
    ['court', 'abc12345', 'PASSWORD_TOO_SHORT'],
    ['trop long', 'a1'.repeat(70), 'PASSWORD_TOO_LONG'],
    ['courant', 'Password123', 'PASSWORD_TOO_SHORT'],
    ['courant long', 'administrator', 'PASSWORD_TOO_COMMON'],
    ['caractère répété', 'aaaaaaaaaaaaaa', 'PASSWORD_TOO_COMMON'],
  ])('refuse un mot de passe %s', (_n, pwd, code) => {
    const r = PlainPassword.create(pwd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(code);
  });

  it("refuse un mot de passe contenant l'identifiant ou l'e-mail", () => {
    const r = PlainPassword.create('xx-marie.curie-2026', { username: 'marie.curie' });
    expect(r.ok).toBe(false);
    expect(PlainPassword.create('le-docteur-house-12', { email: 'house@hopital.fr' }).ok).toBe(false);
  });

  it('ne divulgue jamais la valeur par toString/JSON', () => {
    const p = must(PlainPassword.create('une phrase de passe solide'));
    expect(String(p)).toBe('[PlainPassword]');
    expect(JSON.stringify({ p })).toBe('{"p":"[PlainPassword]"}');
  });

  it('forVerification ne applique pas la politique (anciens mots de passe) mais borne la taille', () => {
    expect(PlainPassword.forVerification('abc').ok).toBe(true);
    expect(PlainPassword.forVerification('').ok).toBe(false);
    expect(PlainPassword.forVerification('x'.repeat(1025)).ok).toBe(false);
  });
});

describe('Permission', () => {
  const p = (s: string) => must(Permission.create(s));

  it('applique la portée « all » par défaut et refuse les jokers', () => {
    expect(p('files:read').value).toBe('files:read:all');
    for (const bad of ['*', 'files:*', 'files', 'Files:read', 'files:read:everything']) expect(Permission.create(bad).ok).toBe(false);
  });

  it("une portée plus large inclut les plus étroites, jamais l'inverse", () => {
    expect(p('files:read:all').implies(p('files:read:own'))).toBe(true);
    expect(p('files:read:department').implies(p('files:read:own'))).toBe(true);
    expect(p('files:read:own').implies(p('files:read:department'))).toBe(false);
  });

  it('ne déborde pas sur une autre ressource ou action', () => {
    expect(p('files:read').implies(p('files:delete'))).toBe(false);
    expect(p('files:read').implies(p('files.clinical:read'))).toBe(false);
  });
});

describe('AccessPolicy', () => {
  it("fusionne les permissions des rôles et sait si l'un exige la MFA", () => {
    const code = (c: string) => must(RoleCode.create(c));
    const a = new Role(code('ROLE_A'), 'A', [must(Permission.create('x:read'))], false, false);
    const b = new Role(code('ROLE_B'), 'B', [must(Permission.create('x:read')), must(Permission.create('y:write'))], true, false);
    expect(AccessPolicy.permissionsOf([a, b])).toHaveLength(2);
    expect(AccessPolicy.requiresMfa([a])).toBe(false);
    expect(AccessPolicy.requiresMfa([a, b])).toBe(true);
    expect(AccessPolicy.can([must(Permission.create('x:read'))], must(Permission.create('y:write')))).toBe(false);
  });
});

describe('LockoutPolicy', () => {
  const policy = new LockoutPolicy();
  it('ne verrouille pas avant 5 échecs, puis double le délai jusqu\'à 24 h', () => {
    expect(policy.lockDurationMs(4)).toBe(0);
    expect(policy.lockDurationMs(5)).toBe(15 * 60_000);
    expect(policy.lockDurationMs(6)).toBe(30 * 60_000);
    expect(policy.lockDurationMs(7)).toBe(60 * 60_000);
    expect(policy.lockDurationMs(40)).toBe(24 * 3_600_000);
  });
});
