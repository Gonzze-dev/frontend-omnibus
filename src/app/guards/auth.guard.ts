import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * La ruta solo existe con sesion iniciada; sin ella se vuelve al login.
 * Es solo para la navegacion: quien autoriza es el backend.
 */
export const soloAutenticados: CanMatchFn = () =>
  inject(AuthService).isAuthenticated() || inject(Router).parseUrl('/login');
