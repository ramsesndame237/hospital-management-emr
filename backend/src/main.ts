import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { validateEnv } from './config/env.validation';
import { loadLocalEnv } from './config/load-env';
import { configurePgTypes } from './database/pg-types';

async function bootstrap() {
  loadLocalEnv();
  const env = validateEnv(process.env);
  configurePgTypes();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register());

  configureApp(app, { corsOrigins: env.CORS_ORIGINS });

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
