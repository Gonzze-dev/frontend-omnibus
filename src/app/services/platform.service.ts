import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  CreatePlatformRequest,
  ListPlatformsParams,
  ListPlatformsResponse,
  Platform,
  TerminalWithPlatforms,
  UpdatePlatformRequest,
} from '../models/platform.model';

/** Platforms (bays) CRUD against /api/admin/platforms. */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly platformsUrl = `${APP_CONFIG.apiUrl}/admin/platforms`;

  list(params: ListPlatformsParams = {}): Observable<ListPlatformsResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);
    if (params.bus_terminal_id) query = query.set('bus_terminal_id', params.bus_terminal_id);

    return this.http.get<ListPlatformsResponse>(this.platformsUrl, { params: query });
  }

  /** Returns the terminal that owns the bay, with that bay as the only element of platforms. */
  get(code: number): Observable<TerminalWithPlatforms> {
    return this.http.get<TerminalWithPlatforms>(`${this.platformsUrl}/${code}`);
  }

  create(data: CreatePlatformRequest): Observable<Platform> {
    return this.http.post<Platform>(this.platformsUrl, data);
  }

  update(code: number, data: UpdatePlatformRequest): Observable<Platform> {
    return this.http.put<Platform>(`${this.platformsUrl}/${code}`, data);
  }

  delete(code: number): Observable<void> {
    return this.http.delete<void>(`${this.platformsUrl}/${code}`);
  }
}
