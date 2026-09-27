import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';

export type AccionPermiso =
  | 'buscar'
  | 'promover'
  | 'degradar'
  | 'promover-super'
  | 'degradar-super';

interface VistaPermiso {
  titulo: string;
  bajada: string;
  /** El endpoint vive en /api/super: solo lo puede usar un super admin. */
  soloSuper?: boolean;
}

const VISTAS: Record<AccionPermiso, VistaPermiso> = {
  buscar: {
    titulo: 'Buscar usuario',
    bajada: 'Ve la cuenta y su rol actual a partir del email.',
  },
  promover: {
    titulo: 'Promover a admin',
    bajada: 'Le da acceso a ciudades, plataformas y avisos de una terminal.',
  },
  degradar: {
    titulo: 'Quitar rol de admin',
    bajada: 'Le saca la terminal. Si no le queda ninguna, vuelve a ser un usuario comun.',
  },
  'promover-super': {
    titulo: 'Promover a super admin',
    bajada: 'Suma el manejo de terminales y de roles super. Pierde sus terminales asignadas.',
    soloSuper: true,
  },
  'degradar-super': {
    titulo: 'Quitar rol de super admin',
    bajada: 'La cuenta vuelve a ser un usuario comun.',
    soloSuper: true,
  },
};

/** Terminales de ejemplo para los selects, hasta que exista la conexion. */
const TERMINALES_EJEMPLO = [
  { uuid: 'a0000000-0000-0000-0000-000000000001', name: 'Terminal Retiro BS AS' },
  { uuid: 'a0000000-0000-0000-0000-000000000002', name: 'Terminal Gualeguaychu' },
];

/** Usuario de ejemplo hasta que exista GET /api/admin/users/by-email. */
const USUARIO_EJEMPLO = {
  uuid: 'd3f1c2a4-8b7e-4c1d-9a2f-5e6b7c8d9e0f',
  first_name: 'Mauro',
  last_name: 'Mendoza',
  email: 'mendozamauro@gmail.com',
  dni: '42464435',
  rol: 'admin',
};

/**
 * Pantallas de control de permisos. Las cinco opciones de la
 * gestion comparten este componente y cambian segun :accion.
 */
@Component({
  selector: 'app-permisos',
  imports: [Topbar, RouterLink],
  templateUrl: './permisos.html',
  styleUrl: './permisos.scss',
})
export class Permisos {
  private readonly ruta = inject(ActivatedRoute);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(
    () => (this.parametros().get('accion') as AccionPermiso | null) ?? 'buscar',
  );

  protected readonly vista = computed(() => VISTAS[this.accion()] ?? VISTAS['buscar']);

  protected readonly terminales = TERMINALES_EJEMPLO;
  protected readonly usuario = USUARIO_EJEMPLO;
}

export const tituloPermisos: ResolveFn<string> = (ruta) => {
  const accion = (ruta.paramMap.get('accion') as AccionPermiso | null) ?? 'buscar';
  return VISTAS[accion]?.titulo ?? 'Permisos';
};
