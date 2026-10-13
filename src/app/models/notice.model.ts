/** Tipos que puede enviar un administrador (GET /api/admin/notification-types). */
export type TipoAvisoAdmin = 'LOCAL' | 'GLOBAL' | 'BUS_DELAY' | 'BUS_ARRIVAL';

/** GET /api/admin/notification-types (models.AdminNotificationTypesResponse). */
export interface TiposAvisoResponse {
  types: TipoAvisoAdmin[];
}

/** POST /api/admin/notifications (models.AdminSendNotificationRequest). */
export interface EnviarAvisoRequest {
  type: 'LOCAL' | 'GLOBAL';
  payload: {
    message: string;
    /** Minutos de vida de la notificacion. */
    time_life: number;
  };
}

export interface EnviarAvisoResponse {
  message: string;
}

/** POST /api/admin/notify-bus-delay (models.NotifyBusDelayRequest). */
export interface NotificarRetrasoRequest {
  type: 'BUS_DELAY';
  license_patent: string;
  /** Obligatorio para el super admin y el admin con varias terminales. */
  uuid_terminal?: string;
  /** Fecha del viaje (YYYY-MM-DD). */
  start_date: string;
  payload: {
    /** Minutos de demora. */
    time_delay: number;
    /** Minutos de vida de la notificacion. */
    time_life: number;
  };
}

export interface NotificarRetrasoResponse {
  message: string;
}

/**
 * POST /notify_passengers (models.NotifyPassengersRequest). Lo usa la camara
 * con X-API-Key; el admin lo usa con su JWT cuando la camara falla.
 */
export interface NotificarArriboRequest {
  license_patent: string;
  /** Codigo del anden (plataforma) donde llego el colectivo. */
  code: string;
  /** Minutos de vida de la notificacion. */
  time_life: number;
}

export interface NotificarArriboResponse {
  message: string;
}

/** Tipos de notificacion que guarda el backend (models.PassengerNotificationType). */
export type TipoNotificacion = 'BUS_ARRIVAL' | 'BUS_DELAY' | 'LOCAL' | 'GLOBAL' | 'CAMERA';

/** Notificacion del listado de admin (models.AdminNotificationListItem). */
export interface NotificacionAdmin {
  id: string;
  type: TipoNotificacion;
  /** null en las notificaciones globales. */
  terminal: { uuid: string; name: string } | null;
  date: string;
  expiration: string;
  expired: boolean;
  /** Varia segun el tipo: message, license_patent, time_delay, anden... */
  payload: Record<string, unknown>;
}

/** GET /api/admin/notifications (models.ListAdminNotificationsResponse). */
export interface ListNotificacionesResponse {
  notifications: NotificacionAdmin[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export type EstadoNotificacion = 'all' | 'active' | 'expired';

export interface ListNotificacionesParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  type?: TipoNotificacion;
  status?: EstadoNotificacion;
  terminal_uuid?: string;
}
