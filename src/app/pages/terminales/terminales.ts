import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';

export type AccionTerminal = 'listar' | 'crear' | 'editar' | 'eliminar';

interface VistaTerminal {
  titulo: string;
  bajada: string;
}

const VISTAS: Record<AccionTerminal, VistaTerminal> = {
  listar: {
    titulo: 'Ver terminales',
    bajada: 'Listado completo con su ciudad e id externo. Filtra para encontrar una puntual.',
  },
  crear: {
    titulo: 'Cargar terminal',
    bajada: 'Alta de una terminal nueva en una ciudad.',
  },
  editar: {
    titulo: 'Editar terminal',
    bajada: 'Cambia el nombre, la ciudad o el id externo.',
  },
  eliminar: {
    titulo: 'Eliminar terminal',
    bajada: 'Baja definitiva del sistema.',
  },
};

/** Ciudades de ejemplo para el select: la terminal va sobre un codigo postal existente. */
const CIUDADES_EJEMPLO = [
  { postal_code: '2820', name: 'Gualeguaychú' },
  { postal_code: '1004', name: 'Buenos Aires 1004' },
  { postal_code: '2000', name: 'Rosario' },
];

/** Datos de ejemplo hasta que exista la conexion con GET /api/super/terminals. */
const TERMINALES_EJEMPLO = [
  {
    uuid: 'a0000000-0000-0000-0000-000000000001',
    name: 'Terminal Gualeguaychu',
    postal_code: '2820',
    external_terminal_id: '447ab6ad-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000002',
    name: 'Terminal Retiro BS AS',
    postal_code: '1004',
    external_terminal_id: '447ab6ae-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000003',
    name: 'Terminal Rosario',
    postal_code: '2000',
    external_terminal_id: '447ab6af-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000004',
    name: 'Terminal Cordoba',
    postal_code: '5000',
    external_terminal_id: '447ab6b0-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000005',
    name: 'Terminal Mendoza',
    postal_code: '5500',
    external_terminal_id: '447ab6b1-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000006',
    name: 'Terminal Tucuman',
    postal_code: '4000',
    external_terminal_id: '447ab6b2-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000007',
    name: 'Terminal Parana',
    postal_code: '3100',
    external_terminal_id: '447ab6b3-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000008',
    name: 'Terminal Santa Fe',
    postal_code: '3000',
    external_terminal_id: '447ab6b4-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000009',
    name: 'Terminal Mar del Plata',
    postal_code: '7600',
    external_terminal_id: '447ab6b5-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000010',
    name: 'Terminal Bahia Blanca',
    postal_code: '8000',
    external_terminal_id: '447ab6b6-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000011',
    name: 'Terminal Neuquen',
    postal_code: '8300',
    external_terminal_id: '447ab6b7-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000012',
    name: 'Terminal Salta',
    postal_code: '4400',
    external_terminal_id: '447ab6b8-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000013',
    name: 'Terminal Corrientes',
    postal_code: '3400',
    external_terminal_id: '447ab6b9-91e2-43d4-a72e-1ed619258ac5',
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000014',
    name: 'Terminal Posadas',
    postal_code: '3300',
    external_terminal_id: '447ab6ba-91e2-43d4-a72e-1ed619258ac5',
  },
];

/** Filas que entran en una pagina del listado. */
const POR_PAGINA = 10;

/**
 * Pantallas de ABM de terminales. Toda la seccion es exclusiva
 * del super admin: los endpoints viven en /api/super.
 */
@Component({
  selector: 'app-terminales',
  imports: [Topbar, RouterLink],
  templateUrl: './terminales.html',
  styleUrl: './terminales.scss',
})
export class Terminales {
  private readonly ruta = inject(ActivatedRoute);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(() => {
    const accion = this.parametros().get('accion') as AccionTerminal | null;
    return accion && accion in VISTAS ? accion : 'listar';
  });

  protected readonly vista = computed(() => VISTAS[this.accion()]);

  protected readonly ciudades = CIUDADES_EJEMPLO;

  /** Texto del filtro del listado: nombre, codigo postal o identificadores. */
  protected readonly filtro = signal('');

  protected readonly pagina = signal(1);

  private readonly filtradas = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return TERMINALES_EJEMPLO;

    return TERMINALES_EJEMPLO.filter((t) =>
      [t.name, t.postal_code, t.uuid, t.external_terminal_id].some((campo) =>
        campo.toLowerCase().includes(texto),
      ),
    );
  });

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.filtradas().length / POR_PAGINA)),
  );

  /**
   * Pagina efectiva: si el filtro dejo menos paginas de las que habia,
   * la ultima valida, para no mostrar un listado vacio.
   */
  protected readonly paginaActual = computed(() => Math.min(this.pagina(), this.totalPaginas()));

  protected readonly paginas = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i + 1),
  );

  /** Las 10 filas de la pagina actual. */
  protected readonly terminales = computed(() => {
    const desde = (this.paginaActual() - 1) * POR_PAGINA;
    return this.filtradas().slice(desde, desde + POR_PAGINA);
  });

  /**
   * Filas en blanco que completan la pagina. La tabla mide siempre lo
   * mismo, asi el paginado y el boton de cargar no se mueven cuando la
   * ultima pagina o el filtro devuelven menos de 10 terminales.
   */
  protected readonly relleno = computed(() =>
    Array.from({ length: Math.max(0, POR_PAGINA - (this.terminales().length || 1)) }),
  );

  protected filtrar(texto: string): void {
    this.filtro.set(texto);
    this.pagina.set(1);
  }

  protected irA(pagina: number): void {
    this.pagina.set(Math.min(Math.max(pagina, 1), this.totalPaginas()));
  }

  /** Terminal de ejemplo para precargar el detalle, editar o confirmar la baja. */
  protected readonly terminalSeleccionada = TERMINALES_EJEMPLO[0];
}

export const tituloTerminales: ResolveFn<string> = (ruta) => {
  const accion = (ruta.paramMap.get('accion') as AccionTerminal | null) ?? 'listar';
  return VISTAS[accion]?.titulo ?? VISTAS['listar'].titulo;
};
