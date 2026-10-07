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
  Rol,
  User,
  ValidateRecoveryTokenResponse,
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
  readonly esSuper = computed(() => this._user()?.rol === 'super_admin');

  tieneRol(...roles: Rol[]): boolean {
    const rol = this._user()?.rol;
    return !!rol && roles.includes(rol);
  }

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

  /**
   * Reemplaza el usuario de la sesion. PUT /users/me no devuelve las
   * terminales del admin, asi que se conservan las que ya habia.
   * Si cambio el rol se pide un access token nuevo: el backend autoriza
   * con el rol del JWT y /auth/refresh lo vuelve a leer de la base.
   */
  actualizarUsuario(user: User): void {
    const rolAnterior = this._user()?.rol;
    const actualizado: User = { ...user, terminals: user.terminals ?? this._user()?.terminals };
    this._user.set(actualizado);
    guardar(USER_KEY, JSON.stringify(actualizado));
    if (rolAnterior && rolAnterior !== actualizado.rol) {
      this.refreshToken().subscribe({ error: () => {} });
    }
  }

  clearSession(): void {
    this.descartarSesion();
    this.router.navigate(['/login']);
  }

  /** Borra la sesion local sin navegar (quien llama decide a donde ir). */
  descartarSesion(): void {
    this._accessToken.set(null);
    this._user.set(null);
    borrar(TOKEN_KEY);
    borrar(USER_KEY);
  }

  /**
   * Pide el correo de recuperacion. Responde igual exista o no la cuenta, asi
   * que la pantalla solo muestra el mensaje que llega.
   */
  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    const body: ForgotPasswordRequest = { email: email.trim() };
    return this.http.post<ForgotPasswordResponse>(`${this.authUrl}/forgot-password`, body);
  }

  /** Comprueba el token del enlace del mail antes de mostrar el formulario. */
  validateRecoveryToken(token: string): Observable<ValidateRecoveryTokenResponse> {
    return this.http.post<ValidateRecoveryTokenResponse>(
      `${this.authUrl}/validate-recovery-token`,
      null,
      { headers: cabeceraRecuperacion(token) },
    );
  }

  /** Guarda la contraseña nueva usando el token del enlace. */
  resetPassword(token: string, password: string): Observable<ResetPasswordResponse> {
    const body: ResetPasswordRequest = { password };
    return this.http.post<ResetPasswordResponse>(`${this.authUrl}/reset-password`, body, {
      headers: cabeceraRecuperacion(token),
    });
  }

  /** Pantalla inicial segun el rol: los administradores van al dashboard. */
  rutaInicio(user: User | null = this._user()): string {
    return esAdmin(user) ? '/dashboard' : '/home';
  }

  private guardarToken(token: string): void {
    this._accessToken.set(token);
    guardar(TOKEN_KEY, token);
  }
}

/**
 * El token de recuperacion no es el de sesion: va como Bearer solo en estas
 * tres llamadas y el interceptor las deja pasar sin tocar (SKIP_PATHS).
 */
function cabeceraRecuperacion(token: string): HttpHeaders {
  return new HttpHeaders({ Authorization: `Bearer ${token.trim()}` });
}

function esAdmin(user: User | null): boolean {
  return user?.rol === 'admin' || user?.rol === 'super_admin';
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
