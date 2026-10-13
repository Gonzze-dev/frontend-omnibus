import { Component, inject } from '@angular/core';
import { Topbar } from '../../shared/topbar/topbar';
import { NotificacionesStore } from '../../shared/notificaciones';

@Component({
  selector: 'app-notificaciones',
  imports: [Topbar],
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.scss',
})
export class Notificaciones {
  private readonly store = inject(NotificacionesStore);

  protected readonly lista = this.store.lista;

  limpiar(): void {
    this.store.limpiar();
  }
}
