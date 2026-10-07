import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { NotificacionesStore } from '../notificaciones';
import { AuthService } from '../../services/auth.service';

/** Mismo corte que la escala de styles.scss: desde aca el menu va en la barra. */
const ESCRITORIO = '(min-width: 768px)';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink, RouterLinkActive, Sidebar],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly store = inject(NotificacionesStore);
  private readonly auth = inject(AuthService);

  protected readonly menuOpen = signal(false);
  protected readonly pendientes = this.store.cantidad;
  protected readonly esAdmin = computed(() => this.auth.tieneRol('admin', 'super_admin'));

  constructor() {
    // Si el drawer quedo abierto y la ventana se agranda, se cierra:
    // asi no reaparece abierto al volver a achicarla.
    const mq = window.matchMedia(ESCRITORIO);
    const alCambiar = (e: MediaQueryListEvent) => e.matches && this.menuOpen.set(false);
    mq.addEventListener('change', alCambiar);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', alCambiar));
  }

  cerrarSesion(): void {
    this.auth.logout();
  }
}
