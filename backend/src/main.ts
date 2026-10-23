import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';
import { configurePgTypes } from './database/pg-types';

async function bootstrap() {
  const env = validateEnv(process.env);
  configurePgTypes();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register());

  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  // Les routes reprennent exactement celles du backend .NET (« api/<Contrôleur>/<action> ») : pas de préfixe global.
  // Corps JSON volumineux : le backend .NET autorisait de gros formulaires (RequestFormSizeLimit).
  app.useBodyParser('json', { limit: '25mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (env.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Sanjeevani API').setVersion('0.1.0').addBearerAuth().build());
    SwaggerModule.setup('api-docs', app, doc);
  }

  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`API prête sur le port ${env.PORT}`, 'Bootstrap');
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
