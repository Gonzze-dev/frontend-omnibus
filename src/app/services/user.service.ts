import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { APP_CONFIG } from '../config';
import { DeleteAccountResponse, UpdateProfileRequest, User } from '../models/auth.model';
import { AuthService } from './auth.service';

/**
 * Profile of the authenticated user against /api/users/me.
 * Every response with the user refreshes the stored session, so the rest
 * of the app (topbar, sidebar) sees the new data without logging in again.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly meUrl = `${APP_CONFIG.apiUrl}/users/me`;

  getProfile(): Observable<User> {
    return this.http.get<User>(this.meUrl).pipe(tap((user) => this.auth.updateUser(user)));
  }

  updateProfile(data: UpdateProfileRequest): Observable<User> {
    return this.http.put<User>(this.meUrl, data).pipe(tap((user) => this.auth.updateUser(user)));
  }

  /**
   * Deletes the account. The backend already invalidates every refresh token, so
   * /logout is not called (it would respond 401): only the local session is cleared.
   */
  deleteAccount(): Observable<DeleteAccountResponse> {
    return this.http.delete<DeleteAccountResponse>(this.meUrl).pipe(tap(() => this.auth.clearSession()));
  }
}
