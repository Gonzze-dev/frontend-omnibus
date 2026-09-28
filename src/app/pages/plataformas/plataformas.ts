import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { PlataformaService } from '../../services/plataforma.service';
import { TerminalService } from '../../services/terminal.service';
import { TerminalConPlataformas } from '../../models/plataforma.model';
import { Terminal } from '../../models/terminal.model';

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

/** Terminales que entran en una pagina del listado. */
const POR_PAGINA = 10;

/** Cantidad de filas que se piden al backend para filtrar/paginar en el cliente. */
const LIMITE_BACKEND = 500;

/**
 * Pantallas de ABM de plataformas. Las cinco opciones de la
 * gestion comparten este componente y cambian segun :accion.
 */
@Component({
  selector: 'app-plataformas',
  imports: [Topbar, RouterLink, ReactiveFormsModule],
  templateUrl: './plataformas.html',
  styleUrl: './plataformas.scss',
})
export class Plataformas {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly plataformaService = inject(PlataformaService);
  private readonly terminalService = inject(TerminalService);
  private readonly fb = inject(FormBuilder);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(() => {
    const accion = this.parametros().get('accion') as AccionPlataforma | null;
    return accion && accion in VISTAS ? accion : 'listar';
  });

  /** Codigo del anden a editar/eliminar, si la ruta lo trae. */
  private readonly codigo = computed(() => {
    const raw = this.parametros().get('codigo');
    const code = raw ? Number(raw) : NaN;
    return Number.isInteger(code) ? code : null;
  });

  protected readonly vista = computed(() => VISTAS[this.accion()]);

  protected readonly terminales = signal<Terminal[]>([]);

  /** Texto del filtro: nombre de la terminal, anden o codigo de anden. */
  protected readonly filtro = signal('');

  protected readonly pagina = signal(1);

  /** Terminal desplegada, o null si estan todas cerradas. */
  protected readonly abierta = signal<string | null>(null);

  // --- Listado ---
  protected readonly cargandoListado = signal(false);
  protected readonly errorListado = signal<string | null>(null);
  private readonly todosLosGrupos = signal<TerminalConPlataformas[]>([]);

  private readonly filtradas = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    const grupos = this.todosLosGrupos();
    if (!texto) return grupos;

    return grupos.filter(
      (g) =>
        g.name.toLowerCase().includes(texto) ||
        g.platforms.some(
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

  // --- Alta ---
  protected readonly formCrear = this.fb.nonNullable.group({
    bus_terminal_id: ['', Validators.required],
    anden: ['', Validators.required],
    lat: [0, Validators.required],
    lng: [0, Validators.required],
  });
  protected readonly guardandoCrear = signal(false);
  protected readonly errorCrear = signal<string | null>(null);

  // --- Edicion ---
  protected readonly formEditar = this.fb.nonNullable.group({
    anden: ['', Validators.required],
    lat: [0, Validators.required],
    lng: [0, Validators.required],
  });
  protected readonly cargandoSeleccionada = signal(false);
  protected readonly errorSeleccionada = signal<string | null>(null);
  protected readonly guardandoEditar = signal(false);
  protected readonly errorEditar = signal<string | null>(null);

  // --- Baja ---
  protected readonly plataformaSeleccionada = signal<{
    code: number;
    anden: string;
    lat: number;
    lng: number;
    terminal: string;
  } | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly errorEliminar = signal<string | null>(null);

  constructor() {
    this.cargarTerminales();

    effect(() => {
      const accion = this.accion();

      if (accion === 'listar') {
        this.cargarPlataformas();
      } else if (accion === 'editar' || accion === 'eliminar') {
        this.cargarSeleccionada(this.codigo());
      } else if (accion === 'crear') {
        this.formCrear.reset({ lat: 0, lng: 0 });
        this.errorCrear.set(null);
      }
    });
  }

  private cargarTerminales(): void {
    this.terminalService.listarPublicas().subscribe({
      next: (terminales) => this.terminales.set(terminales),
    });
  }

  private cargarPlataformas(): void {
    this.cargandoListado.set(true);
    this.errorListado.set(null);

    this.plataformaService.listar({ limit: LIMITE_BACKEND, order: 'ASC' }).subscribe({
      next: (res) => {
        this.todosLosGrupos.set(res.platforms);
        this.cargandoListado.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoListado.set(false);
        this.errorListado.set(mensajeError(err));
      },
    });
  }

  private cargarSeleccionada(code: number | null): void {
    this.plataformaSeleccionada.set(null);
    this.errorSeleccionada.set(null);
    this.errorEliminar.set(null);

    if (code === null) {
      this.errorSeleccionada.set('No se indico que plataforma usar.');
      return;
    }

    this.cargandoSeleccionada.set(true);
    this.plataformaService.obtener(code).subscribe({
      next: (grupo) => {
        this.cargandoSeleccionada.set(false);
        const anden = grupo.platforms[0];
        if (!anden) {
          this.errorSeleccionada.set('No se encontro la plataforma.');
          return;
        }

        this.plataformaSeleccionada.set({
          code: anden.code,
          anden: anden.anden,
          lat: anden.coordinates.lat,
          lng: anden.coordinates.lng,
          terminal: grupo.name,
        });
        this.formEditar.setValue({
          anden: anden.anden,
          lat: anden.coordinates.lat,
          lng: anden.coordinates.lng,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoSeleccionada.set(false);
        this.errorSeleccionada.set(mensajeError(err));
      },
    });
  }

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

  protected crear(): void {
    if (this.formCrear.invalid) {
      this.formCrear.markAllAsTouched();
      return;
    }

    this.guardandoCrear.set(true);
    this.errorCrear.set(null);

    const { bus_terminal_id, anden, lat, lng } = this.formCrear.getRawValue();
    this.plataformaService
      .crear({ bus_terminal_id, anden: anden.trim(), coordinates: { lat, lng } })
      .subscribe({
        next: () => {
          this.guardandoCrear.set(false);
          this.router.navigateByUrl('/dashboard/plataformas/listar');
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoCrear.set(false);
          this.errorCrear.set(mensajeError(err));
        },
      });
  }

  protected guardarEdicion(): void {
    if (this.formEditar.invalid) {
      this.formEditar.markAllAsTouched();
      return;
    }

    const seleccionada = this.plataformaSeleccionada();
    if (!seleccionada) return;

    this.guardandoEditar.set(true);
    this.errorEditar.set(null);

    const { anden, lat, lng } = this.formEditar.getRawValue();
    this.plataformaService
      .actualizar(seleccionada.code, { anden: anden.trim(), coordinates: { lat, lng } })
      .subscribe({
        next: () => {
          this.guardandoEditar.set(false);
          this.router.navigateByUrl('/dashboard/plataformas/listar');
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoEditar.set(false);
          this.errorEditar.set(mensajeError(err));
        },
      });
  }

  protected eliminar(): void {
    const seleccionada = this.plataformaSeleccionada();
    if (!seleccionada) return;

    this.eliminando.set(true);
    this.errorEliminar.set(null);

    this.plataformaService.eliminar(seleccionada.code).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.router.navigateByUrl('/dashboard/plataformas/listar');
      },
      error: (err: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.errorEliminar.set(mensajeError(err));
      },
    });
  }

  protected invalidoCrear(campo: 'bus_terminal_id' | 'anden' | 'lat' | 'lng'): boolean {
    const control = this.formCrear.controls[campo];
    return control.invalid && control.touched;
  }

  protected invalidoEditar(campo: 'anden' | 'lat' | 'lng'): boolean {
    const control = this.formEditar.controls[campo];
    return control.invalid && control.touched;
  }
}

function mensajeError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
      return 'Revisa los datos: el anden y las coordenadas son obligatorios.';
    case 403:
      return 'No tenes permisos sobre esa terminal.';
    case 404:
      return 'No se encontro la plataforma o la terminal indicada.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}

export const tituloPlataformas: ResolveFn<string> = (ruta) => {
  const accion = (ruta.paramMap.get('accion') as AccionPlataforma | null) ?? 'listar';
  return VISTAS[accion]?.titulo ?? VISTAS['listar'].titulo;
};
