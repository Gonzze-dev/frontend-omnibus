/** Tipos que puede enviar un administrador (GET /api/admin/notification-types). */
export type TipoAvisoAdmin = 'LOCAL' | 'GLOBAL' | 'BUS_DELAY';

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
