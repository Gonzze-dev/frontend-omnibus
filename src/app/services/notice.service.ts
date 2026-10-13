import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  AdminNotification,
  ListNotificationsParams,
  ListNotificationsResponse,
  NoticeTypesResponse,
  NotifyArrivalRequest,
  NotifyArrivalResponse,
  NotifyDelayRequest,
  NotifyDelayResponse,
  SendNoticeRequest,
  SendNoticeResponse,
} from '../models/notice.model';

/**
 * Sending, listing and deleting notices against /api/admin (admin and super admin).
 * The backend filters by role: the admin only sees those of their terminals.
 */
@Injectable({ providedIn: 'root' })
export class NoticeService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${APP_CONFIG.apiUrl}/admin`;

  /** Types the user's role can send. */
  types(): Observable<NoticeTypesResponse> {
    return this.http.get<NoticeTypesResponse>(`${this.adminUrl}/notification-types`);
  }

  /**
   * Sends a LOCAL or GLOBAL notice. `terminalUuid` goes as a query param: the
   * super admin and an admin with several terminals require it; GLOBAL does not use it.
   */
  send(data: SendNoticeRequest, terminalUuid?: string): Observable<SendNoticeResponse> {
    let query = new HttpParams();
    if (terminalUuid) query = query.set('terminaluuid', terminalUuid);

    return this.http.post<SendNoticeResponse>(`${this.adminUrl}/notifications`, data, {
      params: query,
    });
  }

  /** Announces the delay of a specific bus (BUS_DELAY). */
  notifyDelay(data: NotifyDelayRequest): Observable<NotifyDelayResponse> {
    return this.http.post<NotifyDelayResponse>(`${this.adminUrl}/notify-bus-delay`, data);
  }

  /** Manually announces a bus arrival at a bay (BUS_ARRIVAL), in case the camera fails. */
  notifyArrival(data: NotifyArrivalRequest): Observable<NotifyArrivalResponse> {
    return this.http.post<NotifyArrivalResponse>(APP_CONFIG.notifyPassengersUrl, data);
  }

  list(params: ListNotificationsParams = {}): Observable<ListNotificationsResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);
    if (params.type) query = query.set('type', params.type);
    if (params.status) query = query.set('status', params.status);
    if (params.terminal_uuid) query = query.set('terminal_uuid', params.terminal_uuid);

    return this.http.get<ListNotificationsResponse>(`${this.adminUrl}/notifications`, {
      params: query,
    });
  }

  get(id: string): Observable<AdminNotification> {
    return this.http.get<AdminNotification>(`${this.adminUrl}/notifications/${id}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/notifications`, {
      params: new HttpParams().set('notification_id', id),
    });
  }
}
