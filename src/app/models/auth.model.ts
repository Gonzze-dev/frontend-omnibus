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

/** POST /api/auth/forgot-password */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * El backend responde siempre el mismo mensaje, exista o no el email, para
 * no revelar que cuentas estan registradas.
 */
export interface ForgotPasswordResponse {
  message: string;
}

/**
 * POST /api/auth/validate-recovery-token: el token de recuperacion viaja en
 * el header Authorization, no en el body.
 */
export interface ValidateRecoveryTokenResponse {
  valid: boolean;
  expires_at?: string;
}

/** POST /api/auth/reset-password (token en el header Authorization). */
export interface ResetPasswordRequest {
  password: string;
}

export interface ResetPasswordResponse {
  message: string;
}

/**
 * PUT /api/users/me: patch parcial, solo viajan los campos que cambiaron
 * (el backend exige al menos uno y responde con el usuario actualizado).
 */
export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  password?: string;
}

/** DELETE /api/users/me */
export interface DeleteAccountResponse {
  message: string;
}
