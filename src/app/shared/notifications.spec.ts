import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { NotificationsStore } from './notifications';
import { RealtimeService } from '../services/realtime.service';
import { AuthService } from '../services/auth.service';
import { User } from '../models/auth.model';
import { PassengerNotification } from '../models/trip.model';

describe('NotificationsStore', () => {
  let received: Subject<PassengerNotification>;
  let deleted: Subject<string>;
  let store: NotificationsStore;
  let currentUser: ReturnType<typeof signal<User | null>>;

  const account = (uuid: string) => ({ uuid, role: 'user' }) as User;

  const arrival: PassengerNotification = {
    type: 'BUS_ARRIVAL',
    payload: { id: 'n-arrival', bay: 'A04', coordinates: { lat: 1, lng: 2 }, time_life: 5 },
  };
  const delay: PassengerNotification = {
    type: 'BUS_DELAY',
    payload: { id: 'n-delay', license_plate: 'AB123CD', time_delay: 25, time_life: 5 },
  };
  const local: PassengerNotification = {
    type: 'LOCAL',
    payload: { id: 'n-local', message: 'Bay 3 closed', time_life: 5 },
  };
  const global: PassengerNotification = {
    type: 'GLOBAL',
    payload: { id: 'n-global', message: 'Out of service from 6 to 7', time_life: 5 },
  };

  function createStore(): NotificationsStore {
    TestBed.resetTestingModule();
    received = new Subject();
    deleted = new Subject();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: currentUser.asReadonly() } },
        {
          provide: RealtimeService,
          useValue: {
            received$: received.asObservable(),
            deleted$: deleted.asObservable(),
            start: () => Promise.resolve(),
          },
        },
      ],
    });
    return TestBed.inject(NotificationsStore);
  }

  beforeEach(() => {
    localStorage.clear();
    currentUser = signal<User | null>(account('u-1'));
    store = createStore();
  });

  it('starts empty, without sample data', () => {
    expect(store.list()).toEqual([]);
    expect(store.count()).toBe(0);
  });

  it('translates each passenger type and shows the newest first', () => {
    [arrival, delay, local, global].forEach((m) => received.next(m));

    expect(store.list().map((n) => [n.id, n.kind, n.title, n.detail])).toEqual([
      ['n-global', 'service', 'Aviso general', 'Out of service from 6 to 7'],
      ['n-local', 'service', 'Aviso de la terminal', 'Bay 3 closed'],
      ['n-delay', 'delay', 'Alerta de retraso', 'Su colectivo esta retrasado unos 25 minutos aproximadamente.'],
      ['n-arrival', 'arrival', 'Tu colectivo acaba de llegar', 'Esta en la plataforma A04.'],
    ]);
    expect(store.count()).toBe(4);
  });

  it('uses the title of a GLOBAL if present', () => {
    received.next({ type: 'GLOBAL', payload: { id: 'g', title: 'Strike', message: 'No service', time_life: 5 } });
    expect(store.list()[0].title).toBe('Strike');
  });

  it('does not duplicate what the hub resends when joining or reconnecting', () => {
    received.next(local);
    received.next(local);
    expect(store.count()).toBe(1);
  });

  it('ignores GLOBAL and LOCAL without a message or with a blank message', () => {
    received.next({ type: 'GLOBAL', payload: { id: 'g1', time_life: 5 } });
    received.next({ type: 'GLOBAL', payload: { id: 'g2', message: '', time_life: 5 } });
    received.next({ type: 'GLOBAL', payload: { id: 'g3', message: '   ', time_life: 5 } });
    received.next({ type: 'LOCAL', payload: { id: 'l1', message: ' \t ', time_life: 5 } });
    expect(store.count()).toBe(0);
  });

  it('ignores CAMERA (it is for admins) and messages without an id', () => {
    received.next({ type: 'CAMERA', payload: { id: 'c', message: 'Camera down', time_life: 5 } });
    received.next({ type: 'LOCAL', payload: { message: 'no id', time_life: 5 } });
    expect(store.count()).toBe(0);
  });

  it('removes the notification an admin deletes', () => {
    received.next(local);
    received.next(global);
    deleted.next('n-local');
    expect(store.list().map((n) => n.id)).toEqual(['n-global']);
  });

  it('what was cleared does not come back with the resend, nor after reloading', () => {
    received.next(local);
    store.clear();
    expect(store.count()).toBe(0);

    received.next(local);
    expect(store.count()).toBe(0);

    // Simulates reloading the page: new store, same localStorage.
    store = createStore();
    received.next(local);
    received.next(global);
    expect(store.list().map((n) => n.id)).toEqual(['n-global']);
  });

  it('what was cleared in one account is not hidden in another one on the same browser', () => {
    received.next(global);
    store.clear();
    expect(store.count()).toBe(0);

    // Session change without reloading: the hub connection stays and resends nothing.
    currentUser.set(account('u-2'));
    expect(store.list().map((n) => n.id)).toEqual(['n-global']);

    store.clear();
    currentUser.set(account('u-1'));
    expect(store.count()).toBe(0);

    // Another account that logs in after reloading also sees it.
    currentUser.set(account('u-3'));
    store = createStore();
    received.next(global);
    expect(store.list().map((n) => n.id)).toEqual(['n-global']);
  });

  it('on startup prunes the expired dismissed ones of every account from storage', () => {
    const now = Date.now();
    localStorage.setItem('dismissed_notifications', JSON.stringify({ old: now + 60_000 }));
    localStorage.setItem('dismissed_notifications:u-1', JSON.stringify({ expired: now - 1, current: now + 60_000 }));
    localStorage.setItem('dismissed_notifications:u-9', JSON.stringify({ expired: now - 1 }));
    localStorage.setItem('notificaciones_descartadas:u-1', JSON.stringify({ legacy: now + 60_000 }));
    localStorage.setItem('something_else', 'x');

    store = createStore();

    expect(localStorage.getItem('dismissed_notifications')).toBeNull();
    expect(JSON.parse(localStorage.getItem('dismissed_notifications:u-1')!)).toEqual({ current: now + 60_000 });
    expect(localStorage.getItem('dismissed_notifications:u-9')).toBeNull();
    expect(localStorage.getItem('notificaciones_descartadas:u-1')).toBeNull();
    expect(localStorage.getItem('something_else')).toBe('x');
  });

  it('removes the expired ones', () => {
    vi.useFakeTimers();
    try {
      store = createStore();
      received.next({ type: 'LOCAL', payload: { id: 'short', message: 'x', time_life: 1 } });
      received.next(local); // 5 minutes
      vi.advanceTimersByTime(90_000);
      expect(store.list().map((n) => n.id)).toEqual(['n-local']);
    } finally {
      vi.useRealTimers();
    }
  });
});
