import { Controller, Get, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DanpheApi } from '../src/common/danphe-response';

/** Contrôleur de test : reproduit les cas du backend .NET (succès, erreur métier, accès refusé). */
@DanpheApi()
@Controller('api/Probe')
class ProbeController {
  @Get('list') list() { return [{ PatientId: 1, FirstName: 'Eva' }]; }
  @Get('choice') choice() { return { Status: 'Failed', ErrorMessage: 'choisi par laction' }; }
  @Get('boom') boom(): never { throw new Error('Doublon de rendez-vous'); }
  @Get('denied') denied(): never { throw new UnauthorizedException('Session expirée'); }
}

@Controller('api/Plain')
class PlainController {
  @Get() plain() { return { hello: 'world' }; }
}

describe('enveloppe de réponse (contrat DanpheHTTPResponse)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = AppModule.register({ database: false });
    mod.controllers = [...(mod.controllers ?? []), ProbeController, PlainController];
    const moduleRef = await Test.createTestingModule({ imports: [mod] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it('enveloppe un résultat dans { Status: "OK", Results }', async () => {
    const res = await request(app.getHttpServer()).get('/api/Probe/list').expect(200);
    expect(res.body).toEqual({ Status: 'OK', Results: [{ PatientId: 1, FirstName: 'Eva' }] });
  });

  it('laisse intacte une réponse qui porte déjà son Status', async () => {
    const res = await request(app.getHttpServer()).get('/api/Probe/choice').expect(200);
    expect(res.body).toEqual({ Status: 'Failed', ErrorMessage: 'choisi par laction' });
  });

  it('transforme une exception métier en HTTP 200 + Status "Failed" (comme .NET)', async () => {
    const res = await request(app.getHttpServer()).get('/api/Probe/boom').expect(200);
    expect(res.body).toEqual({ Status: 'Failed', ErrorMessage: 'Doublon de rendez-vous' });
  });

  it('conserve le code 401 pour que le front redirige vers la connexion', async () => {
    const res = await request(app.getHttpServer()).get('/api/Probe/denied').expect(401);
    expect(res.body.Status).toBe('Failed');
    expect(res.body.ErrorMessage).toBe('Session expirée');
  });

  it("n'enveloppe pas les contrôleurs non marqués", async () => {
    const res = await request(app.getHttpServer()).get('/api/Plain').expect(200);
    expect(res.body).toEqual({ hello: 'world' });
  });

  it('expose la sonde de santé sans base', async () => {
    const res = await request(app.getHttpServer()).get('/api/Health').expect(200);
    expect(res.body).toEqual({ Status: 'OK', Results: { service: 'sanjeevani-api', status: 'up', database: 'disabled' } });
  });
});
