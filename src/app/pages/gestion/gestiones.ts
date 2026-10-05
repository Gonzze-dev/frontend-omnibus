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
  | 'enviar';

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
            bajada: 'Notificacion general o retraso de un colectivo',
            icono: 'enviar',
            tono: 'naranja',
            endpoint: 'POST /api/admin/notifications',
            ruta: '/dashboard/notificaciones/aviso',
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
