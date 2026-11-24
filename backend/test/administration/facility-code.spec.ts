import { codePrefix, fold, formatCode, nameInitials, nextSequence } from '../../src/modules/administration/domain/facility-code-generator';
import { FacilityCode } from '../../src/modules/administration/domain/value-objects/facility-code';
import { FacilityLocation } from '../../src/modules/administration/domain/value-objects/facility-location';

describe('code de l’établissement composé d’après sa localisation et son nom', () => {
  describe('initiales du nom (sans les mots-outils)', () => {
    it.each([
      ['Hôpital Central de Yaoundé', 'hcy'],
      ['Clinique Annexe de Douala', 'cad'],
      ["Centre de Santé d'Étoudi", 'cse'],
    ])('%s', (name, expected) => {
      expect(nameInitials(name)).toBe(expected);
    });

    it('complète par les lettres suivantes du premier mot quand il y a moins de 3 mots significatifs', () => {
      expect(nameInitials('Hôpital Général')).toBe('hgo'); // h, g, puis « o » de « hopital »
      expect(nameInitials('Polyclinique')).toBe('pol');
      expect(nameInitials('Site 2')).toBe('s2i');
    });

    it('ne garde que 3 caractères, tous valables dans un code (minuscules ou chiffres)', () => {
      for (const name of ['Grand Hôpital Universitaire de la Capitale Nationale', 'À', '!!!', 'The Royal Hospital of London']) {
        expect(nameInitials(name)).toMatch(/^[0-9a-z]{3}$/);
      }
      expect(nameInitials('Grand Hôpital Universitaire de la Capitale Nationale')).toBe('ghu');
      expect(nameInitials('The Royal Hospital of London')).toBe('rhl');
    });
  });

  describe('début du code : pays + 2 premières lettres de la commune', () => {
    it('compose le début à partir du pays et de la commune (sans accents, en majuscules)', () => {
      expect(codePrefix('CM', 'Yaoundé')).toBe('CMYA');
      expect(codePrefix('cm', 'Édéa')).toBe('CMED');
      expect(codePrefix('FR', "L'Haÿ-les-Roses")).toBe('FRLH');
    });

    it('à défaut de commune, complète par « XX »', () => {
      expect(codePrefix('CM', null)).toBe('CMXX');
      expect(codePrefix('SN', 'A')).toBe('SNAX');
    });
  });

  describe("numéro d'ordre", () => {
    it('prend le premier numéro libre pour ce début de code, sans toucher aux autres', () => {
      const taken = ['CMYA-hcy-01', 'CMYA-hcy-02', 'CMYA-hcy-04', 'CMYA-abc-01', 'CMDO-hcy-01'];
      expect(nextSequence(taken, 'CMYA', 'hcy')).toBe(3);
      expect(nextSequence(taken, 'CMYA', 'abc')).toBe(2);
      expect(nextSequence([], 'CMYA', 'hcy')).toBe(1);
    });

    it('rend null quand les 99 numéros sont pris', () => {
      const all = Array.from({ length: 99 }, (_, i) => formatCode('CMYA', 'hcy', i + 1));
      expect(nextSequence(all, 'CMYA', 'hcy')).toBeNull();
    });
  });

  it('le code composé respecte toujours le format attendu par le domaine', () => {
    for (const [country, place, name] of [['CM', 'Yaoundé', 'Hôpital Central de Yaoundé'], ['FR', 'Paris', 'Clinique du Parc'], ['SN', null, '***'], ['CI', 'Abidjan', 'A']] as const) {
      const code = formatCode(codePrefix(country, place), nameInitials(name), 1);
      expect(FacilityCode.create(code).ok).toBe(true);
    }
    expect(formatCode('CMYA', 'hcy', 7)).toBe('CMYA-hcy-07');
  });

  it('fold retire accents et ponctuation', () => {
    expect(fold("  Hôpital d'Étoudi - Nord ")).toBe('hopital d etoudi nord');
  });
});

describe('localisation de l’établissement', () => {
  it('normalise le pays en majuscules, nettoie les textes et arrondit les coordonnées', () => {
    const r = FacilityLocation.create({ countryCode: 'cm', region: '  Centre ', commune: 'Yaoundé', street: ' Avenue   Kennedy ', latitude: 3.8480001234, longitude: 11.5021 });
    expect(r.ok && r.value.state).toEqual({ countryCode: 'CM', region: 'Centre', commune: 'Yaoundé', street: 'Avenue Kennedy', latitude: 3.848, longitude: 11.5021 });
  });

  it('seul le pays est obligatoire ; un texte vide devient « absent »', () => {
    const r = FacilityLocation.create({ countryCode: 'CM', region: '   ', commune: '' });
    expect(r.ok && r.value.state).toMatchObject({ region: null, commune: null, street: null, latitude: null, longitude: null });
  });

  it.each([
    [{ countryCode: 'CMR' }], [{ countryCode: '' }], [{ countryCode: '1A' }], [{ countryCode: 'CM', latitude: 3.8 }], [{ countryCode: 'CM', longitude: 11.5 }],
    [{ countryCode: 'CM', latitude: 95, longitude: 11 }], [{ countryCode: 'CM', latitude: 3, longitude: 200 }], [{ countryCode: 'CM', commune: 'x'.repeat(121) }], [{ countryCode: 'CM', latitude: Number.NaN, longitude: 1 }],
  ])('refuse %j', (input) => {
    const r = FacilityLocation.create(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FACILITY_LOCATION_INVALID');
  });
});
