import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { APP_CONFIG } from '../config';
import {
  DemoraColectivo,
  LlegadaColectivo,
  NotificacionPasajero,
} from '../models/viaje.model';

/**
 * Conexion con el hub de SignalR (microservicio realtime).
 *
 * El pasajero se suscribe al grupo `frontend/{PATENTE}:{uuid_terminal}`: ahi
 * publica el backend la llegada (BUS_ARRIVAL, la dispara la camara) y las
 * demoras (BUS_DELAY, las carga un admin). Al unirse, el hub reenvia las
 * notificaciones guardadas que no vencieron, asi que si el colectivo llego
 * antes de que el usuario abriera la app, el aviso aparece igual.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private connection: signalR.HubConnection | null = null;
  private grupo: string | null = null;

  readonly conectado = signal(false);
  readonly llegada = signal<LlegadaColectivo | null>(null);
  readonly demora = signal<DemoraColectivo | null>(null);

  /** Se suscribe a los avisos de un viaje; deja el anterior si habia uno. */
  async seguirViaje(groupKey: string): Promise<void> {
    if (this.grupo !== groupKey) {
      await this.dejarViaje();
    }

    const connection = await this.conectar();
    this.grupo = groupKey;
    await connection.invoke('JoinFrontend', groupKey);
  }

  async dejarViaje(): Promise<void> {
    const grupo = this.grupo;
    this.grupo = null;
    this.llegada.set(null);
    this.demora.set(null);

    if (grupo && this.connection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('LeaveFrontendGroup', grupo);
      } catch {
        // Si el hub no responde, el grupo se pierde igual al cerrar la conexion
      }
    }
  }

  private async conectar(): Promise<signalR.HubConnection> {
    if (this.connection) {
      if (this.connection.state === signalR.HubConnectionState.Disconnected) {
        await this.connection.start();
        this.conectado.set(true);
      }
      return this.connection;
    }

    const apiKey = encodeURIComponent(APP_CONFIG.realtimeApiKey);
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${APP_CONFIG.realtimeUrl}?apiKey=${apiKey}`)
      .withAutomaticReconnect()
      .build();

    connection.on('receiveNotification', (msg: NotificacionPasajero) => this.recibir(msg));

    // SignalR no conserva los grupos al reconectar: hay que volver a unirse.
    connection.onreconnecting(() => this.conectado.set(false));
    connection.onreconnected(async () => {
      this.conectado.set(true);
      if (this.grupo) {
        try {
          await connection.invoke('JoinFrontend', this.grupo);
        } catch {
          // Se reintenta en la proxima reconexion
        }
      }
    });
    connection.onclose(() => this.conectado.set(false));

    this.connection = connection;
    await connection.start();
    this.conectado.set(true);
    return connection;
  }

  private recibir(msg: NotificacionPasajero): void {
    switch (msg?.type) {
      case 'BUS_ARRIVAL':
        this.llegada.set(msg.payload as LlegadaColectivo);
        break;
      case 'BUS_DELAY':
        this.demora.set(msg.payload as DemoraColectivo);
        break;
    }
  }
}
