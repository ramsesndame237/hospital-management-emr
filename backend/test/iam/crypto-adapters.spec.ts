import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { generateSync } from 'otplib';
import { Argon2PasswordHasher } from '../../src/modules/iam/infrastructure/crypto/argon2-password-hasher';
import { AesGcmSecretCipher } from '../../src/modules/iam/infrastructure/crypto/aes-gcm-secret-cipher';
import { HibpBreachedPasswordChecker } from '../../src/modules/iam/infrastructure/crypto/hibp-breached-password-checker';
import { JwtTokenIssuer } from '../../src/modules/iam/infrastructure/crypto/jwt-token-issuer';
import { Legacy3desVerifier } from '../../src/modules/iam/infrastructure/crypto/legacy-3des-verifier';
import { OtplibTotpService } from '../../src/modules/iam/infrastructure/crypto/otplib-totp.service';
import { PasswordHash } from '../../src/modules/iam/domain/value-objects/password-hash';
import { PlainPassword } from '../../src/modules/iam/domain/value-objects/plain-password';
import { must } from './fakes';

const pwd = (s: string) => must(PlainPassword.forVerification(s));
// Paramètres réduits : on teste la logique, pas la résistance au brute-force.
const FAST = { type: 2, memoryCost: 1024, timeCost: 2, parallelism: 1 } as never;

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher(FAST);

  it('hache en Argon2id avec sel aléatoire et vérifie', async () => {
    const a = await hasher.hash(pwd('une phrase de passe solide'));
    const b = await hasher.hash(pwd('une phrase de passe solide'));
    expect(a.scheme).toBe('argon2id');
    expect(a.value).toMatch(/^\$argon2id\$/);
    expect(a.value).not.toBe(b.value); // sel différent à chaque hachage
    expect(await hasher.verify(a, pwd('une phrase de passe solide'))).toBe(true);
    expect(await hasher.verify(a, pwd('une autre phrase'))).toBe(false);
  });

  it('refuse sans lever une empreinte illisible', async () => {
    expect(await hasher.verify(PasswordHash.fromStored('pas-une-empreinte'), pwd('x'))).toBe(false);
  });

  it('demande un nouveau hachage quand les paramètres sont plus faibles que la cible', async () => {
    const weak = await hasher.hash(pwd('une phrase de passe solide'));
    expect(hasher.needsRehash(weak)).toBe(false);
    const stronger = new Argon2PasswordHasher({ type: 2, memoryCost: 2048, timeCost: 3, parallelism: 1 } as never);
    expect(stronger.needsRehash(weak)).toBe(true);
    expect(stronger.needsRehash(PasswordHash.fromStored('garbage'))).toBe(true);
  });

  it("neutralise le chronométrage sans erreur même pour un mot de passe quelconque", async () => {
    await expect(hasher.equalizeTiming(pwd('nimporte quoi'))).resolves.toBeUndefined();
  });
});

describe('Legacy3desVerifier (lecture seule du schéma hérité)', () => {
  // Reproduit le schéma décrit dans le code .NET : clé = MD5(sel), 3DES (2 clés) ECB, PKCS7, base64.
  // Vecteur de non-régression produit par Node ; à confirmer sur un vrai mot de passe de la base .NET avant la bascule.
  const encrypt = (salt: string, plain: string) => {
    const c = createCipheriv('des-ede', createHash('md5').update(salt).digest(), null);
    return Buffer.concat([c.update(plain, 'utf8'), c.final()]).toString('base64');
  };

  it('reconnaît le bon mot de passe et refuse les autres', () => {
    const v = new Legacy3desVerifier('sel-de-test');
    const hash = PasswordHash.legacy(encrypt('sel-de-test', 'Secret123!'));
    expect(v.verify(hash, pwd('Secret123!'))).toBe(true);
    expect(v.verify(hash, pwd('secret123!'))).toBe(false);
  });

  it('est inopérant sans sel configuré (échec fermé) ou avec un autre sel', () => {
    const hash = PasswordHash.legacy(encrypt('sel-de-test', 'Secret123!'));
    expect(new Legacy3desVerifier('').verify(hash, pwd('Secret123!'))).toBe(false);
    expect(new Legacy3desVerifier('autre-sel').verify(hash, pwd('Secret123!'))).toBe(false);
  });

  it('ne lève pas sur une charge utile corrompue', () => {
    expect(new Legacy3desVerifier('s').verify(PasswordHash.legacy('%%%pas-du-base64%%%'), pwd('x'))).toBe(false);
  });
});

describe('OtplibTotpService', () => {
  const totp = new OtplibTotpService();

  it('génère un secret, une URI otpauth et valide le code courant', () => {
    const secret = totp.generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const uri = totp.keyUri(secret, 'dr.house@hopital.fr', 'Sanjeevani EMR');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(`secret=${secret}`);
    expect(totp.verify(secret, generateSync({ secret }))).toBe(true);
  });

  it('refuse un mauvais code, un secret invalide et un code mal formé', () => {
    const secret = totp.generateSecret();
    expect(totp.verify(secret, '000000') || totp.verify(secret, '000001')).toBe(false);
    expect(totp.verify('!!pas-base32!!', '123456')).toBe(false);
    expect(totp.verify(secret, 'abc')).toBe(false);
  });
});

describe('AesGcmSecretCipher', () => {
  const key = randomBytes(32).toString('base64');
  const cipher = new AesGcmSecretCipher(key);

  it('chiffre puis déchiffre ; deux chiffrements du même secret diffèrent (IV aléatoire)', () => {
    const a = cipher.encrypt('JBSWY3DPEHPK3PXP');
    expect(a).toMatch(/^v1\./);
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
    expect(cipher.encrypt('JBSWY3DPEHPK3PXP')).not.toBe(a);
    expect(cipher.decrypt(a)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('détecte toute altération et refuse une autre clé', () => {
    const enc = cipher.encrypt('secret');
    const parts = enc.split('.');
    parts[3] = Buffer.from('altéré').toString('base64url');
    expect(() => cipher.decrypt(parts.join('.'))).toThrow();
    expect(() => new AesGcmSecretCipher(randomBytes(32).toString('base64')).decrypt(enc)).toThrow();
    expect(() => cipher.decrypt('n-importe-quoi')).toThrow();
  });

  it('exige une clé de 32 octets', () => {
    expect(() => new AesGcmSecretCipher(randomBytes(16).toString('base64'))).toThrow(/32 octets/);
  });
});

describe('JwtTokenIssuer', () => {
  const opts = { secret: 's'.repeat(40), issuer: 'sanjeevani', audience: 'web', ttlMinutes: 15 };
  const jwt = new JwtService();
  const issuer = new JwtTokenIssuer(jwt, opts);
  const claims = { userId: '00000000-0000-4000-8000-000000000001', username: 'docteur', roles: ['DOCTOR'], scope: 'full' as const };

  it('émet un jeton vérifiable et expirant dans 15 minutes', async () => {
    const { token, expiresAt } = await issuer.issue(claims);
    expect(await issuer.verify(token)).toEqual(claims);
    const minutes = expiresAt.epochMilliseconds / 60_000 - Date.now() / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
  });

  it('refuse : mauvaise clé, mauvaise audience, mauvais émetteur, jeton altéré, expiré, alg=none', async () => {
    const { token } = await issuer.issue(claims);
    expect(await new JwtTokenIssuer(jwt, { ...opts, secret: 'x'.repeat(40) }).verify(token)).toBeNull();
    expect(await new JwtTokenIssuer(jwt, { ...opts, audience: 'autre' }).verify(token)).toBeNull();
    expect(await new JwtTokenIssuer(jwt, { ...opts, issuer: 'autre' }).verify(token)).toBeNull();
    expect(await issuer.verify(token.slice(0, -3) + 'abc')).toBeNull();
    expect(await issuer.verify('')).toBeNull();

    const expired = await jwt.signAsync({ scope: 'full', username: 'u', roles: [] }, { secret: opts.secret, subject: 'x', issuer: opts.issuer, audience: opts.audience, expiresIn: -10 });
    expect(await issuer.verify(expired)).toBeNull();

    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ sub: claims.userId, scope: 'full', iss: opts.issuer, aud: opts.audience, exp: 4_102_444_800 }),
    ).toString('base64url')}.`;
    expect(await issuer.verify(none)).toBeNull();
  });

  it('refuse un jeton sans portée valide', async () => {
    const odd = await jwt.signAsync({ scope: 'admin', username: 'u', roles: [] }, { secret: opts.secret, subject: 'x', issuer: opts.issuer, audience: opts.audience, expiresIn: 60 });
    expect(await issuer.verify(odd)).toBeNull();
  });
});

describe('HibpBreachedPasswordChecker', () => {
  // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
  const respond = (body: string, ok = true) => jest.fn(async (_url: string, _init?: unknown) => ({ ok, text: async () => body }) as Response);

  it('envoie uniquement le préfixe de 5 caractères (k-anonymité)', async () => {
    const f = respond('1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\nABCDE:2');
    expect(await new HibpBreachedPasswordChecker(f as never).isBreached(pwd('password'))).toBe(true);
    const url = String(f.mock.calls[0][0]);
    expect(url).toBe('https://api.pwnedpasswords.com/range/5BAA6');
    expect(new URL(url).pathname).toBe('/range/5BAA6'); // seul le préfixe SHA-1 du mot de passe quitte le serveur
  });

  it('ignore les lignes de remplissage (compte 0) et les mots de passe absents', async () => {
    expect(await new HibpBreachedPasswordChecker(respond('1E4C9B93F3F0682250B6CF8331B7EE68FD8:0') as never).isBreached(pwd('password'))).toBe(false);
    expect(await new HibpBreachedPasswordChecker(respond('AAAAA:5') as never).isBreached(pwd('password'))).toBe(false);
  });

  it('accepte (ne bloque pas) si le service est indisponible ou répond une erreur', async () => {
    const down = jest.fn(async () => { throw new Error('réseau'); });
    expect(await new HibpBreachedPasswordChecker(down as never).isBreached(pwd('password'))).toBe(false);
    expect(await new HibpBreachedPasswordChecker(respond('', false) as never).isBreached(pwd('password'))).toBe(false);
  });
});
