import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * The route only exists with an active session; without one it goes back to login.
 * It is only for navigation: the backend is the one that authorizes.
 */
export const authenticatedOnly: CanMatchFn = () =>
  inject(AuthService).isAuthenticated() || inject(Router).parseUrl('/login');

/**
 * Guest screens (login, sign up): with an active session it goes
 * straight to the role's initial screen (dashboard or home).
 */
export const guestsOnly: CanMatchFn = () => {
  const auth = inject(AuthService);
  return !auth.isAuthenticated() || inject(Router).parseUrl(auth.homeRoute());
};
