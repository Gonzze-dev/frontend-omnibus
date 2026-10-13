import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';

const FORMATO = new Intl.NumberFormat('es-AR');
const DURACION_MS = 900;

/**
 * Escribe un numero en el elemento contando desde el valor anterior
 * (o desde 0 la primera vez) hasta el nuevo. Mientras no hay dato
 * muestra una raya, igual que el formateo que reemplaza.
 *
 *   <span [abContador]="total()"></span>
 */
@Directive({ selector: '[abContador]' })
export class Contador {
  readonly abContador = input.required<number | null>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private actual = 0;
  private frame = 0;

  constructor() {
    effect(() => this.animar(this.abContador()));
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  private animar(destino: number | null): void {
    cancelAnimationFrame(this.frame);

    if (destino === null) {
      this.actual = 0;
      this.el.textContent = '—';
      return;
    }

    const desde = this.actual;
    const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sinMovimiento || desde === destino) {
      this.pintar(destino);
      return;
    }

    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min((ahora - inicio) / DURACION_MS, 1);
      const suave = 1 - Math.pow(1 - t, 3); // ease-out cubico
      this.pintar(Math.round(desde + (destino - desde) * suave));
      if (t < 1) this.frame = requestAnimationFrame(paso);
    };
    this.frame = requestAnimationFrame(paso);
  }

  private pintar(valor: number): void {
    this.actual = valor;
    this.el.textContent = FORMATO.format(valor);
  }
}
