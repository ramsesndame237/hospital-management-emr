import { Injectable, InjectionToken, inject } from '@angular/core';
import { Translator } from '../i18n/translator';

/** Un lieu trouvé : l'adresse d'un bâtiment ou d'un quartier, jamais celle d'un patient. */
export interface Place {
  readonly label: string;
  readonly countryCode: string;
  readonly region: string;
  readonly commune: string;
  readonly street: string;
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Port de recherche de lieux (géocodage). L'écran de localisation ne connaît que ce contrat : le service par défaut est Nominatim (OpenStreetMap), mais un site
 * isolé d'Internet peut ne rien brancher et saisir la localisation à la main. Toutes les méthodes rejettent quand le service est injoignable.
 */
export abstract class Geocoder {
  /** Cherche un lieu par son nom, éventuellement restreint à un pays (code ISO). Au plus quelques résultats. */
  abstract search(query: string, countryCode?: string): Promise<readonly Place[]>;
  /** Le lieu le plus proche de ces coordonnées, ou `null`. */
  abstract reverse(latitude: number, longitude: number): Promise<Place | null>;
}

interface NominatimAddress {
  readonly [key: string]: string | undefined;
}

interface NominatimResult {
  readonly lat: string;
  readonly lon: string;
  readonly display_name?: string;
  readonly address?: NominatimAddress;
}

const first = (a: NominatimAddress, keys: readonly string[]): string => keys.map((k) => a[k]).find((v) => !!v) ?? '';

/**
 * Ramène une réponse Nominatim à un `Place`. Les noms d'unités administratives varient selon les pays (région, province, état, département ; ville, commune,
 * village, arrondissement) : on prend la première valeur disponible dans l'ordre du plus au moins précis pour la commune, du plus large au plus fin pour la région.
 */
export function parseNominatim(r: NominatimResult): Place | null {
  const a = r.address ?? {};
  const latitude = Number(r.lat);
  const longitude = Number(r.lon);
  const countryCode = (a['country_code'] ?? '').toUpperCase();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !/^[A-Z]{2}$/.test(countryCode)) return null;
  const road = first(a, ['road', 'pedestrian', 'footway', 'path', 'residential']);
  return {
    label: r.display_name ?? '',
    countryCode,
    region: first(a, ['state', 'region', 'province', 'state_district']),
    commune: first(a, ['city', 'town', 'municipality', 'village', 'city_district', 'suburb', 'county']),
    street: [a['house_number'], road].filter((p) => !!p).join(' ').trim(),
    latitude,
    longitude,
  };
}

/** Qui fournit `fetch` : le navigateur ; les tests branchent un faux. */
export const GEO_FETCH = new InjectionToken<typeof fetch>('GEO_FETCH', { providedIn: 'root', factory: () => (...args) => fetch(...args) });

const BASE = 'https://nominatim.openstreetmap.org';
/** Règle d'usage de Nominatim : au plus une requête par seconde (le serveur public est gratuit et partagé). */
const MIN_INTERVAL_MS = 1100;

/**
 * Adaptateur Nominatim (OpenStreetMap). Il respecte la règle d'usage du service public : une requête par seconde au plus (les appels se mettent en file), jamais de
 * recherche à chaque frappe (l'écran n'appelle que sur action de l'utilisateur), et le navigateur identifie l'application par l'en-tête Referer. On utilise `fetch`
 * et NON `HttpClient` : les intercepteurs de l'application ajoutent le jeton de session aux requêtes, qui ne doit JAMAIS partir vers un service tiers. Aucune donnée
 * de patient n'est jamais envoyée : seulement ce que l'utilisateur tape pour chercher un lieu, ou les coordonnées d'un clic sur la carte.
 */
@Injectable()
export class NominatimGeocoder extends Geocoder {
  private readonly run = inject(GEO_FETCH);
  private readonly i18n = inject(Translator);
  private last = 0;
  private queue: Promise<unknown> = Promise.resolve();

  override async search(query: string, countryCode?: string): Promise<readonly Place[]> {
    const text = query.trim();
    if (text.length < 2) return [];
    const params = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', limit: '6', q: text, 'accept-language': this.i18n.locale() });
    if (countryCode) params.set('countrycodes', countryCode.toLowerCase());
    const body = await this.get<NominatimResult[]>(`/search?${params.toString()}`);
    return body.map(parseNominatim).filter((p): p is Place => p !== null);
  }

  override async reverse(latitude: number, longitude: number): Promise<Place | null> {
    const params = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', zoom: '18', lat: String(latitude), lon: String(longitude), 'accept-language': this.i18n.locale() });
    const body = await this.get<NominatimResult & { error?: string }>(`/reverse?${params.toString()}`);
    return body.error ? null : parseNominatim(body);
  }

  /** Met la requête en file derrière les précédentes et l'espace d'au moins `MIN_INTERVAL_MS` de la précédente. */
  private get<T>(path: string): Promise<T> {
    const task = this.queue.then(async () => {
      const wait = this.last + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.last = Date.now();
      const response = await this.run(`${BASE}${path}`, { credentials: 'omit', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`geocoder ${response.status}`);
      return (await response.json()) as T;
    });
    // La file continue même si une requête échoue.
    this.queue = task.catch(() => undefined);
    return task;
  }
}

/** Adaptateur « hors ligne » : aucun service, la localisation se saisit à la main. */
@Injectable()
export class UnavailableGeocoder extends Geocoder {
  override search(): Promise<readonly Place[]> {
    return Promise.reject(new Error('geocoder unavailable'));
  }

  override reverse(): Promise<Place | null> {
    return Promise.reject(new Error('geocoder unavailable'));
  }
}
