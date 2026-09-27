import { Injectable, computed, signal } from '@angular/core';

export type TipoNotificacion = 'retraso' | 'llegada' | 'servicio';

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  titulo: string;
  detalle: string;
}

/**
 * Datos de ejemplo, tal como estan en el mockup.
 * Cuando exista el backend, esto se reemplaza por la respuesta del
 * endpoint; el resto de la pantalla no necesita cambiar.
 */
export const NOTIFICACIONES: readonly Notificacion[] = [
  {
    id: 1,
    tipo: 'retraso',
    titulo: 'Alerta de restraso',
    detalle: 'Su colectivo esta retrasado unos 25 minutos aproximadamente',
  },
  {
    id: 2,
    tipo: 'llegada',
    titulo: 'Tu colectivo acaba de llegar',
    detalle: 'Su colectivo esta retrasado unos 25 minutos aproximadamente',
  },
  {
    id: 3,
    tipo: 'servicio',
    titulo: 'Application fuera de servicio',
    detalle: 'La aplicacion estara fuera de servicio de 6 AM a 7 AM',
  },
];

/**
 * Mantiene la lista en un solo lugar para que el contador de la campana
 * y la pantalla de notificaciones no se contradigan.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesStore {
  private readonly _lista = signal<Notificacion[]>([...NOTIFICACIONES]);

  readonly lista = this._lista.asReadonly();
  readonly cantidad = computed(() => this._lista().length);

  limpiar(): void {
    this._lista.set([]);
  }
}
