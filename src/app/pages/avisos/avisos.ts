import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';

export type AccionAviso = 'aviso' | 'retraso' | 'eliminar';

interface VistaAviso {
  titulo: string;
  bajada: string;
}

const VISTAS: Record<AccionAviso, VistaAviso> = {
  aviso: {
    titulo: 'Enviar aviso',
    bajada: 'Notificacion general para los pasajeros de una terminal.',
  },
  retraso: {
    titulo: 'Avisar un retraso',
    bajada: 'Alerta de demora para un colectivo puntual.',
  },
  eliminar: {
    titulo: 'Eliminar aviso',
    bajada: 'Baja de una notificacion ya enviada.',
  },
};

/** Terminales de ejemplo para los selects, hasta que exista la conexion. */
const TERMINALES_EJEMPLO = [
  { uuid: 'a0000000-0000-0000-0000-000000000001', name: 'Terminal Retiro BS AS' },
  { uuid: 'a0000000-0000-0000-0000-000000000002', name: 'Terminal Gualeguaychu' },
];

/**
 * Tipos que acepta el envio de avisos, de los que devuelve
 * GET /api/admin/notification-types. BUS_DELAY no esta aca porque
 * tiene su propia pantalla: pide patente y fecha del viaje.
 */
const TIPOS_EJEMPLO = [
  { nombre: 'LOCAL', detalle: 'Aviso para los pasajeros de una sola terminal.' },
  { nombre: 'GLOBAL', detalle: 'Aviso para todas las terminales. Solo super admin.' },
];

/** Aviso de ejemplo para la pantalla de baja. */
const AVISO_EJEMPLO = {
  id: '98fb4a77-0a0f-44f0-8067-59e5b7df42ba',
  tipo: 'LOCAL',
  mensaje: 'Ejemplo de mensaje LOCAL',
  terminal: 'Terminal Retiro BS AS',
};

/**
 * Pantallas de gestion de avisos. Las cuatro opciones de la
 * gestion comparten este componente y cambian segun :accion.
 */
@Component({
  selector: 'app-avisos',
  imports: [Topbar, RouterLink],
  templateUrl: './avisos.html',
  styleUrl: './avisos.scss',
})
export class Avisos {
  private readonly ruta = inject(ActivatedRoute);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(
    () => (this.parametros().get('accion') as AccionAviso | null) ?? 'aviso',
  );

  protected readonly vista = computed(() => VISTAS[this.accion()] ?? VISTAS['aviso']);

  protected readonly terminales = TERMINALES_EJEMPLO;
  protected readonly tipos = TIPOS_EJEMPLO;
  protected readonly aviso = AVISO_EJEMPLO;
}

export const tituloAvisos: ResolveFn<string> = (ruta) => {
  const accion = (ruta.paramMap.get('accion') as AccionAviso | null) ?? 'aviso';
  return VISTAS[accion]?.titulo ?? 'Notificaciones';
};
