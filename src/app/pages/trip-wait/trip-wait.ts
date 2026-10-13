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
import { Coordenadas, ViajeEsperado } from '../../models/viaje.model';

@Component({
  selector: 'app-espera-viaje',
  imports: [DatePipe],
  templateUrl: './espera-viaje.html',
  styleUrl: './espera-viaje.scss',
})
export class EsperaViaje {
  readonly viaje = input.required<ViajeEsperado>();
  /** Devuelve el home a su estado de busqueda. */
  readonly buscarOtro = output<void>();

  private readonly realtime = inject(RealtimeService);
  protected readonly conectado = this.realtime.conectado;
  protected readonly llegada = this.realtime.llegada;
  protected readonly demora = this.realtime.demora;

  /** Coordenadas de la plataforma donde esta el colectivo (solo tras la llegada). */
  protected readonly posicion = computed<Coordenadas | null>(() => {
    const c = this.llegada()?.coordinates;
    return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? c : null;
  });

  protected readonly mapsUrl = computed(() => {
    const p = this.posicion();
    return p ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : null;
  });

  /** Ciudades del recorrido en orden, para mostrarlas como "A → B → C". */
  protected readonly recorrido = computed(() =>
    [...this.viaje().trip.trip_city]
      .sort((a, b) => a.order - b.order)
      .map((c) => c.city_name)
      .join(' → '),
  );

  private readonly mapaRef = viewChild<ElementRef<HTMLElement>>('mapa');
  private mapa?: L.Map;
  private pin?: L.Marker;
  private observer?: ResizeObserver;

  constructor() {
    // El contenedor del mapa solo existe cuando llega el colectivo, por eso
    // el mapa se crea despues del render y no en ngAfterViewInit.
    afterRenderEffect(() => {
      const el = this.mapaRef()?.nativeElement;
      const pos = this.posicion();
      const anden = this.llegada()?.anden ?? '';

      if (!el || !pos) {
        this.destruirMapa();
        return;
      }

      const punto: L.LatLngTuple = [pos.lat, pos.lng];
      if (this.mapa && this.mapa.getContainer() === el) {
        this.pin?.setLatLng(punto).setTooltipContent(`Plataforma ${anden}`);
        this.mapa.setView(punto, this.mapa.getZoom());
        return;
      }

      this.destruirMapa();
      this.crearMapa(el, punto, anden);
    });

    inject(DestroyRef).onDestroy(() => this.destruirMapa());
  }

  protected verEnMapa(): void {
    const pos = this.posicion();
    if (pos) this.mapa?.flyTo([pos.lat, pos.lng], 18);
  }

  private crearMapa(el: HTMLElement, punto: L.LatLngTuple, anden: string): void {
    this.mapa = L.map(el, {
      center: punto,
      zoom: 18,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    // La atribucion es obligatoria por la politica de uso de tiles de OSM.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.mapa);

    this.mapa.attributionControl.setPrefix(false);

    // Chapa azul con el icono del colectivo, como en el mockup.
    this.pin = L.marker(punto, {
      icon: L.divIcon({
        className: 'mapa__pin-wrap',
        html: `<span class="mapa__pin" aria-hidden="true">
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
      .addTo(this.mapa)
      .bindTooltip(`Plataforma ${anden}`, {
        permanent: true,
        direction: 'top',
        offset: [0, -18],
        className: 'mapa__label',
      });

    // Si la card cambia de tamaño (rotacion, breakpoint) Leaflet necesita
    // recalcular o quedan tiles sin pedir.
    this.observer = new ResizeObserver(() => this.mapa?.invalidateSize());
    this.observer.observe(el);
  }

  private destruirMapa(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.mapa?.remove();
    this.mapa = undefined;
    this.pin = undefined;
  }
}
