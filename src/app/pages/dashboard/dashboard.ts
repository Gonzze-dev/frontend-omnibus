import { Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Topbar } from '../../shared/topbar/topbar';
import { Counter } from '../../shared/counter/counter';
import { StatsService } from '../../services/stats.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

type Glyph =
  | 'city'
  | 'platform'
  | 'terminal'
  | 'site'
  | 'settings'
  | 'monitor'
  | 'permissions'
  | 'roles'
  | 'notices';

type Tone = 'blue' | 'indigo' | 'crimson' | 'ink' | 'orange';

interface Metric {
  id: string;
  label: string;
  /** null while loading or if the endpoint failed. */
  value: WritableSignal<number | null>;
  icon: Glyph;
  tone: Tone;
  load: () => Observable<number>;
}

interface Shortcut {
  id: string;
  title: string;
  lead: string;
  icon: Glyph;
  /** Big, almost transparent icon in the bottom right corner. */
  mark: Glyph;
  tone: Tone;
  /** Its endpoints live in /api/super: only a super admin sees it. */
  superOnly?: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [Topbar, NgTemplateOutlet, RouterLink, Counter],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly stats = inject(StatsService);
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  /**
   * Glyphs are drawn at small icon size (scale 1) and are
   * enlarged depending on where they appear, as in the mockup.
   */
  protected readonly scale = { metric: 1, shortcut: 4 / 3, mark: 10 / 3 };

  /** Each metric is requested separately: if one count fails, the others are still shown. */
  protected readonly metrics: readonly Metric[] = [
    {
      id: 'cities',
      label: 'Total de ciudades',
      value: signal<number | null>(null),
      icon: 'city',
      tone: 'blue',
      load: () => this.stats.totalCities(),
    },
    {
      id: 'platforms',
      label: 'Total de plataformas',
      value: signal<number | null>(null),
      icon: 'platform',
      tone: 'indigo',
      load: () => this.stats.totalPlatforms(),
    },
    {
      id: 'terminals',
      label: 'Total de terminales',
      value: signal<number | null>(null),
      icon: 'terminal',
      tone: 'crimson',
      load: () => this.stats.totalTerminals(),
    },
  ];

  /**
   * Each shortcut summarizes a group of administration endpoints. The id
   * is the route segment: the card links to /dashboard/<id>.
   * "Manage notifications" is not in the mockup: it covers the
   * notice and delay endpoints, which had no card.
   */
  protected readonly shortcuts: readonly Shortcut[] = [
    { id: 'cities', title: 'Gestionar ciudades', lead: 'Mapa y sedes', icon: 'site', mark: 'city', tone: 'blue', superOnly: true },
    { id: 'platforms', title: 'Gestionar plataformas', lead: 'Sistemas base', icon: 'platform', mark: 'platform', tone: 'indigo' },
    { id: 'terminals', title: 'Gestionar terminales', lead: 'Sistema base', icon: 'terminal', mark: 'terminal', tone: 'crimson', superOnly: true },
    { id: 'permissions', title: 'Control de permisos', lead: 'Roles', icon: 'permissions', mark: 'roles', tone: 'ink' },
    { id: 'notifications', title: 'Gestionar notificaciones', lead: 'Avisos y retrasos', icon: 'notices', mark: 'notices', tone: 'orange' },
  ];

  /** Greets with the session's first name, which /users/me keeps up to date. */
  protected readonly greeting = computed(() => {
    const name = this.auth.user()?.first_name?.trim();
    return name ? `Bienvenido, ${name}` : 'Bienvenido';
  });

  /** Recomputed only when /users/me brings a different role. */
  protected readonly visibleShortcuts = computed(() =>
    this.shortcuts.filter((s) => !s.superOnly || this.auth.isSuper()),
  );

  ngOnInit(): void {
    this.syncPermissions();

    for (const m of this.metrics) {
      m.load().subscribe({
        next: (total) => m.value.set(total),
        error: () => m.value.set(null),
      });
    }
  }

  /**
   * The stored role may be stale (another admin changed it while the
   * session was still open): the profile is requested every time the page is entered.
   * If they are no longer an administrator, they leave the dashboard.
   */
  private syncPermissions(): void {
    this.userService.getProfile().subscribe({
      next: () => {
        if (!this.auth.hasRole('admin', 'super_admin')) {
          this.router.navigateByUrl(this.auth.homeRoute());
        }
      },
      error: () => {},
    });
  }
}
