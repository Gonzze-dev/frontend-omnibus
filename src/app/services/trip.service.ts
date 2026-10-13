import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import { Terminal, ViajeEsperado } from '../models/viaje.model';

/** Endpoints del pasajero para buscar su viaje y quedar a la espera. */
@Injectable({ providedIn: 'root' })
export class ViajeService {
  private readonly http = inject(HttpClient);
  private readonly busesUrl = `${APP_CONFIG.apiUrl}/buses`;

  terminales(): Observable<Terminal[]> {
    return this.http.get<Terminal[]>(`${APP_CONFIG.apiUrl}/users/terminals`);
  }

  /**
   * El backend valida el pasaje contra el sistema de terminales y deja al
   * usuario esperando ese colectivo. Reemplaza cualquier espera anterior.
   */
  esperar(terminalId: string, ticket: string): Observable<ViajeEsperado> {
    return this.http.post<ViajeEsperado>(`${this.busesUrl}/join`, { terminalId, ticket });
  }

  /** Viaje que el usuario ya estaba esperando (404 si no hay ninguno). */
  enEspera(): Observable<ViajeEsperado> {
    return this.http.get<ViajeEsperado>(`${this.busesUrl}/awaited`);
  }

  dejarDeEsperar(): Observable<void> {
    return this.http.delete<void>(`${this.busesUrl}/awaited`);
  }
}
