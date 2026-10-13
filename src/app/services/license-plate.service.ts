import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';

export interface ReadLicensePlateResponse {
  license_plate: string;
}

/**
 * Reads license plates from a photo. The backend forwards the image to the
 * OCR microservice, so its API key is not exposed in the browser.
 */
@Injectable({ providedIn: 'root' })
export class LicensePlateService {
  private readonly http = inject(HttpClient);
  private readonly url = `${APP_CONFIG.apiUrl}/admin/license-plate/read`;

  read(image: Blob): Observable<ReadLicensePlateResponse> {
    const data = new FormData();
    data.append('image', image, 'license-plate.jpg');
    return this.http.post<ReadLicensePlateResponse>(this.url, data);
  }
}
