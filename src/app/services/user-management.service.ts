import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import { User } from '../models/auth.model';
import { ListUsersParams, ListUsersResponse } from '../models/user-management.model';

/**
 * Platform users: listing and role changes.
 * The list and the promotion to admin live in /api/admin (admin and super admin);
 * the promotion to super admin in /api/super.
 */
@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly http = inject(HttpClient);
  private readonly adminUsersUrl = `${APP_CONFIG.apiUrl}/admin/users`;
  private readonly superUsersUrl = `${APP_CONFIG.apiUrl}/super/users`;

  list(params: ListUsersParams = {}): Observable<ListUsersResponse> {
    let query = new HttpParams();
    if (params.page) query = query.set('page', params.page);
    if (params.limit) query = query.set('limit', params.limit);
    if (params.order) query = query.set('order', params.order);
    if (params.search) query = query.set('search', params.search);

    return this.http.get<ListUsersResponse>(this.adminUsersUrl, { params: query });
  }

  /**
   * Makes the user an admin and adds the terminal. An admin can only use
   * their own terminals (the backend responds 403 otherwise); a super admin, any.
   */
  promoteAdmin(email: string, busTerminalId: string): Observable<User> {
    return this.http.post<User>(`${this.adminUsersUrl}/promote`, {
      email,
      bus_terminal_id: busTerminalId,
    });
  }

  /**
   * Removes the terminal from the admin; if they have none left, they become a user again.
   * An admin can only remove their own terminals (403 otherwise); a super admin, any.
   */
  demoteAdmin(email: string, busTerminalId: string): Observable<User> {
    return this.http.post<User>(`${this.adminUsersUrl}/demote`, {
      email,
      bus_terminal_id: busTerminalId,
    });
  }

  /** Super admin only. The user loses the terminals they had assigned. */
  promoteSuper(email: string): Observable<User> {
    return this.http.post<User>(`${this.superUsersUrl}/promote-super`, { email });
  }

  /** Super admin only. The account goes straight back to a regular user. */
  demoteSuper(email: string): Observable<User> {
    return this.http.post<User>(`${this.superUsersUrl}/demote-super`, { email });
  }
}
