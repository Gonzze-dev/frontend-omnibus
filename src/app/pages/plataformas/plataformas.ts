import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';

export type AccionPlataforma = 'listar' | 'crear' | 'editar' | 'eliminar';

interface VistaPlataforma {
  titulo: string;
  bajada: string;
}

const VISTAS: Record<AccionPlataforma, VistaPlataforma> = {
  listar: {
    titulo: 'Ver plataformas',
    bajada: 'Abri una terminal para ver sus andenes y sus coordenadas.',
  },
  crear: {
    titulo: 'Cargar plataforma',
    bajada: 'Alta de un anden nuevo en una terminal.',
  },
  editar: {
    titulo: 'Editar plataforma',
    bajada: 'Cambia el anden o su ubicacion.',
  },
  eliminar: {
    titulo: 'Eliminar plataforma',
    bajada: 'Baja definitiva del sistema.',
  },
};

/** Terminales de ejemplo para los selects, hasta que exista la conexion. */
const TERMINALES_EJEMPLO = [
  { uuid: 'a0000000-0000-0000-0000-000000000001', name: 'Terminal Retiro BS AS' },
  { uuid: 'a0000000-0000-0000-0000-000000000002', name: 'Terminal Gualeguaychu' },
];

/** Datos de ejemplo hasta que exista la conexion con GET /api/admin/platforms. */
const PLATAFORMAS_EJEMPLO = [
  {
    uuid: 'a0000000-0000-0000-0000-000000000001',
    terminal: 'Terminal Retiro BS AS',
    andenes: [
      { code: 1, anden: 'A1', lat: -34.602700000000006, lng: -58.3826 },
      { code: 2, anden: 'B2', lat: -34.6017, lng: -58.3836 },
      { code: 3, anden: 'B3', lat: -34.6007, lng: -58.3846 },
      { code: 4, anden: 'C1', lat: -34.599700000000006, lng: -58.3856 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000002',
    terminal: 'Terminal Gualeguaychu',
    andenes: [
      { code: 5, anden: 'A20', lat: -33.0045, lng: -58.522200000000005 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000003',
    terminal: 'Terminal Rosario',
    andenes: [
      { code: 6, anden: 'A1', lat: -32.9408, lng: -60.6453 },
      { code: 7, anden: 'A2', lat: -32.939800000000005, lng: -60.6463 },
      { code: 8, anden: 'B1', lat: -32.9388, lng: -60.6473 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000004',
    terminal: 'Terminal Cordoba',
    andenes: [
      { code: 9, anden: 'P1', lat: -31.4111, lng: -64.1978 },
      { code: 10, anden: 'P2', lat: -31.4101, lng: -64.1988 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000005',
    terminal: 'Terminal Mendoza',
    andenes: [
      { code: 11, anden: 'A5', lat: -32.878499999999995, lng: -68.85679999999999 },
      { code: 12, anden: 'A6', lat: -32.8775, lng: -68.8578 },
      { code: 13, anden: 'A7', lat: -32.8765, lng: -68.8588 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000006',
    terminal: 'Terminal Tucuman',
    andenes: [
      { code: 14, anden: 'B1', lat: -26.7943, lng: -65.2316 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000007',
    terminal: 'Terminal Parana',
    andenes: [
      { code: 15, anden: 'A1', lat: -31.7183, lng: -60.5483 },
      { code: 16, anden: 'A2', lat: -31.7173, lng: -60.549299999999995 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000008',
    terminal: 'Terminal Santa Fe',
    andenes: [
      { code: 17, anden: 'C3', lat: -31.6163, lng: -60.717000000000006 },
      { code: 18, anden: 'C4', lat: -31.615299999999998, lng: -60.718 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000009',
    terminal: 'Terminal Mar del Plata',
    andenes: [
      { code: 19, anden: 'A1', lat: -37.9865, lng: -57.5616 },
      { code: 20, anden: 'A2', lat: -37.985499999999995, lng: -57.5626 },
      { code: 21, anden: 'A3', lat: -37.9845, lng: -57.5636 },
      { code: 22, anden: 'A4', lat: -37.9835, lng: -57.5646 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000010',
    terminal: 'Terminal Bahia Blanca',
    andenes: [
      { code: 23, anden: 'B2', lat: -38.695299999999996, lng: -62.289100000000005 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000011',
    terminal: 'Terminal Neuquen',
    andenes: [
      { code: 24, anden: 'A1', lat: -38.9276, lng: -68.0831 },
      { code: 25, anden: 'A2', lat: -38.9266, lng: -68.0841 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000012',
    terminal: 'Terminal Salta',
    andenes: [
      { code: 26, anden: 'D1', lat: -24.7561, lng: -65.44919999999999 },
      { code: 27, anden: 'D2', lat: -24.7551, lng: -65.4502 },
      { code: 28, anden: 'D3', lat: -24.7541, lng: -65.4512 },
    ],
  },
  {
    uuid: 'a0000000-0000-0000-0000-000000000013',
    terminal: 'Terminal Corrientes',
    andenes: [
      { code: 29, anden: 'A9', lat: -27.4402, lng: -58.8596 },
    ],
  },
];

/** Terminales que entran en una pagina del listado. */
const POR_PAGINA = 10;

/**
 * Pantallas de ABM de plataformas. Las cinco opciones de la
 * gestion comparten este componente y cambian segun :accion.
 */
@Component({
  selector: 'app-plataformas',
  imports: [Topbar, RouterLink],
  templateUrl: './plataformas.html',
  styleUrl: './plataformas.scss',
})
export class Plataformas {
  private readonly ruta = inject(ActivatedRoute);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(() => {
    const accion = this.parametros().get('accion') as AccionPlataforma | null;
    return accion && accion in VISTAS ? accion : 'listar';
  });

  protected readonly vista = computed(() => VISTAS[this.accion()]);

  protected readonly terminales = TERMINALES_EJEMPLO;

  /** Texto del filtro: nombre de la terminal, anden o codigo de anden. */
  protected readonly filtro = signal('');

  protected readonly pagina = signal(1);

  /** Terminal desplegada, o null si estan todas cerradas. */
  protected readonly abierta = signal<string | null>(null);

  private readonly filtradas = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return PLATAFORMAS_EJEMPLO;

    return PLATAFORMAS_EJEMPLO.filter(
      (g) =>
        g.terminal.toLowerCase().includes(texto) ||
        g.andenes.some(
          (a) => a.anden.toLowerCase().includes(texto) || String(a.code).includes(texto),
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

  /** Las 10 terminales de la pagina actual, cada una con sus andenes. */
  protected readonly grupos = computed(() => {
    const desde = (this.paginaActual() - 1) * POR_PAGINA;
    return this.filtradas().slice(desde, desde + POR_PAGINA);
  });

  /**
   * Filas en blanco que completan la pagina. Con todas las terminales
   * cerradas la tabla mide siempre lo mismo, asi el paginado y el boton
   * de cargar no se mueven de una pagina a otra.
   */
  protected readonly relleno = computed(() =>
    Array.from({ length: Math.max(0, POR_PAGINA - (this.grupos().length || 1)) }),
  );

  protected filtrar(texto: string): void {
    this.filtro.set(texto);
    this.pagina.set(1);
    this.abierta.set(null);
  }

  protected irA(pagina: number): void {
    this.pagina.set(Math.min(Math.max(pagina, 1), this.totalPaginas()));
    this.abierta.set(null);
  }

  /** Una terminal abierta a la vez: volver a tocarla la cierra. */
  protected desplegar(uuid: string): void {
    this.abierta.update((actual) => (actual === uuid ? null : uuid));
  }

  /** Anden de ejemplo para precargar el detalle, editar o confirmar la baja. */
  protected readonly plataformaSeleccionada = {
    ...PLATAFORMAS_EJEMPLO[0].andenes[1],
    terminal: PLATAFORMAS_EJEMPLO[0].terminal,
  };
}

export const tituloPlataformas: ResolveFn<string> = (ruta) => {
  const accion = (ruta.paramMap.get('accion') as AccionPlataforma | null) ?? 'listar';
  return VISTAS[accion]?.titulo ?? VISTAS['listar'].titulo;
};
