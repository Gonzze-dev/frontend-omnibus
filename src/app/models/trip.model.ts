/** GET /api/users/terminals (models.BusTerminalResponse). */
export interface Terminal {
  uuid: string;
  postal_code: string;
  name: string;
}

export interface TripCity {
  city_name: string;
  start_date: string;
  end_date: string;
  order: number;
}

/** Bus ticket as returned by the terminals backend (models.BusTicket). */
export interface BusTicket {
  postal_code: string;
  bus_terminal_name: string;
  ticket: string;
  dni: string;
  name: string;
  bus_license_plate: string;
  enterprise: string;
  start_date: string;
  end_date: string;
  trip_city: TripCity[];
  uuid: string;
}

/**
 * POST /api/buses/join and GET /api/buses/awaited (models.AwaitedTripResponse).
 * `group_key` is the realtime channel where the bus notices arrive.
 */
export interface AwaitedTrip {
  group_key: string;
  terminal: { uuid: string; name: string };
  trip: BusTicket;
  created_at: string;
  notified_at: string | null;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/** BUS_ARRIVAL payload (models.PlatformInfo). */
export interface BusArrival {
  id: string;
  bay: string;
  coordinates: Coordinates | null;
  time_life: number;
}

/** BUS_DELAY payload (models.NotifyBusDelayPayload). */
export interface BusDelay {
  id: string;
  license_plate: string;
  time_delay: number;
  time_life: number;
}

/**
 * LOCAL (models.AdminLocalNotificationPayload) and GLOBAL payload. GLOBAL
 * accepts any JSON with `time_life`; `message` is shown (and `title` if present).
 */
export interface AdminNotice {
  id: string;
  message?: string;
  title?: string;
  time_life: number;
}

export type PassengerNotificationType = 'BUS_ARRIVAL' | 'BUS_DELAY' | 'LOCAL' | 'GLOBAL' | 'CAMERA';

/** Message the hub emits on `receiveNotification`. */
export interface PassengerNotification {
  type: PassengerNotificationType;
  payload: unknown;
}
