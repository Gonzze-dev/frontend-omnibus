import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';

const FORMAT = new Intl.NumberFormat('es-AR');
const DURATION_MS = 900;

/**
 * Writes a number into the element counting from the previous value
 * (or from 0 the first time) up to the new one. While there is no data
 * it shows a dash, just like the formatting it replaces.
 *
 *   <span [abCounter]="total()"></span>
 */
@Directive({ selector: '[abCounter]' })
export class Counter {
  readonly abCounter = input.required<number | null>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private current = 0;
  private frame = 0;

  constructor() {
    effect(() => this.animate(this.abCounter()));
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  private animate(target: number | null): void {
    cancelAnimationFrame(this.frame);

    if (target === null) {
      this.current = 0;
      this.el.textContent = '—';
      return;
    }

    const from = this.current;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || from === target) {
      this.paint(target);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      this.paint(Math.round(from + (target - from) * eased));
      if (t < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private paint(value: number): void {
    this.current = value;
    this.el.textContent = FORMAT.format(value);
  }
}
