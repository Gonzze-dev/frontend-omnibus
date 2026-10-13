import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { APP_CONFIG } from '../config';
import { BusArrival, BusDelay, PassengerNotification } from '../models/trip.model';

/** Group of the GLOBAL notices (the hub builds it as `frontend/global`). */
const GLOBAL_GROUP = 'global';

/**
 * Connection to the SignalR hub (realtime microservice).
 *
 * Groups the passenger subscribes to (the hub prefixes them with `frontend/`):
 * - `global`: GLOBAL notices from the super admin. Always.
 * - `{terminal_uuid}`: LOCAL notices of the terminal where they wait.
 * - `{PLATE}:{terminal_uuid}`: arrival (BUS_ARRIVAL, fired by the camera)
 *   and delays (BUS_DELAY, entered by an admin) of their bus.
 *
 * The backend stores every notification and, when joining a group, the hub resends
 * the ones that have not expired. So if the notice went out before the user opened
 * the app, it still arrives. That is why the same notice can arrive more than once
 * (for example when reconnecting): listeners have to deduplicate by id.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private connection: signalR.HubConnection | null = null;
  private connecting: Promise<signalR.HubConnection> | null = null;
  /** Groups of the trip being followed: [plate:terminal, terminal]. */
  private tripGroups: string[] = [];

  readonly connected = signal(false);
  readonly arrival = signal<BusArrival | null>(null);
  readonly delay = signal<BusDelay | null>(null);

  private readonly _received = new Subject<PassengerNotification>();
  private readonly _deleted = new Subject<string>();
  /** Every notification the hub emits, including the ones resent when joining. */
  readonly received$ = this._received.asObservable();
  /** Ids of notifications an admin deleted. */
  readonly deleted$ = this._deleted.asObservable();

  /** Opens the connection and subscribes to the global notices. */
  async start(): Promise<void> {
    await this.connect();
  }

  /** Subscribes to a trip's notices; leaves the previous one if there was one. */
  async followTrip(groupKey: string, terminalUuid: string): Promise<void> {
    const groups = [groupKey, terminalUuid];
    if (groups.join() !== this.tripGroups.join()) {
      await this.leaveTrip();
    }

    const connection = await this.connect();
    this.tripGroups = groups;
    for (const group of groups) {
      await connection.invoke('JoinFrontend', group);
    }
  }

  async leaveTrip(): Promise<void> {
    const groups = this.tripGroups;
    this.tripGroups = [];
    this.arrival.set(null);
    this.delay.set(null);

    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    for (const group of groups) {
      try {
        await this.connection.invoke('LeaveFrontendGroup', group);
      } catch {
        // If the hub does not respond, the group is lost anyway when the connection closes
      }
    }
  }

  private connect(): Promise<signalR.HubConnection> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return Promise.resolve(this.connection);
    }
    // Several screens can request the connection at once: the attempt is shared.
    this.connecting ??= this.open().finally(() => (this.connecting = null));
    return this.connecting;
  }

  private async open(): Promise<signalR.HubConnection> {
    if (!this.connection) {
      const apiKey = encodeURIComponent(APP_CONFIG.realtimeApiKey);
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${APP_CONFIG.realtimeUrl}?apiKey=${apiKey}`)
        .withAutomaticReconnect()
        .build();

      this.connection.on('receiveNotification', (msg: PassengerNotification) => this.receive(msg));
      this.connection.on('deleteNotification', (id: string) => this.remove(id));

      // SignalR does not keep the groups when reconnecting: they have to be joined again.
      this.connection.onreconnecting(() => this.connected.set(false));
      this.connection.onreconnected(async () => {
        this.connected.set(true);
        await this.joinGroups();
      });
      this.connection.onclose(() => this.connected.set(false));
    }

    if (this.connection.state === signalR.HubConnectionState.Disconnected) {
      await this.connection.start();
      this.connected.set(true);
      await this.joinGroups();
    }
    return this.connection;
  }

  private async joinGroups(): Promise<void> {
    for (const group of [GLOBAL_GROUP, ...this.tripGroups]) {
      try {
        await this.connection?.invoke('JoinFrontend', group);
      } catch {
        // Retried on the next reconnection
      }
    }
  }

  private receive(msg: PassengerNotification): void {
    if (!msg?.type) return;

    switch (msg.type) {
      case 'BUS_ARRIVAL': {
        const arrival = msg.payload as BusArrival;
        // The resend on reconnect must not fire the notice again.
        if (this.arrival()?.id !== arrival.id) this.arrival.set(arrival);
        break;
      }
      case 'BUS_DELAY': {
        const delay = msg.payload as BusDelay;
        if (this.delay()?.id !== delay.id) this.delay.set(delay);
        break;
      }
    }

    this._received.next(msg);
  }

  private remove(id: string): void {
    if (this.arrival()?.id === id) this.arrival.set(null);
    if (this.delay()?.id === id) this.delay.set(null);
    this._deleted.next(id);
  }
}
