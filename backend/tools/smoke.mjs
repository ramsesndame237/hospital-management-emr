// Test de fumée d'une installation : à lancer après le premier démarrage, sur une base NEUVE (il consomme l'amorçage du premier administrateur).
//   BASE_URL=http://localhost:8080 SMOKE_ADMIN_TEMP_PASSWORD='<mot de passe affiché par bootstrap-admin>' node tools/smoke.mjs
// Il déroule la première connexion d'un administrateur (changement de mot de passe, inscription de la double authentification), puis vérifie que
// chaque module répond avec ses droits : preuve que le schéma complet, les rôles et les routes sont en place sur la vraie base.
// Il n'écrit rien de clinique. Le nouveau mot de passe et le secret TOTP ne sont jamais affichés.
import { randomBytes } from 'node:crypto';
import { generateSync } from 'otplib';

const BASE = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const USER = process.env.SMOKE_ADMIN_USER ?? 'admin';
const TEMP = process.env.SMOKE_ADMIN_TEMP_PASSWORD;
if (!TEMP) {
  console.error('SMOKE_ADMIN_TEMP_PASSWORD est obligatoire (mot de passe temporaire affiché par bootstrap-admin).');
  process.exit(2);
}
const NEW_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? `Sm0ke-${randomBytes(12).toString('base64url')}-ok!`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✔' : '✘'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures += 1;
};
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* corps non JSON */ }
  return { status: res.status, body: json };
};

const health = await call('GET', '/api/Health');
check('l\'API répond (santé)', health.status === 200, `HTTP ${health.status}`);

const login = await call('POST', '/api/v1/auth/login', { body: { username: USER, password: TEMP } });
check('connexion avec le mot de passe temporaire', login.status === 200 && login.body?.mustChangePassword === true, `HTTP ${login.status}`);
if (login.status !== 200) process.exit(1);

const changed = await call('POST', '/api/v1/auth/password/change', { token: login.body.accessToken, body: { currentPassword: TEMP, newPassword: NEW_PASSWORD } });
check('changement du mot de passe', changed.status === 200, `HTTP ${changed.status} ${JSON.stringify(changed.body)?.slice(0, 120)}`);
if (changed.status !== 200) process.exit(1);

const enroll = await call('POST', '/api/v1/auth/mfa/enroll', { token: changed.body.accessToken });
check('inscription de la double authentification', enroll.status === 200 && typeof enroll.body?.secret === 'string', `HTTP ${enroll.status}`);
if (enroll.status !== 200) process.exit(1);

const activated = await call('POST', '/api/v1/auth/mfa/activate', { token: changed.body.accessToken, body: { code: generateSync({ secret: enroll.body.secret }) } });
check('activation de la double authentification (codes de récupération remis)', activated.status === 200 && (activated.body?.recoveryCodes?.length ?? 0) > 0, `HTTP ${activated.status}`);
if (activated.status !== 200) process.exit(1);

// Après l'activation, la connexion complète (portée « full ») exige le mot de passe ET un code TOTP. Un code déjà utilisé est refusé (rejeu) :
// on attend la fenêtre suivante de 30 s si besoin.
let full = await call('POST', '/api/v1/auth/login', { body: { username: USER, password: NEW_PASSWORD, totpCode: generateSync({ secret: enroll.body.secret }) } });
if (full.status !== 200) {
  await new Promise((resolve) => setTimeout(resolve, 31_000));
  full = await call('POST', '/api/v1/auth/login', { body: { username: USER, password: NEW_PASSWORD, totpCode: generateSync({ secret: enroll.body.secret }) } });
}
check('connexion complète (mot de passe + code TOTP)', full.status === 200 && !!full.body?.accessToken, `HTTP ${full.status}`);
const token = full.body?.accessToken;
if (!token) process.exit(1);

const me = await call('GET', '/api/v1/auth/me', { token });
check('profil administrateur système', me.status === 200 && JSON.stringify(me.body).includes('SYSTEM_ADMIN'), `HTTP ${me.status}`);

// Écriture en base, puis relecture.
const organization = await call('PUT', '/api/v1/organization', { token, body: { name: 'Établissement de test' } });
check('écriture en base (organisation)', organization.status === 200, `HTTP ${organization.status}`);

// Chaque module doit répondre 200 à l'administrateur système (droit de lecture) : schéma, rôles et routes en place.
const modules = [
  ['organisation', '/api/v1/organization'], ['utilisateurs', '/api/v1/users?offset=0&limit=5'], ['rôles', '/api/v1/roles'], ['patients', '/api/v1/patients?q=zz'],
  ['catalogue des actes', '/api/v1/billing/items'], ['catalogue des analyses', '/api/v1/lab/tests'], ['catalogue des examens d\'imagerie', '/api/v1/imaging/exam-types'],
  ['catalogue des médicaments', '/api/v1/pharmacy/drugs'], ['journal d\'audit', '/api/v1/audit/events?limit=5'],
];
for (const [name, path] of modules) {
  const r = await call('GET', path, { token });
  check(`module : ${name}`, r.status === 200, `HTTP ${r.status}`);
}

// Le journal d'audit est chaîné : sa vérification d'intégrité doit passer.
const verify = await call('GET', '/api/v1/audit/verify', { token });
check('intégrité du journal d\'audit', verify.status === 200, `HTTP ${verify.status} ${JSON.stringify(verify.body)?.slice(0, 120)}`);

console.log(failures === 0 ? '\nInstallation opérationnelle.' : `\n${failures} contrôle(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
