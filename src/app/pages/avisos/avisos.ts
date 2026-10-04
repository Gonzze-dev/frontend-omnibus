import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { AuthService } from '../../services/auth.service';
import { AvisoService } from '../../services/aviso.service';
import { TerminalService } from '../../services/terminal.service';

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

type TipoAviso = 'LOCAL' | 'GLOBAL';

/**
 * Tipos que acepta el envio de avisos. De los que devuelve
 * GET /api/admin/notification-types se muestran solo estos: BUS_DELAY
 * tiene su propia pantalla porque pide patente y fecha del viaje.
 */
const DETALLE_TIPOS: Record<TipoAviso, string> = {
  LOCAL: 'Aviso para los pasajeros de una sola terminal.',
  GLOBAL: 'Aviso para todas las terminales. Solo super admin.',
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
 * Pantallas de gestion de avisos. Las cuatro opciones de la
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
  protected readonly tipos = signal<{ nombre: TipoAviso; detalle: string }[]>([]);
  protected readonly errorTipos = signal<string | null>(null);

  protected readonly formAviso = this.fb.nonNullable.group({
    tipo: ['LOCAL' as TipoAviso, Validators.required],
    terminal: ['', Validators.required],
    mensaje: ['', [Validators.required, Validators.pattern(/\S/)]],
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

  constructor() {
    this.cargarTerminales();

    effect(() => {
      const control = this.formAviso.controls.terminal;
      if (this.esGlobal()) control.disable();
      else control.enable();
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
        const tipos = res.types.filter((t): t is TipoAviso => t in DETALLE_TIPOS);
        this.tipos.set(tipos.map((nombre) => ({ nombre, detalle: DETALLE_TIPOS[nombre] })));

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

  protected invalidoAviso(campo: 'terminal' | 'mensaje' | 'vida'): boolean {
    const control = this.formAviso.controls[campo];
    return control.invalid && control.touched;
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
