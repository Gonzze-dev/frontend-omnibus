import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { TerminalService } from '../../services/terminal.service';
import { CiudadService } from '../../services/ciudad.service';
import { Terminal } from '../../models/terminal.model';
import { Ciudad } from '../../models/ciudad.model';

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Filas que entran en una pagina del listado. */
const POR_PAGINA = 10;

/** Cantidad de filas que se piden al backend para filtrar/paginar en el cliente. */
const LIMITE_BACKEND = 500;

/**
 * Pantallas de ABM de terminales. Toda la seccion es exclusiva
 * del super admin: los endpoints viven en /api/super.
 */
@Component({
  selector: 'app-terminales',
  imports: [Topbar, RouterLink, ReactiveFormsModule],
  templateUrl: './terminales.html',
  styleUrl: './terminales.scss',
})
export class Terminales {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly terminalService = inject(TerminalService);
  private readonly ciudadService = inject(CiudadService);
  private readonly fb = inject(FormBuilder);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(() => {
    const accion = this.parametros().get('accion') as AccionTerminal | null;
    return accion && accion in VISTAS ? accion : 'listar';
  });

  /** Uuid de la terminal a editar/eliminar, si la ruta lo trae. */
  private readonly codigo = computed(() => this.parametros().get('codigo'));

  protected readonly vista = computed(() => VISTAS[this.accion()]);

  protected readonly ciudades = signal<Ciudad[]>([]);

  /** Texto del filtro del listado: nombre, codigo postal o identificadores. */
  protected readonly filtro = signal('');

  protected readonly pagina = signal(1);

  // --- Listado ---
  protected readonly cargandoListado = signal(false);
  protected readonly errorListado = signal<string | null>(null);
  private readonly todasLasTerminales = signal<Terminal[]>([]);

  private readonly filtradas = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    const terminales = this.todasLasTerminales();
    if (!texto) return terminales;

    return terminales.filter((t) =>
      [t.name, t.postal_code, t.uuid, t.external_terminal_id ?? ''].some((campo) =>
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

  // --- Alta ---
  protected readonly formCrear = this.fb.nonNullable.group({
    name: ['', Validators.required],
    postal_code: ['', Validators.required],
    external_terminal_id: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
  });
  protected readonly guardandoCrear = signal(false);
  protected readonly errorCrear = signal<string | null>(null);

  // --- Edicion ---
  protected readonly formEditar = this.fb.nonNullable.group({
    name: ['', Validators.required],
    postal_code: ['', Validators.required],
    external_terminal_id: ['', [Validators.required, Validators.pattern(UUID_PATTERN)]],
  });
  protected readonly cargandoSeleccionada = signal(false);
  protected readonly errorSeleccionada = signal<string | null>(null);
  protected readonly guardandoEditar = signal(false);
  protected readonly errorEditar = signal<string | null>(null);

  // --- Baja ---
  protected readonly terminalSeleccionada = signal<Terminal | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly errorEliminar = signal<string | null>(null);

  constructor() {
    this.cargarCiudades();

    effect(() => {
      const accion = this.accion();

      if (accion === 'listar') {
        this.cargarTerminales();
      } else if (accion === 'editar' || accion === 'eliminar') {
        this.cargarSeleccionada(this.codigo());
      } else if (accion === 'crear') {
        this.formCrear.reset();
        this.errorCrear.set(null);
      }
    });
  }

  private cargarCiudades(): void {
    this.ciudadService.listar({ limit: LIMITE_BACKEND, order: 'ASC' }).subscribe({
      next: (res) => this.ciudades.set(res.cities),
    });
  }

  private cargarTerminales(): void {
    this.cargandoListado.set(true);
    this.errorListado.set(null);

    this.terminalService.listar({ limit: LIMITE_BACKEND, order: 'ASC' }).subscribe({
      next: (res) => {
        this.todasLasTerminales.set(res.terminals);
        this.cargandoListado.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoListado.set(false);
        this.errorListado.set(mensajeError(err));
      },
    });
  }

  private cargarSeleccionada(uuid: string | null): void {
    this.terminalSeleccionada.set(null);
    this.errorSeleccionada.set(null);
    this.errorEliminar.set(null);

    if (!uuid) {
      this.errorSeleccionada.set('No se indico que terminal usar.');
      return;
    }

    this.cargandoSeleccionada.set(true);
    this.terminalService.obtener(uuid).subscribe({
      next: (terminal) => {
        this.cargandoSeleccionada.set(false);
        this.terminalSeleccionada.set(terminal);
        this.formEditar.setValue({
          name: terminal.name,
          postal_code: terminal.postal_code,
          external_terminal_id: terminal.external_terminal_id ?? '',
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
  }

  protected irA(pagina: number): void {
    this.pagina.set(Math.min(Math.max(pagina, 1), this.totalPaginas()));
  }

  protected crear(): void {
    if (this.formCrear.invalid) {
      this.formCrear.markAllAsTouched();
      return;
    }

    this.guardandoCrear.set(true);
    this.errorCrear.set(null);

    const { name, postal_code, external_terminal_id } = this.formCrear.getRawValue();
    this.terminalService
      .crear({
        name: name.trim(),
        postal_code,
        external_terminal_id: external_terminal_id.trim(),
      })
      .subscribe({
        next: () => {
          this.guardandoCrear.set(false);
          this.router.navigateByUrl('/dashboard/terminales/listar');
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

    const seleccionada = this.terminalSeleccionada();
    if (!seleccionada) return;

    this.guardandoEditar.set(true);
    this.errorEditar.set(null);

    const { name, postal_code, external_terminal_id } = this.formEditar.getRawValue();
    this.terminalService
      .actualizar(seleccionada.uuid, {
        name: name.trim(),
        postal_code,
        external_terminal_id: external_terminal_id.trim(),
      })
      .subscribe({
        next: () => {
          this.guardandoEditar.set(false);
          this.router.navigateByUrl('/dashboard/terminales/listar');
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoEditar.set(false);
          this.errorEditar.set(mensajeError(err));
        },
      });
  }

  protected eliminar(): void {
    const seleccionada = this.terminalSeleccionada();
    if (!seleccionada) return;

    this.eliminando.set(true);
    this.errorEliminar.set(null);

    this.terminalService.eliminar(seleccionada.uuid).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.router.navigateByUrl('/dashboard/terminales/listar');
      },
      error: (err: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.errorEliminar.set(mensajeError(err));
      },
    });
  }

  protected invalidoCrear(campo: 'name' | 'postal_code' | 'external_terminal_id'): boolean {
    const control = this.formCrear.controls[campo];
    return control.invalid && control.touched;
  }

  protected invalidoEditar(campo: 'name' | 'postal_code' | 'external_terminal_id'): boolean {
    const control = this.formEditar.controls[campo];
    return control.invalid && control.touched;
  }
}

function mensajeError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
      return 'Revisa los datos: faltan campos o el id externo no es valido.';
    case 404:
      return 'No se encontro la terminal o la ciudad indicada.';
    case 409:
      return 'Ese id externo ya esta en uso por otra terminal.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}

export const tituloTerminales: ResolveFn<string> = (ruta) => {
  const accion = (ruta.paramMap.get('accion') as AccionTerminal | null) ?? 'listar';
  return VISTAS[accion]?.titulo ?? VISTAS['listar'].titulo;
};
