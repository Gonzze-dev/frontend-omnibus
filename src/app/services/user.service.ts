import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { APP_CONFIG } from '../config';
import { DeleteAccountResponse, UpdateProfileRequest, User } from '../models/auth.model';
import { AuthService } from './auth.service';

/**
 * Perfil del usuario autenticado contra /api/users/me.
 * Cada respuesta con el usuario refresca la sesion guardada, asi el resto
 * de la app (topbar, sidebar) ve los datos nuevos sin volver a loguearse.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly meUrl = `${APP_CONFIG.apiUrl}/users/me`;

  obtenerPerfil(): Observable<User> {
    return this.http.get<User>(this.meUrl).pipe(tap((user) => this.auth.actualizarUsuario(user)));
  }

  actualizarPerfil(datos: UpdateProfileRequest): Observable<User> {
    return this.http.put<User>(this.meUrl, datos).pipe(tap((user) => this.auth.actualizarUsuario(user)));
  }

  /**
   * Borra la cuenta. El backend ya invalida todos los refresh tokens, asi que
   * no se llama a /logout (responderia 401): solo se limpia la sesion local.
   */
  eliminarCuenta(): Observable<DeleteAccountResponse> {
    return this.http.delete<DeleteAccountResponse>(this.meUrl).pipe(tap(() => this.auth.clearSession()));
  }
}
