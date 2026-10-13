import { Component, computed, inject, model } from '@angular/core';
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

  close(): void {
    this.open.set(false);
  }

  logout(): void {
    this.close();
    this.auth.logout();
  }
}
