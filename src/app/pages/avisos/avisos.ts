import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { AuthService } from '../../services/auth.service';
import { AvisoService } from '../../services/aviso.service';
import { TerminalService } from '../../services/terminal.service';

export type AccionAviso = 'aviso' | 'eliminar';

interface VistaAviso {
  titulo: string;
  bajada: string;
}

const VISTAS: Record<AccionAviso, VistaAviso> = {
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

/** Aviso de ejemplo para la pantalla de baja. */
const AVISO_EJEMPLO = {
  id: '98fb4a77-0a0f-44f0-8067-59e5b7df42ba',
  tipo: 'LOCAL',
  mensaje: 'Ejemplo de mensaje LOCAL',
  terminal: 'Terminal Retiro BS AS',
};

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
  private readonly auth = inject(AuthService);
  private readonly avisoService = inject(AvisoService);
  private readonly terminalService = inject(TerminalService);
  private readonly fb = inject(FormBuilder);

  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly accion = computed(
    () => (this.parametros().get('accion') as AccionAviso | null) ?? 'aviso',
  );

  protected readonly vista = computed(() => VISTAS[this.accion()] ?? VISTAS['aviso']);

  protected readonly aviso = AVISO_EJEMPLO;

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
      if (this.accion() === 'aviso') this.prepararAviso();
    });
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
  const accion = (ruta.paramMap.get('accion') as AccionAviso | null) ?? 'aviso';
  return VISTAS[accion]?.titulo ?? 'Notificaciones';
};
