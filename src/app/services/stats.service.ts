import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import { CountResponse } from '../models/stats.model';

/** Dashboard totals against /api/admin/stats (admin and super admin). */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly statsUrl = `${APP_CONFIG.apiUrl}/admin/stats`;

  /** Number of registered terminals. */
  totalTerminals(): Observable<number> {
    return this.count('terminals');
  }

  /** Number of registered platforms. */
  totalPlatforms(): Observable<number> {
    return this.count('platforms');
  }

  /** Number of registered cities. */
  totalCities(): Observable<number> {
    return this.count('cities');
  }

  private count(resource: 'terminals' | 'platforms' | 'cities'): Observable<number> {
    return this.http
      .get<CountResponse>(`${this.statsUrl}/${resource}`)
      .pipe(map((res) => res.total));
  }
}
