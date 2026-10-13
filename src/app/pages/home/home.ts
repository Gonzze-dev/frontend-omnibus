import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Topbar } from '../../shared/topbar/topbar';
import { TripWait } from '../trip-wait/trip-wait';
import { QrScanner } from '../../shared/qr-scanner/qr-scanner';
import { Toast } from '../../shared/toast/toast';
import { TICKET_PARSERS, QrTicketError, parseTicket } from '../../shared/qr-scanner/ticket-parser';
import { TripService } from '../../services/trip.service';
import { RealtimeService } from '../../services/realtime.service';
import { AwaitedTrip, Terminal } from '../../models/trip.model';

@Component({
  selector: 'app-home',
  imports: [Topbar, TripWait, QrScanner, Toast],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly trips = inject(TripService);
  private readonly realtime = inject(RealtimeService);

  /**
   * "Trip wait" is not a route: it is the same home with the body
   * replaced. Setting it back to null leaves it as it was.
   */
  protected readonly trip = signal<AwaitedTrip | null>(null);
  /** While checking whether the user was already waiting for a trip. */
  protected readonly restoring = signal(true);

  protected readonly terminals = signal<Terminal[]>([]);
  protected readonly zipFilter = signal('');
  protected readonly terminalId = signal<string | null>(null);
  protected readonly filteredTerminals = computed(() => {
    const filter = this.zipFilter().trim();
    const all = this.terminals();
    return filter ? all.filter((t) => t.postal_code.includes(filter)) : all;
  });

  /** Terminal combobox: what is typed filters the list by name. */
  protected readonly comboOpen = signal(false);
  protected readonly nameFilter = signal('');
  protected readonly activeOption = signal(0);
  protected readonly terminalName = computed(
    () => this.terminals().find((t) => t.uuid === this.terminalId())?.name ?? '',
  );
  protected readonly terminalOptions = computed(() => {
    const filter = normalize(this.nameFilter().trim());
    const list = this.filteredTerminals();
    return filter ? list.filter((t) => normalize(t.name).includes(filter)) : list;
  });

  protected readonly scanning = signal(false);
  protected readonly ticket = signal('');
  protected readonly scanError = signal<string | null>(null);
  protected readonly showSuccess = signal(false);

  protected readonly searching = signal(false);
  protected readonly searchError = signal<string | null>(null);
  /** Bus ticket error or missing data: shown in a popup that has to be accepted. */
  protected readonly ticketError = signal<{ title: string; message: string } | null>(null);
  private readonly ticketDialog = viewChild<ElementRef<HTMLDialogElement>>('ticketDialog');
  protected readonly showArrival = signal(false);
  protected readonly arrivalBay = computed(() => this.realtime.arrival()?.bay ?? '');

  constructor() {
    this.trips.terminals().subscribe({
      next: (list) => this.terminals.set(list),
      error: () => this.searchError.set('No se pudieron cargar las terminales.'),
    });

    // If the user reloads the page, it resumes the wait they had.
    this.trips.awaited().subscribe({
      next: (trip) => {
        this.restoring.set(false);
        void this.startWaiting(trip);
      },
      error: () => this.restoring.set(false),
    });

    // The native <dialog> is opened with showModal() to get a backdrop and focus.
    effect(() => {
      const dialog = this.ticketDialog()?.nativeElement;
      if (!dialog) return;
      if (this.ticketError() && !dialog.open) dialog.showModal();
      if (!this.ticketError() && dialog.open) dialog.close();
    });

    // Floating notice when the bus arrives while waiting.
    effect(() => {
      const arrival = this.realtime.arrival();
      if (arrival && untracked(this.trip)) {
        this.showArrival.set(true);
        navigator.vibrate?.([200, 100, 200]);
      }
    });
  }

  protected onZipFilter(value: string): void {
    this.zipFilter.set(value);
    const filtered = this.filteredTerminals();
    if (!filtered.some((t) => t.uuid === this.terminalId())) {
      this.terminalId.set(filtered.length === 1 ? filtered[0].uuid : null);
    }
  }

  protected openCombo(): void {
    this.nameFilter.set('');
    this.activeOption.set(0);
    this.comboOpen.set(true);
  }

  protected closeCombo(): void {
    this.comboOpen.set(false);
    this.nameFilter.set('');
  }

  protected onNameFilter(value: string): void {
    this.nameFilter.set(value);
    this.activeOption.set(0);
    this.comboOpen.set(true);
  }

  protected chooseTerminal(terminal: Terminal): void {
    this.terminalId.set(terminal.uuid);
    this.closeCombo();
  }

  protected onComboKey(event: KeyboardEvent): void {
    const options = this.terminalOptions();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.comboOpen()) return this.openCombo();
        if (!options.length) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeOption.update((i) => (i + step + options.length) % options.length);
        return;
      }
      case 'Enter': {
        const option = options[this.activeOption()];
        if (this.comboOpen() && option) {
          event.preventDefault();
          this.chooseTerminal(option);
        }
        return;
      }
      case 'Escape':
        this.closeCombo();
        return;
    }
  }

  protected onCodeRead(code: string): void {
    try {
      this.ticket.set(parseTicket(TICKET_PARSERS, code));
      this.scanError.set(null);
      this.showSuccess.set(true);
    } catch (error) {
      this.scanError.set(
        error instanceof QrTicketError ? error.message : 'No se pudo escanear el QR correctamente.',
      );
    }
    this.scanning.set(false);
  }

  protected searchTrip(): void {
    const terminalId = this.terminalId();
    const ticket = this.ticket().trim().toUpperCase();
    this.searchError.set(null);

    if (!terminalId) {
      this.ticketError.set({ title: 'Falta la terminal', message: 'Elegí la terminal donde vas a esperar el colectivo.' });
      return;
    }
    if (!ticket) {
      this.ticketError.set({ title: 'Falta el pasaje', message: 'Ingresá el código de tu pasaje o escaneá el QR.' });
      return;
    }

    this.searching.set(true);
    this.trips.wait(terminalId, ticket).subscribe({
      next: (trip) => {
        this.searching.set(false);
        void this.startWaiting(trip);
      },
      error: (error: HttpErrorResponse) => {
        this.searching.set(false);
        const invalid = invalidTicketMessage(error);
        if (invalid) this.ticketError.set({ title: 'Pasaje no válido', message: invalid });
        else this.searchError.set(errorMessage(error));
      },
    });
  }

  protected acceptTicketError(): void {
    this.ticketError.set(null);
  }

  protected searchAnother(): void {
    this.trips.stopWaiting().subscribe({ error: () => {} });
    void this.realtime.leaveTrip();
    this.showArrival.set(false);
    this.trip.set(null);
  }

  private async startWaiting(trip: AwaitedTrip): Promise<void> {
    this.trip.set(trip);
    this.ticket.set(trip.trip.ticket);
    this.terminalId.set(trip.terminal.uuid);
    try {
      await this.realtime.followTrip(trip.group_key, trip.terminal.uuid);
    } catch {
      // The wait screen warns that there is no real-time connection;
      // the backend still sends the email when the bus arrives.
    }
  }
}

/** Lowercase and without accents, so "cordoba" finds "CÓRDOBA". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Message for the popup when the backend rejects the bus ticket; null if it is another error. */
function invalidTicketMessage(error: HttpErrorResponse): string | null {
  const detail: string = error.error?.message ?? '';
  if (error.status === 409) return 'Este pasaje pertenece a otra terminal. Elegí la terminal correcta e intentá de nuevo.';
  if (error.status === 404 && detail.includes('trip')) return 'No encontramos un viaje con ese código de pasaje. Revisalo e intentá de nuevo.';
  return null;
}

function errorMessage(error: HttpErrorResponse): string {
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
