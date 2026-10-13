import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Role } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

/**
 * The route only exists for those roles; everyone else goes back to their initial
 * screen. It is only for navigation: the backend is the one that authorizes.
 */
export const rolesOnly =
  (...roles: Role[]): CanMatchFn =>
  () => {
    const auth = inject(AuthService);
    return auth.hasRole(...roles) || inject(Router).parseUrl(auth.homeRoute());
  };
