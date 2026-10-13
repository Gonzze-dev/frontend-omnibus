import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { PlatformService } from '../../services/platform.service';
import { TerminalService } from '../../services/terminal.service';
import { TerminalWithPlatforms } from '../../models/platform.model';
import { Terminal } from '../../models/terminal.model';

export type PlatformAction = 'list' | 'create' | 'edit';

interface PlatformView {
  title: string;
  lead: string;
}

const VIEWS: Record<PlatformAction, PlatformView> = {
  list: {
    title: 'Gestionar plataformas',
    lead: 'Gestionar plataformas te permite ver, crear, editar y eliminar las plataformas de cada terminal.',
  },
  create: {
    title: 'Cargar plataforma',
    lead: 'Alta de un anden nuevo en una terminal.',
  },
  edit: {
    title: 'Editar plataforma',
    lead: 'Cambia el anden o su ubicacion.',
  },
};

/** Terminals that fit in one page of the list. */
const PAGE_SIZE = 10;

/** Number of rows requested from the backend to filter/paginate on the client. */
const BACKEND_LIMIT = 500;

/**
 * Platforms CRUD screens. The five management options
 * share this component and change according to :action.
 */
@Component({
  selector: 'app-platforms',
  imports: [Topbar, RouterLink, ReactiveFormsModule],
  templateUrl: './platforms.html',
  styleUrl: './platforms.scss',
})
export class Platforms {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformService = inject(PlatformService);
  private readonly terminalService = inject(TerminalService);
  private readonly fb = inject(FormBuilder);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly action = computed(() => {
    const action = this.params().get('action') as PlatformAction | null;
    return action && action in VIEWS ? action : 'list';
  });

  /** Code of the bay to edit, if the route carries it. */
  private readonly code = computed(() => {
    const raw = this.params().get('code');
    const code = raw ? Number(raw) : NaN;
    return Number.isInteger(code) ? code : null;
  });

  protected readonly view = computed(() => VIEWS[this.action()]);

  protected readonly terminals = signal<Terminal[]>([]);

  /** Filter text: terminal name, bay or bay code. */
  protected readonly filter = signal('');

  protected readonly page = signal(1);

  /** Expanded terminal, or null if all of them are collapsed. */
  protected readonly expanded = signal<string | null>(null);

  // --- List ---
  protected readonly loadingList = signal(false);
  protected readonly listError = signal<string | null>(null);
  private readonly allGroups = signal<TerminalWithPlatforms[]>([]);

  private readonly filtered = computed(() => {
    const text = this.filter().trim().toLowerCase();
    const groups = this.allGroups();
    if (!text) return groups;

    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(text) ||
        g.platforms.some(
          (p) => p.bay.toLowerCase().includes(text) || String(p.code).includes(text),
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

  /** The 10 terminals of the current page, each with its bays. */
  protected readonly groups = computed(() => {
    const from = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(from, from + PAGE_SIZE);
  });

  /**
   * Blank rows that complete the page. With every terminal
   * collapsed the table always has the same height, so the pagination and the
   * add button do not move from one page to another.
   */
  protected readonly filler = computed(() =>
    Array.from({ length: Math.max(0, PAGE_SIZE - (this.groups().length || 1)) }),
  );

  // --- Create (popup over the list) ---
  private readonly createDialog = viewChild<ElementRef<HTMLDialogElement>>('createDialog');
  protected readonly createOpen = signal(false);
  protected readonly createForm = this.fb.nonNullable.group({
    bus_terminal_id: ['', Validators.required],
    bay: ['', Validators.required],
    lat: [0, Validators.required],
    lng: [0, Validators.required],
  });
  protected readonly savingCreate = signal(false);
  protected readonly createError = signal<string | null>(null);

  // --- Edit ---
  protected readonly editForm = this.fb.nonNullable.group({
    bay: ['', Validators.required],
    lat: [0, Validators.required],
    lng: [0, Validators.required],
  });
  protected readonly loadingSelected = signal(false);
  protected readonly selectedError = signal<string | null>(null);
  protected readonly savingEdit = signal(false);
  protected readonly editError = signal<string | null>(null);

  // --- Edit: chosen bay (popup over the list) ---
  private readonly editDialog = viewChild<ElementRef<HTMLDialogElement>>('editDialog');
  protected readonly editOpen = signal(false);
  protected readonly selectedPlatform = signal<{
    code: number;
    bay: string;
    lat: number;
    lng: number;
    terminal: string;
  } | null>(null);

  // --- Delete (popup over the list) ---
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');
  protected readonly toDelete = signal<{ code: number; bay: string; terminal: string } | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    this.loadTerminals();

    effect(() => {
      const action = this.action();

      if (action === 'list') {
        this.loadPlatforms();
      } else if (action === 'edit') {
        // The old edit URL still works: it shows the list with the popup open
        const code = this.code();
        this.router.navigateByUrl('/dashboard/platforms', { replaceUrl: true });
        untracked(() => this.openEdit(code));
      } else if (action === 'create') {
        // The old create URL still works: it shows the list with the popup open
        this.router.navigateByUrl('/dashboard/platforms', { replaceUrl: true });
        untracked(() => this.openCreate());
      }
    });

    // The native <dialog> is opened with showModal() to get a backdrop, trapped
    // focus and closing with Escape without writing them by hand.
    effect(() => {
      const dialog = this.deleteDialog()?.nativeElement;
      if (!dialog) return;
      if (this.toDelete() && !dialog.open) dialog.showModal();
      if (!this.toDelete() && dialog.open) dialog.close();
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
  }

  private loadTerminals(): void {
    this.terminalService.listPublic().subscribe({
      next: (terminals) => this.terminals.set(terminals),
    });
  }

  private loadPlatforms(): void {
    this.loadingList.set(true);
    this.listError.set(null);

    this.platformService.list({ limit: BACKEND_LIMIT, order: 'ASC' }).subscribe({
      next: (res) => {
        this.allGroups.set(res.platforms);
        this.loadingList.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingList.set(false);
        this.listError.set(errorMessage(err));
      },
    });
  }

  private loadSelected(code: number | null): void {
    this.selectedPlatform.set(null);
    this.selectedError.set(null);

    if (code === null) {
      this.selectedError.set('No se indico que plataforma usar.');
      return;
    }

    this.loadingSelected.set(true);
    this.platformService.get(code).subscribe({
      next: (group) => {
        this.loadingSelected.set(false);
        const platform = group.platforms[0];
        if (!platform) {
          this.selectedError.set('No se encontro la plataforma.');
          return;
        }

        this.selectedPlatform.set({
          code: platform.code,
          bay: platform.bay,
          lat: platform.coordinates.lat,
          lng: platform.coordinates.lng,
          terminal: group.name,
        });
        this.editForm.setValue({
          bay: platform.bay,
          lat: platform.coordinates.lat,
          lng: platform.coordinates.lng,
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
    this.expanded.set(null);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 1), this.totalPages()));
    this.expanded.set(null);
  }

  protected openCreate(): void {
    this.createForm.reset({ lat: 0, lng: 0 });
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

  protected openEdit(code: number | null): void {
    this.editError.set(null);
    this.editOpen.set(true);
    this.loadSelected(code);
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

  /** One terminal expanded at a time: tapping it again collapses it. */
  protected toggle(uuid: string): void {
    this.expanded.update((current) => (current === uuid ? null : uuid));
  }

  protected create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.savingCreate.set(true);
    this.createError.set(null);

    const { bus_terminal_id, bay, lat, lng } = this.createForm.getRawValue();
    this.platformService
      .create({ bus_terminal_id, bay: bay.trim(), coordinates: { lat, lng } })
      .subscribe({
        next: () => {
          this.savingCreate.set(false);
          this.createOpen.set(false);
          this.loadPlatforms();
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

    const selected = this.selectedPlatform();
    if (!selected) return;

    this.savingEdit.set(true);
    this.editError.set(null);

    const { bay, lat, lng } = this.editForm.getRawValue();
    this.platformService
      .update(selected.code, { bay: bay.trim(), coordinates: { lat, lng } })
      .subscribe({
        next: () => {
          this.savingEdit.set(false);
          this.editOpen.set(false);
          this.loadPlatforms();
        },
        error: (err: HttpErrorResponse) => {
          this.savingEdit.set(false);
          this.editError.set(errorMessage(err));
        },
      });
  }

  protected confirmDelete(code: number, bay: string, terminal: string): void {
    this.deleteError.set(null);
    this.toDelete.set({ code, bay, terminal });
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

    this.platformService.delete(selected.code).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toDelete.set(null);
        // The bay is removed from the list without requesting it from the backend again
        this.allGroups.update((groups) =>
          groups.map((g) => ({
            ...g,
            platforms: g.platforms.filter((p) => p.code !== selected.code),
          })),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(errorMessage(err));
      },
    });
  }

  protected createInvalid(field: 'bus_terminal_id' | 'bay' | 'lat' | 'lng'): boolean {
    const control = this.createForm.controls[field];
    return control.invalid && control.touched;
  }

  protected editInvalid(field: 'bay' | 'lat' | 'lng'): boolean {
    const control = this.editForm.controls[field];
    return control.invalid && control.touched;
  }
}

function errorMessage(err: HttpErrorResponse): string {
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

export const platformsTitle: ResolveFn<string> = (route) => {
  const action = (route.paramMap.get('action') as PlatformAction | null) ?? 'list';
  return VIEWS[action]?.title ?? VIEWS['list'].title;
};
