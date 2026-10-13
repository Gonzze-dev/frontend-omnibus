import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import { User } from '../models/auth.model';
import { ListUsuariosParams, ListUsuariosResponse } from '../models/usuario.model';

/**
 * Usuarios de la plataforma: listado y cambio de rol.
 * El listado y la promocion a admin viven en /api/admin (admin y super admin);
 * la promocion a super admin en /api/super.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly adminUsersUrl = `${APP_CONFIG.apiUrl}/admin/users`;
  private readonly superUsersUrl = `${APP_CONFIG.apiUrl}/super/users`;

  listar(params: ListUsuariosParams = {}): Observable<ListUsuariosResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);
    if (params.search) query = query.set('search', params.search);

    return this.http.get<ListUsuariosResponse>(this.adminUsersUrl, { params: query });
  }

  /**
   * Hace admin al usuario y le suma la terminal. Un admin solo puede usar
   * terminales propias (el backend responde 403 si no); un super admin, cualquiera.
   */
  promoverAdmin(email: string, busTerminalId: string): Observable<User> {
    return this.http.post<User>(`${this.adminUsersUrl}/promote`, {
      email,
      bus_terminal_id: busTerminalId,
    });
  }

  /**
   * Le saca la terminal al admin; si no le queda ninguna, vuelve a ser usuario.
   * Un admin solo puede quitar terminales propias (403 si no); un super admin, cualquiera.
   */
  degradarAdmin(email: string, busTerminalId: string): Observable<User> {
    return this.http.post<User>(`${this.adminUsersUrl}/demote`, {
      email,
      bus_terminal_id: busTerminalId,
    });
  }

  /** Solo super admin. El usuario pierde las terminales que tenia asignadas. */
  promoverSuper(email: string): Observable<User> {
    return this.http.post<User>(`${this.superUsersUrl}/promote-super`, { email });
  }

  /** Solo super admin. La cuenta vuelve directo a usuario comun. */
  degradarSuper(email: string): Observable<User> {
    return this.http.post<User>(`${this.superUsersUrl}/demote-super`, { email });
  }
}
