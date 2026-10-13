import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';

export interface LeerPatenteResponse {
  license_plate: string;
}

/**
 * Lectura de patentes desde una foto. El backend reenvia la imagen al
 * microservicio de OCR, asi su API key no queda expuesta en el navegador.
 */
@Injectable({ providedIn: 'root' })
export class PatenteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${APP_CONFIG.apiUrl}/admin/license-plate/read`;

  leer(imagen: Blob): Observable<LeerPatenteResponse> {
    const datos = new FormData();
    datos.append('image', imagen, 'patente.jpg');
    return this.http.post<LeerPatenteResponse>(this.url, datos);
  }
}
