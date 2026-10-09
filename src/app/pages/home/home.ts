import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Topbar } from '../../shared/topbar/topbar';
import { EsperaViaje } from '../espera-viaje/espera-viaje';
import { QrScanner } from '../../shared/qr-scanner/qr-scanner';
import { Toast } from '../../shared/toast/toast';
import { PARSERS_BOLETO, QrBoletoError, parsearBoleto } from '../../shared/qr-scanner/boleto-parser';
import { ViajeService } from '../../services/viaje.service';
import { RealtimeService } from '../../services/realtime.service';
import { Terminal, ViajeEsperado } from '../../models/viaje.model';

@Component({
  selector: 'app-home',
  imports: [Topbar, EsperaViaje, QrScanner, Toast],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly viajes = inject(ViajeService);
  private readonly realtime = inject(RealtimeService);

  /**
   * "Espera del viaje" no es una ruta: es el mismo home con el cuerpo
   * reemplazado. Volver a null lo deja como estaba.
   */
  protected readonly viaje = signal<ViajeEsperado | null>(null);
  /** Mientras se consulta si el usuario ya estaba esperando un viaje. */
  protected readonly restaurando = signal(true);

  protected readonly terminales = signal<Terminal[]>([]);
  protected readonly filtroCp = signal('');
  protected readonly terminalId = signal<string | null>(null);
  protected readonly terminalesFiltradas = computed(() => {
    const filtro = this.filtroCp().trim();
    const todas = this.terminales();
    return filtro ? todas.filter((t) => t.postal_code.includes(filtro)) : todas;
  });

  /** Combobox de terminal: lo que se escribe filtra la lista por nombre. */
  protected readonly comboAbierto = signal(false);
  protected readonly filtroNombre = signal('');
  protected readonly opcionActiva = signal(0);
  protected readonly nombreTerminal = computed(
    () => this.terminales().find((t) => t.uuid === this.terminalId())?.name ?? '',
  );
  protected readonly opcionesTerminal = computed(() => {
    const filtro = normalizar(this.filtroNombre().trim());
    const lista = this.terminalesFiltradas();
    return filtro ? lista.filter((t) => normalizar(t.name).includes(filtro)) : lista;
  });

  protected readonly escaneando = signal(false);
  protected readonly ticket = signal('');
  protected readonly errorEscaneo = signal<string | null>(null);
  protected readonly mostrarExito = signal(false);

  protected readonly buscando = signal(false);
  protected readonly errorBusqueda = signal<string | null>(null);
  /** Error de pasaje o de datos faltantes: se muestra en un popup que hay que aceptar. */
  protected readonly errorPasaje = signal<{ titulo: string; mensaje: string } | null>(null);
  private readonly dialogoPasaje = viewChild<ElementRef<HTMLDialogElement>>('dialogoPasaje');
  protected readonly mostrarLlegada = signal(false);
  protected readonly andenLlegada = computed(() => this.realtime.llegada()?.anden ?? '');

  constructor() {
    this.viajes.terminales().subscribe({
      next: (lista) => this.terminales.set(lista),
      error: () => this.errorBusqueda.set('No se pudieron cargar las terminales.'),
    });

    // Si el usuario recarga la pagina, retoma la espera que tenia.
    this.viajes.enEspera().subscribe({
      next: (viaje) => {
        this.restaurando.set(false);
        void this.quedarAEspera(viaje);
      },
      error: () => this.restaurando.set(false),
    });

    // El <dialog> nativo se abre con showModal() para tener fondo y foco.
    effect(() => {
      const dialogo = this.dialogoPasaje()?.nativeElement;
      if (!dialogo) return;
      if (this.errorPasaje() && !dialogo.open) dialogo.showModal();
      if (!this.errorPasaje() && dialogo.open) dialogo.close();
    });

    // Aviso flotante cuando el colectivo llega mientras se espera.
    effect(() => {
      const llegada = this.realtime.llegada();
      if (llegada && untracked(this.viaje)) {
        this.mostrarLlegada.set(true);
        navigator.vibrate?.([200, 100, 200]);
      }
    });
  }

  protected onFiltroCp(valor: string): void {
    this.filtroCp.set(valor);
    const filtradas = this.terminalesFiltradas();
    if (!filtradas.some((t) => t.uuid === this.terminalId())) {
      this.terminalId.set(filtradas.length === 1 ? filtradas[0].uuid : null);
    }
  }

  protected abrirCombo(): void {
    this.filtroNombre.set('');
    this.opcionActiva.set(0);
    this.comboAbierto.set(true);
  }

  protected cerrarCombo(): void {
    this.comboAbierto.set(false);
    this.filtroNombre.set('');
  }

  protected onFiltroNombre(valor: string): void {
    this.filtroNombre.set(valor);
    this.opcionActiva.set(0);
    this.comboAbierto.set(true);
  }

  protected elegirTerminal(terminal: Terminal): void {
    this.terminalId.set(terminal.uuid);
    this.cerrarCombo();
  }

  protected onTeclaCombo(evento: KeyboardEvent): void {
    const opciones = this.opcionesTerminal();
    switch (evento.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        evento.preventDefault();
        if (!this.comboAbierto()) return this.abrirCombo();
        if (!opciones.length) return;
        const paso = evento.key === 'ArrowDown' ? 1 : -1;
        this.opcionActiva.update((i) => (i + paso + opciones.length) % opciones.length);
        return;
      }
      case 'Enter': {
        const opcion = opciones[this.opcionActiva()];
        if (this.comboAbierto() && opcion) {
          evento.preventDefault();
          this.elegirTerminal(opcion);
        }
        return;
      }
      case 'Escape':
        this.cerrarCombo();
        return;
    }
  }

  protected onCodigoLeido(codigo: string): void {
    try {
      this.ticket.set(parsearBoleto(PARSERS_BOLETO, codigo));
      this.errorEscaneo.set(null);
      this.mostrarExito.set(true);
    } catch (error) {
      this.errorEscaneo.set(
        error instanceof QrBoletoError ? error.message : 'No se pudo escanear el QR correctamente.',
      );
    }
    this.escaneando.set(false);
  }

  protected buscarViaje(): void {
    const terminalId = this.terminalId();
    const ticket = this.ticket().trim().toUpperCase();
    this.errorBusqueda.set(null);

    if (!terminalId) {
      this.errorPasaje.set({ titulo: 'Falta la terminal', mensaje: 'Elegí la terminal donde vas a esperar el colectivo.' });
      return;
    }
    if (!ticket) {
      this.errorPasaje.set({ titulo: 'Falta el pasaje', mensaje: 'Ingresá el código de tu pasaje o escaneá el QR.' });
      return;
    }

    this.buscando.set(true);
    this.viajes.esperar(terminalId, ticket).subscribe({
      next: (viaje) => {
        this.buscando.set(false);
        void this.quedarAEspera(viaje);
      },
      error: (error: HttpErrorResponse) => {
        this.buscando.set(false);
        const pasaje = mensajePasajeInvalido(error);
        if (pasaje) this.errorPasaje.set({ titulo: 'Pasaje no válido', mensaje: pasaje });
        else this.errorBusqueda.set(mensajeError(error));
      },
    });
  }

  protected aceptarErrorPasaje(): void {
    this.errorPasaje.set(null);
  }

  protected buscarOtro(): void {
    this.viajes.dejarDeEsperar().subscribe({ error: () => {} });
    void this.realtime.dejarViaje();
    this.mostrarLlegada.set(false);
    this.viaje.set(null);
  }

  private async quedarAEspera(viaje: ViajeEsperado): Promise<void> {
    this.viaje.set(viaje);
    this.ticket.set(viaje.trip.ticket);
    this.terminalId.set(viaje.terminal.uuid);
    try {
      await this.realtime.seguirViaje(viaje.group_key, viaje.terminal.uuid);
    } catch {
      // La pantalla de espera avisa que no hay conexion en tiempo real;
      // el backend igual manda el mail cuando llega el colectivo.
    }
  }
}

/** Minusculas y sin tildes, para que "cordoba" encuentre "CÓRDOBA". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Mensaje para el popup cuando el backend rechaza el pasaje; null si es otro error. */
function mensajePasajeInvalido(error: HttpErrorResponse): string | null {
  const detalle: string = error.error?.message ?? '';
  if (error.status === 409) return 'Este pasaje pertenece a otra terminal. Elegí la terminal correcta e intentá de nuevo.';
  if (error.status === 404 && detalle.includes('trip')) return 'No encontramos un viaje con ese código de pasaje. Revisalo e intentá de nuevo.';
  return null;
}

function mensajeError(error: HttpErrorResponse): string {
  const detalle: string = error.error?.message ?? '';
  switch (error.status) {
    case 401:
      return 'Iniciá sesión para seguir tu viaje.';
    case 404:
      return 'La terminal elegida ya no existe. Elegí otra.';
    case 502:
      return 'El sistema de la terminal no responde. Probá de nuevo en unos minutos.';
    default:
      return 'Ocurrió un error al buscar el viaje.';
  }
}
