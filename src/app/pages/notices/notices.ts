import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ResolveFn, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { PlateCamera } from '../../shared/plate-camera/plate-camera';
import { SearchOption, SearchSelect } from '../../shared/search-select/search-select';
import { AuthService } from '../../services/auth.service';
import { NoticeService } from '../../services/notice.service';
import { TerminalService } from '../../services/terminal.service';
import { PlatformService } from '../../services/platform.service';
import { UserService } from '../../services/user.service';
import { GroupedPlatform } from '../../models/platform.model';
import {
  AdminNotification,
  NotificationStatus,
  NotificationType,
} from '../../models/notice.model';

export type NoticeAction = 'list' | 'send';

interface NoticeView {
  title: string;
  lead: string;
}

const VIEWS: Record<NoticeAction, NoticeView> = {
  list: {
    title: 'Gestionar notificaciones',
    lead: 'Revisá los avisos enviados a los pasajeros, de qué terminal son, y da de baja los que ya no hacen falta.',
  },
  send: {
    title: 'Enviar aviso',
    lead: 'Notificación para los pasajeros de una terminal, o el arribo de un colectivo si falló la cámara.',
  },
};

type NoticeType = 'LOCAL' | 'GLOBAL' | 'BUS_DELAY' | 'BUS_ARRIVAL';

/**
 * Types accepted when sending notices, in the order they are shown. Only
 * the ones returned by GET /api/admin/notification-types for the role are offered.
 */
const TYPE_OPTIONS: Record<NoticeType, { label: string; detail: string }> = {
  LOCAL: { label: 'LOCAL', detail: 'Aviso para los pasajeros de una sola terminal.' },
  GLOBAL: { label: 'GLOBAL', detail: 'Aviso para todas las terminales. Solo super admin.' },
  BUS_DELAY: {
    label: 'RETRASO',
    detail: 'Avisar un retraso de un colectivo puntual a sus pasajeros.',
  },
  BUS_ARRIVAL: {
    label: 'ARRIBO',
    detail: 'Avisar que un colectivo llegó a un andén, por si la cámara no lo detectó.',
  },
};

/** Maximum number of bays GET /api/admin/platforms accepts per page. */
const MAX_BAYS = 100;

interface TerminalOption {
  uuid: string;
  name: string;
}

/** Rows that fit in one page of the list. */
const PAGE_SIZE = 10;

/** Short name of each type in the list and in the filter, in that order. */
const TYPE_LABELS: Record<NotificationType, string> = {
  LOCAL: 'Local',
  GLOBAL: 'Global',
  BUS_DELAY: 'Retraso',
  BUS_ARRIVAL: 'Arribo',
  CAMERA: 'Cámara',
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Notice management screens. The management options
 * share this component and change according to :action.
 */
@Component({
  selector: 'app-notices',
  imports: [Topbar, RouterLink, ReactiveFormsModule, PlateCamera, SearchSelect],
  templateUrl: './notices.html',
  styleUrl: './notices.scss',
})
export class Notices {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly noticeService = inject(NoticeService);
  private readonly terminalService = inject(TerminalService);
  private readonly platformService = inject(PlatformService);
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly action = computed(() => {
    const action = this.params().get('action') as NoticeAction | null;
    return action && action in VIEWS ? action : 'list';
  });

  protected readonly view = computed(() => VIEWS[this.action()]);

  // --- List ---
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly filterTypes = Object.keys(TYPE_LABELS) as NotificationType[];
  protected readonly typeFilter = signal<NotificationType | ''>('');
  protected readonly statusFilter = signal<NotificationStatus>('all');
  protected readonly page = signal(1);
  protected readonly loadingList = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly notifications = signal<AdminNotification[]>([]);
  private readonly totalElements = signal(0);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalElements() / PAGE_SIZE)),
  );

  protected readonly pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1),
  );

  /** Blank rows that complete the page, just like in cities. */
  protected readonly filler = computed(() =>
    Array.from({ length: Math.max(0, PAGE_SIZE - (this.notifications().length || 1)) }),
  );

  // --- Delete (popup over the list) ---
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');
  protected readonly toDelete = signal<AdminNotification | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  /**
   * Terminals of the selects: the super admin chooses among all of them; the admin,
   * among the ones assigned to them.
   */
  protected readonly terminals = signal<TerminalOption[]>([]);

  protected readonly terminalOptions = computed<SearchOption[]>(() =>
    this.terminals().map((t) => ({ value: t.uuid, label: t.name })),
  );

  // --- Sending a notice ---
  protected readonly types = signal<{ name: NoticeType; label: string; detail: string }[]>([]);
  protected readonly typesError = signal<string | null>(null);

  protected readonly noticeForm = this.fb.nonNullable.group({
    type: ['LOCAL' as NoticeType, Validators.required],
    terminal: ['', Validators.required],
    message: ['', [Validators.required, Validators.pattern(/\S/)]],
    plate: ['', [Validators.required, Validators.pattern(/\S/)]],
    bay: ['', Validators.required],
    date: ['', Validators.required],
    delay: [15, [Validators.required, Validators.min(1)]],
    lifetime: [12, [Validators.required, Validators.min(1)]],
  });
  protected readonly sending = signal(false);
  protected readonly noticeError = signal<string | null>(null);
  protected readonly noticeSent = signal<string | null>(null);

  private readonly chosenType = toSignal(this.noticeForm.controls.type.valueChanges, {
    initialValue: this.noticeForm.controls.type.value,
  });

  /** GLOBAL goes to every terminal: no terminal is chosen. */
  protected readonly isGlobal = computed(() => this.chosenType() === 'GLOBAL');

  /** BUS_DELAY asks for plate, date and delay instead of a message. */
  protected readonly isDelay = computed(() => this.chosenType() === 'BUS_DELAY');

  /** BUS_ARRIVAL asks for plate and bay instead of a message. */
  protected readonly isArrival = computed(() => this.chosenType() === 'BUS_ARRIVAL');

  private readonly chosenTerminal = toSignal(this.noticeForm.controls.terminal.valueChanges, {
    initialValue: this.noticeForm.controls.terminal.value,
  });

  /** Bays of the chosen terminal, for the arrival notice. */
  protected readonly bays = signal<GroupedPlatform[]>([]);
  protected readonly loadingBays = signal(false);
  protected readonly baysError = signal<string | null>(null);

  protected readonly bayOptions = computed<SearchOption[]>(() =>
    this.bays().map((b) => ({ value: String(b.code), label: b.bay, detail: String(b.code) })),
  );

  constructor() {
    this.loadTerminals();

    effect(() => {
      const { terminal, message, plate, bay, date, delay } = this.noticeForm.controls;
      setEnabled(terminal, !this.isGlobal());
      setEnabled(message, !this.isDelay() && !this.isArrival());
      setEnabled(plate, this.isDelay() || this.isArrival());
      setEnabled(bay, this.isArrival());
      for (const control of [date, delay]) setEnabled(control, this.isDelay());
    });

    effect(() => {
      const terminal = this.chosenTerminal();
      if (this.isArrival()) untracked(() => this.loadBays(terminal));
    });

    effect(() => {
      const action = this.action();
      if (action === 'list') untracked(() => this.loadNotifications());
      else if (action === 'send') this.prepareNotice();
    });

    // The native <dialog> is opened with showModal() to get a backdrop, trapped
    // focus and closing with Escape without writing them by hand.
    effect(() => {
      const dialog = this.deleteDialog()?.nativeElement;
      if (!dialog) return;
      if (this.toDelete() && !dialog.open) dialog.showModal();
      if (!this.toDelete() && dialog.open) dialog.close();
    });
  }

  private loadNotifications(): void {
    this.loadingList.set(true);
    this.listError.set(null);

    const type = this.typeFilter();
    this.noticeService
      .list({
        page: this.page(),
        limit: PAGE_SIZE,
        type: type || undefined,
        status: this.statusFilter(),
      })
      .subscribe({
        next: (res) => {
          this.notifications.set(res.notifications);
          this.totalElements.set(res.total_elements);
          this.loadingList.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingList.set(false);
          this.listError.set(listErrorMessage(err));
        },
      });
  }

  protected filterByType(type: string): void {
    this.typeFilter.set(type as NotificationType | '');
    this.page.set(1);
    this.loadNotifications();
  }

  protected filterByStatus(status: string): void {
    this.statusFilter.set(status as NotificationStatus);
    this.page.set(1);
    this.loadNotifications();
  }

  protected goTo(page: number): void {
    const target = Math.min(Math.max(page, 1), this.totalPages());
    if (target === this.page()) return;
    this.page.set(target);
    this.loadNotifications();
  }

  protected confirmDelete(notification: AdminNotification): void {
    this.deleteError.set(null);
    this.toDelete.set(notification);
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.toDelete.set(null);
    this.deleteError.set(null);
  }

  /** A click on the backdrop (outside the content) closes the popup. */
  protected onDeletePopupClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancelDelete();
  }

  protected delete(): void {
    const selected = this.toDelete();
    if (!selected) return;

    this.deleting.set(true);
    this.deleteError.set(null);

    this.noticeService.delete(selected.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toDelete.set(null);
        // The list is paginated in the backend: the page is requested again,
        // or the previous one if the deleted notice was the only one on this page.
        if (this.notifications().length === 1 && this.page() > 1) {
          this.page.update((p) => p - 1);
        }
        this.loadNotifications();
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(deleteErrorMessage(err));
      },
    });
  }

  /** Main text of the notification; it changes according to the type. */
  protected message(n: AdminNotification): string {
    const p = n.payload;
    switch (n.type) {
      case 'BUS_DELAY':
        return `Retraso de ${p['time_delay'] ?? '?'} min del colectivo ${p['license_plate'] ?? ''}`.trim();
      case 'BUS_ARRIVAL':
        return `Arribo al andén ${p['bay'] ?? '?'}`;
      default:
        return typeof p['message'] === 'string' ? p['message'] : '-';
    }
  }

  protected terminal(n: AdminNotification): string {
    return n.terminal ? n.terminal.name || n.terminal.uuid : 'Todas (global)';
  }

  protected formatDate(value: string): string {
    return DATE_FORMAT.format(new Date(value));
  }

  private loadTerminals(): void {
    const user = this.auth.user();

    if (user?.role === 'admin') {
      // The login does not bring the admin's terminals: the session's are shown
      // (if any) and confirmed with GET /users/me, which does return them.
      this.terminals.set(user.terminals ?? []);
      this.chooseOnlyTerminal();
      this.userService.getProfile().subscribe({
        next: (profile) => {
          this.terminals.set(profile.terminals ?? []);
          this.chooseOnlyTerminal();
        },
      });
      return;
    }

    this.terminalService.listPublic().subscribe({
      next: (terminals) => {
        this.terminals.set(terminals.map(({ uuid, name }) => ({ uuid, name })));
        this.chooseOnlyTerminal();
      },
    });
  }

  /** With a single terminal available there is no need to choose it. */
  private chooseOnlyTerminal(): void {
    const terminals = this.terminals();
    const control = this.noticeForm.controls.terminal;
    if (terminals.length === 1 && !control.value) control.setValue(terminals[0].uuid);
  }

  private loadBays(terminal: string): void {
    this.bays.set([]);
    this.baysError.set(null);
    this.noticeForm.controls.bay.setValue('');
    if (!terminal) return;

    this.loadingBays.set(true);
    this.platformService.list({ bus_terminal_id: terminal, limit: MAX_BAYS }).subscribe({
      next: (res) => {
        // If the terminal changed in the meantime, this response no longer applies.
        if (this.noticeForm.controls.terminal.value !== terminal) return;
        this.loadingBays.set(false);
        const bays = res.platforms.find((t) => t.uuid === terminal)?.platforms ?? [];
        this.bays.set(bays);
        if (bays.length === 1) this.noticeForm.controls.bay.setValue(String(bays[0].code));
      },
      error: (err: HttpErrorResponse) => {
        if (this.noticeForm.controls.terminal.value !== terminal) return;
        this.loadingBays.set(false);
        this.baysError.set(listErrorMessage(err));
      },
    });
  }

  private prepareNotice(): void {
    this.noticeError.set(null);
    this.noticeSent.set(null);
    this.typesError.set(null);

    this.noticeService.types().subscribe({
      next: (res) => {
        const types = (Object.keys(TYPE_OPTIONS) as NoticeType[]).filter((t) =>
          res.types.includes(t),
        );
        this.types.set(types.map((name) => ({ name, ...TYPE_OPTIONS[name] })));

        const type = this.noticeForm.controls.type;
        if (types.length && !types.includes(type.value)) type.setValue(types[0]);
      },
      error: (err: HttpErrorResponse) => this.typesError.set(errorMessage(err)),
    });
  }

  protected sendNotice(): void {
    if (this.noticeForm.invalid) {
      this.noticeForm.markAllAsTouched();
      return;
    }

    this.sending.set(true);
    this.noticeError.set(null);
    this.noticeSent.set(null);

    const { type, terminal, message, lifetime } = this.noticeForm.getRawValue();
    if (type === 'BUS_DELAY') {
      this.sendDelay();
      return;
    }
    if (type === 'BUS_ARRIVAL') {
      this.sendArrival();
      return;
    }

    this.noticeService
      .send(
        { type, payload: { message: message.trim(), time_life: lifetime } },
        type === 'LOCAL' ? terminal : undefined,
      )
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.noticeSent.set(
            type === 'GLOBAL'
              ? 'Aviso enviado a todas las terminales.'
              : 'Aviso enviado a los pasajeros de la terminal.',
          );
          this.noticeForm.controls.message.reset();
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          this.noticeError.set(errorMessage(err));
        },
      });
  }

  private sendDelay(): void {
    const { terminal, plate, date, delay, lifetime } = this.noticeForm.getRawValue();
    this.noticeService
      .notifyDelay({
        type: 'BUS_DELAY',
        license_plate: plate.trim(),
        uuid_terminal: terminal || undefined,
        start_date: date,
        payload: { time_delay: delay, time_life: lifetime },
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.noticeSent.set('Retraso avisado a los pasajeros del colectivo.');
          this.noticeForm.controls.plate.reset();
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          this.noticeError.set(delayErrorMessage(err));
        },
      });
  }

  private sendArrival(): void {
    const { plate, bay, lifetime } = this.noticeForm.getRawValue();
    this.noticeService
      .notifyArrival({ license_plate: plate.trim(), code: bay, time_life: lifetime })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.noticeSent.set('Arribo avisado a los pasajeros del colectivo.');
          this.noticeForm.controls.plate.reset();
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          this.noticeError.set(arrivalErrorMessage(err));
        },
      });
  }

  /** Fills in the license plate the OCR read from the photo. */
  protected onPlateRead(plate: string): void {
    const control = this.noticeForm.controls.plate;
    control.setValue(plate);
    control.markAsDirty();
    control.markAsTouched();
  }

  protected noticeInvalid(
    field: 'terminal' | 'message' | 'plate' | 'bay' | 'date' | 'delay' | 'lifetime',
  ): boolean {
    const control = this.noticeForm.controls[field];
    return control.invalid && control.touched;
  }
}

function setEnabled(control: AbstractControl, enabled: boolean): void {
  if (enabled) control.enable();
  else control.disable();
}

function listErrorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intentá más tarde.';
    case 400:
      return err.error?.message === 'admin has no associated terminal'
        ? 'No tenés terminales asignadas.'
        : 'Revisá los filtros del listado.';
    case 403:
      return 'No tenés permisos para ver estos avisos.';
    case 404:
      return 'No se encontró el aviso. Puede que ya se haya eliminado.';
    default:
      return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}

function deleteErrorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 403:
      return 'No tenés permisos para eliminar este aviso.';
    case 404:
      return 'El aviso ya no existe.';
    default:
      return listErrorMessage(err);
  }
}

function delayErrorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 400:
      return 'Revisá los datos: la patente, la fecha, la demora, la duración y la terminal son obligatorias.';
    case 409:
      return 'No hay un viaje registrado para esa patente y fecha en la terminal.';
    case 502:
      return 'No se pudo verificar el viaje o entregar el aviso. Intentá de nuevo.';
    default:
      return errorMessage(err);
  }
}

function arrivalErrorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 400:
      return 'Revisá los datos: la patente, el andén y la duración son obligatorios.';
    case 403:
      return 'No tenés permisos para avisar arribos en esa terminal.';
    case 404:
      return 'No se encontró el andén indicado.';
    case 502:
      return 'El arribo no se pudo entregar en tiempo real. Intentá de nuevo.';
    default:
      return errorMessage(err);
  }
}

function errorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intentá más tarde.';
    case 400:
      return 'Revisá los datos: el mensaje, la duración y la terminal son obligatorios.';
    case 403:
      return 'No tenés permisos para enviar ese aviso o sobre esa terminal.';
    case 404:
      return 'No se encontró la terminal indicada.';
    case 502:
      return 'El aviso no se pudo entregar en tiempo real. Intentá de nuevo.';
    default:
      return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}

export const noticesTitle: ResolveFn<string> = (route) => {
  const action = (route.paramMap.get('action') as NoticeAction | null) ?? 'list';
  return VIEWS[action]?.title ?? VIEWS['list'].title;
};
