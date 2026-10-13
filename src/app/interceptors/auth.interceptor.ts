import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Endpoints that carry no Bearer and do not try to refresh on a 401. */
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
 * Adds the access token to every request and, if the backend responds 401,
 * renews the token with the refresh cookie and retries once.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const skip = SKIP_PATHS.some((path) => req.url.includes(path));
  const token = auth.accessToken();

  const withToken = (t: string) => req.clone({ setHeaders: { Authorization: `Bearer ${t}` } });

  return next(token && !skip ? withToken(token) : req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || skip || !token) {
        return throwError(() => error);
      }
      return auth.refreshToken().pipe(
        catchError(() => {
          auth.clearSession();
          return throwError(() => error);
        }),
        switchMap((newToken) => next(withToken(newToken))),
      );
    }),
  );
};
