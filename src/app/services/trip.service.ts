import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import { AwaitedTrip, Terminal } from '../models/trip.model';

/** Passenger endpoints to find their trip and start waiting. */
@Injectable({ providedIn: 'root' })
export class TripService {
  private readonly http = inject(HttpClient);
  private readonly busesUrl = `${APP_CONFIG.apiUrl}/buses`;

  terminals(): Observable<Terminal[]> {
    return this.http.get<Terminal[]>(`${APP_CONFIG.apiUrl}/users/terminals`);
  }

  /**
   * The backend validates the bus ticket against the terminals system and leaves the
   * user waiting for that bus. It replaces any previous wait.
   */
  wait(terminalId: string, ticket: string): Observable<AwaitedTrip> {
    return this.http.post<AwaitedTrip>(`${this.busesUrl}/join`, { terminalId, ticket });
  }

  /** Trip the user was already waiting for (404 if there is none). */
  awaited(): Observable<AwaitedTrip> {
    return this.http.get<AwaitedTrip>(`${this.busesUrl}/awaited`);
  }

  stopWaiting(): Observable<void> {
    return this.http.delete<void>(`${this.busesUrl}/awaited`);
  }
}
