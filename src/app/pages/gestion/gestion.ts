import { Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, ResolveFn, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Topbar } from '../../shared/topbar/topbar';
import { buscarSeccion } from './gestiones';

/**
 * Menu de opciones de una card del dashboard. Las cinco gestiones
 * comparten esta pantalla: lo unico que cambia es la seccion del
 * catalogo que le toca segun la ruta.
 */
@Component({
  selector: 'app-gestion',
  imports: [Topbar, RouterLink, NgTemplateOutlet],
  templateUrl: './gestion.html',
  styleUrl: './gestion.scss',
})
export class Gestion {
  private readonly ruta = inject(ActivatedRoute);

  /** Se lee del parametro para que el link entre secciones funcione. */
  private readonly parametros = toSignal(this.ruta.paramMap, {
    initialValue: this.ruta.snapshot.paramMap,
  });

  protected readonly seccion = computed(() => buscarSeccion(this.parametros().get('seccion')));

  private readonly numero = new Intl.NumberFormat('es-AR');

  protected formatear(valor: number): string {
    return this.numero.format(valor);
  }
}

/** Titulo de la pestaña: el de la seccion, o el generico si no existe. */
export const tituloGestion: ResolveFn<string> = (ruta) =>
  buscarSeccion(ruta.paramMap.get('seccion'))?.titulo ?? 'Dashboard';
