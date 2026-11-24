import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';

export interface FacilityLocationInput {
  readonly countryCode?: string | null;
  readonly region?: string | null;
  readonly commune?: string | null;
  readonly street?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
}

export interface FacilityLocationState {
  /** Code pays ISO 3166-1 alpha-2, en majuscules (ex. `CM`). */
  readonly countryCode: string;
  /** Région, province, département… (selon le pays). */
  readonly region: string | null;
  /** Commune, ville ou arrondissement. */
  readonly commune: string | null;
  /** Rue et numéro. */
  readonly street: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

const INVALID = (reason: string, field?: string) => new DomainError('FACILITY_LOCATION_INVALID', `Localisation invalide : ${reason}`, { field: field ?? '' });

const text = (raw: string | null | undefined, max: number, field: string): Result<string | null> => {
  const value = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (value === '') return ok(null);
  return value.length <= max ? ok(value) : err(INVALID(`« ${field} » ne doit pas dépasser ${max} caractères.`, field));
};

/**
 * Où se trouve l'établissement : le pays (obligatoire), puis, de plus en plus précis, la région, la commune et la rue, et les coordonnées GPS quand on les connaît.
 * C'est elle qui sert à composer le code de l'établissement. Rien ici ne concerne un patient : c'est l'adresse d'un bâtiment.
 */
export class FacilityLocation {
  private constructor(private readonly s: FacilityLocationState) {}

  static create(input: FacilityLocationInput): Result<FacilityLocation> {
    const country = String(input.countryCode ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) return err(INVALID('le pays doit être un code ISO de 2 lettres (ex. CM).', 'countryCode'));
    const region = text(input.region, 120, 'région');
    if (!region.ok) return err(region.error);
    const commune = text(input.commune, 120, 'commune');
    if (!commune.ok) return err(commune.error);
    const street = text(input.street, 200, 'rue');
    if (!street.ok) return err(street.error);
    const hasLat = input.latitude !== undefined && input.latitude !== null;
    const hasLng = input.longitude !== undefined && input.longitude !== null;
    if (hasLat !== hasLng) return err(INVALID('latitude et longitude vont ensemble.', 'latitude'));
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (hasLat && hasLng) {
      latitude = Number(input.latitude);
      longitude = Number(input.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return err(INVALID('latitude entre -90 et 90.', 'latitude'));
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return err(INVALID('longitude entre -180 et 180.', 'longitude'));
      // Six décimales (≈ 10 cm) suffisent largement pour un bâtiment.
      latitude = Math.round(latitude * 1e6) / 1e6;
      longitude = Math.round(longitude * 1e6) / 1e6;
    }
    return ok(new FacilityLocation({ countryCode: country, region: region.value, commune: commune.value, street: street.value, latitude, longitude }));
  }

  /** Reconstitution depuis la base (déjà validé). */
  static restore(state: FacilityLocationState): FacilityLocation {
    return new FacilityLocation(state);
  }

  get state(): FacilityLocationState {
    return this.s;
  }

  equals(other: FacilityLocation | null): boolean {
    if (!other) return false;
    const a = this.s;
    const b = other.s;
    return a.countryCode === b.countryCode && a.region === b.region && a.commune === b.commune && a.street === b.street && a.latitude === b.latitude && a.longitude === b.longitude;
  }
}
