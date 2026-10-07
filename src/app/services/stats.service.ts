import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import { CountResponse } from '../models/stats.model';

/** Totales del dashboard contra /api/admin/stats (admin y super admin). */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly statsUrl = `${APP_CONFIG.apiUrl}/admin/stats`;

  /** Cantidad de terminales registradas. */
  totalTerminales(): Observable<number> {
    return this.contar('terminals');
  }

  /** Cantidad de plataformas registradas. */
  totalPlataformas(): Observable<number> {
    return this.contar('platforms');
  }

  /** Cantidad de ciudades registradas. */
  totalCiudades(): Observable<number> {
    return this.contar('cities');
  }

  private contar(recurso: 'terminals' | 'platforms' | 'cities'): Observable<number> {
    return this.http
      .get<CountResponse>(`${this.statsUrl}/${recurso}`)
      .pipe(map((res) => res.total));
  }
}
