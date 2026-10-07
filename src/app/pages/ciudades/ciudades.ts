import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { CiudadService } from '../../services/ciudad.service';
import { Ciudad } from '../../models/ciudad.model';

export type AccionCiudad = 'listar' | 'crear' | 'editar';

interface VistaCiudad {
  titulo: string;
  bajada: string;
}

const VISTAS: Record<AccionCiudad, VistaCiudad> = {
  listar: {
    titulo: 'Gestionar ciudades',
    bajada: 'Gestionar ciudades te permite ver, crear, editar y eliminar ciudades del sistema.',
  },
  crear: {
    titulo: 'Cargar ciudad',
    bajada: 'Alta de una ciudad nueva en el sistema.',
  },
  editar: {
    titulo: 'Editar ciudad',
    bajada: 'Cambia el nombre o el codigo postal.',
  },
};

/** Filas que entran en una pagina del listado. */
const POR_PAGINA = 10;

/** Cantidad de ciudades que se piden al backend para filtrar/paginar en el cliente. */
const LIMITE_BACKEND = 500;

/**
 * Pantallas de CRUD de ciudades. Las opciones de la gestion
 * comparten este componente: cambia la vista segun el parametro
 * :accion, igual que Gestion cambia de seccion.
 */
@Component({
  selector: 'app-ciudades',
  imports: [Topbar, RouterLink, ReactiveFormsModule],
  templateUrl: './ciudades.html',
  styleUrl: './ciudades.scss',
})
export class Ciudades {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ciudadService = inject(CiudadService);
  private readonly fb = inject(FormBuilder);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(() => {
    const accion = this.parametros().get('accion') as AccionCiudad | null;
    return accion && accion in VISTAS ? accion : 'listar';
  });

  /** Codigo postal de la ciudad a editar, si la ruta lo trae. */
  private readonly codigo = computed(() => this.parametros().get('codigo'));

  protected readonly vista = computed(() => VISTAS[this.accion()]);

  /** Texto del filtro del listado: busca por codigo postal o por nombre. */
  protected readonly filtro = signal('');

  protected readonly pagina = signal(1);

  // --- Listado ---
  protected readonly cargandoListado = signal(false);
  protected readonly errorListado = signal<string | null>(null);
  private readonly todasLasCiudades = signal<Ciudad[]>([]);

  private readonly filtradas = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    const ciudades = this.todasLasCiudades();
    if (!texto) return ciudades;

    return ciudades.filter(
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

  // --- Alta (popup sobre el listado) ---
  private readonly dialogoAlta = viewChild<ElementRef<HTMLDialogElement>>('dialogoAlta');
  protected readonly altaAbierta = signal(false);
  protected readonly formCrear = this.fb.nonNullable.group({
    postal_code: ['', Validators.required],
    name: ['', Validators.required],
  });
  protected readonly guardandoCrear = signal(false);
  protected readonly errorCrear = signal<string | null>(null);

  // --- Edicion ---
  protected readonly formEditar = this.fb.nonNullable.group({
    postal_code: ['', Validators.required],
    name: ['', Validators.required],
  });
  protected readonly cargandoSeleccionada = signal(false);
  protected readonly errorSeleccionada = signal<string | null>(null);
  protected readonly guardandoEditar = signal(false);
  protected readonly errorEditar = signal<string | null>(null);

  // --- Edicion: ciudad elegida (popup sobre el listado) ---
  private readonly dialogoEdicion = viewChild<ElementRef<HTMLDialogElement>>('dialogoEdicion');
  protected readonly edicionAbierta = signal(false);
  protected readonly ciudadSeleccionada = signal<Ciudad | null>(null);

  // --- Baja (popup sobre el listado) ---
  private readonly dialogoBaja = viewChild<ElementRef<HTMLDialogElement>>('dialogoBaja');
  protected readonly aEliminar = signal<Ciudad | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly errorEliminar = signal<string | null>(null);

  constructor() {
    effect(() => {
      const accion = this.accion();

      if (accion === 'listar') {
        this.cargarCiudades();
      } else if (accion === 'editar') {
        // La URL vieja de edicion sigue andando: muestra el listado con el popup abierto
        const codigo = this.codigo();
        this.router.navigateByUrl('/dashboard/ciudades', { replaceUrl: true });
        untracked(() => this.abrirEdicion(codigo));
      } else if (accion === 'crear') {
        // La URL vieja de alta sigue andando: muestra el listado con el popup abierto
        this.router.navigateByUrl('/dashboard/ciudades', { replaceUrl: true });
        untracked(() => this.abrirAlta());
      }
    });

    // El <dialog> nativo se abre con showModal() para tener fondo, foco
    // atrapado y cierre con Escape sin escribirlos a mano.
    effect(() => {
      const dialogo = this.dialogoBaja()?.nativeElement;
      if (!dialogo) return;
      if (this.aEliminar() && !dialogo.open) dialogo.showModal();
      if (!this.aEliminar() && dialogo.open) dialogo.close();
    });

    effect(() => {
      const dialogo = this.dialogoAlta()?.nativeElement;
      if (!dialogo) return;
      if (this.altaAbierta() && !dialogo.open) dialogo.showModal();
      if (!this.altaAbierta() && dialogo.open) dialogo.close();
    });

    effect(() => {
      const dialogo = this.dialogoEdicion()?.nativeElement;
      if (!dialogo) return;
      if (this.edicionAbierta() && !dialogo.open) dialogo.showModal();
      if (!this.edicionAbierta() && dialogo.open) dialogo.close();
    });
  }

  private cargarCiudades(): void {
    this.cargandoListado.set(true);
    this.errorListado.set(null);

    this.ciudadService.listar({ limit: LIMITE_BACKEND, order: 'ASC' }).subscribe({
      next: (res) => {
        this.todasLasCiudades.set(res.cities);
        this.cargandoListado.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoListado.set(false);
        this.errorListado.set(mensajeError(err));
      },
    });
  }

  private cargarSeleccionada(codigo: string | null): void {
    this.ciudadSeleccionada.set(null);
    this.errorSeleccionada.set(null);

    if (!codigo) {
      this.errorSeleccionada.set('No se indico que ciudad usar.');
      return;
    }

    this.cargandoSeleccionada.set(true);
    this.ciudadService.obtener(codigo).subscribe({
      next: (ciudad) => {
        this.cargandoSeleccionada.set(false);
        this.ciudadSeleccionada.set(ciudad);
        this.formEditar.setValue({ postal_code: ciudad.postal_code, name: ciudad.name });
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

  protected abrirAlta(): void {
    this.formCrear.reset();
    this.errorCrear.set(null);
    this.altaAbierta.set(true);
  }

  protected cerrarAlta(): void {
    if (this.guardandoCrear()) return;
    this.altaAbierta.set(false);
    this.errorCrear.set(null);
  }

  /** Un click en el fondo (fuera del contenido) cierra el popup de alta. */
  protected clickEnPopupAlta(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cerrarAlta();
  }

  protected abrirEdicion(codigo: string | null): void {
    this.errorEditar.set(null);
    this.edicionAbierta.set(true);
    this.cargarSeleccionada(codigo);
  }

  protected cerrarEdicion(): void {
    if (this.guardandoEditar()) return;
    this.edicionAbierta.set(false);
    this.errorEditar.set(null);
  }

  /** Un click en el fondo (fuera del contenido) cierra el popup de edicion. */
  protected clickEnPopupEdicion(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cerrarEdicion();
  }

  protected crear(): void {
    if (this.formCrear.invalid) {
      this.formCrear.markAllAsTouched();
      return;
    }

    this.guardandoCrear.set(true);
    this.errorCrear.set(null);

    const { postal_code, name } = this.formCrear.getRawValue();
    this.ciudadService.crear({ postal_code: postal_code.trim(), name: name.trim() }).subscribe({
      next: () => {
        this.guardandoCrear.set(false);
        this.altaAbierta.set(false);
        this.cargarCiudades();
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

    const seleccionada = this.ciudadSeleccionada();
    if (!seleccionada) return;

    this.guardandoEditar.set(true);
    this.errorEditar.set(null);

    const { postal_code, name } = this.formEditar.getRawValue();
    this.ciudadService
      .actualizar(seleccionada.postal_code, { postal_code: postal_code.trim(), name: name.trim() })
      .subscribe({
        next: () => {
          this.guardandoEditar.set(false);
          this.edicionAbierta.set(false);
          this.cargarCiudades();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoEditar.set(false);
          this.errorEditar.set(mensajeError(err));
        },
      });
  }

  protected confirmarBaja(ciudad: Ciudad): void {
    this.errorEliminar.set(null);
    this.aEliminar.set(ciudad);
  }

  protected cancelarBaja(): void {
    if (this.eliminando()) return;
    this.aEliminar.set(null);
    this.errorEliminar.set(null);
  }

  /** Un click en el fondo (fuera del contenido) cierra el popup. */
  protected clickEnPopup(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancelarBaja();
  }

  protected eliminar(): void {
    const seleccionada = this.aEliminar();
    if (!seleccionada) return;

    this.eliminando.set(true);
    this.errorEliminar.set(null);

    this.ciudadService.eliminar(seleccionada.postal_code).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.aEliminar.set(null);
        // Se saca la ciudad del listado sin volver a pedirlo al backend
        this.todasLasCiudades.update((ciudades) =>
          ciudades.filter((c) => c.postal_code !== seleccionada.postal_code),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.errorEliminar.set(mensajeError(err));
      },
    });
  }

  protected invalidoCrear(campo: 'postal_code' | 'name'): boolean {
    const control = this.formCrear.controls[campo];
    return control.invalid && control.touched;
  }

  protected invalidoEditar(campo: 'postal_code' | 'name'): boolean {
    const control = this.formEditar.controls[campo];
    return control.invalid && control.touched;
  }
}

function mensajeError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
      return 'El nombre y el codigo postal son obligatorios.';
    case 404:
      return 'No se encontro la ciudad.';
    case 409:
      return 'Ya existe una ciudad con ese codigo postal.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}

export const tituloCiudades: ResolveFn<string> = (ruta) => {
  const accion = (ruta.paramMap.get('accion') as AccionCiudad | null) ?? 'listar';
  return VISTAS[accion]?.titulo ?? VISTAS['listar'].titulo;
};
