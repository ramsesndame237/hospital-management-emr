import { evaluateRule, identityValuesOf, strengthOf, unmetRules } from './password-policy';
import { ValidatorSpec } from './form-schema';

const spec: ValidatorSpec = { type: 'passwordPolicy', value: 12, rules: ['notCommon', 'noIdentity'] };
const ctx = (...identityValues: string[]) => ({ identityValues });

describe('politique de mot de passe', () => {
  it('exige 12 caractères au minimum (même règle que le backend)', () => {
    expect(unmetRules('Court1!', spec, ctx())).toContain('minLength');
    expect(unmetRules('Une-phrase-solide-2026', spec, ctx())).toEqual([]);
  });

  it("n'évalue rien sur un champ vide : c'est la règle « obligatoire » qui parle", () => {
    expect(unmetRules('', spec, ctx())).toEqual([]);
  });

  it.each(['password', 'Password', 'azertyuiop', 'qwertyuiop12', 'aaaaaaaaaaaa', '123456789012', 'sanjeevani2026'])('refuse le mot de passe courant ou trivial : %s', (password) => {
    expect(evaluateRule('notCommon', password, spec, ctx())).toBe(false);
  });

  it('accepte une phrase de passe qui ne ressemble à rien de connu', () => {
    expect(evaluateRule('notCommon', 'cheval-pile-agrafe-lune', spec, ctx())).toBe(true);
  });

  it("refuse un mot de passe qui contient l'identifiant ou la partie locale de l'e-mail, sans tenir compte de la casse", () => {
    const context = ctx('marie.curie', 'marie.curie@hopital.test');
    expect(evaluateRule('noIdentity', 'Xx-MARIE.CURIE-2026', spec, context)).toBe(false);
    expect(evaluateRule('noIdentity', 'cheval-pile-agrafe-lune', spec, context)).toBe(true);
  });

  it('ignore les fragments d’identité trop courts pour être significatifs', () => {
    expect(evaluateRule('noIdentity', 'abcdefghijkl-zz', spec, ctx('ab'))).toBe(true);
  });

  it('rassemble les valeurs d’identité déclarées en JSON et celles lues dans les champs voisins', () => {
    const withBoth: ValidatorSpec = { ...spec, identityValues: ['marie'], identityFields: ['username'] };
    expect(identityValuesOf(withBoth, (name) => (name === 'username' ? 'mcurie' : ''))).toEqual(['marie', 'mcurie']);
  });

  describe('force', () => {
    it('vaut 0 pour un champ vide', () => expect(strengthOf('', [])).toBe(0));
    it('ne dépasse jamais « faible » quand la politique est enfreinte', () => expect(strengthOf('Aa1!Aa1!Aa1!Aa1!Aa1!', ['notCommon'])).toBe(1));
    it('monte avec la longueur et la variété', () => {
      expect(strengthOf('cheval pile', [])).toBe(1);
      expect(strengthOf('cheval pile agrafe', [])).toBe(3);
      expect(strengthOf('Cheval-pile-agrafe-2026', [])).toBe(4);
    });
  });
});
