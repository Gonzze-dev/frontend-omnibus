import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  EnviarAvisoRequest,
  EnviarAvisoResponse,
  ListNotificacionesParams,
  ListNotificacionesResponse,
  NotificacionAdmin,
  NotificarRetrasoRequest,
  NotificarRetrasoResponse,
  TiposAvisoResponse,
} from '../models/aviso.model';

/**
 * Envio, listado y baja de avisos contra /api/admin (admin y super admin).
 * El backend filtra por rol: el admin solo ve las de sus terminales.
 */
@Injectable({ providedIn: 'root' })
export class AvisoService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${APP_CONFIG.apiUrl}/admin`;

  /** Tipos que el rol del usuario puede enviar. */
  tipos(): Observable<TiposAvisoResponse> {
    return this.http.get<TiposAvisoResponse>(`${this.adminUrl}/notification-types`);
  }

  /**
   * Envia un aviso LOCAL o GLOBAL. `terminalUuid` va como query: lo exige el
   * super admin y el admin con varias terminales; GLOBAL no lo usa.
   */
  enviar(datos: EnviarAvisoRequest, terminalUuid?: string): Observable<EnviarAvisoResponse> {
    let query = new HttpParams();
    if (terminalUuid) query = query.set('terminaluuid', terminalUuid);

    return this.http.post<EnviarAvisoResponse>(`${this.adminUrl}/notifications`, datos, {
      params: query,
    });
  }

  /** Avisa la demora de un colectivo puntual (BUS_DELAY). */
  notificarRetraso(datos: NotificarRetrasoRequest): Observable<NotificarRetrasoResponse> {
    return this.http.post<NotificarRetrasoResponse>(`${this.adminUrl}/notify-bus-delay`, datos);
  }

  listar(params: ListNotificacionesParams = {}): Observable<ListNotificacionesResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);
    if (params.type) query = query.set('type', params.type);
    if (params.status) query = query.set('status', params.status);
    if (params.terminal_uuid) query = query.set('terminal_uuid', params.terminal_uuid);

    return this.http.get<ListNotificacionesResponse>(`${this.adminUrl}/notifications`, {
      params: query,
    });
  }

  obtener(id: string): Observable<NotificacionAdmin> {
    return this.http.get<NotificacionAdmin>(`${this.adminUrl}/notifications/${id}`);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/notifications`, {
      params: new HttpParams().set('notification_id', id),
    });
  }
}
