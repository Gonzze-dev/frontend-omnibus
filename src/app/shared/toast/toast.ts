import { Component, input, output, OnInit, OnDestroy } from '@angular/core';

/**
 * Notificacion flotante de exito (patron "Cambios guardados con exito" del
 * Figma). Es puramente visual: no persiste nada, solo confirma al usuario
 * que una accion salio bien y se cierra sola.
 */
@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class Toast implements OnInit, OnDestroy {
  readonly mensaje = input.required<string>();
  readonly duracionMs = input(2600);
  readonly cerrado = output<void>();

  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.timer = setTimeout(() => this.cerrado.emit(), this.duracionMs());
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
