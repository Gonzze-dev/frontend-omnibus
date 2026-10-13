import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';
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

/**
 * Ids que el usuario limpio, para que el reenvio del hub no los traiga de vuelta.
 * Va una clave por cuenta: si no, limpiar en una cuenta las ocultaba en todas
 * las que se usen en el mismo navegador.
 */
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
  private readonly auth = inject(AuthService);

  /**
   * Todo lo recibido, sin filtrar por cuenta. La conexion al hub sobrevive al
   * cambio de sesion y no se reenvian las guardadas, asi que no se puede vaciar
   * al cambiar de cuenta: se filtra con las descartadas de la cuenta actual.
   */
  private readonly _recibidas = signal<Notificacion[]>([]);
  /** Descartadas por cuenta, cacheadas para no releer localStorage en cada calculo. */
  private readonly _descartadas = signal(new Map<string, Map<string, number>>());

  private readonly claveCuenta = computed(() => descartadasKey(this.auth.user()?.uuid));
  private readonly descartadas = computed(
    () => this._descartadas().get(this.claveCuenta()) ?? leerDescartadas(this.claveCuenta()),
  );

  readonly lista = computed(() => {
    const descartadas = this.descartadas();
    return this._recibidas().filter((n) => !descartadas.has(n.id));
  });
  readonly cantidad = computed(() => this.lista().length);

  constructor() {
    podarDescartadas();

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

  /** Limpia solo para la cuenta con sesion iniciada. */
  limpiar(): void {
    const clave = this.claveCuenta();
    const descartadas = new Map(this.descartadas());
    for (const n of this.lista()) {
      descartadas.set(n.id, n.vence);
    }
    guardarDescartadas(clave, descartadas);
    this._descartadas.update((porCuenta) => new Map(porCuenta).set(clave, descartadas));
  }

  private agregar(msg: NotificacionPasajero): void {
    const nueva = aNotificacion(msg);
    if (!nueva || nueva.vence <= Date.now()) return;

    this._recibidas.update((lista) =>
      lista.some((n) => n.id === nueva.id) ? lista : [nueva, ...lista],
    );
  }

  private quitar(id: string): void {
    this._recibidas.update((lista) => lista.filter((n) => n.id !== id));
  }

  private quitarVencidas(): void {
    const ahora = Date.now();
    if (this._recibidas().some((n) => n.vence <= ahora)) {
      this._recibidas.update((lista) => lista.filter((n) => n.vence > ahora));
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

/** Sin sesion (no deberia pasar en las pantallas con campana) se usa una clave aparte. */
function descartadasKey(userUuid: string | undefined): string {
  return `${DESCARTADAS_KEY}:${userUuid ?? 'anonimo'}`;
}

function leerDescartadas(clave: string): Map<string, number> {
  const ahora = Date.now();
  try {
    const guardadas = JSON.parse(localStorage.getItem(clave) ?? '{}') as Record<string, number>;
    // Las vencidas ya no las reenvia el hub: no hace falta recordarlas.
    return new Map(Object.entries(guardadas).filter(([, vence]) => vence > ahora));
  } catch {
    return new Map();
  }
}

function guardarDescartadas(clave: string, descartadas: Map<string, number>): void {
  try {
    if (descartadas.size === 0) {
      localStorage.removeItem(clave);
    } else {
      localStorage.setItem(clave, JSON.stringify(Object.fromEntries(descartadas)));
    }
  } catch {
    // Sin storage, lo limpiado puede volver a aparecer al recargar
  }
}

/**
 * Saca del storage las descartadas que ya vencieron, de todas las cuentas que
 * usaron este navegador: si una no vuelve a entrar, nadie mas las limpiaria.
 * Tambien borra la clave vieja sin uuid, de cuando era una sola para todos.
 */
function podarDescartadas(): void {
  try {
    localStorage.removeItem(DESCARTADAS_KEY);
    const claves = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const clave of claves) {
      if (clave?.startsWith(`${DESCARTADAS_KEY}:`)) {
        guardarDescartadas(clave, leerDescartadas(clave));
      }
    }
  } catch {
    // Sin storage no hay nada que podar
  }
}
