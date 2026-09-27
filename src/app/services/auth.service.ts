import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize, map, Observable, shareReplay, tap } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  RegisterRequest,
  User,
} from '../models/auth.model';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'auth_user';

/**
 * Sesion del usuario contra /api/auth.
 * El access token y el usuario se guardan en localStorage; el refresh
 * token viaja en una cookie HttpOnly que maneja el backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authUrl = `${APP_CONFIG.apiUrl}/auth`;

  private readonly _accessToken = signal<string | null>(leer(TOKEN_KEY));
  private readonly _user = signal<User | null>(leerUsuario());

  readonly accessToken = this._accessToken.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._accessToken());

  /** Refresh en curso, compartido para no disparar varios a la vez. */
  private refresh$: Observable<string> | null = null;

  login(credenciales: LoginRequest): Observable<User> {
    return this.http.post<LoginResponse>(`${this.authUrl}/login`, credenciales).pipe(
      tap((res) => {
        this.guardarToken(res.access_token);
        this._user.set(res.user);
        guardar(USER_KEY, JSON.stringify(res.user));
      }),
      map((res) => res.user),
    );
  }

  register(datos: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.authUrl}/register`, datos);
  }

  /** Pide un access token nuevo usando la cookie de refresh. */
  refreshToken(): Observable<string> {
    this.refresh$ ??= this.http.post<RefreshResponse>(`${this.authUrl}/refresh`, null).pipe(
      map((res) => res.access_token),
      tap((token) => this.guardarToken(token)),
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

  clearSession(): void {
    this._accessToken.set(null);
    this._user.set(null);
    borrar(TOKEN_KEY);
    borrar(USER_KEY);
    this.router.navigate(['/login']);
  }

  /** Pantalla inicial segun el rol: los administradores van al dashboard. */
  rutaInicio(user: User | null = this._user()): string {
    return user?.rol === 'admin' || user?.rol === 'super_admin' ? '/dashboard' : '/home';
  }

  private guardarToken(token: string): void {
    this._accessToken.set(token);
    guardar(TOKEN_KEY, token);
  }
}

// localStorage puede fallar (modo privado, almacenamiento bloqueado)
function leer(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function guardar(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function borrar(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function leerUsuario(): User | null {
  const raw = leer(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
