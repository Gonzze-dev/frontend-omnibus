import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  Ciudad,
  CreateCiudadRequest,
  ListCiudadesParams,
  ListCiudadesResponse,
  UpdateCiudadRequest,
} from '../models/ciudad.model';

/** ABM de ciudades contra /api/admin/cities. */
@Injectable({ providedIn: 'root' })
export class CiudadService {
  private readonly http = inject(HttpClient);
  private readonly citiesUrl = `${APP_CONFIG.apiUrl}/admin/cities`;

  listar(params: ListCiudadesParams = {}): Observable<ListCiudadesResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);

    return this.http.get<ListCiudadesResponse>(this.citiesUrl, { params: query });
  }

  obtener(postalCode: string): Observable<Ciudad> {
    return this.http.get<Ciudad>(`${this.citiesUrl}/${postalCode}`);
  }

  crear(datos: CreateCiudadRequest): Observable<Ciudad> {
    return this.http.post<Ciudad>(this.citiesUrl, datos);
  }

  actualizar(postalCode: string, datos: UpdateCiudadRequest): Observable<Ciudad> {
    return this.http.put<Ciudad>(`${this.citiesUrl}/${postalCode}`, datos);
  }

  eliminar(postalCode: string): Observable<void> {
    return this.http.delete<void>(`${this.citiesUrl}/${postalCode}`);
  }
}
