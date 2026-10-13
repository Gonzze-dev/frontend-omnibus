import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { SearchOption, SearchSelect } from '../../shared/search-select/search-select';
import { TerminalService } from '../../services/terminal.service';
import { CityService } from '../../services/city.service';
import { ExternalTerminal, Terminal } from '../../models/terminal.model';
import { City } from '../../models/city.model';

export type TerminalAction = 'list' | 'create' | 'edit';

interface TerminalView {
  title: string;
  lead: string;
}

const VIEWS: Record<TerminalAction, TerminalView> = {
  list: {
    title: 'Gestionar terminales',
    lead: 'Gestionar terminales te permite ver, crear, editar y eliminar terminales del sistema.',
  },
  create: {
    title: 'Cargar terminal',
    lead: 'Alta de una terminal nueva en una ciudad.',
  },
  edit: {
    title: 'Editar terminal',
    lead: 'Cambia el nombre, la ciudad o la terminal externa.',
  },
};

/** Rows that fit in one page of the list. */
const PAGE_SIZE = 10;

/** Number of rows requested from the backend to filter/paginate on the client. */
const BACKEND_LIMIT = 500;

/**
 * Terminals CRUD screens. The whole section is exclusive
 * to the super admin: the endpoints live in /api/super.
 */
@Component({
  selector: 'app-terminals',
  imports: [Topbar, RouterLink, ReactiveFormsModule, SearchSelect],
  templateUrl: './terminals.html',
  styleUrl: './terminals.scss',
})
export class Terminals {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly terminalService = inject(TerminalService);
  private readonly cityService = inject(CityService);
  private readonly fb = inject(FormBuilder);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly action = computed(() => {
    const action = this.params().get('action') as TerminalAction | null;
    return action && action in VIEWS ? action : 'list';
  });

  /** Uuid of the terminal to edit, if the route carries it. */
  private readonly code = computed(() => this.params().get('code'));

  protected readonly view = computed(() => VIEWS[this.action()]);

  protected readonly cities = signal<City[]>([]);

  /** Terminals of the bus ticket system, to choose the external id. */
  protected readonly externals = signal<ExternalTerminal[]>([]);
  protected readonly externalsError = signal<string | null>(null);

  protected readonly cityOptions = computed<SearchOption[]>(() =>
    this.cities().map((c) => ({ value: c.postal_code, label: `${c.name} (${c.postal_code})` })),
  );

  protected readonly externalOptions = computed<SearchOption[]>(() =>
    this.externals().map((e) => ({ value: e.uuid, label: e.name, disabled: this.externalTaken(e) })),
  );

  /** External ids already assigned to some terminal, so they are not offered again. */
  private readonly externalsInUse = computed(
    () =>
      new Set(
        this.allTerminals()
          .map((t) => t.external_terminal_id)
          .filter((id): id is string => !!id),
      ),
  );

  /** List filter text: name, postal code or identifiers. */
  protected readonly filter = signal('');

  protected readonly page = signal(1);

  // --- List ---
  protected readonly loadingList = signal(false);
  protected readonly listError = signal<string | null>(null);
  private readonly allTerminals = signal<Terminal[]>([]);

  private readonly filtered = computed(() => {
    const text = this.filter().trim().toLowerCase();
    const terminals = this.allTerminals();
    if (!text) return terminals;

    return terminals.filter((t) =>
      [t.name, t.postal_code, t.uuid, t.external_terminal_id ?? ''].some((field) =>
        field.toLowerCase().includes(text),
      ),
    );
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)),
  );

  /**
   * Effective page: if the filter left fewer pages than there were,
   * the last valid one, so an empty list is not shown.
   */
  protected readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  protected readonly pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1),
  );

  /** The 10 rows of the current page. */
  protected readonly terminals = computed(() => {
    const from = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(from, from + PAGE_SIZE);
  });

  /**
   * Blank rows that complete the page. The table always has the same
   * height, so the pagination and the add button do not move when the
   * last page or the filter return fewer than 10 terminals.
   */
  protected readonly filler = computed(() =>
    Array.from({ length: Math.max(0, PAGE_SIZE - (this.terminals().length || 1)) }),
  );

  // --- Create (popup over the list) ---
  private readonly createDialog = viewChild<ElementRef<HTMLDialogElement>>('createDialog');
  protected readonly createOpen = signal(false);
  protected readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    postal_code: ['', Validators.required],
    external_terminal_id: ['', Validators.required],
  });
  protected readonly savingCreate = signal(false);
  protected readonly createError = signal<string | null>(null);

  // --- Edit ---
  protected readonly editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    postal_code: ['', Validators.required],
    external_terminal_id: ['', Validators.required],
  });
  protected readonly loadingSelected = signal(false);
  protected readonly selectedError = signal<string | null>(null);
  protected readonly savingEdit = signal(false);
  protected readonly editError = signal<string | null>(null);

  // --- Edit: chosen terminal (popup over the list) ---
  private readonly editDialog = viewChild<ElementRef<HTMLDialogElement>>('editDialog');
  protected readonly editOpen = signal(false);
  protected readonly selectedTerminal = signal<Terminal | null>(null);

  // --- Delete (popup over the list) ---
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');
  protected readonly toDelete = signal<Terminal | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    this.loadCities();
    this.loadExternals();

    effect(() => {
      const action = this.action();

      if (action === 'list') {
        this.loadTerminals();
      } else if (action === 'edit') {
        // The old edit URL still works: it shows the list with the popup open
        const code = this.code();
        this.router.navigateByUrl('/dashboard/terminals', { replaceUrl: true });
        untracked(() => this.openEdit(code));
      } else if (action === 'create') {
        // The old create URL still works: it shows the list with the popup open
        this.router.navigateByUrl('/dashboard/terminals', { replaceUrl: true });
        untracked(() => this.openCreate());
      }
    });

    effect(() => {
      const dialog = this.createDialog()?.nativeElement;
      if (!dialog) return;
      if (this.createOpen() && !dialog.open) dialog.showModal();
      if (!this.createOpen() && dialog.open) dialog.close();
    });

    effect(() => {
      const dialog = this.editDialog()?.nativeElement;
      if (!dialog) return;
      if (this.editOpen() && !dialog.open) dialog.showModal();
      if (!this.editOpen() && dialog.open) dialog.close();
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

  private loadCities(): void {
    this.cityService.list({ limit: BACKEND_LIMIT, order: 'ASC' }).subscribe({
      next: (res) => this.cities.set(res.cities),
    });
  }

  private loadExternals(): void {
    this.externalsError.set(null);
    this.terminalService.listExternal().subscribe({
      next: (externals) =>
        this.externals.set([...externals].sort((a, b) => a.name.localeCompare(b.name))),
      error: () => this.externalsError.set('No se pudieron cargar las terminales del sistema de pasajes.'),
    });
  }

  /**
   * An external terminal already assigned to another terminal cannot be chosen
   * again. When editing, the one the selected terminal already has is allowed.
   */
  private externalTaken(external: ExternalTerminal): boolean {
    const own = this.selectedTerminal()?.external_terminal_id;
    return this.externalsInUse().has(external.uuid) && external.uuid !== own;
  }

  private loadTerminals(): void {
    this.loadingList.set(true);
    this.listError.set(null);

    this.terminalService.list({ limit: BACKEND_LIMIT, order: 'ASC' }).subscribe({
      next: (res) => {
        this.allTerminals.set(res.terminals);
        this.loadingList.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingList.set(false);
        this.listError.set(errorMessage(err));
      },
    });
  }

  private loadSelected(uuid: string | null): void {
    this.selectedTerminal.set(null);
    this.selectedError.set(null);

    if (!uuid) {
      this.selectedError.set('No se indico que terminal usar.');
      return;
    }

    this.loadingSelected.set(true);
    this.terminalService.get(uuid).subscribe({
      next: (terminal) => {
        this.loadingSelected.set(false);
        this.selectedTerminal.set(terminal);
        this.editForm.setValue({
          name: terminal.name,
          postal_code: terminal.postal_code,
          external_terminal_id: terminal.external_terminal_id ?? '',
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loadingSelected.set(false);
        this.selectedError.set(errorMessage(err));
      },
    });
  }

  protected applyFilter(text: string): void {
    this.filter.set(text);
    this.page.set(1);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  protected openEdit(uuid: string | null): void {
    this.editError.set(null);
    this.editOpen.set(true);
    this.loadSelected(uuid);
  }

  protected closeEdit(): void {
    if (this.savingEdit()) return;
    this.editOpen.set(false);
    this.editError.set(null);
  }

  /** A click on the backdrop (outside the content) closes the edit popup. */
  protected onEditPopupClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeEdit();
  }

  protected openCreate(): void {
    this.selectedTerminal.set(null);
    this.createForm.reset();
    this.createError.set(null);
    this.createOpen.set(true);
  }

  protected closeCreate(): void {
    if (this.savingCreate()) return;
    this.createOpen.set(false);
    this.createError.set(null);
  }

  /** A click on the backdrop (outside the content) closes the create popup. */
  protected onCreatePopupClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeCreate();
  }

  protected create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.savingCreate.set(true);
    this.createError.set(null);

    const { name, postal_code, external_terminal_id } = this.createForm.getRawValue();
    this.terminalService
      .create({
        name: name.trim(),
        postal_code,
        external_terminal_id,
      })
      .subscribe({
        next: () => {
          this.savingCreate.set(false);
          this.createOpen.set(false);
          this.loadTerminals();
        },
        error: (err: HttpErrorResponse) => {
          this.savingCreate.set(false);
          this.createError.set(errorMessage(err));
        },
      });
  }

  protected saveEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const selected = this.selectedTerminal();
    if (!selected) return;

    this.savingEdit.set(true);
    this.editError.set(null);

    const { name, postal_code, external_terminal_id } = this.editForm.getRawValue();
    this.terminalService
      .update(selected.uuid, {
        name: name.trim(),
        postal_code,
        external_terminal_id,
      })
      .subscribe({
        next: () => {
          this.savingEdit.set(false);
          this.editOpen.set(false);
          this.loadTerminals();
        },
        error: (err: HttpErrorResponse) => {
          this.savingEdit.set(false);
          this.editError.set(errorMessage(err));
        },
      });
  }

  protected confirmDelete(terminal: Terminal): void {
    this.deleteError.set(null);
    this.toDelete.set(terminal);
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

    this.terminalService.delete(selected.uuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toDelete.set(null);
        // The terminal is removed from the list without requesting it from the backend again
        this.allTerminals.update((terminals) =>
          terminals.filter((t) => t.uuid !== selected.uuid),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(errorMessage(err));
      },
    });
  }

  protected createInvalid(field: 'name' | 'postal_code' | 'external_terminal_id'): boolean {
    const control = this.createForm.controls[field];
    return control.invalid && control.touched;
  }

  protected editInvalid(field: 'name' | 'postal_code' | 'external_terminal_id'): boolean {
    const control = this.editForm.controls[field];
    return control.invalid && control.touched;
  }
}

function errorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intenta mas tarde.';
    case 400:
      return 'Revisa los datos: faltan campos o la terminal externa no es valida.';
    case 404:
      return 'No se encontro la terminal o la ciudad indicada.';
    case 409:
      return 'Esa terminal externa ya esta asignada a otra terminal.';
    default:
      return 'Ocurrio un error inesperado. Intenta de nuevo.';
  }
}

export const terminalsTitle: ResolveFn<string> = (route) => {
  const action = (route.paramMap.get('action') as TerminalAction | null) ?? 'list';
  return VIEWS[action]?.title ?? VIEWS['list'].title;
};
