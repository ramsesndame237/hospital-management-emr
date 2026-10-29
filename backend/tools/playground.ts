/**
 * Bac à sable : démarre l'API COMPLÈTE (mêmes modules, gardes et configuration qu'en production) sur une base PostgreSQL
 * embarquée en mémoire et des sessions en mémoire, avec un compte de démonstration par profil. Aucune infrastructure
 * à installer : pour découvrir la documentation (`/api-docs`) et tester les endpoints.
 *
 *   npm run playground            # http://localhost:3100/api-docs
 *   PORT=4000 npm run playground
 *
 * Les données disparaissent à l'arrêt. NE JAMAIS utiliser en production (comptes et secrets publics).
 */
import 'reflect-metadata';
import type { Express } from 'express';
import { generateSync } from 'otplib';
import { configurePgTypes } from '../src/database/pg-types';
import { createTestWorld, TOTP_SECRET } from '../test/iam/e2e-app';

const PORT = Number(process.env.PORT ?? 3100);
const PASSWORD = 'Demo-Passw0rd-2026';

const PROFILES: { username: string; role: string; mfa: boolean; label: string }[] = [
  { username: 'system_admin', role: 'SYSTEM_ADMIN', mfa: true, label: 'Administrateur système' },
  { username: 'doctor', role: 'DOCTOR', mfa: true, label: 'Médecin' },
  { username: 'nurse', role: 'NURSE', mfa: true, label: 'Infirmier(ère)' },
  { username: 'pharmacist', role: 'PHARMACIST', mfa: true, label: 'Pharmacien(ne)' },
  { username: 'pharmacist2', role: 'PHARMACIST', mfa: true, label: 'Pharmacien(ne) (second : approuve les ajustements)' },
  { username: 'lab_technician', role: 'LAB_TECHNICIAN', mfa: true, label: 'Technicien(ne) de laboratoire' },
  { username: 'radiologist', role: 'RADIOLOGIST', mfa: true, label: 'Radiologue' },
  { username: 'dpo_auditor', role: 'DPO_AUDITOR', mfa: true, label: 'DPO / Auditeur' },
  { username: 'cashier', role: 'CASHIER', mfa: false, label: 'Caissier(ère)' },
  { username: 'receptionist', role: 'RECEPTIONIST', mfa: false, label: 'Réceptionniste' },
  { username: 'accountant', role: 'ACCOUNTANT', mfa: false, label: 'Comptable' },
  { username: 'patient', role: 'PATIENT', mfa: false, label: 'Patient' },
];

async function main(): Promise<void> {
  configurePgTypes();
  const world = await createTestWorld({
    docs: true,
    // Aide au test : le code TOTP courant des comptes protégés (à la place d'une application d'authentification).
    // Enregistrée AVANT l'initialisation, sinon le routeur répondrait 404 en premier.
    beforeInit: (app) => {
      const server = app.getHttpAdapter().getInstance() as Express;
      server.get('/dev/totp', (_req, res) => res.json({ code: generateSync({ secret: TOTP_SECRET }), validForSeconds: 30 - (Math.floor(Date.now() / 1000) % 30) }));
    },
  });
  for (const p of PROFILES) await world.seed({ username: p.username, password: PASSWORD, roles: [p.role], mfa: p.mfa });
  // Confort du bac à sable uniquement : le caissier (sans MFA) peut ouvrir la documentation. En vrai, seule la permission
  // `api.docs:read` l'autorise, et elle n'est donnée par défaut qu'à l'administrateur système.
  await world.sql.query("UPDATE iam_roles SET permissions = array_append(permissions, 'api.docs:read') WHERE code = 'CASHIER'");

  await world.app.listen(PORT, '0.0.0.0');

  const line = '─'.repeat(78);
  /* eslint-disable no-console */
  console.log(`\n${line}\n  Sanjeevani EMR — bac à sable (données en mémoire, NE PAS utiliser en production)\n${line}`);
  console.log(`  Documentation interactive : http://localhost:${PORT}/api-docs   (connexion requise)`);
  console.log(`  Document OpenAPI (JSON)   : http://localhost:${PORT}/api-docs/json   (même accès)`);
  console.log(`  Code TOTP courant         : http://localhost:${PORT}/dev/totp   (comptes marqués « MFA »)\n`);
  console.log(`  Mot de passe de tous les comptes : ${PASSWORD}\n`);
  console.log('  Identifiant        Profil                          Double authentification');
  for (const p of PROFILES) console.log(`  ${p.username.padEnd(18)} ${p.label.padEnd(31)} ${p.mfa ? 'oui → ajouter "totpCode"' : 'non'}`);
  console.log(`\n  Accès à la documentation : « system_admin » (+ code de /dev/totp) ou, dans ce bac à sable seulement, « cashier ».`);
  console.log(`${line}\n  Ctrl+C pour arrêter.\n`);
  /* eslint-enable no-console */

  const stop = async () => {
    await world.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
