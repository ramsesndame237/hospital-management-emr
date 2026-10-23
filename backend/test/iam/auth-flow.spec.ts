import { sha256 } from '../../src/shared-kernel/crypto';
import { LoginUseCase } from '../../src/modules/iam/application/use-cases/login';
import { LogoutUseCase } from '../../src/modules/iam/application/use-cases/logout';
import { RefreshSessionUseCase } from '../../src/modules/iam/application/use-cases/refresh-session';
import { ActivateMfaUseCase, BeginMfaEnrollmentUseCase } from '../../src/modules/iam/application/use-cases/mfa';
import { ChangePasswordUseCase } from '../../src/modules/iam/application/use-cases/change-password';
import { PlainPassword } from '../../src/modules/iam/domain/value-objects/plain-password';
import { buildWorld, FakeTotp, must, World } from './fakes';

const CTX = { ip: '10.0.0.5', userAgent: 'jest' };
const GOOD = 'une phrase de passe solide';

function login(w: World) {
  return new LoginUseCase(w.users, w.roles, w.hasher, w.legacy, w.totp, w.cipher, w.sessions, w.audit, w.clock);
}
function refresh(w: World) {
  return new RefreshSessionUseCase(w.store, w.users, w.roles, w.sessions, w.audit, w.clock);
}

describe('Connexion', () => {
  let w: World;
  beforeEach(() => { w = buildWorld(); });

  it('ouvre une session complète pour un compte sans MFA obligatoire', async () => {
    await w.addUser({ username: 'caissier', password: GOOD, roles: ['CASHIER'] });
    const r = await login(w).execute({ username: 'Caissier', password: GOOD, ...CTX });
    expect(r.ok && r.value.kind === 'authenticated' && r.value.tokens.scope).toBe('full');
    expect(w.audit.last('auth.login')?.outcome).toBe('SUCCESS');
  });

  it("répond de façon identique pour un compte inconnu et un mauvais mot de passe (anti-énumération)", async () => {
    await w.addUser({ username: 'caissier', password: GOOD, roles: ['CASHIER'] });
    const unknown = await login(w).execute({ username: 'inconnu', password: 'whatever-long-enough', ...CTX });
    const wrong = await login(w).execute({ username: 'caissier', password: 'mauvais-mot-de-passe', ...CTX });
    expect(unknown).toEqual(wrong);
    expect(!unknown.ok && unknown.error.code).toBe('INVALID_CREDENTIALS');
    expect(w.hasher.timingCalls).toBe(1); // le compte inconnu a dépensé le même temps de calcul
  });

  it('verrouille le compte après 5 échecs, même avec le bon mot de passe ensuite', async () => {
    await w.addUser({ username: 'caissier', password: GOOD, roles: ['CASHIER'] });
    for (let i = 0; i < 5; i++) await login(w).execute({ username: 'caissier', password: 'faux-faux-faux', ...CTX });
    const locked = await login(w).execute({ username: 'caissier', password: GOOD, ...CTX });
    expect(!locked.ok && locked.error.code).toBe('INVALID_CREDENTIALS'); // message identique : on ne révèle pas le verrouillage
    expect(w.audit.last('auth.login')?.outcome).toBe('DENIED');
    expect(w.audit.last('auth.login')?.reason).toBe('locked');

    w.clock.advance(16 * 60_000);
    const later = await login(w).execute({ username: 'caissier', password: GOOD, ...CTX });
    expect(later.ok).toBe(true);
  });

  it('refuse un compte désactivé', async () => {
    const u = await w.addUser({ username: 'caissier', password: GOOD, roles: ['CASHIER'] });
    u.disable();
    const r = await login(w).execute({ username: 'caissier', password: GOOD, ...CTX });
    expect(r.ok).toBe(false);
    expect(w.audit.last('auth.login')?.reason).toBe('disabled');
  });

  it("limite la session (`setup`) tant que le mot de passe provisoire n'a pas été changé", async () => {
    await w.addUser({ username: 'nouveau', password: 'Provisoire-123', roles: ['CASHIER'], mustChangePassword: true });
    const r = await login(w).execute({ username: 'nouveau', password: 'Provisoire-123', ...CTX });
    expect(r.ok && r.value.kind === 'authenticated' && [r.value.tokens.scope, r.value.mustChangePassword]).toEqual(['setup', true]);
  });

  it("impose l'inscription MFA aux profils cliniques (jeton `setup`)", async () => {
    await w.addUser({ username: 'docteur', password: GOOD, roles: ['DOCTOR'] });
    const r = await login(w).execute({ username: 'docteur', password: GOOD, ...CTX });
    expect(r.ok && r.value.kind === 'authenticated' && [r.value.tokens.scope, r.value.mfaEnrollmentRequired]).toEqual(['setup', true]);
  });

  it('demande le second facteur, puis l\'accepte (TOTP) ou le refuse', async () => {
    await w.addUser({ username: 'docteur', password: GOOD, roles: ['DOCTOR'], mfa: true });
    const first = await login(w).execute({ username: 'docteur', password: GOOD, ...CTX });
    expect(first.ok && first.value.kind).toBe('mfa_required');

    const bad = await login(w).execute({ username: 'docteur', password: GOOD, totpCode: '000000', ...CTX });
    expect(!bad.ok && bad.error.code).toBe('MFA_CODE_INVALID');

    const good = await login(w).execute({ username: 'docteur', password: GOOD, totpCode: FakeTotp.GOOD, ...CTX });
    expect(good.ok && good.value.kind === 'authenticated' && good.value.tokens.scope).toBe('full');
  });

  it('compte les mauvais codes MFA dans le verrouillage', async () => {
    await w.addUser({ username: 'docteur', password: GOOD, roles: ['DOCTOR'], mfa: true });
    for (let i = 0; i < 5; i++) await login(w).execute({ username: 'docteur', password: GOOD, totpCode: '000000', ...CTX });
    const r = await login(w).execute({ username: 'docteur', password: GOOD, totpCode: FakeTotp.GOOD, ...CTX });
    expect(r.ok).toBe(false);
  });

  it('accepte un code de récupération une seule fois', async () => {
    const u = await w.addUser({ username: 'docteur', password: GOOD, roles: ['DOCTOR'] });
    u.beginMfaEnrollment('enc:S');
    u.confirmMfaEnrollment([sha256('ABCDE-FGHJK')]);
    const first = await login(w).execute({ username: 'docteur', password: GOOD, recoveryCode: 'abcde-fghjk', ...CTX });
    expect(first.ok).toBe(true);
    const again = await login(w).execute({ username: 'docteur', password: GOOD, recoveryCode: 'ABCDE-FGHJK', ...CTX });
    expect(again.ok).toBe(false);
  });

  it('migre un mot de passe hérité (3DES) vers Argon2id à la première connexion', async () => {
    const u = await w.addUser({ username: 'ancien', password: 'court', roles: ['CASHIER'], legacy: true });
    expect(u.passwordHash.scheme).toBe('legacy-3des');
    const r = await login(w).execute({ username: 'ancien', password: 'court', ...CTX });
    expect(r.ok).toBe(true);
    expect(u.passwordHash.scheme).toBe('argon2id');
    expect(u.passwordHash.value).toBe('$argon2id$fake$court');
  });

  it("ne migre pas (et refuse) si le mot de passe hérité est faux", async () => {
    const u = await w.addUser({ username: 'ancien', password: 'court', roles: ['CASHIER'], legacy: true });
    const r = await login(w).execute({ username: 'ancien', password: 'mauvais', ...CTX });
    expect(r.ok).toBe(false);
    expect(u.passwordHash.scheme).toBe('legacy-3des');
  });
});

describe('Rafraîchissement des sessions', () => {
  let w: World;
  beforeEach(() => { w = buildWorld(); });

  async function openSession() {
    await w.addUser({ username: 'caissier', password: GOOD, roles: ['CASHIER'] });
    const r = await login(w).execute({ username: 'caissier', password: GOOD, ...CTX });
    if (!r.ok || r.value.kind !== 'authenticated') throw new Error('connexion attendue');
    return r.value.tokens;
  }

  it('fait tourner le jeton : un usage, un nouveau jeton, même famille', async () => {
    const t1 = await openSession();
    const r = await refresh(w).execute(t1.refreshToken, CTX);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.refreshToken).not.toBe(t1.refreshToken);
  });

  it('détecte le rejeu d\'un jeton consommé et révoque toute la famille', async () => {
    const t1 = await openSession();
    const t2 = await refresh(w).execute(t1.refreshToken, CTX);
    expect(t2.ok).toBe(true);

    const replay = await refresh(w).execute(t1.refreshToken, CTX); // le voleur rejoue l'ancien jeton
    expect(!replay.ok && replay.error.code).toBe('SESSION_INVALID');
    expect(w.audit.last('auth.refresh')?.reason).toBe('refresh-token-reuse');

    const victim = await refresh(w).execute(t2.ok ? t2.value.refreshToken : '', CTX); // le jeton légitime est aussi révoqué
    expect(victim.ok).toBe(false);
  });

  it.each(['', 'pas-un-jeton', 'a.b.c', '.', 'id-inconnu.secret'])('refuse un jeton malformé ou inconnu : %p', async (bad) => {
    expect((await refresh(w).execute(bad, CTX)).ok).toBe(false);
  });

  it('refuse un secret incorrect pour une session existante', async () => {
    const t = await openSession();
    const [id] = t.refreshToken.split('.');
    expect((await refresh(w).execute(`${id}.faux`, CTX)).ok).toBe(false);
  });

  it('refuse après expiration et après désactivation du compte', async () => {
    const t = await openSession();
    w.clock.advance(8 * 24 * 3_600_000);
    expect((await refresh(w).execute(t.refreshToken, CTX)).ok).toBe(false);

    const w2 = buildWorld();
    const u = await w2.addUser({ username: 'caissier', password: GOOD, roles: ['CASHIER'] });
    const r = await login(w2).execute({ username: 'caissier', password: GOOD, ...CTX });
    u.disable();
    expect((await refresh(w2).execute(r.ok && r.value.kind === 'authenticated' ? r.value.tokens.refreshToken : '', CTX)).ok).toBe(false);
  });

  it('la déconnexion révoque la famille', async () => {
    const t = await openSession();
    await new LogoutUseCase(w.store, w.audit, w.clock).execute(t.refreshToken, CTX);
    expect((await refresh(w).execute(t.refreshToken, CTX)).ok).toBe(false);
  });

  it('passe de `setup` à `full` une fois mot de passe changé (portée recalculée)', async () => {
    const u = await w.addUser({ username: 'nouveau', password: 'Provisoire-123', roles: ['CASHIER'], mustChangePassword: true });
    const r = await login(w).execute({ username: 'nouveau', password: 'Provisoire-123', ...CTX });
    const tokens = r.ok && r.value.kind === 'authenticated' ? r.value.tokens : null;
    u.changePassword(await w.hasher.hash(must(PlainPassword.forVerification(GOOD))), w.clock.now());
    const next = await refresh(w).execute(tokens!.refreshToken, CTX);
    expect(next.ok && next.value.scope).toBe('full');
  });
});

describe('MFA', () => {
  it("inscrit puis active la MFA ; les codes de secours sont remis une fois et stockés hachés", async () => {
    const w = buildWorld();
    const u = await w.addUser({ username: 'docteur', password: GOOD, roles: ['DOCTOR'] });
    const begin = await new BeginMfaEnrollmentUseCase(w.users, w.totp, w.cipher).execute(u.id.value);
    expect(begin.ok && begin.value.keyUri).toContain('otpauth://totp/');
    expect(u.pendingMfaSecret).toBe('enc:JBSWY3DPEHPK3PXP'); // chiffré au repos

    const bad = await new ActivateMfaUseCase(w.users, w.totp, w.cipher, w.audit, w.clock).execute(u.id.value, '000000');
    expect(!bad.ok && bad.error.code).toBe('MFA_CODE_INVALID');
    expect(u.hasMfa).toBe(false);

    const ok = await new ActivateMfaUseCase(w.users, w.totp, w.cipher, w.audit, w.clock).execute(u.id.value, FakeTotp.GOOD);
    expect(ok.ok && ok.value).toHaveLength(10);
    expect(u.hasMfa).toBe(true);
    expect(u.snapshot().recoveryCodeHashes).toHaveLength(10);
    expect(u.snapshot().recoveryCodeHashes[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuse l'activation sans inscription préalable et une double inscription", async () => {
    const w = buildWorld();
    const u = await w.addUser({ username: 'docteur', password: GOOD, roles: ['DOCTOR'], mfa: true });
    const act = await new ActivateMfaUseCase(w.users, w.totp, w.cipher, w.audit, w.clock).execute(u.id.value, FakeTotp.GOOD);
    expect(!act.ok && act.error.code).toBe('MFA_NOT_STARTED');
    const again = await new BeginMfaEnrollmentUseCase(w.users, w.totp, w.cipher).execute(u.id.value);
    expect(!again.ok && again.error.code).toBe('MFA_ALREADY_ENABLED');
  });
});

describe('Changement de mot de passe', () => {
  function build(w: World) {
    return new ChangePasswordUseCase(w.users, w.hasher, w.legacy, w.breached, w.store, w.sessions, w.resolver, w.audit, w.clock);
  }

  it('révoque toutes les sessions et ouvre une nouvelle session complète', async () => {
    const w = buildWorld();
    const u = await w.addUser({ username: 'nouveau', password: 'Provisoire-123', roles: ['CASHIER'], mustChangePassword: true });
    const l = await login(w).execute({ username: 'nouveau', password: 'Provisoire-123', ...CTX });
    expect(l.ok).toBe(true);

    const r = await build(w).execute(u.id.value, 'Provisoire-123', GOOD, CTX);
    expect(r.ok && r.value.scope).toBe('full');
    expect(u.mustChangePassword).toBe(false);
    expect(w.store.active(u.id.value)).toBe(1);
    expect(w.audit.last('auth.password.change')?.outcome).toBe('SUCCESS');
  });

  it('refuse : ancien mot de passe faux, politique non respectée, identique, compromis', async () => {
    const w = buildWorld();
    const u = await w.addUser({ username: 'nouveau', password: 'Provisoire-123', roles: ['CASHIER'] });
    const uc = build(w);
    expect((await uc.execute(u.id.value, 'faux-faux-faux', GOOD, CTX)).ok).toBe(false);
    const short = await uc.execute(u.id.value, 'Provisoire-123', 'court', CTX);
    expect(!short.ok && short.error.code).toBe('PASSWORD_TOO_SHORT');
    const same = await uc.execute(u.id.value, 'Provisoire-123', 'Provisoire-123', CTX);
    expect(!same.ok && same.error.code).toBe('PASSWORD_UNCHANGED');
    w.breached.bad.add('phrase-compromise-connue');
    const breached = await uc.execute(u.id.value, 'Provisoire-123', 'phrase-compromise-connue', CTX);
    expect(!breached.ok && breached.error.code).toBe('PASSWORD_BREACHED');
    expect(u.passwordHash.value).toContain('Provisoire-123'); // inchangé après tous ces refus
  });
});
