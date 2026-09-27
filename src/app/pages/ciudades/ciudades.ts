import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';

export type AccionCiudad = 'listar' | 'crear' | 'editar' | 'eliminar';

interface VistaCiudad {
  titulo: string;
  bajada: string;
}

const VISTAS: Record<AccionCiudad, VistaCiudad> = {
  listar: {
    titulo: 'Ver ciudades',
    bajada: 'Listado completo con su codigo postal. Filtra para encontrar una puntual.',
  },
  crear: {
    titulo: 'Cargar ciudad',
    bajada: 'Alta de una ciudad nueva en el sistema.',
  },
  editar: {
    titulo: 'Editar ciudad',
    bajada: 'Cambia el nombre o el codigo postal.',
  },
  eliminar: {
    titulo: 'Eliminar ciudad',
    bajada: 'Baja definitiva del sistema.',
  },
};

/** Datos de ejemplo hasta que exista la conexion con GET /api/admin/cities. */
const CIUDADES_EJEMPLO = [
  { postal_code: '2820', name: 'Gualeguaychú' },
  { postal_code: '1004', name: 'Buenos Aires 1004' },
  { postal_code: '2000', name: 'Rosario' },
  { postal_code: '5000', name: 'Córdoba' },
  { postal_code: '5500', name: 'Mendoza' },
  { postal_code: '4000', name: 'San Miguel de Tucumán' },
  { postal_code: '3100', name: 'Paraná' },
  { postal_code: '3000', name: 'Santa Fe' },
  { postal_code: '7600', name: 'Mar del Plata' },
  { postal_code: '8000', name: 'Bahía Blanca' },
  { postal_code: '8300', name: 'Neuquén' },
  { postal_code: '8400', name: 'San Carlos de Bariloche' },
  { postal_code: '4400', name: 'Salta' },
  { postal_code: '3400', name: 'Corrientes' },
  { postal_code: '3500', name: 'Resistencia' },
  { postal_code: '3300', name: 'Posadas' },
  { postal_code: '5900', name: 'Villa María' },
  { postal_code: '2400', name: 'San Francisco' },
  { postal_code: '6000', name: 'Junín' },
  { postal_code: '7000', name: 'Tandil' },
  { postal_code: '9000', name: 'Comodoro Rivadavia' },
  { postal_code: '9100', name: 'Trelew' },
  { postal_code: '2900', name: 'San Nicolás de los Arroyos' },
  { postal_code: '2600', name: 'Venado Tuerto' },
];

/** Filas que entran en una pagina del listado. */
const POR_PAGINA = 10;

/**
 * Pantallas de CRUD de ciudades. Las opciones de la gestion
 * comparten este componente: cambia la vista segun el parametro
 * :accion, igual que Gestion cambia de seccion.
 */
@Component({
  selector: 'app-ciudades',
  imports: [Topbar, RouterLink],
  templateUrl: './ciudades.html',
  styleUrl: './ciudades.scss',
})
export class Ciudades {
  private readonly ruta = inject(ActivatedRoute);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(() => {
    const accion = this.parametros().get('accion') as AccionCiudad | null;
    return accion && accion in VISTAS ? accion : 'listar';
  });

  protected readonly vista = computed(() => VISTAS[this.accion()]);

  /** Texto del filtro del listado: busca por codigo postal o por nombre. */
  protected readonly filtro = signal('');

  protected readonly pagina = signal(1);

  private readonly filtradas = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return CIUDADES_EJEMPLO;

    return CIUDADES_EJEMPLO.filter(
      (c) => c.postal_code.toLowerCase().includes(texto) || c.name.toLowerCase().includes(texto),
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
  protected readonly ciudades = computed(() => {
    const desde = (this.paginaActual() - 1) * POR_PAGINA;
    return this.filtradas().slice(desde, desde + POR_PAGINA);
  });

  /**
   * Filas en blanco que completan la pagina. La tabla mide siempre lo
   * mismo, asi el paginado y el boton de cargar no se mueven cuando la
   * ultima pagina o el filtro devuelven menos de 10 ciudades.
   */
  protected readonly relleno = computed(() =>
    Array.from({ length: Math.max(0, POR_PAGINA - (this.ciudades().length || 1)) }),
  );

  protected filtrar(texto: string): void {
    this.filtro.set(texto);
    this.pagina.set(1);
  }

  protected irA(pagina: number): void {
    this.pagina.set(Math.min(Math.max(pagina, 1), this.totalPaginas()));
  }

  /** Ciudad de ejemplo para precargar el detalle, editar o confirmar la baja. */
  protected readonly ciudadSeleccionada = CIUDADES_EJEMPLO[0];
}

export const tituloCiudades: ResolveFn<string> = (ruta) => {
  const accion = (ruta.paramMap.get('accion') as AccionCiudad | null) ?? 'listar';
  return VISTAS[accion]?.titulo ?? VISTAS['listar'].titulo;
};
