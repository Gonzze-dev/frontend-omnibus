import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import * as L from 'leaflet';
import { RealtimeService } from '../../services/realtime.service';
import { AwaitedTrip, Coordinates } from '../../models/trip.model';

@Component({
  selector: 'app-trip-wait',
  imports: [DatePipe],
  templateUrl: './trip-wait.html',
  styleUrl: './trip-wait.scss',
})
export class TripWait {
  readonly trip = input.required<AwaitedTrip>();
  /** Takes the home back to its search state. */
  readonly searchAnother = output<void>();

  private readonly realtime = inject(RealtimeService);
  protected readonly connected = this.realtime.connected;
  protected readonly arrival = this.realtime.arrival;
  protected readonly delay = this.realtime.delay;

  /** Coordinates of the platform where the bus is (only after the arrival). */
  protected readonly position = computed<Coordinates | null>(() => {
    const c = this.arrival()?.coordinates;
    return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? c : null;
  });

  protected readonly mapsUrl = computed(() => {
    const p = this.position();
    return p ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : null;
  });

  /** Route cities in order, shown as "A → B → C". */
  protected readonly route = computed(() =>
    [...this.trip().trip.trip_city]
      .sort((a, b) => a.order - b.order)
      .map((c) => c.city_name)
      .join(' → '),
  );

  private readonly mapRef = viewChild<ElementRef<HTMLElement>>('map');
  private map?: L.Map;
  private pin?: L.Marker;
  private observer?: ResizeObserver;

  constructor() {
    // The map container only exists when the bus arrives, which is why
    // the map is created after rendering and not in ngAfterViewInit.
    afterRenderEffect(() => {
      const el = this.mapRef()?.nativeElement;
      const pos = this.position();
      const bay = this.arrival()?.bay ?? '';

      if (!el || !pos) {
        this.destroyMap();
        return;
      }

      const point: L.LatLngTuple = [pos.lat, pos.lng];
      if (this.map && this.map.getContainer() === el) {
        this.pin?.setLatLng(point).setTooltipContent(`Plataforma ${bay}`);
        this.map.setView(point, this.map.getZoom());
        return;
      }

      this.destroyMap();
      this.createMap(el, point, bay);
    });

    inject(DestroyRef).onDestroy(() => this.destroyMap());
  }

  protected showOnMap(): void {
    const pos = this.position();
    if (pos) this.map?.flyTo([pos.lat, pos.lng], 18);
  }

  private createMap(el: HTMLElement, point: L.LatLngTuple, bay: string): void {
    this.map = L.map(el, {
      center: point,
      zoom: 18,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    // Attribution is mandatory under the OSM tile usage policy.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);

    this.map.attributionControl.setPrefix(false);

    // Blue badge with the bus icon, as in the mockup.
    this.pin = L.marker(point, {
      icon: L.divIcon({
        className: 'map__pin-wrap',
        html: `<span class="map__pin" aria-hidden="true">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                   <rect x="4" y="3" width="16" height="14" rx="3" fill="#FFFFFF"/>
                   <path d="M5 8h14" stroke="#1D4ED8" stroke-width="1.6"/>
                   <circle cx="8" cy="19" r="2" fill="#FFFFFF"/>
                   <circle cx="16" cy="19" r="2" fill="#FFFFFF"/>
                 </svg>
               </span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
      keyboard: false,
    })
      .addTo(this.map)
      .bindTooltip(`Plataforma ${bay}`, {
        permanent: true,
        direction: 'top',
        offset: [0, -18],
        className: 'map__label',
      });

    // If the card changes size (rotation, breakpoint) Leaflet needs to
    // recompute or some tiles are never requested.
    this.observer = new ResizeObserver(() => this.map?.invalidateSize());
    this.observer.observe(el);
  }

  private destroyMap(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.map?.remove();
    this.map = undefined;
    this.pin = undefined;
  }
}
