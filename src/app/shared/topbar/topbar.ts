import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { NotificationsStore } from '../notifications';
import { AuthService } from '../../services/auth.service';

/** Same breakpoint as the styles.scss scale: from here on the menu goes in the bar. */
const DESKTOP = '(min-width: 768px)';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink, RouterLinkActive, Sidebar],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly store = inject(NotificationsStore);
  private readonly auth = inject(AuthService);

  protected readonly menuOpen = signal(false);
  protected readonly pending = this.store.count;
  protected readonly isAdmin = computed(() => this.auth.hasRole('admin', 'super_admin'));

  constructor() {
    // If the drawer was left open and the window grows, it closes:
    // that way it does not reappear open when shrinking it again.
    const mq = window.matchMedia(DESKTOP);
    const onChange = (e: MediaQueryListEvent) => e.matches && this.menuOpen.set(false);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
  }

  logout(): void {
    this.auth.logout();
  }
}
