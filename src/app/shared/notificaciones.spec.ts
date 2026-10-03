import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { NotificacionesStore } from './notificaciones';
import { RealtimeService } from '../services/realtime.service';
import { NotificacionPasajero } from '../models/viaje.model';

describe('NotificacionesStore', () => {
  let recibidas: Subject<NotificacionPasajero>;
  let eliminadas: Subject<string>;
  let store: NotificacionesStore;

  const llegada: NotificacionPasajero = {
    type: 'BUS_ARRIVAL',
    payload: { id: 'n-llegada', anden: 'A04', coordinates: { lat: 1, lng: 2 }, time_life: 5 },
  };
  const demora: NotificacionPasajero = {
    type: 'BUS_DELAY',
    payload: { id: 'n-demora', license_patent: 'AB123CD', time_delay: 25, time_life: 5 },
  };
  const local: NotificacionPasajero = {
    type: 'LOCAL',
    payload: { id: 'n-local', message: 'Anden 3 cerrado', time_life: 5 },
  };
  const global: NotificacionPasajero = {
    type: 'GLOBAL',
    payload: { id: 'n-global', message: 'Fuera de servicio de 6 a 7', time_life: 5 },
  };

  function crearStore(): NotificacionesStore {
    TestBed.resetTestingModule();
    recibidas = new Subject();
    eliminadas = new Subject();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RealtimeService,
          useValue: {
            recibidas$: recibidas.asObservable(),
            eliminadas$: eliminadas.asObservable(),
            iniciar: () => Promise.resolve(),
          },
        },
      ],
    });
    return TestBed.inject(NotificacionesStore);
  }

  beforeEach(() => {
    localStorage.clear();
    store = crearStore();
  });

  it('arranca vacio, sin datos de ejemplo', () => {
    expect(store.lista()).toEqual([]);
    expect(store.cantidad()).toBe(0);
  });

  it('traduce cada tipo del pasajero y muestra la mas nueva primero', () => {
    [llegada, demora, local, global].forEach((m) => recibidas.next(m));

    expect(store.lista().map((n) => [n.id, n.tipo, n.titulo, n.detalle])).toEqual([
      ['n-global', 'servicio', 'Aviso general', 'Fuera de servicio de 6 a 7'],
      ['n-local', 'servicio', 'Aviso de la terminal', 'Anden 3 cerrado'],
      ['n-demora', 'retraso', 'Alerta de retraso', 'Su colectivo esta retrasado unos 25 minutos aproximadamente.'],
      ['n-llegada', 'llegada', 'Tu colectivo acaba de llegar', 'Esta en la plataforma A04.'],
    ]);
    expect(store.cantidad()).toBe(4);
  });

  it('usa el title de un GLOBAL si viene', () => {
    recibidas.next({ type: 'GLOBAL', payload: { id: 'g', title: 'Paro', message: 'Sin servicio', time_life: 5 } });
    expect(store.lista()[0].titulo).toBe('Paro');
  });

  it('no duplica lo que el hub reenvia al unirse o reconectar', () => {
    recibidas.next(local);
    recibidas.next(local);
    expect(store.cantidad()).toBe(1);
  });

  it('ignora GLOBAL y LOCAL sin message o con message en blanco', () => {
    recibidas.next({ type: 'GLOBAL', payload: { id: 'g1', time_life: 5 } });
    recibidas.next({ type: 'GLOBAL', payload: { id: 'g2', message: '', time_life: 5 } });
    recibidas.next({ type: 'GLOBAL', payload: { id: 'g3', message: '   ', time_life: 5 } });
    recibidas.next({ type: 'LOCAL', payload: { id: 'l1', message: ' \t ', time_life: 5 } });
    expect(store.cantidad()).toBe(0);
  });

  it('ignora CAMERA (es para admins) y mensajes sin id', () => {
    recibidas.next({ type: 'CAMERA', payload: { id: 'c', message: 'Camara caida', time_life: 5 } });
    recibidas.next({ type: 'LOCAL', payload: { message: 'sin id', time_life: 5 } });
    expect(store.cantidad()).toBe(0);
  });

  it('quita la notificacion que borra un admin', () => {
    recibidas.next(local);
    recibidas.next(global);
    eliminadas.next('n-local');
    expect(store.lista().map((n) => n.id)).toEqual(['n-global']);
  });

  it('lo limpiado no vuelve con el reenvio, ni despues de recargar', () => {
    recibidas.next(local);
    store.limpiar();
    expect(store.cantidad()).toBe(0);

    recibidas.next(local);
    expect(store.cantidad()).toBe(0);

    // Simula recargar la pagina: store nuevo, mismo localStorage.
    store = crearStore();
    recibidas.next(local);
    recibidas.next(global);
    expect(store.lista().map((n) => n.id)).toEqual(['n-global']);
  });

  it('saca las vencidas', () => {
    vi.useFakeTimers();
    try {
      store = crearStore();
      recibidas.next({ type: 'LOCAL', payload: { id: 'corta', message: 'x', time_life: 1 } });
      recibidas.next(local); // 5 minutos
      vi.advanceTimersByTime(90_000);
      expect(store.lista().map((n) => n.id)).toEqual(['n-local']);
    } finally {
      vi.useRealTimers();
    }
  });
});
