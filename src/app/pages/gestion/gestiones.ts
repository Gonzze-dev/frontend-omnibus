/**
 * Catalogo de las gestiones del dashboard.
 *
 * Cada card del dashboard abre una seccion de este archivo, y cada
 * opcion de una seccion es un endpoint de internal/router/admin.go o
 * internal/router/super_admin.go. Tener el mapeo en un solo lugar evita
 * que la pantalla y el backend se desincronicen.
 */

export type Glifo =
  | 'lista'
  | 'buscar'
  | 'alta'
  | 'editar'
  | 'eliminar'
  | 'ascender'
  | 'descender'
  | 'escudo'
  | 'enviar'
  | 'retraso';

export type Tono = 'azul' | 'indigo' | 'carmin' | 'tinta' | 'naranja';

export interface Opcion {
  id: string;
  titulo: string;
  bajada: string;
  icono: Glifo;
  tono: Tono;
  /** Endpoint que va a cubrir la pantalla, para no perder el mapeo. */
  endpoint: string;
  /** El endpoint vive en /api/super: solo lo puede usar un super admin. */
  soloSuper?: boolean;
  /** Pantalla que resuelve la opcion. */
  ruta: string;
}

export interface Grupo {
  id: string;
  titulo: string;
  opciones: readonly Opcion[];
}

export interface Seccion {
  /** Coincide con el id del acceso en el dashboard y con la ruta. */
  id: string;
  titulo: string;
  bajada: string;
  /** Contador de cabecera. Las secciones que no cuentan filas no lo tienen. */
  resumen?: { valor: number; etiqueta: string; tono: Tono };
  grupos: readonly Grupo[];
}

/**
 * Criterio de color, igual en todas las secciones: el listado y el alta
 * usan el tono de la card, las consultas puntuales y la edicion van en
 * azul, y todo lo destructivo en carmin.
 *
 * Los contadores son datos de ejemplo, como los del dashboard, hasta
 * que existan los endpoints de conteo.
 */
export const SECCIONES: readonly Seccion[] = [
  {
    id: 'ciudades',
    titulo: 'Gestionar Ciudades',
    bajada: 'Elegi que queres hacer con las ciudades del sistema.',
    resumen: { valor: 124, etiqueta: 'ciudades cargadas', tono: 'azul' },
    grupos: [
      {
        id: 'consultar',
        titulo: 'Consultar',
        opciones: [
          {
            id: 'listar',
            titulo: 'Ver ciudades',
            bajada: 'Listado completo con su codigo postal, con filtro de busqueda',
            icono: 'lista',
            tono: 'azul',
            endpoint: 'GET /api/admin/cities',
            ruta: '/dashboard/ciudades/listar',
          },
        ],
      },
      {
        id: 'administrar',
        titulo: 'Administrar',
        opciones: [
          {
            id: 'crear',
            titulo: 'Cargar ciudad',
            bajada: 'Alta de una ciudad nueva',
            icono: 'alta',
            tono: 'azul',
            endpoint: 'POST /api/admin/cities',
            ruta: '/dashboard/ciudades/crear',
          },
        ],
      },
    ],
  },
  {
    id: 'plataformas',
    titulo: 'Gestionar Plataformas',
    bajada: 'Elegi que queres hacer con los andenes del sistema.',
    resumen: { valor: 38, etiqueta: 'plataformas activas', tono: 'indigo' },
    grupos: [
      {
        id: 'consultar',
        titulo: 'Consultar',
        opciones: [
          {
            id: 'listar',
            titulo: 'Ver plataformas',
            bajada: 'Terminales con sus andenes, con filtro de busqueda',
            icono: 'lista',
            tono: 'indigo',
            endpoint: 'GET /api/admin/platforms',
            ruta: '/dashboard/plataformas/listar',
          },
        ],
      },
      {
        id: 'administrar',
        titulo: 'Administrar',
        opciones: [
          {
            id: 'crear',
            titulo: 'Cargar plataforma',
            bajada: 'Alta de un anden nuevo en una terminal',
            icono: 'alta',
            tono: 'indigo',
            endpoint: 'POST /api/admin/platforms',
            ruta: '/dashboard/plataformas/crear',
          },
        ],
      },
    ],
  },
  {
    id: 'terminales',
    titulo: 'Gestionar Terminales',
    bajada: 'Toda esta seccion es exclusiva del super admin.',
    resumen: { valor: 1842, etiqueta: 'terminales en linea', tono: 'carmin' },
    grupos: [
      {
        id: 'consultar',
        titulo: 'Consultar',
        opciones: [
          {
            id: 'listar',
            titulo: 'Ver terminales',
            bajada: 'Listado completo con su ciudad, con filtro de busqueda',
            icono: 'lista',
            tono: 'carmin',
            endpoint: 'GET /api/super/terminals',
            soloSuper: true,
            ruta: '/dashboard/terminales/listar',
          },
        ],
      },
      {
        id: 'administrar',
        titulo: 'Administrar',
        opciones: [
          {
            id: 'crear',
            titulo: 'Cargar terminal',
            bajada: 'Alta de una terminal nueva en una ciudad',
            icono: 'alta',
            tono: 'carmin',
            endpoint: 'POST /api/super/terminals',
            soloSuper: true,
            ruta: '/dashboard/terminales/crear',
          },
        ],
      },
    ],
  },
  {
    id: 'permisos',
    titulo: 'Control de Permisos',
    bajada: 'Busca una cuenta y cambiale el rol dentro del sistema.',
    grupos: [
      {
        id: 'consultar',
        titulo: 'Consultar',
        opciones: [
          {
            id: 'buscar',
            titulo: 'Buscar usuario',
            bajada: 'Ver la cuenta y su rol actual por email',
            icono: 'buscar',
            tono: 'azul',
            endpoint: 'GET /api/admin/users/by-email',
            ruta: '/dashboard/permisos/buscar',
          },
        ],
      },
      {
        id: 'admin',
        titulo: 'Rol administrador',
        opciones: [
          {
            id: 'promover',
            titulo: 'Promover a admin',
            bajada: 'Le da acceso a ciudades, plataformas y avisos',
            icono: 'ascender',
            tono: 'tinta',
            endpoint: 'POST /api/admin/users/promote',
            ruta: '/dashboard/permisos/promover',
          },
          {
            id: 'degradar',
            titulo: 'Quitar rol de admin',
            bajada: 'La cuenta vuelve a ser un usuario comun',
            icono: 'descender',
            tono: 'carmin',
            endpoint: 'POST /api/admin/users/demote',
            ruta: '/dashboard/permisos/degradar',
          },
        ],
      },
      {
        id: 'super',
        titulo: 'Rol super admin',
        opciones: [
          {
            id: 'promover-super',
            titulo: 'Promover a super admin',
            bajada: 'Suma el manejo de terminales y de roles super',
            icono: 'escudo',
            tono: 'tinta',
            endpoint: 'POST /api/super/users/promote-super',
            soloSuper: true,
            ruta: '/dashboard/permisos/promover-super',
          },
          {
            id: 'degradar-super',
            titulo: 'Quitar rol de super admin',
            bajada: 'La cuenta queda como admin',
            icono: 'descender',
            tono: 'carmin',
            endpoint: 'POST /api/super/users/demote-super',
            soloSuper: true,
            ruta: '/dashboard/permisos/degradar-super',
          },
        ],
      },
    ],
  },
  {
    id: 'notificaciones',
    titulo: 'Gestionar notificaciones',
    bajada: 'Manda avisos a los pasajeros y revisa los que ya salieron.',
    grupos: [
      {
        id: 'enviar',
        titulo: 'Enviar',
        opciones: [
          {
            id: 'aviso',
            titulo: 'Enviar aviso',
            bajada: 'Notificacion general para los pasajeros',
            icono: 'enviar',
            tono: 'naranja',
            endpoint: 'POST /api/admin/notifications',
            ruta: '/dashboard/notificaciones/aviso',
          },
          {
            id: 'retraso',
            titulo: 'Avisar un retraso',
            bajada: 'Alerta de demora para un colectivo puntual',
            icono: 'retraso',
            tono: 'azul',
            endpoint: 'POST /api/admin/notify-bus-delay',
            ruta: '/dashboard/notificaciones/retraso',
          },
        ],
      },
      {
        id: 'administrar',
        titulo: 'Administrar',
        opciones: [
          {
            id: 'eliminar',
            titulo: 'Eliminar aviso',
            bajada: 'Baja de una notificacion ya enviada',
            icono: 'eliminar',
            tono: 'carmin',
            endpoint: 'DELETE /api/admin/notifications',
            ruta: '/dashboard/notificaciones/eliminar',
          },
        ],
      },
    ],
  },
];

export function buscarSeccion(id: string | null): Seccion | undefined {
  return SECCIONES.find((s) => s.id === id);
}
