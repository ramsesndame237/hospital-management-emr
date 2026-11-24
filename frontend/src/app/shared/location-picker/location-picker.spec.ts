import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Geocoder, Place } from '../../core/geo/geocoder';
import { configureApp, settle } from '../../testing/app-testing';
import { LocationPicker, LocationValue, MAP_FACTORY, MapHandle } from './location-picker';

const PLACE: Place = { label: 'Yaoundé, Centre', countryCode: 'CM', region: 'Centre', commune: 'Yaoundé', street: 'Avenue Kennedy', latitude: 3.848, longitude: 11.502 };

@Component({ imports: [LocationPicker], template: '<app-location-picker (changed)="seen.push($event)" />' })
class Host {
  readonly seen: (LocationValue | null)[] = [];
}

describe('LocationPicker', () => {
  let fixture: ComponentFixture<Host>;
  let geocoder: { search: ReturnType<typeof vi.fn>; reverse: ReturnType<typeof vi.fn> };
  let map: MapHandle;
  let clicked: ((lat: number, lng: number) => void) | undefined;
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => root().querySelector<T>(s)!;

  async function setup() {
    geocoder = { search: vi.fn().mockResolvedValue([PLACE]), reverse: vi.fn().mockResolvedValue(PLACE) };
    map = { setView: vi.fn(), setMarker: vi.fn(), onClick: (h) => { clicked = h; }, destroy: vi.fn() };
    configureApp({ providers: [{ provide: Geocoder, useValue: geocoder }, { provide: MAP_FACTORY, useValue: async () => map }] });
    fixture = TestBed.createComponent(Host);
    await settle(fixture);
  }

  async function selectCountry(code: string) {
    const select = q<HTMLSelectElement>('select');
    select.value = code;
    select.dispatchEvent(new Event('change'));
    await settle(fixture);
  }

  it('émet la localisation dès que le pays est choisi, et null quand il est retiré', async () => {
    await setup();
    await selectCountry('CM');
    expect(fixture.componentInstance.seen.at(-1)).toMatchObject({ countryCode: 'CM', commune: '' });
    await selectCountry('');
    expect(fixture.componentInstance.seen.at(-1)).toBeNull();
  });

  it('remplit région, commune, rue et coordonnées depuis un lieu trouvé, et place le point sur la carte', async () => {
    await setup();
    q<HTMLInputElement>('input[type=search]').value = 'Hôpital Central';
    q<HTMLButtonElement>('button').click();
    await settle(fixture);
    expect(geocoder.search).toHaveBeenCalledWith('Hôpital Central', undefined);
    root().querySelectorAll<HTMLButtonElement>('li button')[0].click();
    await settle(fixture);
    expect(fixture.componentInstance.seen.at(-1)).toEqual({ countryCode: 'CM', region: 'Centre', commune: 'Yaoundé', street: 'Avenue Kennedy', latitude: 3.848, longitude: 11.502 });
    expect(map.setMarker).toHaveBeenCalledWith(3.848, 11.502);
  });

  it('un clic sur la carte cherche l’adresse ; si le service tombe, garde les coordonnées et prévient', async () => {
    await setup();
    await selectCountry('CM');
    geocoder.reverse.mockRejectedValue(new Error('down'));
    clicked!(3.8, 11.5);
    await settle(fixture);
    expect(fixture.componentInstance.seen.at(-1)).toMatchObject({ countryCode: 'CM', latitude: 3.8, longitude: 11.5 });
    expect(root().textContent).toContain('injoignable');
  });

  it('la saisie manuelle fonctionne sans service de recherche', async () => {
    await setup();
    await selectCountry('CM');
    const commune = root().querySelectorAll<HTMLInputElement>('input[type=text]')[1];
    commune.value = 'Douala';
    commune.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(fixture.componentInstance.seen.at(-1)).toMatchObject({ countryCode: 'CM', commune: 'Douala' });
  });
});
