import { hasPermission } from './permissions';

describe('hasPermission', () => {
  it('accorde une permission exacte et applique la portée « all » par défaut', () => {
    expect(hasPermission(['files:upload'], 'files:upload')).toBe(true);
    expect(hasPermission(['files:upload:all'], 'files:upload')).toBe(true);
  });

  it("une portée plus large couvre les plus étroites, jamais l'inverse", () => {
    expect(hasPermission(['files:read:all'], 'files:read:own')).toBe(true);
    expect(hasPermission(['files:read:department'], 'files:read:own')).toBe(true);
    expect(hasPermission(['files:read:own'], 'files:read:department')).toBe(false);
    expect(hasPermission(['files:read:department'], 'files:read')).toBe(false); // exiger « all »
  });

  it('ne déborde ni sur une autre ressource, ni sur une autre action', () => {
    expect(hasPermission(['files:read'], 'files:delete')).toBe(false);
    expect(hasPermission(['files:read'], 'files.clinical:read')).toBe(false);
    expect(hasPermission([], 'files:read')).toBe(false);
  });

  it.each(['', 'files', 'files:read:everything', 'files:read:all:extra', ':read'])('refuse une permission requise mal formée : %p', (bad) => {
    expect(hasPermission(['files:read:all'], bad)).toBe(false);
  });

  it('ignore les permissions accordées mal formées au lieu de lever', () => {
    expect(hasPermission(['n-importe-quoi', 'a:b:c:d', 'files:read'], 'files:read')).toBe(true);
  });
});
