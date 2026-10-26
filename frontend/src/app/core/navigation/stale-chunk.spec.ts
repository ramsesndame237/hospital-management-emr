import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NavigationError } from '@angular/router';
import { isChunkLoadError, reloadOnStaleChunk } from './stale-chunk';

describe('rechargement après une mise à jour (écran introuvable)', () => {
  const stale = new TypeError('Failed to fetch dynamically imported module: http://localhost:4200/chunk-ABC.js');
  const failure = (error: unknown) => new NavigationError(1, '/admin/sites', error);

  let assign: ReturnType<typeof vi.fn>;
  let store: Map<string, string>;

  function run(error: unknown): void {
    TestBed.runInInjectionContext(() => reloadOnStaleChunk(failure(error)));
  }

  beforeEach(() => {
    assign = vi.fn();
    store = new Map();
    const defaultView = {
      location: { assign },
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
    };
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: { defaultView } }] });
  });

  it.each([
    ['Failed to fetch dynamically imported module: http://x/chunk.js'],
    ['error loading dynamically imported module'],
    ['Loading chunk 12 failed.'],
  ])('reconnaît un écran introuvable : %s', (message) => expect(isChunkLoadError(new TypeError(message))).toBe(true));

  it('ne prend pas une autre erreur pour un écran introuvable', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
  });

  it("recharge la page à l'adresse demandée quand un écran est introuvable", () => {
    run(stale);
    expect(assign).toHaveBeenCalledWith('/admin/sites');
  });

  it('ne recharge qu’une fois : si le problème persiste, l’erreur remonte au lieu de boucler', () => {
    run(stale);
    expect(() => run(stale)).toThrow(stale);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('laisse remonter toute autre erreur de navigation sans recharger', () => {
    const other = new Error('boom');
    expect(() => run(other)).toThrow(other);
    expect(assign).not.toHaveBeenCalled();
  });
});
