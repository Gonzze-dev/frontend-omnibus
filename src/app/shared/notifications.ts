import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';
import { RealtimeService } from '../services/realtime.service';
import { AdminNotice, BusArrival, BusDelay, PassengerNotification } from '../models/trip.model';

export type NotificationKind = 'delay' | 'arrival' | 'service';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  /** Epoch ms when it stops being shown. */
  expires: number;
}

/**
 * Ids the user cleared, so the hub's resend does not bring them back.
 * There is one key per account: otherwise clearing in one account hid them in
 * every account used in the same browser.
 */
const DISMISSED_KEY = 'dismissed_notifications';
/** Key used before it was renamed; its entries are dropped on startup. */
const LEGACY_DISMISSED_KEY = 'notificaciones_descartadas';
const CHECK_EXPIRED_MS = 30_000;

/**
 * Keeps the list in a single place so the bell counter and the
 * notifications screen do not contradict each other.
 *
 * It is filled with what arrives over realtime. The hub resends the stored ones
 * when joining a group (and when reconnecting), so it deduplicates by id.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);

  /**
   * Everything received, not filtered by account. The hub connection survives a
   * session change and the stored ones are not resent, so it cannot be emptied
   * when the account changes: it is filtered with the current account's dismissed ones.
   */
  private readonly _received = signal<Notification[]>([]);
  /** Dismissed per account, cached so localStorage is not reread on every computation. */
  private readonly _dismissed = signal(new Map<string, Map<string, number>>());

  private readonly accountKey = computed(() => dismissedKey(this.auth.user()?.uuid));
  private readonly dismissed = computed(
    () => this._dismissed().get(this.accountKey()) ?? readDismissed(this.accountKey()),
  );

  readonly list = computed(() => {
    const dismissed = this.dismissed();
    return this._received().filter((n) => !dismissed.has(n.id));
  });
  readonly count = computed(() => this.list().length);

  constructor() {
    pruneDismissed();

    this.realtime.received$
      .pipe(takeUntilDestroyed())
      .subscribe((msg) => this.add(msg));
    this.realtime.deleted$
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.remove(id));

    const timer = setInterval(() => this.removeExpired(), CHECK_EXPIRED_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // Global notices arrive even if the user is not waiting for a trip.
    this.realtime.start().catch(() => {
      // Without realtime the list stays empty; it is retried when following a trip
    });
  }

  /** Clears only for the account with an active session. */
  clear(): void {
    const key = this.accountKey();
    const dismissed = new Map(this.dismissed());
    for (const n of this.list()) {
      dismissed.set(n.id, n.expires);
    }
    saveDismissed(key, dismissed);
    this._dismissed.update((byAccount) => new Map(byAccount).set(key, dismissed));
  }

  private add(msg: PassengerNotification): void {
    const incoming = toNotification(msg);
    if (!incoming || incoming.expires <= Date.now()) return;

    this._received.update((list) =>
      list.some((n) => n.id === incoming.id) ? list : [incoming, ...list],
    );
  }

  private remove(id: string): void {
    this._received.update((list) => list.filter((n) => n.id !== id));
  }

  private removeExpired(): void {
    const now = Date.now();
    if (this._received().some((n) => n.expires <= now)) {
      this._received.update((list) => list.filter((n) => n.expires > now));
    }
  }
}

/**
 * Translates the hub message into what the screen shows. Returns null for
 * the types that are not for the passenger (CAMERA goes to admins).
 *
 * The payload carries `time_life` in minutes but not the sending date, so the
 * expiration is counted from when it arrives. For a resent one it is approximate; the
 * hub never resends the ones that already expired in the database anyway.
 */
function toNotification(msg: PassengerNotification): Notification | null {
  const payload = msg.payload as { id?: string; time_life?: number } | null;
  if (!payload?.id) return null;

  const expires = Date.now() + (payload.time_life ?? 0) * 60_000;
  const base = { id: payload.id, expires };

  switch (msg.type) {
    case 'BUS_ARRIVAL': {
      const p = payload as BusArrival;
      return {
        ...base,
        kind: 'arrival',
        title: 'Tu colectivo acaba de llegar',
        detail: `Esta en la plataforma ${p.bay}.`,
      };
    }
    case 'BUS_DELAY': {
      const p = payload as BusDelay;
      return {
        ...base,
        kind: 'delay',
        title: 'Alerta de retraso',
        detail: `Su colectivo esta retrasado unos ${p.time_delay} minutos aproximadamente.`,
      };
    }
    case 'LOCAL':
    case 'GLOBAL': {
      const p = payload as AdminNotice;
      const detail = p.message?.trim();
      if (!detail) return null;
      return {
        ...base,
        kind: 'service',
        title: p.title?.trim() || (msg.type === 'LOCAL' ? 'Aviso de la terminal' : 'Aviso general'),
        detail,
      };
    }
    default:
      return null;
  }
}

/** Without a session (should not happen on screens with the bell) a separate key is used. */
function dismissedKey(userUuid: string | undefined): string {
  return `${DISMISSED_KEY}:${userUuid ?? 'anonymous'}`;
}

function readDismissed(key: string): Map<string, number> {
  const now = Date.now();
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, number>;
    // The hub no longer resends expired ones: there is no need to remember them.
    return new Map(Object.entries(stored).filter(([, expires]) => expires > now));
  } catch {
    return new Map();
  }
}

function saveDismissed(key: string, dismissed: Map<string, number>): void {
  try {
    if (dismissed.size === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(Object.fromEntries(dismissed)));
    }
  } catch {
    // Without storage, what was cleared can reappear on reload
  }
}

/**
 * Removes from storage the dismissed ones that already expired, for every account that
 * used this browser: if one never logs in again, nobody else would clean them up.
 * It also deletes the old key without uuid, from when there was a single one for everyone,
 * and the keys saved under the legacy name.
 */
function pruneDismissed(): void {
  try {
    localStorage.removeItem(DISMISSED_KEY);
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const key of keys) {
      if (key === LEGACY_DISMISSED_KEY || key?.startsWith(`${LEGACY_DISMISSED_KEY}:`)) {
        localStorage.removeItem(key);
      } else if (key?.startsWith(`${DISMISSED_KEY}:`)) {
        saveDismissed(key, readDismissed(key));
      }
    }
  } catch {
    // Without storage there is nothing to prune
  }
}
