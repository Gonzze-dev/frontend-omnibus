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
