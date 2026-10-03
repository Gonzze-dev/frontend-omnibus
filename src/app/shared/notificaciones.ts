import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RealtimeService } from '../services/realtime.service';
import {
  AvisoAdmin,
  DemoraColectivo,
  LlegadaColectivo,
  NotificacionPasajero,
} from '../models/viaje.model';

export type TipoNotificacion = 'retraso' | 'llegada' | 'servicio';

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  detalle: string;
  /** Epoch ms en que deja de mostrarse. */
  vence: number;
}

/** Ids que el usuario limpio, para que el reenvio del hub no los traiga de vuelta. */
const DESCARTADAS_KEY = 'notificaciones_descartadas';
const REVISAR_VENCIDAS_MS = 30_000;

/**
 * Mantiene la lista en un solo lugar para que el contador de la campana
 * y la pantalla de notificaciones no se contradigan.
 *
 * Se llena con lo que llega por realtime. El hub reenvia las guardadas al
 * unirse a un grupo (y al reconectar), asi que se deduplica por id.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesStore {
  private readonly realtime = inject(RealtimeService);

  private readonly _lista = signal<Notificacion[]>([]);
  private readonly descartadas = leerDescartadas();

  readonly lista = this._lista.asReadonly();
  readonly cantidad = computed(() => this._lista().length);

  constructor() {
    this.realtime.recibidas$
      .pipe(takeUntilDestroyed())
      .subscribe((msg) => this.agregar(msg));
    this.realtime.eliminadas$
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.quitar(id));

    const timer = setInterval(() => this.quitarVencidas(), REVISAR_VENCIDAS_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // Los avisos globales llegan aunque el usuario no este esperando un viaje.
    this.realtime.iniciar().catch(() => {
      // Sin realtime la lista queda vacia; se reintenta al seguir un viaje
    });
  }

  limpiar(): void {
    for (const n of this._lista()) {
      this.descartadas.set(n.id, n.vence);
    }
    guardarDescartadas(this.descartadas);
    this._lista.set([]);
  }

  private agregar(msg: NotificacionPasajero): void {
    const nueva = aNotificacion(msg);
    if (!nueva || nueva.vence <= Date.now() || this.descartadas.has(nueva.id)) return;

    this._lista.update((lista) =>
      lista.some((n) => n.id === nueva.id) ? lista : [nueva, ...lista],
    );
  }

  private quitar(id: string): void {
    this._lista.update((lista) => lista.filter((n) => n.id !== id));
  }

  private quitarVencidas(): void {
    const ahora = Date.now();
    if (this._lista().some((n) => n.vence <= ahora)) {
      this._lista.update((lista) => lista.filter((n) => n.vence > ahora));
    }
  }
}

/**
 * Traduce el mensaje del hub a lo que muestra la pantalla. Devuelve null para
 * los tipos que no son para el pasajero (CAMERA va a los admins).
 *
 * El payload trae `time_life` en minutos pero no la fecha de envio, asi que el
 * vencimiento se cuenta desde que llega. Para una reenviada es aproximado; el
 * hub igual nunca reenvia las que ya vencieron en la base.
 */
function aNotificacion(msg: NotificacionPasajero): Notificacion | null {
  const payload = msg.payload as { id?: string; time_life?: number } | null;
  if (!payload?.id) return null;

  const vence = Date.now() + (payload.time_life ?? 0) * 60_000;
  const base = { id: payload.id, vence };

  switch (msg.type) {
    case 'BUS_ARRIVAL': {
      const p = payload as LlegadaColectivo;
      return {
        ...base,
        tipo: 'llegada',
        titulo: 'Tu colectivo acaba de llegar',
        detalle: `Esta en la plataforma ${p.anden}.`,
      };
    }
    case 'BUS_DELAY': {
      const p = payload as DemoraColectivo;
      return {
        ...base,
        tipo: 'retraso',
        titulo: 'Alerta de retraso',
        detalle: `Su colectivo esta retrasado unos ${p.time_delay} minutos aproximadamente.`,
      };
    }
    case 'LOCAL':
    case 'GLOBAL': {
      const p = payload as AvisoAdmin;
      const detalle = p.message?.trim();
      if (!detalle) return null;
      return {
        ...base,
        tipo: 'servicio',
        titulo: p.title?.trim() || (msg.type === 'LOCAL' ? 'Aviso de la terminal' : 'Aviso general'),
        detalle,
      };
    }
    default:
      return null;
  }
}

function leerDescartadas(): Map<string, number> {
  const ahora = Date.now();
  try {
    const guardadas = JSON.parse(localStorage.getItem(DESCARTADAS_KEY) ?? '{}') as Record<string, number>;
    // Las vencidas ya no las reenvia el hub: no hace falta recordarlas.
    return new Map(Object.entries(guardadas).filter(([, vence]) => vence > ahora));
  } catch {
    return new Map();
  }
}

function guardarDescartadas(descartadas: Map<string, number>): void {
  try {
    localStorage.setItem(DESCARTADAS_KEY, JSON.stringify(Object.fromEntries(descartadas)));
  } catch {
    // Sin storage, lo limpiado puede volver a aparecer al recargar
  }
}
