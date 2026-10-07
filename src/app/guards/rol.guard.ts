import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Rol } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

/**
 * La ruta solo existe para esos roles; el resto vuelve a su pantalla
 * inicial. Es solo para la navegacion: quien autoriza es el backend.
 */
export const soloRoles =
  (...roles: Rol[]): CanMatchFn =>
  () => {
    const auth = inject(AuthService);
    return auth.tieneRol(...roles) || inject(Router).parseUrl(auth.rutaInicio());
  };
