/** Terminal a cargo de un admin (models.ProfileTerminalRef). */
export interface TerminalAsignada {
  uuid: string;
  name: string;
}

/** Usuario dentro del listado de GET /api/admin/users (models.UserListItem). */
export interface UsuarioListado {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  rol: string;
  terminals: TerminalAsignada[];
}

/** GET /api/admin/users (models.ListUsersResponse). */
export interface ListUsuariosResponse {
  users: UsuarioListado[];
  page: number;
  next: number | null;
  prev: number | null;
  elements: number;
  total_elements: number;
}

export interface ListUsuariosParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  /** Filtra por nombre o email. */
  search?: string;
}
