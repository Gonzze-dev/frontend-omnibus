/** GET /api/users/terminals (models.BusTerminalResponse). */
export interface Terminal {
  uuid: string;
  postal_code: string;
  name: string;
}

export interface CiudadViaje {
  city_name: string;
  start_date: string;
  end_date: string;
  order: number;
}

/** Pasaje tal como lo devuelve el backend de terminales (models.BusTicket). */
export interface Pasaje {
  postal_code: string;
  bus_terminal_name: string;
  ticket: string;
  dni: string;
  name: string;
  bus_license_plate: string;
  enterprise: string;
  start_date: string;
  end_date: string;
  trip_city: CiudadViaje[];
  uuid: string;
}

/**
 * POST /api/buses/join y GET /api/buses/awaited (models.AwaitedTripResponse).
 * `group_key` es el canal de realtime donde llegan los avisos del colectivo.
 */
export interface ViajeEsperado {
  group_key: string;
  terminal: { uuid: string; name: string };
  trip: Pasaje;
  created_at: string;
  notified_at: string | null;
}

export interface Coordenadas {
  lat: number;
  lng: number;
}

/** Payload de BUS_ARRIVAL (models.PlatformInfo). */
export interface LlegadaColectivo {
  id: string;
  anden: string;
  coordinates: Coordenadas | null;
  time_life: number;
}

/** Payload de BUS_DELAY (models.NotifyBusDelayPayload). */
export interface DemoraColectivo {
  id: string;
  license_patent: string;
  time_delay: number;
  time_life: number;
}

export type TipoNotificacionPasajero = 'BUS_ARRIVAL' | 'BUS_DELAY' | 'LOCAL' | 'GLOBAL' | 'CAMERA';

/** Mensaje que emite el hub en `receiveNotification`. */
export interface NotificacionPasajero {
  type: TipoNotificacionPasajero;
  payload: unknown;
}
