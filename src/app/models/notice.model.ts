/** Types an administrator can send (GET /api/admin/notification-types). */
export type AdminNoticeType = 'LOCAL' | 'GLOBAL' | 'BUS_DELAY' | 'BUS_ARRIVAL';

/** GET /api/admin/notification-types (models.AdminNotificationTypesResponse). */
export interface NoticeTypesResponse {
  types: AdminNoticeType[];
}

/** POST /api/admin/notifications (models.AdminSendNotificationRequest). */
export interface SendNoticeRequest {
  type: 'LOCAL' | 'GLOBAL';
  payload: {
    message: string;
    /** Notification lifetime in minutes. */
    time_life: number;
  };
}

export interface SendNoticeResponse {
  message: string;
}

/** POST /api/admin/notify-bus-delay (models.NotifyBusDelayRequest). */
export interface NotifyDelayRequest {
  type: 'BUS_DELAY';
  license_plate: string;
  /** Required for the super admin and for an admin with several terminals. */
  uuid_terminal?: string;
  /** Trip date (YYYY-MM-DD). */
  start_date: string;
  payload: {
    /** Delay in minutes. */
    time_delay: number;
    /** Notification lifetime in minutes. */
    time_life: number;
  };
}

export interface NotifyDelayResponse {
  message: string;
}

/**
 * POST /notify_passengers (models.NotifyPassengersRequest). The camera uses it
 * with X-API-Key; the admin uses it with their JWT when the camera fails.
 */
export interface NotifyArrivalRequest {
  license_plate: string;
  /** Code of the bay (platform) where the bus arrived. */
  code: string;
  /** Notification lifetime in minutes. */
  time_life: number;
}

export interface NotifyArrivalResponse {
  message: string;
}

/** Notification types stored by the backend (models.PassengerNotificationType). */
export type NotificationType = 'BUS_ARRIVAL' | 'BUS_DELAY' | 'LOCAL' | 'GLOBAL' | 'CAMERA';

/** Notification in the admin list (models.AdminNotificationListItem). */
export interface AdminNotification {
  id: string;
  type: NotificationType;
  /** null in global notifications. */
  terminal: { uuid: string; name: string } | null;
  date: string;
  expiration: string;
  expired: boolean;
  /** Depends on the type: message, license_plate, time_delay, bay... */
  payload: Record<string, unknown>;
}

/** GET /api/admin/notifications (models.ListAdminNotificationsResponse). */
export interface ListNotificationsResponse {
  notifications: AdminNotification[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export type NotificationStatus = 'all' | 'active' | 'expired';

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  type?: NotificationType;
  status?: NotificationStatus;
  terminal_uuid?: string;
}
