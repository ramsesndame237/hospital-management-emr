import { ChangeDetectionStrategy, Component, ElementRef, InjectionToken, OnDestroy, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild, ViewEncapsulation } from '@angular/core';
import { countryOptions } from '../../core/geo/countries';
import { Geocoder, Place } from '../../core/geo/geocoder';
import { Translator } from '../../core/i18n/translator';

/** La localisation choisie : le pays (code ISO) d'abord, puis, de plus en plus précis, la région, la commune, la rue et les coordonnées. */
export interface LocationValue {
  readonly countryCode: string;
  readonly region: string;
  readonly commune: string;
  readonly street: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

/** Le sous-ensemble de Leaflet dont on se sert : permet de charger la bibliothèque à la demande et de la remplacer dans les tests. */
export interface MapHandle {
  setView(latitude: number, longitude: number, zoom: number): void;
  setMarker(latitude: number, longitude: number): void;
  onClick(handler: (latitude: number, longitude: number) => void): void;
  destroy(): void;
}

export type MapFactory = (container: HTMLElement) => Promise<MapHandle>;

/** Fabrique de carte : Leaflet est chargé seulement quand le sélecteur s'affiche (il n'alourdit ni la connexion ni les autres écrans). */
export const MAP_FACTORY = new InjectionToken<MapFactory>('MAP_FACTORY', {
  providedIn: 'root',
  factory: () => async (container: HTMLElement): Promise<MapHandle> => {
    const L = await import('leaflet');
    const map = L.map(container, { zoomControl: true }).setView([3.85, 11.5], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    let marker: import('leaflet').CircleMarker | null = null;
    return {
      setView: (lat, lng, zoom) => map.setView([lat, lng], zoom),
      setMarker: (lat, lng) => {
        // Un cercle plutôt qu'une épingle : aucune image à charger.
        if (marker) marker.setLatLng([lat, lng]);
        else marker = L.circleMarker([lat, lng], { radius: 9, weight: 3, color: '#0b5cad', fillColor: '#0b5cad', fillOpacity: 0.35 }).addTo(map);
      },
      onClick: (handler) => map.on('click', (event) => handler(event.latlng.lat, event.latlng.lng)),
      destroy: () => map.remove(),
    };
  },
});

const EMPTY: LocationValue = { countryCode: '', region: '', commune: '', street: '', latitude: null, longitude: null };
const INPUT = 'h-11 w-full rounded-[2px] border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Choix de la localisation d'un site : le pays, puis une recherche de lieu (Nominatim / OpenStreetMap) ou un clic sur la carte (Leaflet) qui remplissent la région,
 * la commune, la rue et les coordonnées. Chaque champ reste modifiable à la main : sans accès Internet (ou si le service ne répond pas), on saisit simplement la localisation.
 * Ne sert qu'à décrire l'adresse d'un bâtiment : aucune donnée de patient ne passe par ici.
 */
@Component({
  selector: 'app-location-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: '../../../../node_modules/leaflet/dist/leaflet.css',
  template: `
    <fieldset class="flex flex-col gap-4 border border-border p-4">
      <legend class="px-1 text-sm leading-6 font-semibold text-foreground">{{ i18n.t('location.title') }}</legend>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('location.country') }} *</span>
        <select class="${INPUT}" [value]="value().countryCode" (change)="setCountry($any($event.target).value)" [attr.aria-label]="i18n.t('location.country')">
          <option value="">{{ i18n.t('location.chooseCountry') }}</option>
          @for (c of countries(); track c.code) {
            <option [value]="c.code" [selected]="c.code === value().countryCode">{{ c.name }}</option>
          }
        </select>
      </label>

      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-end gap-2">
          <label class="flex min-w-60 flex-1 flex-col gap-1 text-sm">
            <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('location.search') }}</span>
            <input #searchBox type="search" class="${INPUT}" [placeholder]="i18n.t('location.searchPlaceholder')" (keydown.enter)="$event.preventDefault(); search(searchBox.value)" />
          </label>
          <button type="button" class="h-11 rounded-[2px] border border-border px-4 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50" [disabled]="searching()" (click)="search(searchBox.value)">
            {{ i18n.t(searching() ? 'location.searching' : 'location.searchButton') }}
          </button>
        </div>
        @if (searchError()) {
          <p class="text-sm leading-6 text-status-warning" role="status">{{ i18n.t('location.unavailable') }}</p>
        }
        @if (results().length > 0) {
          <ul class="flex flex-col border border-border" [attr.aria-label]="i18n.t('location.results')">
            @for (place of results(); track place.latitude + ',' + place.longitude) {
              <li class="border-b border-border last:border-b-0">
                <button type="button" class="w-full px-3 py-2 text-left text-sm leading-6 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" (click)="choose(place)">{{ place.label }}</button>
              </li>
            }
          </ul>
        } @else if (searched() && !searchError()) {
          <p class="text-sm leading-6 text-muted-foreground" role="status">{{ i18n.t('location.noResult') }}</p>
        }
      </div>

      <div class="flex flex-col gap-1">
        <div #mapBox class="h-64 w-full border border-border bg-muted" role="application" [attr.aria-label]="i18n.t('location.map')"></div>
        <p class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('location.mapHint') }}</p>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('location.region') }}</span>
          <input type="text" class="${INPUT}" [value]="value().region" maxlength="120" (input)="patch({ region: $any($event.target).value })" />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('location.commune') }}</span>
          <input type="text" class="${INPUT}" [value]="value().commune" maxlength="120" (input)="patch({ commune: $any($event.target).value })" />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('location.street') }}</span>
          <input type="text" class="${INPUT}" [value]="value().street" maxlength="200" (input)="patch({ street: $any($event.target).value })" />
        </label>
      </div>
      @if (coordinates(); as c) {
        <p class="font-mono text-xs leading-[18px] text-muted-foreground">{{ c }}</p>
      }
    </fieldset>
  `,
})
export class LocationPicker implements OnDestroy {
  protected readonly i18n = inject(Translator);
  private readonly geocoder = inject(Geocoder);
  private readonly mapFactory = inject(MAP_FACTORY);
  private readonly mapBox = viewChild.required<ElementRef<HTMLElement>>('mapBox');

  /** Localisation de départ (modification d'un site existant) ; lue une seule fois. */
  readonly initial = input<LocationValue | null>(null);
  /** Émis à chaque changement : `null` tant que le pays n'est pas choisi. */
  readonly changed = output<LocationValue | null>();

  protected readonly value = signal<LocationValue>(EMPTY);
  protected readonly results = signal<readonly Place[]>([]);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly searchError = signal(false);
  protected readonly countries = computed(() => countryOptions(this.i18n.locale()));
  protected readonly coordinates = computed(() => {
    const v = this.value();
    return v.latitude === null || v.longitude === null ? '' : `${v.latitude.toFixed(6)}, ${v.longitude.toFixed(6)}`;
  });

  private map: MapHandle | null = null;
  private destroyed = false;
  private seeded = false;

  constructor() {
    effect(() => {
      const initial = this.initial();
      if (initial && !this.seeded) {
        this.seeded = true;
        untracked(() => this.value.set({ ...EMPTY, ...initial }));
      }
    });
    afterNextRender(() => void this.startMap());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.map?.destroy();
  }

  private async startMap(): Promise<void> {
    try {
      const map = await this.mapFactory(this.mapBox().nativeElement);
      if (this.destroyed) {
        map.destroy();
        return;
      }
      this.map = map;
      map.onClick((lat, lng) => void this.pick(lat, lng));
      this.showOnMap(this.value());
    } catch {
      // Pas de carte (hors ligne, bibliothèque non chargée) : la saisie manuelle suffit.
    }
  }

  private showOnMap(v: LocationValue): void {
    if (this.map && v.latitude !== null && v.longitude !== null) {
      this.map.setView(v.latitude, v.longitude, 14);
      this.map.setMarker(v.latitude, v.longitude);
    }
  }

  private update(next: LocationValue): void {
    this.value.set(next);
    this.changed.emit(next.countryCode ? next : null);
  }

  protected setCountry(code: string): void {
    this.results.set([]);
    this.searched.set(false);
    // Changer de pays rend caduque une adresse d'un autre pays : on repart de zéro.
    this.update({ ...EMPTY, countryCode: code });
  }

  protected patch(part: Partial<LocationValue>): void {
    this.update({ ...this.value(), ...part });
  }

  protected async search(query: string): Promise<void> {
    if (query.trim().length < 2) return;
    this.searching.set(true);
    this.searchError.set(false);
    try {
      this.results.set(await this.geocoder.search(query, this.value().countryCode || undefined));
      this.searched.set(true);
    } catch {
      this.results.set([]);
      this.searchError.set(true);
    } finally {
      this.searching.set(false);
    }
  }

  protected choose(place: Place): void {
    this.results.set([]);
    this.searched.set(false);
    const next: LocationValue = { countryCode: place.countryCode, region: place.region, commune: place.commune, street: place.street, latitude: place.latitude, longitude: place.longitude };
    this.update(next);
    this.showOnMap(next);
  }

  /** Clic sur la carte : on garde le point, et on cherche l'adresse correspondante pour remplir les champs (sans elle, les coordonnées seules sont gardées). */
  private async pick(latitude: number, longitude: number): Promise<void> {
    this.map?.setMarker(latitude, longitude);
    const at = { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 };
    this.searchError.set(false);
    try {
      const place = await this.geocoder.reverse(latitude, longitude);
      if (place) this.update({ countryCode: place.countryCode, region: place.region, commune: place.commune, street: place.street, ...at });
      else this.update({ ...this.value(), ...at });
    } catch {
      this.searchError.set(true);
      this.update({ ...this.value(), ...at });
    }
  }
}
