import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  EnviarAvisoRequest,
  EnviarAvisoResponse,
  NotificarRetrasoRequest,
  NotificarRetrasoResponse,
  TiposAvisoResponse,
} from '../models/aviso.model';

/** Envio de avisos manuales contra /api/admin (admin y super admin). */
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
}
