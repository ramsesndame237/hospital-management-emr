import { EventEmitter } from 'node:events';
import { JsonLogger, requestLogger, routeOf } from '../../src/common/http-logging';

function run(req: Record<string, unknown>, status = 200) {
  const lines: Record<string, unknown>[] = [];
  const headers: Record<string, string> = {};
  let tick = 0;
  const res = Object.assign(new EventEmitter(), { statusCode: status, setHeader: (k: string, v: string) => { headers[k] = v; } });
  const request = { method: 'GET', baseUrl: '', path: '/', ip: '10.0.0.5', header: (name: string) => (req['headers'] as Record<string, string> | undefined)?.[name], ...req };
  const next = jest.fn();
  requestLogger({ write: (l) => lines.push(l), now: () => (tick += 40) })(request as never, res as never, next);
  res.emit('finish');
  return { lines, headers, next };
}

describe('journal des requêtes', () => {
  it('écrit une ligne par requête avec le gabarit de route, sans la chaîne de requête', () => {
    const { lines, headers, next } = run({ method: 'GET', baseUrl: '/api/v1', route: { path: '/patients/:id' }, path: '/patients/5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', originalUrl: '/api/v1/patients/5d81b4cd?patientNumber=P-0042' });
    expect(next).toHaveBeenCalled();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ method: 'GET', route: '/api/v1/patients/:id', status: 200, durationMs: 40, ip: '10.0.0.5' });
    expect(JSON.stringify(lines[0])).not.toMatch(/P-0042|5d81b4cd/);
    expect(headers['X-Request-Id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reprend un identifiant de corrélation valide du client, en ignore un douteux', () => {
    expect(run({ headers: { 'x-request-id': 'gateway-abc12345' }, route: { path: '/x' } }).headers['X-Request-Id']).toBe('gateway-abc12345');
    expect(run({ headers: { 'x-request-id': 'a b\nc' }, route: { path: '/x' } }).headers['X-Request-Id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('masque les identifiants quand aucune route ne correspond (404)', () => {
    expect(routeOf({ baseUrl: '', route: undefined, path: '/api/v1/patients/5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73/invoices/42' } as never)).toBe('/api/v1/patients/:id/invoices/:id');
  });

  it('ne journalise pas les sondes de supervision', () => {
    const { lines, headers } = run({ path: '/api/Health' });
    expect(lines).toEqual([]);
    expect(headers['X-Request-Id']).toBeDefined();
  });
});

describe('JsonLogger', () => {
  const capture = () => {
    const out: { stream: string; line: string }[] = [];
    return { out, logger: new JsonLogger((stream, line) => out.push({ stream, line })) };
  };

  it('émet une ligne JSON par message, sur stdout', () => {
    const { out, logger } = capture();
    logger.log('API prête', 'Bootstrap');
    const parsed = JSON.parse(out[0].line);
    expect(out[0].stream).toBe('stdout');
    expect(parsed).toMatchObject({ level: 'log', context: 'Bootstrap', message: 'API prête' });
    expect(out[0].line.endsWith('\n')).toBe(true);
  });

  it('met les erreurs sur stderr avec leur pile', () => {
    const { out, logger } = capture();
    logger.error('boum', 'Error: boum\n    at x', 'Envelope');
    expect(out[0].stream).toBe('stderr');
    expect(JSON.parse(out[0].line)).toMatchObject({ level: 'error', context: 'Envelope', message: 'boum', stack: 'Error: boum\n    at x' });
  });

  it('fusionne un objet structuré (la ligne de requête)', () => {
    const { out, logger } = capture();
    logger.log({ message: 'request', route: '/a', status: 200 }, 'Http');
    expect(JSON.parse(out[0].line)).toMatchObject({ context: 'Http', message: 'request', route: '/a', status: 200 });
  });
});
