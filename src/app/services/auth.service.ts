import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize, map, Observable, shareReplay, tap } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  RegisterRequest,
  ResetPasswordRequest,
  ResetPasswordResponse,
  Role,
  User,
  ValidateRecoveryTokenResponse,
} from '../models/auth.model';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'auth_user';

/**
 * User session against /api/auth.
 * The access token and the user are stored in localStorage; the refresh
 * token travels in an HttpOnly cookie handled by the backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authUrl = `${APP_CONFIG.apiUrl}/auth`;

  private readonly _accessToken = signal<string | null>(read(TOKEN_KEY));
  private readonly _user = signal<User | null>(readUser());

  readonly accessToken = this._accessToken.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._accessToken());
  readonly isSuper = computed(() => this._user()?.role === 'super_admin');

  hasRole(...roles: Role[]): boolean {
    const role = this._user()?.role;
    return !!role && roles.includes(role);
  }

  /** Refresh in progress, shared so several are not fired at once. */
  private refresh$: Observable<string> | null = null;

  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<LoginResponse>(`${this.authUrl}/login`, credentials).pipe(
      tap((res) => {
        this.saveToken(res.access_token);
        this._user.set(res.user);
        save(USER_KEY, JSON.stringify(res.user));
      }),
      map((res) => res.user),
    );
  }

  register(data: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.authUrl}/register`, data);
  }

  /** Requests a new access token using the refresh cookie. */
  refreshToken(): Observable<string> {
    this.refresh$ ??= this.http.post<RefreshResponse>(`${this.authUrl}/refresh`, null).pipe(
      map((res) => res.access_token),
      tap((token) => this.saveToken(token)),
      finalize(() => (this.refresh$ = null)),
      shareReplay(1),
    );
    return this.refresh$;
  }

  logout(): void {
    this.http.post(`${this.authUrl}/logout`, null).subscribe({
      complete: () => this.clearSession(),
      error: () => this.clearSession(),
    });
  }

  /**
   * Replaces the session user. PUT /users/me does not return the admin's
   * terminals, so the ones already there are kept.
   * If the role changed a new access token is requested: the backend authorizes
   * with the JWT role and /auth/refresh reads it again from the database.
   */
  updateUser(user: User): void {
    const previousRole = this._user()?.role;
    const updated: User = { ...user, terminals: user.terminals ?? this._user()?.terminals };
    this._user.set(updated);
    save(USER_KEY, JSON.stringify(updated));
    if (previousRole && previousRole !== updated.role) {
      this.refreshToken().subscribe({ error: () => {} });
    }
  }

  clearSession(): void {
    this.discardSession();
    this.router.navigate(['/login']);
  }

  /** Clears the local session without navigating (the caller decides where to go). */
  discardSession(): void {
    this._accessToken.set(null);
    this._user.set(null);
    remove(TOKEN_KEY);
    remove(USER_KEY);
  }

  /**
   * Requests the recovery email. It responds the same whether or not the account
   * exists, so the screen only shows the message that arrives.
   */
  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    const body: ForgotPasswordRequest = { email: email.trim() };
    return this.http.post<ForgotPasswordResponse>(`${this.authUrl}/forgot-password`, body);
  }

  /** Checks the email link token before showing the form. */
  validateRecoveryToken(token: string): Observable<ValidateRecoveryTokenResponse> {
    return this.http.post<ValidateRecoveryTokenResponse>(
      `${this.authUrl}/validate-recovery-token`,
      null,
      { headers: recoveryHeader(token) },
    );
  }

  /** Saves the new password using the link token. */
  resetPassword(token: string, password: string): Observable<ResetPasswordResponse> {
    const body: ResetPasswordRequest = { password };
    return this.http.post<ResetPasswordResponse>(`${this.authUrl}/reset-password`, body, {
      headers: recoveryHeader(token),
    });
  }

  /** Initial screen according to the role: administrators go to the dashboard. */
  homeRoute(user: User | null = this._user()): string {
    return isAdmin(user) ? '/dashboard' : '/home';
  }

  private saveToken(token: string): void {
    this._accessToken.set(token);
    save(TOKEN_KEY, token);
  }
}

/**
 * The recovery token is not the session one: it goes as Bearer only in these
 * three calls and the interceptor lets them through untouched (SKIP_PATHS).
 */
function recoveryHeader(token: string): HttpHeaders {
  return new HttpHeaders({ Authorization: `Bearer ${token.trim()}` });
}

function isAdmin(user: User | null): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

// localStorage can fail (private mode, blocked storage)
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function readUser(): User | null {
  const raw = read(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as User & { rol?: Role };
    // Sessions saved before the field was renamed store the role as `rol`.
    if (!user.role && user.rol) user.role = user.rol;
    delete user.rol;
    return user;
  } catch {
    return null;
  }
}
