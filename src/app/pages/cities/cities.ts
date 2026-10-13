import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { CityService } from '../../services/city.service';
import { City } from '../../models/city.model';

export type CityAction = 'list' | 'create' | 'edit';

interface CityView {
  title: string;
  lead: string;
}

const VIEWS: Record<CityAction, CityView> = {
  list: {
    title: 'Gestionar ciudades',
    lead: 'Gestionar ciudades te permite ver, crear, editar y eliminar ciudades del sistema.',
  },
  create: {
    title: 'Cargar ciudad',
    lead: 'Alta de una ciudad nueva en el sistema.',
  },
  edit: {
    title: 'Editar ciudad',
    lead: 'Cambia el nombre o el codigo postal.',
  },
};

/** Rows that fit in one page of the list. */
const PAGE_SIZE = 10;

/** Number of cities requested from the backend to filter/paginate on the client. */
const BACKEND_LIMIT = 500;

/**
 * Cities CRUD screens. The management options share this
 * component: the view changes according to the :action
 * parameter, just like Management changes section.
 */
@Component({
  selector: 'app-cities',
  imports: [Topbar, RouterLink, ReactiveFormsModule],
  templateUrl: './cities.html',
  styleUrl: './cities.scss',
})
export class Cities {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cityService = inject(CityService);
  private readonly fb = inject(FormBuilder);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly action = computed(() => {
    const action = this.params().get('action') as CityAction | null;
    return action && action in VIEWS ? action : 'list';
  });

  /** Postal code of the city to edit, if the route carries it. */
  private readonly code = computed(() => this.params().get('code'));

  protected readonly view = computed(() => VIEWS[this.action()]);

  /** List filter text: searches by postal code or by name. */
  protected readonly filter = signal('');

  protected readonly page = signal(1);

  // --- List ---
  protected readonly loadingList = signal(false);
  protected readonly listError = signal<string | null>(null);
  private readonly allCities = signal<City[]>([]);

  private readonly filtered = computed(() => {
    const text = this.filter().trim().toLowerCase();
    const cities = this.allCities();
    if (!text) return cities;

    return cities.filter(
      (c) => c.postal_code.toLowerCase().includes(text) || c.name.toLowerCase().includes(text),
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
  protected readonly cities = computed(() => {
    const from = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(from, from + PAGE_SIZE);
  });

  /**
   * Blank rows that complete the page. The table always has the same
   * height, so the pagination and the add button do not move when the
   * last page or the filter return fewer than 10 cities.
   */
  protected readonly filler = computed(() =>
    Array.from({ length: Math.max(0, PAGE_SIZE - (this.cities().length || 1)) }),
  );

  // --- Create (popup over the list) ---
  private readonly createDialog = viewChild<ElementRef<HTMLDialogElement>>('createDialog');
  protected readonly createOpen = signal(false);
  protected readonly createForm = this.fb.nonNullable.group({
    postal_code: ['', Validators.required],
    name: ['', Validators.required],
  });
  protected readonly savingCreate = signal(false);
  protected readonly createError = signal<string | null>(null);

  // --- Edit ---
  protected readonly editForm = this.fb.nonNullable.group({
    postal_code: ['', Validators.required],
    name: ['', Validators.required],
  });
  protected readonly loadingSelected = signal(false);
  protected readonly selectedError = signal<string | null>(null);
  protected readonly savingEdit = signal(false);
  protected readonly editError = signal<string | null>(null);

  // --- Edit: chosen city (popup over the list) ---
  private readonly editDialog = viewChild<ElementRef<HTMLDialogElement>>('editDialog');
  protected readonly editOpen = signal(false);
  protected readonly selectedCity = signal<City | null>(null);

  // --- Delete (popup over the list) ---
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');
  protected readonly toDelete = signal<City | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const action = this.action();

      if (action === 'list') {
        this.loadCities();
      } else if (action === 'edit') {
        // The old edit URL still works: it shows the list with the popup open
        const code = this.code();
        this.router.navigateByUrl('/dashboard/cities', { replaceUrl: true });
        untracked(() => this.openEdit(code));
      } else if (action === 'create') {
        // The old create URL still works: it shows the list with the popup open
        this.router.navigateByUrl('/dashboard/cities', { replaceUrl: true });
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

  private loadCities(): void {
    this.loadingList.set(true);
    this.listError.set(null);

    this.cityService.list({ limit: BACKEND_LIMIT, order: 'ASC' }).subscribe({
      next: (res) => {
        this.allCities.set(res.cities);
        this.loadingList.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingList.set(false);
        this.listError.set(errorMessage(err));
      },
    });
  }

  private loadSelected(code: string | null): void {
    this.selectedCity.set(null);
    this.selectedError.set(null);

    if (!code) {
      this.selectedError.set('No se indico que ciudad usar.');
      return;
    }

    this.loadingSelected.set(true);
    this.cityService.get(code).subscribe({
      next: (city) => {
        this.loadingSelected.set(false);
        this.selectedCity.set(city);
        this.editForm.setValue({ postal_code: city.postal_code, name: city.name });
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

  protected openCreate(): void {
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

  protected openEdit(code: string | null): void {
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

  protected create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.savingCreate.set(true);
    this.createError.set(null);

    const { postal_code, name } = this.createForm.getRawValue();
    this.cityService.create({ postal_code: postal_code.trim(), name: name.trim() }).subscribe({
      next: () => {
        this.savingCreate.set(false);
        this.createOpen.set(false);
        this.loadCities();
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

    const selected = this.selectedCity();
    if (!selected) return;

    this.savingEdit.set(true);
    this.editError.set(null);

    const { postal_code, name } = this.editForm.getRawValue();
    this.cityService
      .update(selected.postal_code, { postal_code: postal_code.trim(), name: name.trim() })
      .subscribe({
        next: () => {
          this.savingEdit.set(false);
          this.editOpen.set(false);
          this.loadCities();
        },
        error: (err: HttpErrorResponse) => {
          this.savingEdit.set(false);
          this.editError.set(errorMessage(err));
        },
      });
  }

  protected confirmDelete(city: City): void {
    this.deleteError.set(null);
    this.toDelete.set(city);
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

    this.cityService.delete(selected.postal_code).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toDelete.set(null);
        // The city is removed from the list without requesting it from the backend again
        this.allCities.update((cities) =>
          cities.filter((c) => c.postal_code !== selected.postal_code),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(errorMessage(err));
      },
    });
  }

  protected createInvalid(field: 'postal_code' | 'name'): boolean {
    const control = this.createForm.controls[field];
    return control.invalid && control.touched;
  }

  protected editInvalid(field: 'postal_code' | 'name'): boolean {
    const control = this.editForm.controls[field];
    return control.invalid && control.touched;
  }
}

function errorMessage(err: HttpErrorResponse): string {
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

export const citiesTitle: ResolveFn<string> = (route) => {
  const action = (route.paramMap.get('action') as CityAction | null) ?? 'list';
  return VIEWS[action]?.title ?? VIEWS['list'].title;
};
