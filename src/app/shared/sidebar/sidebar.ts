import { Component, ElementRef, computed, effect, inject, model, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  host: {
    '(document:keydown.escape)': 'close()',
  },
})
export class Sidebar {
  private readonly auth = inject(AuthService);

  /** Two-way: the parent opens the menu and the drawer closes by itself. */
  readonly open = model(false);

  protected readonly isAdmin = computed(() => this.auth.hasRole('admin', 'super_admin'));

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  /** Element that had focus before opening (the menu button): it gets it back when closing. */
  private opener: HTMLElement | null = null;

  constructor() {
    // Keyboard and screen readers follow the drawer: when it opens focus goes to
    // its first link, and when it closes it goes back to whoever opened it.
    effect(() => {
      if (this.open()) {
        this.opener = document.activeElement as HTMLElement | null;
        // Waits for the panel to lose `inert`, which blocks focus
        setTimeout(() => this.panel().nativeElement.querySelector<HTMLElement>('a, button')?.focus());
      } else if (this.opener) {
        this.opener.focus();
        this.opener = null;
      }
    });
  }

  close(): void {
    this.open.set(false);
  }

  logout(): void {
    this.close();
    this.auth.logout();
  }
}
