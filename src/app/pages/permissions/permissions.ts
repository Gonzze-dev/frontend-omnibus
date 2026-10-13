import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable, map } from 'rxjs';
import { Topbar } from '../../shared/topbar/topbar';
import { Toast } from '../../shared/toast/toast';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TerminalService } from '../../services/terminal.service';
import { UserManagementService } from '../../services/user-management.service';
import { AssignedTerminal, ListedUser } from '../../models/user-management.model';

/** Rows that fit in one page of the users list. */
const PAGE_SIZE = 10;

/**
 * Permission control: paginated list of users from which an account is
 * searched and its role is raised or lowered (admin or super admin).
 */
@Component({
  selector: 'app-permissions',
  imports: [Topbar, RouterLink, Toast],
  templateUrl: './permissions.html',
  styleUrl: './permissions.scss',
})
export class Permissions {
  // --- Users list ---
  // Unlike cities, pagination and search are done by the
  // backend: every page change or search is a new request.
  private readonly userManagement = inject(UserManagementService);

  /** What is typed in the search box, not applied yet. */
  protected readonly searchText = signal('');
  /** Search applied with the button: the one sent to the backend. */
  private readonly search = signal('');

  protected readonly page = signal(1);
  /** Incremented to request the current page again (after a role change). */
  private readonly reload = signal(0);
  protected readonly totalElements = signal(0);
  protected readonly users = signal<ListedUser[]>([]);
  protected readonly loadingList = signal(false);
  protected readonly listError = signal<string | null>(null);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalElements() / PAGE_SIZE)),
  );

  protected readonly pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1),
  );

  /** Blank rows that complete the page, so the table does not change height. */
  protected readonly filler = computed(() =>
    Array.from({ length: Math.max(0, PAGE_SIZE - (this.users().length || 1)) }),
  );

  constructor() {
    effect(() => {
      this.reload();
      this.loadUsers(this.page(), this.search());
    });

    // The detail's - depends on the admin's own terminals: the profile is
    // refreshed because the stored session may be stale.
    if (this.auth.user()?.role === 'admin') {
      this.userService.getProfile().subscribe({ error: () => {} });
    }

    // The native <dialog> is opened with showModal() to get a backdrop, trapped
    // focus and closing with Escape without writing them by hand.
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.target() && !dialog.open) dialog.showModal();
      if (!this.target() && dialog.open) dialog.close();
    });
  }

  private loadUsers(page: number, search: string): void {
    this.loadingList.set(true);
    this.listError.set(null);
    this.expanded.set(null);

    this.userManagement
      .list({ page, limit: PAGE_SIZE, order: 'ASC', search })
      .subscribe({
        next: (res) => {
          this.users.set(res.users);
          this.totalElements.set(res.total_elements);
          this.loadingList.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.users.set([]);
          this.totalElements.set(0);
          this.loadingList.set(false);
          this.listError.set(listErrorMessage(err));
        },
      });
  }

  protected applySearch(): void {
    this.search.set(this.searchText().trim());
    this.page.set(1);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  /** User with the terminals detail expanded. One at a time. */
  protected readonly expanded = signal<string | null>(null);

  protected isAdmin(u: ListedUser): boolean {
    return u.role === 'admin';
  }

  /** Tapping the expanded user again collapses it. */
  protected toggle(uuid: string): void {
    this.expanded.update((current) => (current === uuid ? null : uuid));
  }

  // --- Promotion popup ---
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly terminalService = inject(TerminalService);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly iAmSuper = this.auth.isSuper;

  /** User whose role is being changed. null = popup closed. */
  protected readonly target = signal<ListedUser | null>(null);
  /**
   * The same popup is used to raise the role (+), lower a super admin (-)
   * or remove a terminal from an admin (- in the detail).
   */
  protected readonly mode = signal<'promote' | 'demote' | 'remove-terminal'>('promote');
  /** Terminal removed from the admin in 'remove-terminal' mode. */
  protected readonly terminalToRemove = signal<AssignedTerminal | null>(null);
  /** The super admin first chooses the role; the admin goes straight to the terminal. */
  protected readonly step = signal<'role' | 'terminal'>('terminal');

  /** Terminals the logged-in user can grant: all of them if super, their own if admin. */
  private readonly availableTerminals = signal<AssignedTerminal[]>([]);
  protected readonly loadingTerminals = signal(false);
  protected readonly chosenTerminal = signal<string | null>(null);

  /** The terminals the user already manages are not offered. */
  protected readonly offeredTerminals = computed(() => {
    const alreadyHas = new Set(this.target()?.terminals.map((t) => t.uuid) ?? []);
    return this.availableTerminals().filter((t) => !alreadyHas.has(t.uuid));
  });

  // --- Terminal selector with search ---
  /** What is typed in the selector. When a terminal is chosen it becomes its name. */
  protected readonly terminalText = signal('');
  protected readonly terminalListOpen = signal(false);
  /** Option highlighted with the keyboard arrows. */
  protected readonly highlighted = signal(0);

  protected readonly filteredTerminals = computed(() => {
    const text = normalize(this.terminalText());
    const chosen = this.chosenTerminal();
    const offered = this.offeredTerminals();
    // With one already chosen all of them are shown, so it can be changed without deleting the text.
    if (!text || chosen) return offered;
    return offered.filter((t) => normalize(t.name).includes(text));
  });

  protected typeTerminal(text: string): void {
    this.terminalText.set(text);
    this.chosenTerminal.set(null);
    this.highlighted.set(0);
    this.terminalListOpen.set(true);
  }

  protected chooseTerminal(t: AssignedTerminal): void {
    this.chosenTerminal.set(t.uuid);
    this.terminalText.set(t.name);
    this.terminalListOpen.set(false);
  }

  protected onTerminalKey(event: KeyboardEvent): void {
    const options = this.filteredTerminals();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.terminalListOpen()) return this.terminalListOpen.set(true);
        this.highlighted.update((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlighted.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        const t = options[this.highlighted()];
        if (this.terminalListOpen() && t) {
          event.preventDefault();
          this.chooseTerminal(t);
        }
        break;
      }
      case 'Escape':
        // With the list open, Escape closes the list and not the popup.
        if (this.terminalListOpen()) {
          event.preventDefault();
          event.stopPropagation();
          this.terminalListOpen.set(false);
        }
        break;
    }
  }

  protected readonly promoting = signal(false);
  protected readonly promotionError = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  /**
   * The + appears on the accounts whose role can be raised:
   * never on your own nor on a super admin, which is already the highest role.
   */
  protected canPromote(u: ListedUser): boolean {
    return u.role !== 'super_admin' && u.uuid !== this.auth.user()?.uuid;
  }

  /** Only a super admin sees the -, on another super admin (never on themselves). */
  protected canDemote(u: ListedUser): boolean {
    return this.iAmSuper() && u.role === 'super_admin' && u.uuid !== this.auth.user()?.uuid;
  }

  protected openDemotion(u: ListedUser): void {
    this.target.set(u);
    this.mode.set('demote');
    this.promotionError.set(null);
  }

  protected demoteSuper(): void {
    const u = this.target();
    if (!u) return;
    this.runPromotion(
      this.userManagement.demoteSuper(u.email),
      `${u.first_name} ${u.last_name} ahora es usuario`,
    );
  }

  /**
   * The detail's -: a super admin sees it on any terminal; an admin,
   * only on the ones they also manage. Never on their own account.
   */
  protected canRemoveTerminal(u: ListedUser, t: AssignedTerminal): boolean {
    if (u.uuid === this.auth.user()?.uuid) return false;
    if (this.iAmSuper()) return true;
    return this.auth.user()?.terminals?.some((own) => own.uuid === t.uuid) ?? false;
  }

  protected openRemoveTerminal(u: ListedUser, t: AssignedTerminal): void {
    this.target.set(u);
    this.terminalToRemove.set(t);
    this.mode.set('remove-terminal');
    this.promotionError.set(null);
  }

  protected removeTerminal(): void {
    const u = this.target();
    const t = this.terminalToRemove();
    if (!u || !t) return;
    const last = u.terminals.length <= 1;
    this.runPromotion(
      this.userManagement.demoteAdmin(u.email, t.uuid),
      last
        ? `${u.first_name} ${u.last_name} ahora es usuario`
        : `${u.first_name} ${u.last_name} ya no está a cargo de ${t.name}`,
    );
  }

  protected openPromotion(u: ListedUser): void {
    this.target.set(u);
    this.mode.set('promote');
    this.step.set(this.iAmSuper() ? 'role' : 'terminal');
    this.chosenTerminal.set(null);
    this.promotionError.set(null);
    if (!this.iAmSuper()) this.loadTerminals();
  }

  protected closePromotion(): void {
    if (this.promoting()) return;
    this.target.set(null);
  }

  /**
   * A click on the backdrop (the <dialog> itself, outside the content) closes it.
   * It deliberately returns nothing: if the handler returned false, Angular
   * would call preventDefault and the radios inside could not be checked.
   */
  protected onPopupClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closePromotion();
  }

  /** Super admin step: admin leads to choosing the terminal. */
  protected chooseAdmin(): void {
    this.step.set('terminal');
    this.promotionError.set(null);
    this.loadTerminals();
  }

  protected backToRole(): void {
    this.step.set('role');
    this.promotionError.set(null);
  }

  private loadTerminals(): void {
    this.loadingTerminals.set(true);
    this.chosenTerminal.set(null);
    this.terminalText.set('');
    this.terminalListOpen.set(false);

    // The admin can only grant their terminals: they come from the profile, which is
    // the up-to-date source (the stored session may be stale).
    const terminals$: Observable<AssignedTerminal[]> = this.iAmSuper()
      ? this.terminalService.listPublic().pipe(map((ts) => ts.map((t) => ({ uuid: t.uuid, name: t.name }))))
      : this.userService.getProfile().pipe(map((u) => u.terminals ?? []));

    terminals$.subscribe({
      next: (terminals) => {
        this.availableTerminals.set(terminals);
        this.loadingTerminals.set(false);
        // With a single option there is no need to make them choose.
        const offered = this.offeredTerminals();
        if (offered.length === 1) this.chooseTerminal(offered[0]);
      },
      error: (err: HttpErrorResponse) => {
        this.availableTerminals.set([]);
        this.loadingTerminals.set(false);
        this.promotionError.set(promotionErrorMessage(err));
      },
    });
  }

  protected promoteSuper(): void {
    const u = this.target();
    if (!u) return;
    this.runPromotion(
      this.userManagement.promoteSuper(u.email),
      `${u.first_name} ${u.last_name} ahora es super admin`,
    );
  }

  protected promoteAdmin(): void {
    const u = this.target();
    const terminal = this.chosenTerminal();
    if (!u || !terminal) return;
    this.runPromotion(
      this.userManagement.promoteAdmin(u.email, terminal),
      `${u.first_name} ${u.last_name} ahora es admin`,
    );
  }

  private runPromotion(request: Observable<unknown>, successMessage: string): void {
    this.promoting.set(true);
    this.promotionError.set(null);

    request.subscribe({
      next: () => {
        this.promoting.set(false);
        this.target.set(null);
        this.success.set(successMessage);
        this.reload.update((n) => n + 1);
      },
      error: (err: HttpErrorResponse) => {
        this.promoting.set(false);
        this.promotionError.set(promotionErrorMessage(err));
      },
    });
  }
}

/** To search ignoring case and accents ("gualeguaychu" finds "Gualeguaychú"). */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function listErrorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intentá más tarde.';
    case 401:
    case 403:
      return 'No tenés permisos para ver el listado de usuarios.';
    default:
      return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}

function promotionErrorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Intentá más tarde.';
    case 403:
      return 'No tenés permisos sobre esa terminal.';
    case 404:
      return 'No se encontró el usuario o la terminal.';
    case 409:
      return 'La cuenta ya tiene ese rol.';
    default:
      return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}

export const permissionsTitle = 'Control de permisos';
