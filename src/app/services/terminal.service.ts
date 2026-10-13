import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  CreateTerminalRequest,
  ExternalTerminal,
  ListTerminalsParams,
  ListTerminalsResponse,
  Terminal,
  UpdateTerminalRequest,
} from '../models/terminal.model';

/** Terminals CRUD against /api/super/terminals (super admin only). */
@Injectable({ providedIn: 'root' })
export class TerminalService {
  private readonly http = inject(HttpClient);
  private readonly terminalsUrl = `${APP_CONFIG.apiUrl}/super/terminals`;

  /** Public list (any authenticated user) for terminal selects. */
  listPublic(): Observable<Terminal[]> {
    return this.http.get<Terminal[]>(`${APP_CONFIG.apiUrl}/users/terminals`);
  }

  list(params: ListTerminalsParams = {}): Observable<ListTerminalsResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);

    return this.http.get<ListTerminalsResponse>(this.terminalsUrl, { params: query });
  }

  get(uuid: string): Observable<Terminal> {
    return this.http.get<Terminal>(`${this.terminalsUrl}/${uuid}`);
  }

  create(data: CreateTerminalRequest): Observable<Terminal> {
    return this.http.post<Terminal>(this.terminalsUrl, data);
  }

  update(uuid: string, data: UpdateTerminalRequest): Observable<Terminal> {
    return this.http.put<Terminal>(`${this.terminalsUrl}/${uuid}`, data);
  }

  delete(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.terminalsUrl}/${uuid}`);
  }

  /** Terminals of the bus ticket system, to choose the external id. */
  listExternal(): Observable<ExternalTerminal[]> {
    return this.http.get<ExternalTerminal[]>(`${APP_CONFIG.apiUrl}/super/get-external-terminals`);
  }
}
