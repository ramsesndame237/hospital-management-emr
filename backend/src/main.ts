import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { buildApiDocsOptions } from './config/api-docs.config';
import { validateEnv } from './config/env.validation';
import { loadLocalEnv } from './config/load-env';
import { configurePgTypes } from './database/pg-types';

async function bootstrap() {
  loadLocalEnv();
  const env = validateEnv(process.env);
  configurePgTypes();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register());

  configureApp(app, { corsOrigins: env.CORS_ORIGINS, docs: buildApiDocsOptions(env.API_DOCS_ENABLED), secureCookies: env.COOKIE_SECURE });

  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`API prête sur le port ${env.PORT}`, 'Bootstrap');
  if (env.API_DOCS_ENABLED) Logger.log(`Documentation interactive : http://localhost:${env.PORT}/api-docs`, 'Bootstrap');
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
