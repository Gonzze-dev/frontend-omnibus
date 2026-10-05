import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ResolveFn, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { AuthService } from '../../services/auth.service';
import { AvisoService } from '../../services/aviso.service';
import { TerminalService } from '../../services/terminal.service';
import {
  EstadoNotificacion,
  NotificacionAdmin,
  TipoNotificacion,
} from '../../models/aviso.model';

export type AccionAviso = 'listar' | 'aviso' | 'eliminar';

interface VistaAviso {
  titulo: string;
  bajada: string;
}

const VISTAS: Record<AccionAviso, VistaAviso> = {
  listar: {
    titulo: 'Gestionar notificaciones',
    bajada: 'Revisa los avisos enviados a los pasajeros, de que terminal son y da de baja los que ya no hacen falta.',
  },
  aviso: {
    titulo: 'Enviar aviso',
    bajada: 'Notificacion general para los pasajeros de una terminal.',
  },
  eliminar: {
    titulo: 'Eliminar aviso',
    bajada: 'Baja de una notificacion ya enviada.',
  },
};

type TipoAviso = 'LOCAL' | 'GLOBAL' | 'BUS_DELAY';

/**
 * Tipos que acepta el envio de avisos, en el orden en que se muestran. Se
 * ofrecen solo los que devuelve GET /api/admin/notification-types para el rol.
 */
const OPCIONES_TIPOS: Record<TipoAviso, { etiqueta: string; detalle: string }> = {
  LOCAL: { etiqueta: 'LOCAL', detalle: 'Aviso para los pasajeros de una sola terminal.' },
  GLOBAL: { etiqueta: 'GLOBAL', detalle: 'Aviso para todas las terminales. Solo super admin.' },
  BUS_DELAY: {
    etiqueta: 'RETRASO',
    detalle: 'Avisar un retraso de un colectivo puntual a sus pasajeros.',
  },
};

interface OpcionTerminal {
  uuid: string;
  name: string;
}

/** Filas que entran en una pagina del listado. */
const POR_PAGINA = 10;

/** Nombre corto de cada tipo en el listado y en el filtro, en ese orden. */
const ETIQUETAS_TIPO: Record<TipoNotificacion, string> = {
  LOCAL: 'Local',
  GLOBAL: 'Global',
  BUS_DELAY: 'Retraso',
  BUS_ARRIVAL: 'Arribo',
  CAMERA: 'Camara',
};

const FECHA = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Pantallas de gestion de avisos. Las opciones de la
 * gestion comparten este componente y cambian segun :accion.
 */
@Component({
  selector: 'app-avisos',
  imports: [Topbar, RouterLink, ReactiveFormsModule],
  templateUrl: './avisos.html',
  styleUrl: './avisos.scss',
})
export class Avisos {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly avisoService = inject(AvisoService);
  private readonly terminalService = inject(TerminalService);
  private readonly fb = inject(FormBuilder);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(() => {
    const accion = this.parametros().get('accion') as AccionAviso | null;
    return accion && accion in VISTAS ? accion : 'listar';
  });

  /** Id de la notificacion a eliminar, si la ruta lo trae. */
  private readonly codigo = computed(() => this.parametros().get('codigo'));

  protected readonly vista = computed(() => VISTAS[this.accion()]);

  // --- Listado ---
  protected readonly etiquetasTipo = ETIQUETAS_TIPO;
  protected readonly tiposFiltro = Object.keys(ETIQUETAS_TIPO) as TipoNotificacion[];
  protected readonly filtroTipo = signal<TipoNotificacion | ''>('');
  protected readonly filtroEstado = signal<EstadoNotificacion>('all');
  protected readonly pagina = signal(1);
  protected readonly cargandoListado = signal(false);
  protected readonly errorListado = signal<string | null>(null);
  protected readonly notificaciones = signal<NotificacionAdmin[]>([]);
  private readonly totalElementos = signal(0);

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalElementos() / POR_PAGINA)),
  );

  protected readonly paginas = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i + 1),
  );

  /** Filas en blanco que completan la pagina, igual que en ciudades. */
  protected readonly relleno = computed(() =>
    Array.from({ length: Math.max(0, POR_PAGINA - (this.notificaciones().length || 1)) }),
  );

  // --- Baja ---
  protected readonly seleccionada = signal<NotificacionAdmin | null>(null);
  protected readonly cargandoSeleccionada = signal(false);
  protected readonly errorSeleccionada = signal<string | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly errorEliminar = signal<string | null>(null);

  /**
   * Terminales de los selects: el super admin elige entre todas; el admin,
   * entre las que tiene asignadas.
   */
  protected readonly terminales = signal<OpcionTerminal[]>([]);

  // --- Envio de aviso ---
  protected readonly tipos = signal<{ nombre: TipoAviso; etiqueta: string; detalle: string }[]>(
    [],
  );
  protected readonly errorTipos = signal<string | null>(null);

  protected readonly formAviso = this.fb.nonNullable.group({
    tipo: ['LOCAL' as TipoAviso, Validators.required],
    terminal: ['', Validators.required],
    mensaje: ['', [Validators.required, Validators.pattern(/\S/)]],
    patente: ['', [Validators.required, Validators.pattern(/\S/)]],
    fecha: ['', Validators.required],
    demora: [15, [Validators.required, Validators.min(1)]],
    vida: [12, [Validators.required, Validators.min(1)]],
  });
  protected readonly enviando = signal(false);
  protected readonly errorAviso = signal<string | null>(null);
  protected readonly avisoEnviado = signal<string | null>(null);

  private readonly tipoElegido = toSignal(this.formAviso.controls.tipo.valueChanges, {
    initialValue: this.formAviso.controls.tipo.value,
  });

  /** GLOBAL va a todas las terminales: no se elige terminal. */
  protected readonly esGlobal = computed(() => this.tipoElegido() === 'GLOBAL');

  /** BUS_DELAY pide patente, fecha y demora en lugar de mensaje. */
  protected readonly esRetraso = computed(() => this.tipoElegido() === 'BUS_DELAY');

  constructor() {
    this.cargarTerminales();

    effect(() => {
      const { terminal, mensaje, patente, fecha, demora } = this.formAviso.controls;
      habilitar(terminal, !this.esGlobal());
      habilitar(mensaje, !this.esRetraso());
      for (const control of [patente, fecha, demora]) habilitar(control, this.esRetraso());
    });

    effect(() => {
      const accion = this.accion();
      if (accion === 'listar') untracked(() => this.cargarNotificaciones());
      else if (accion === 'aviso') this.prepararAviso();
      else if (accion === 'eliminar') this.cargarSeleccionada(this.codigo());
    });
  }

  private cargarNotificaciones(): void {
    this.cargandoListado.set(true);
    this.errorListado.set(null);

    const tipo = this.filtroTipo();
    this.avisoService
      .listar({
        page: this.pagina(),
        limit: POR_PAGINA,
        type: tipo || undefined,
        status: this.filtroEstado(),
      })
      .subscribe({
        next: (res) => {
          this.notificaciones.set(res.notifications);
          this.totalElementos.set(res.total_elements);
          this.cargandoListado.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.cargandoListado.set(false);
          this.errorListado.set(mensajeErrorListado(err));
        },
      });
  }

  protected filtrarTipo(tipo: string): void {
    this.filtroTipo.set(tipo as TipoNotificacion | '');
    this.pagina.set(1);
    this.cargarNotificaciones();
  }

  protected filtrarEstado(estado: string): void {
    this.filtroEstado.set(estado as EstadoNotificacion);
    this.pagina.set(1);
    this.cargarNotificaciones();
  }

  protected irA(pagina: number): void {
    const destino = Math.min(Math.max(pagina, 1), this.totalPaginas());
    if (destino === this.pagina()) return;
    this.pagina.set(destino);
    this.cargarNotificaciones();
  }

  private cargarSeleccionada(id: string | null): void {
    this.seleccionada.set(null);
    this.errorSeleccionada.set(null);
    this.errorEliminar.set(null);

    if (!id) {
      this.errorSeleccionada.set('No se indico que aviso eliminar.');
      return;
    }

    this.cargandoSeleccionada.set(true);
    this.avisoService.obtener(id).subscribe({
      next: (notificacion) => {
        this.cargandoSeleccionada.set(false);
        this.seleccionada.set(notificacion);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoSeleccionada.set(false);
        this.errorSeleccionada.set(mensajeErrorListado(err));
      },
    });
  }

  protected eliminar(): void {
    const seleccionada = this.seleccionada();
    if (!seleccionada) return;

    this.eliminando.set(true);
    this.errorEliminar.set(null);

    this.avisoService.eliminar(seleccionada.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.router.navigateByUrl('/dashboard/notificaciones/listar');
      },
      error: (err: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.errorEliminar.set(mensajeErrorEliminar(err));
      },
    });
  }

  /** Texto principal de la notificacion; cambia segun el tipo. */
  protected mensaje(n: NotificacionAdmin): string {
    const p = n.payload;
    switch (n.type) {
      case 'BUS_DELAY':
        return `Retraso de ${p['time_delay'] ?? '?'} min del colectivo ${p['license_patent'] ?? ''}`.trim();
      case 'BUS_ARRIVAL':
        return `Arribo al anden ${p['anden'] ?? '?'}`;
      default:
        return typeof p['message'] === 'string' ? p['message'] : '-';
    }
  }

  protected terminal(n: NotificacionAdmin): string {
    return n.terminal ? n.terminal.name || n.terminal.uuid : 'Todas (global)';
  }

  protected fecha(valor: string): string {
    return FECHA.format(new Date(valor));
  }

  private cargarTerminales(): void {
    const user = this.auth.user();

    if (user?.rol === 'admin') {
      this.terminales.set(user.terminals ?? []);
      this.elegirUnicaTerminal();
      return;
    }

    this.terminalService.listarPublicas().subscribe({
      next: (terminales) => {
        this.terminales.set(terminales.map(({ uuid, name }) => ({ uuid, name })));
        this.elegirUnicaTerminal();
      },
    });
  }

  /** Con una sola terminal disponible no hace falta elegirla. */
  private elegirUnicaTerminal(): void {
    const terminales = this.terminales();
    const control = this.formAviso.controls.terminal;
    if (terminales.length === 1 && !control.value) control.setValue(terminales[0].uuid);
  }

  private prepararAviso(): void {
    this.errorAviso.set(null);
    this.avisoEnviado.set(null);
    this.errorTipos.set(null);

    this.avisoService.tipos().subscribe({
      next: (res) => {
        const tipos = (Object.keys(OPCIONES_TIPOS) as TipoAviso[]).filter((t) =>
          res.types.includes(t),
        );
        this.tipos.set(tipos.map((nombre) => ({ nombre, ...OPCIONES_TIPOS[nombre] })));

        const tipo = this.formAviso.controls.tipo;
        if (tipos.length && !tipos.includes(tipo.value)) tipo.setValue(tipos[0]);
      },
      error: (err: HttpErrorResponse) => this.errorTipos.set(mensajeError(err)),
    });
  }

  protected enviarAviso(): void {
    if (this.formAviso.invalid) {
      this.formAviso.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorAviso.set(null);
    this.avisoEnviado.set(null);

    const { tipo, terminal, mensaje, vida } = this.formAviso.getRawValue();
    if (tipo === 'BUS_DELAY') {
      this.enviarRetraso();
      return;
    }

    this.avisoService
      .enviar(
        { type: tipo, payload: { message: mensaje.trim(), time_life: vida } },
        tipo === 'LOCAL' ? terminal : undefined,
      )
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.avisoEnviado.set(
            tipo === 'GLOBAL'
              ? 'Aviso enviado a todas las terminales.'
              : 'Aviso enviado a los pasajeros de la terminal.',
          );
          this.formAviso.controls.mensaje.reset();
        },
        error: (err: HttpErrorResponse) => {
          this.enviando.set(false);
          this.errorAviso.set(mensajeError(err));
        },
      });
  }

  private enviarRetraso(): void {
    const { terminal, patente, fecha, demora, vida } = this.formAviso.getRawValue();
    this.avisoService
      .notificarRetraso({
        type: 'BUS_DELAY',
        license_patent: patente.trim(),
        uuid_terminal: terminal || undefined,
        start_date: fecha,
        payload: { time_delay: demora, time_life: vida },
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.avisoEnviado.set('Retraso avisado a los pasajeros del colectivo.');
          this.formAviso.controls.patente.reset();
        },
        error: (err: HttpErrorResponse) => {
          this.enviando.set(false);
          this.errorAviso.set(mensajeErrorRetraso(err));
        },
      });
  }

  protected invalidoAviso(
    campo: 'terminal' | 'mensaje' | 'patente' | 'fecha' | 'demora' | 'vida',
  ): boolean {
    const control = this.formAviso.controls[campo];
    return control.invalid && control.touched;
  }
}

function habilitar(control: AbstractControl, activo: boolean): void {
  if (activo) control.enable();
  else control.disable();
}

function mensajeErrorListado(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
      return err.error?.message === 'admin has no associated terminal'
        ? 'No tenes terminales asignadas.'
        : 'Revisa los filtros del listado.';
    case 403:
      return 'No tenes permisos para ver estos avisos.';
    case 404:
      return 'No se encontro el aviso. Puede que ya se haya eliminado.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}

function mensajeErrorEliminar(err: HttpErrorResponse): string {
  switch (err.status) {
    case 403:
      return 'No tenes permisos para eliminar este aviso.';
    case 404:
      return 'El aviso ya no existe.';
    default:
      return mensajeErrorListado(err);
  }
}

function mensajeErrorRetraso(err: HttpErrorResponse): string {
  switch (err.status) {
    case 400:
      return 'Revisa los datos: la patente, la fecha, la demora, la duracion y la terminal son obligatorias.';
    case 409:
      return 'No hay un viaje registrado para esa patente y fecha en la terminal.';
    case 502:
      return 'No se pudo verificar el viaje o entregar el aviso. Intenta de nuevo.';
    default:
      return mensajeError(err);
  }
}

function mensajeError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
      return 'Revisa los datos: el mensaje, la duracion y la terminal son obligatorios.';
    case 403:
      return 'No tenes permisos para enviar ese aviso o sobre esa terminal.';
    case 404:
      return 'No se encontro la terminal indicada.';
    case 502:
      return 'El aviso no se pudo entregar en tiempo real. Intenta de nuevo.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}

export const tituloAvisos: ResolveFn<string> = (ruta) => {
  const accion = (ruta.paramMap.get('accion') as AccionAviso | null) ?? 'listar';
  return VISTAS[accion]?.titulo ?? VISTAS['listar'].titulo;
};
