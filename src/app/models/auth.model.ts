/** Roles definidos en el backend (internal/roles/roles.go). */
export type Rol = 'user' | 'admin' | 'super_admin';

export interface UserTerminalRef {
  uuid: string;
  name: string;
}

/** Usuario tal como lo devuelve el backend (models.UserResponse). */
export interface User {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  rol: Rol;
  created_at?: string;
  updated_at?: string;
  terminals?: UserTerminalRef[];
}

/** POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

/** POST /api/auth/register (responde 201 con el usuario, sin tokens). */
export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

/** POST /api/auth/refresh: solo devuelve el access token nuevo. */
export interface RefreshResponse {
  access_token: string;
}
