import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Endpoints que no llevan Bearer ni intentan refresh ante un 401. */
const SKIP_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/validate-recovery-token',
  '/api/auth/reset-password',
];

/**
 * Agrega el access token a cada request y, si el backend responde 401,
 * renueva el token con la cookie de refresh y reintenta una vez.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const skip = SKIP_PATHS.some((path) => req.url.includes(path));
  const token = auth.accessToken();

  const conToken = (t: string) => req.clone({ setHeaders: { Authorization: `Bearer ${t}` } });

  return next(token && !skip ? conToken(token) : req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || skip || !token) {
        return throwError(() => error);
      }
      return auth.refreshToken().pipe(
        catchError(() => {
          auth.clearSession();
          return throwError(() => error);
        }),
        switchMap((nuevo) => next(conToken(nuevo))),
      );
    }),
  );
};
