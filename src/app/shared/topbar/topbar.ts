import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { NotificacionesStore } from '../notificaciones';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink, Sidebar],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly store = inject(NotificacionesStore);

  protected readonly menuOpen = signal(false);
  protected readonly pendientes = this.store.cantidad;
}
