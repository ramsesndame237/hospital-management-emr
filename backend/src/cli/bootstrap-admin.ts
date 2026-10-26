import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadLocalEnv } from '../config/load-env';
import { configurePgTypes } from '../database/pg-types';
import { SQL_EXECUTOR, SqlExecutor } from '../database/sql-executor';
import { CreateUserUseCase } from '../modules/iam/application/use-cases/manage-users';

/**
 * Crée le tout premier administrateur système, une seule fois (refuse s'il existe déjà un compte).
 * Le mot de passe temporaire est affiché ici et nulle part ailleurs ; il devra être changé à la première connexion,
 * qui exigera aussi l'inscription MFA (profil administrateur).
 *
 *   (variables dans .env, ou en ligne :)
 *   BOOTSTRAP_ADMIN_USERNAME=admin BOOTSTRAP_ADMIN_EMAIL=dsi@hopital.example node dist/cli/bootstrap-admin.js
 */
async function main(): Promise<void> {
  // Le fichier `.env` doit être chargé AVANT de lire les variables ci-dessous (une variable déjà définie dans l'environnement l'emporte).
  loadLocalEnv();
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'admin';
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (!email) throw new Error('BOOTSTRAP_ADMIN_EMAIL est obligatoire (dans .env ou dans l\'environnement).');

  configurePgTypes();
  const app = await NestFactory.createApplicationContext(AppModule.register(), { logger: ['error', 'warn'] });
  try {
    const sql = app.get<SqlExecutor>(SQL_EXECUTOR, { strict: false });
    const [{ n }] = await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM iam_users');
    if (n > 0) throw new Error('Des comptes existent déjà : amorçage refusé. Utilisez l\'API d\'administration.');

    const created = await app.get(CreateUserUseCase, { strict: false }).execute('system:bootstrap', { username, email, roles: ['SYSTEM_ADMIN'] });
    if (!created.ok) throw new Error(created.error.message);
    // eslint-disable-next-line no-console
    console.log(`Administrateur créé : ${created.value.user.username}\nMot de passe temporaire (affiché une seule fois) : ${created.value.temporaryPassword}`);
  } finally {
    await app.close();
  }
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
