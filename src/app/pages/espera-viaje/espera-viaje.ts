import { AfterViewInit, Component, ElementRef, OnDestroy, output, viewChild } from '@angular/core';
import * as L from 'leaflet';

/** Coordenadas de la terminal de Gualeguaychu (placeholder hasta que llegue del backend). */
const PLATAFORMA: L.LatLngTuple = [-33.0089, -58.5236];

@Component({
  selector: 'app-espera-viaje',
  templateUrl: './espera-viaje.html',
  styleUrl: './espera-viaje.scss',
})
export class EsperaViaje implements AfterViewInit, OnDestroy {
  /** Devuelve el home a su estado de busqueda. */
  readonly buscarOtro = output<void>();

  private readonly mapaRef = viewChild.required<ElementRef<HTMLElement>>('mapa');
  private mapa?: L.Map;
  private observer?: ResizeObserver;

  /** Datos de muestra: cuando exista la API se reemplazan por un input(). */
  protected readonly viaje = {
    plataforma: 'A27',
    empresa: 'Flecha Bus',
    patente: 'GDMKD MFDKFV AF 122 A2',
    pasajero: 'Gonzalo Errandonea',
    dni: '12141210',
    codigo: 'FLE-002-2026',
    asiento: '27 - ARRIBA',
  };

  ngAfterViewInit(): void {
    this.mapa = L.map(this.mapaRef().nativeElement, {
      center: PLATAFORMA,
      zoom: 16,
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
    L.marker(PLATAFORMA, {
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
      .bindTooltip(`Plataforma ${this.viaje.plataforma}`, {
        permanent: true,
        direction: 'top',
        offset: [0, -18],
        className: 'mapa__label',
      });

    // Si la card cambia de tamaño (rotacion, breakpoint) Leaflet necesita
    // recalcular o quedan tiles sin pedir.
    this.observer = new ResizeObserver(() => this.mapa?.invalidateSize());
    this.observer.observe(this.mapaRef().nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.mapa?.remove();
  }

  protected verEnMapa(): void {
    this.mapa?.flyTo(PLATAFORMA, 17);
  }
}
