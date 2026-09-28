import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  CreateTerminalRequest,
  ListTerminalesParams,
  ListTerminalesResponse,
  Terminal,
  UpdateTerminalRequest,
} from '../models/terminal.model';

/** ABM de terminales contra /api/super/terminals (solo super admin). */
@Injectable({ providedIn: 'root' })
export class TerminalService {
  private readonly http = inject(HttpClient);
  private readonly terminalsUrl = `${APP_CONFIG.apiUrl}/super/terminals`;

  /** Listado publico (cualquier usuario autenticado) para selects de terminal. */
  listarPublicas(): Observable<Terminal[]> {
    return this.http.get<Terminal[]>(`${APP_CONFIG.apiUrl}/users/terminals`);
  }

  listar(params: ListTerminalesParams = {}): Observable<ListTerminalesResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);

    return this.http.get<ListTerminalesResponse>(this.terminalsUrl, { params: query });
  }

  obtener(uuid: string): Observable<Terminal> {
    return this.http.get<Terminal>(`${this.terminalsUrl}/${uuid}`);
  }

  crear(datos: CreateTerminalRequest): Observable<Terminal> {
    return this.http.post<Terminal>(this.terminalsUrl, datos);
  }

  actualizar(uuid: string, datos: UpdateTerminalRequest): Observable<Terminal> {
    return this.http.put<Terminal>(`${this.terminalsUrl}/${uuid}`, datos);
  }

  eliminar(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.terminalsUrl}/${uuid}`);
  }
}
