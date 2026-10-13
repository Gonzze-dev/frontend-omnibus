import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  City,
  CreateCityRequest,
  ListCitiesParams,
  ListCitiesResponse,
  UpdateCityRequest,
} from '../models/city.model';

/** Cities CRUD against /api/admin/cities. */
@Injectable({ providedIn: 'root' })
export class CityService {
  private readonly http = inject(HttpClient);
  private readonly citiesUrl = `${APP_CONFIG.apiUrl}/admin/cities`;

  list(params: ListCitiesParams = {}): Observable<ListCitiesResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);

    return this.http.get<ListCitiesResponse>(this.citiesUrl, { params: query });
  }

  get(postalCode: string): Observable<City> {
    return this.http.get<City>(`${this.citiesUrl}/${postalCode}`);
  }

  create(data: CreateCityRequest): Observable<City> {
    return this.http.post<City>(this.citiesUrl, data);
  }

  update(postalCode: string, data: UpdateCityRequest): Observable<City> {
    return this.http.put<City>(`${this.citiesUrl}/${postalCode}`, data);
  }

  delete(postalCode: string): Observable<void> {
    return this.http.delete<void>(`${this.citiesUrl}/${postalCode}`);
  }
}
