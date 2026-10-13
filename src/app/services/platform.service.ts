import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  CreatePlataformaRequest,
  ListPlataformasParams,
  ListPlataformasResponse,
  Plataforma,
  TerminalConPlataformas,
  UpdatePlataformaRequest,
} from '../models/plataforma.model';

/** ABM de plataformas (andenes) contra /api/admin/platforms. */
@Injectable({ providedIn: 'root' })
export class PlataformaService {
  private readonly http = inject(HttpClient);
  private readonly platformsUrl = `${APP_CONFIG.apiUrl}/admin/platforms`;

  listar(params: ListPlataformasParams = {}): Observable<ListPlataformasResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);
    if (params.bus_terminal_id) query = query.set('bus_terminal_id', params.bus_terminal_id);

    return this.http.get<ListPlataformasResponse>(this.platformsUrl, { params: query });
  }

  /** Devuelve la terminal duenia del anden, con ese anden como unico elemento de platforms. */
  obtener(code: number): Observable<TerminalConPlataformas> {
    return this.http.get<TerminalConPlataformas>(`${this.platformsUrl}/${code}`);
  }

  crear(datos: CreatePlataformaRequest): Observable<Plataforma> {
    return this.http.post<Plataforma>(this.platformsUrl, datos);
  }

  actualizar(code: number, datos: UpdatePlataformaRequest): Observable<Plataforma> {
    return this.http.put<Plataforma>(`${this.platformsUrl}/${code}`, datos);
  }

  eliminar(code: number): Observable<void> {
    return this.http.delete<void>(`${this.platformsUrl}/${code}`);
  }
}
