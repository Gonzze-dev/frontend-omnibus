import { Component, signal } from '@angular/core';
import { Topbar } from '../../shared/topbar/topbar';
import { EsperaViaje } from '../espera-viaje/espera-viaje';

@Component({
  selector: 'app-home',
  imports: [Topbar, EsperaViaje],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  /**
   * "Espera del viaje" no es una ruta: es el mismo home con el cuerpo
   * reemplazado. Volver a false lo deja como estaba.
   */
  protected readonly esperando = signal(false);
}
