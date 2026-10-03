import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  DemoraColectivo,
  LlegadaColectivo,
  NotificacionPasajero,
} from '../models/viaje.model';

/** Grupo de los avisos GLOBAL (el hub lo arma como `frontend/global`). */
const GRUPO_GLOBAL = 'global';

/**
 * Conexion con el hub de SignalR (microservicio realtime).
 *
 * Grupos a los que se suscribe el pasajero (el hub les antepone `frontend/`):
 * - `global`: avisos GLOBAL del super admin. Siempre.
 * - `{uuid_terminal}`: avisos LOCAL de la terminal donde espera.
 * - `{PATENTE}:{uuid_terminal}`: llegada (BUS_ARRIVAL, la dispara la camara)
 *   y demoras (BUS_DELAY, las carga un admin) de su colectivo.
 *
 * El backend guarda cada notificacion y, al unirse a un grupo, el hub reenvia
 * las que no vencieron. Asi, si el aviso salio antes de que el usuario abriera
 * la app, le llega igual. Por eso un mismo aviso puede llegar mas de una vez
 * (por ejemplo al reconectar): quien escucha tiene que deduplicar por id.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private connection: signalR.HubConnection | null = null;
  private conectando: Promise<signalR.HubConnection> | null = null;
  /** Grupos del viaje que se esta siguiendo: [patente:terminal, terminal]. */
  private gruposViaje: string[] = [];

  readonly conectado = signal(false);
  readonly llegada = signal<LlegadaColectivo | null>(null);
  readonly demora = signal<DemoraColectivo | null>(null);

  private readonly _recibidas = new Subject<NotificacionPasajero>();
  private readonly _eliminadas = new Subject<string>();
  /** Cada notificacion que emite el hub, incluidas las reenviadas al unirse. */
  readonly recibidas$ = this._recibidas.asObservable();
  /** Ids de notificaciones que un admin borro. */
  readonly eliminadas$ = this._eliminadas.asObservable();

  /** Abre la conexion y se suscribe a los avisos globales. */
  async iniciar(): Promise<void> {
    await this.conectar();
  }

  /** Se suscribe a los avisos de un viaje; deja el anterior si habia uno. */
  async seguirViaje(groupKey: string, terminalUuid: string): Promise<void> {
    const grupos = [groupKey, terminalUuid];
    if (grupos.join() !== this.gruposViaje.join()) {
      await this.dejarViaje();
    }

    const connection = await this.conectar();
    this.gruposViaje = grupos;
    for (const grupo of grupos) {
      await connection.invoke('JoinFrontend', grupo);
    }
  }

  async dejarViaje(): Promise<void> {
    const grupos = this.gruposViaje;
    this.gruposViaje = [];
    this.llegada.set(null);
    this.demora.set(null);

    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    for (const grupo of grupos) {
      try {
        await this.connection.invoke('LeaveFrontendGroup', grupo);
      } catch {
        // Si el hub no responde, el grupo se pierde igual al cerrar la conexion
      }
    }
  }

  private conectar(): Promise<signalR.HubConnection> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return Promise.resolve(this.connection);
    }
    // Varias pantallas pueden pedir la conexion a la vez: se comparte el intento.
    this.conectando ??= this.abrir().finally(() => (this.conectando = null));
    return this.conectando;
  }

  private async abrir(): Promise<signalR.HubConnection> {
    if (!this.connection) {
      const apiKey = encodeURIComponent(APP_CONFIG.realtimeApiKey);
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${APP_CONFIG.realtimeUrl}?apiKey=${apiKey}`)
        .withAutomaticReconnect()
        .build();

      this.connection.on('receiveNotification', (msg: NotificacionPasajero) => this.recibir(msg));
      this.connection.on('deleteNotification', (id: string) => this.eliminar(id));

      // SignalR no conserva los grupos al reconectar: hay que volver a unirse.
      this.connection.onreconnecting(() => this.conectado.set(false));
      this.connection.onreconnected(async () => {
        this.conectado.set(true);
        await this.unirseAGrupos();
      });
      this.connection.onclose(() => this.conectado.set(false));
    }

    if (this.connection.state === signalR.HubConnectionState.Disconnected) {
      await this.connection.start();
      this.conectado.set(true);
      await this.unirseAGrupos();
    }
    return this.connection;
  }

  private async unirseAGrupos(): Promise<void> {
    for (const grupo of [GRUPO_GLOBAL, ...this.gruposViaje]) {
      try {
        await this.connection?.invoke('JoinFrontend', grupo);
      } catch {
        // Se reintenta en la proxima reconexion
      }
    }
  }

  private recibir(msg: NotificacionPasajero): void {
    if (!msg?.type) return;

    switch (msg.type) {
      case 'BUS_ARRIVAL': {
        const llegada = msg.payload as LlegadaColectivo;
        // El reenvio al reconectar no tiene que volver a disparar el aviso.
        if (this.llegada()?.id !== llegada.id) this.llegada.set(llegada);
        break;
      }
      case 'BUS_DELAY': {
        const demora = msg.payload as DemoraColectivo;
        if (this.demora()?.id !== demora.id) this.demora.set(demora);
        break;
      }
    }

    this._recibidas.next(msg);
  }

  private eliminar(id: string): void {
    if (this.llegada()?.id === id) this.llegada.set(null);
    if (this.demora()?.id === id) this.demora.set(null);
    this._eliminadas.next(id);
  }
}
