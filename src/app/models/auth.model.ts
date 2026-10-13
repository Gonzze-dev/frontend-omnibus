/** Roles defined in the backend (internal/roles/roles.go). */
export type Role = 'user' | 'admin' | 'super_admin';

export interface UserTerminalRef {
  uuid: string;
  name: string;
}

/** User as returned by the backend (models.UserResponse). */
export interface User {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
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

/** POST /api/auth/register (responds 201 with the user, no tokens). */
export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

/** POST /api/auth/refresh: only returns the new access token. */
export interface RefreshResponse {
  access_token: string;
}

/** POST /api/auth/forgot-password */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * The backend always responds with the same message, whether or not the email
 * exists, so it does not reveal which accounts are registered.
 */
export interface ForgotPasswordResponse {
  message: string;
}

/**
 * POST /api/auth/validate-recovery-token: the recovery token travels in the
 * Authorization header, not in the body.
 */
export interface ValidateRecoveryTokenResponse {
  valid: boolean;
  expires_at?: string;
}

/** POST /api/auth/reset-password (token in the Authorization header). */
export interface ResetPasswordRequest {
  password: string;
}

export interface ResetPasswordResponse {
  message: string;
}

/**
 * PUT /api/users/me: partial patch, only the fields that changed are sent
 * (the backend requires at least one and responds with the updated user).
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
