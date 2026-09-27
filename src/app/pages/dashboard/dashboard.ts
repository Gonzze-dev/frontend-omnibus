import { Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Topbar } from '../../shared/topbar/topbar';

type Glifo =
  | 'ciudad'
  | 'plataforma'
  | 'terminal'
  | 'sede'
  | 'ajustes'
  | 'monitor'
  | 'permisos'
  | 'roles'
  | 'avisos';

type Tono = 'azul' | 'indigo' | 'carmin' | 'tinta' | 'naranja';

interface Metrica {
  id: string;
  etiqueta: string;
  valor: number;
  icono: Glifo;
  tono: Tono;
}

interface Acceso {
  id: string;
  titulo: string;
  bajada: string;
  icono: Glifo;
  /** Icono grande y casi transparente de la esquina inferior derecha. */
  marca: Glifo;
  tono: Tono;
}

@Component({
  selector: 'app-dashboard',
  imports: [Topbar, NgTemplateOutlet, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  /**
   * Los glifos se dibujan a tamaño de icono chico (escala 1) y se
   * agrandan segun donde aparecen, como en el mockup.
   */
  protected readonly escala = { metrica: 1, acceso: 4 / 3, marca: 10 / 3 };

  /** Datos de ejemplo hasta que existan los endpoints de conteo. */
  protected readonly metricas: readonly Metrica[] = [
    { id: 'ciudades', etiqueta: 'Total de ciudades', valor: 124, icono: 'ciudad', tono: 'azul' },
    { id: 'plataformas', etiqueta: 'Plataformas activas', valor: 38, icono: 'plataforma', tono: 'indigo' },
    { id: 'terminales', etiqueta: 'Terminales en línea', valor: 1842, icono: 'terminal', tono: 'carmin' },
  ];

  /**
   * Cada acceso resume un grupo de endpoints de administracion. El id
   * es el de la seccion en pages/gestion/gestiones.ts: la card linkea
   * a /dashboard/<id>.
   * "Gestionar notificaciones" no esta en el mockup: cubre los
   * endpoints de avisos y retrasos, que no tenian card.
   */
  protected readonly accesos: readonly Acceso[] = [
    { id: 'ciudades', titulo: 'Gestionar Ciudades', bajada: 'Mapa y sedes', icono: 'sede', marca: 'ciudad', tono: 'azul' },
    { id: 'plataformas', titulo: 'Gestionar Plataformas', bajada: 'Sistemas base', icono: 'ajustes', marca: 'plataforma', tono: 'indigo' },
    { id: 'terminales', titulo: 'Gestionar terminales', bajada: 'Sistema base', icono: 'monitor', marca: 'terminal', tono: 'carmin' },
    { id: 'permisos', titulo: 'Control de Permisos', bajada: 'Roles', icono: 'permisos', marca: 'roles', tono: 'tinta' },
    { id: 'notificaciones', titulo: 'Gestionar notificaciones', bajada: 'Avisos y retrasos', icono: 'avisos', marca: 'avisos', tono: 'naranja' },
  ];

  private readonly numero = new Intl.NumberFormat('es-AR');

  protected formatear(valor: number): string {
    return this.numero.format(valor);
  }
}
