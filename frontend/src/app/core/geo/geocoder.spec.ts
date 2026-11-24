import { TestBed } from '@angular/core/testing';
import { configureApp } from '../../testing/app-testing';
import { GEO_FETCH, Geocoder, NominatimGeocoder, parseNominatim } from './geocoder';

const yaounde = {
  lat: '3.8480', lon: '11.5021', display_name: 'Avenue Kennedy, Yaoundé, Centre, Cameroun',
  address: { road: 'Avenue Kennedy', house_number: '12', city: 'Yaoundé', state: 'Centre', country_code: 'cm' },
};

describe('parseNominatim', () => {
  it('ramène une réponse à une localisation (pays en majuscules, rue avec numéro)', () => {
    expect(parseNominatim(yaounde)).toEqual({
      label: 'Avenue Kennedy, Yaoundé, Centre, Cameroun', countryCode: 'CM', region: 'Centre', commune: 'Yaoundé', street: '12 Avenue Kennedy', latitude: 3.848, longitude: 11.5021,
    });
  });

  it('prend le village à défaut de ville, la province à défaut d’état', () => {
    const p = parseNominatim({ lat: '1', lon: '2', address: { village: 'Bandjoun', province: 'Ouest', country_code: 'cm' } });
    expect(p).toMatchObject({ commune: 'Bandjoun', region: 'Ouest', street: '' });
  });

  it('écarte une réponse sans pays ou aux coordonnées invalides', () => {
    expect(parseNominatim({ lat: '1', lon: '2', address: {} })).toBeNull();
    expect(parseNominatim({ lat: 'x', lon: '2', address: { country_code: 'cm' } })).toBeNull();
  });
});

describe('NominatimGeocoder', () => {
  function setup(body: unknown, ok = true) {
    const run = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 503, json: () => Promise.resolve(body) });
    configureApp({ providers: [{ provide: GEO_FETCH, useValue: run }, { provide: Geocoder, useClass: NominatimGeocoder }] });
    return { geocoder: TestBed.inject(Geocoder), run };
  }

  it('cherche un lieu dans le pays choisi, sans jeton de session ni cookies', async () => {
    const { geocoder, run } = setup([yaounde]);
    const places = await geocoder.search('Hôpital Central', 'CM');
    expect(places).toHaveLength(1);
    const [url, init] = run.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
    expect(url).toContain('countrycodes=cm');
    expect(init.credentials).toBe('omit');
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i);
  });

  it('ne cherche pas moins de deux caractères', async () => {
    const { geocoder, run } = setup([]);
    expect(await geocoder.search(' a ')).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('rejette quand le service répond en erreur', async () => {
    const { geocoder } = setup({}, false);
    await expect(geocoder.search('Yaoundé')).rejects.toThrow('geocoder 503');
  });

  it('rend null quand aucun lieu ne correspond aux coordonnées', async () => {
    const { geocoder } = setup({ error: 'Unable to geocode' });
    expect(await geocoder.reverse(0, 0)).toBeNull();
  });
});
