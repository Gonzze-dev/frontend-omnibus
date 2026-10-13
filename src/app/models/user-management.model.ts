/** Terminal managed by an admin (models.ProfileTerminalRef). */
export interface AssignedTerminal {
  uuid: string;
  name: string;
}

/** User in the GET /api/admin/users list (models.UserListItem). */
export interface ListedUser {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  terminals: AssignedTerminal[];
}

/** GET /api/admin/users (models.ListUsersResponse). */
export interface ListUsersResponse {
  users: ListedUser[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  /** Filters by name or email. */
  search?: string;
}
