import { Component, ElementRef, computed, effect, forwardRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface OpcionBuscador {
  valor: string;
  etiqueta: string;
  deshabilitada?: boolean;
}

/** Pasa a minusculas y saca los acentos, para buscar "cordoba" y encontrar "Córdoba". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Select con busqueda por coincidencia. Se usa como un control de
 * formulario mas (formControlName): escribir filtra las opciones y
 * al elegir una se guarda su valor.
 */
@Component({
  selector: 'app-select-buscador',
  templateUrl: './select-buscador.html',
  styleUrl: './select-buscador.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectBuscador), multi: true },
  ],
  host: {
    '(focusout)': 'alSalir($event)',
    '(window:resize)': 'posicionar()',
  },
})
export class SelectBuscador implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');
  private readonly lista = viewChild<ElementRef<HTMLUListElement>>('lista');

  readonly opciones = input.required<OpcionBuscador[]>();
  readonly placeholder = input('Buscar...');
  readonly inputId = input<string>();
  readonly invalido = input(false);

  protected readonly valor = signal('');
  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  protected readonly activa = signal(0);
  protected readonly deshabilitado = signal(false);

  protected readonly listaId = `select-buscador-${Math.random().toString(36).slice(2, 9)}`;

  private readonly seleccionada = computed(() =>
    this.opciones().find((o) => o.valor === this.valor()),
  );

  protected readonly filtradas = computed(() => {
    const busqueda = normalizar(this.texto().trim());
    // Con la opcion elegida a la vista se muestran todas, no solo esa
    if (!busqueda || this.texto() === this.seleccionada()?.etiqueta) return this.opciones();
    return this.opciones().filter((o) => normalizar(o.etiqueta).includes(busqueda));
  });

  constructor() {
    // Las opciones pueden llegar despues que el valor (se piden al backend):
    // cuando llegan se muestra la etiqueta de la opcion elegida.
    effect(() => {
      const etiqueta = this.seleccionada()?.etiqueta ?? '';
      if (!untracked(this.abierto)) this.texto.set(etiqueta);
    });

    // La lista se abre como popover: queda en la top layer, por encima del
    // <dialog> que la contiene, sin que su overflow la recorte.
    effect((onCleanup) => {
      const lista = this.lista()?.nativeElement;
      if (!lista) return;
      lista.showPopover();
      this.posicionar();

      // Si se scrollea el popup (o la pagina) la lista acompana al input
      const alScrollear = () => this.posicionar();
      document.addEventListener('scroll', alScrollear, true);
      onCleanup(() => document.removeEventListener('scroll', alScrollear, true));
    });

    // Al filtrar cambia el alto de la lista: se recalcula si entra abajo
    effect(() => {
      this.filtradas();
      untracked(() => queueMicrotask(() => this.posicionar()));
    });
  }

  private onChange: (valor: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(valor: string | null): void {
    this.valor.set(valor ?? '');
    this.texto.set(this.opciones().find((o) => o.valor === valor)?.etiqueta ?? '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  protected abrir(): void {
    if (this.deshabilitado()) return;
    this.abierto.set(true);
    this.activa.set(Math.max(0, this.filtradas().findIndex((o) => o.valor === this.valor())));
  }

  protected escribir(texto: string): void {
    this.texto.set(texto);
    this.abierto.set(true);
    this.activa.set(this.filtradas().findIndex((o) => !o.deshabilitada));
  }

  protected elegir(opcion: OpcionBuscador): void {
    if (opcion.deshabilitada) return;
    this.valor.set(opcion.valor);
    this.texto.set(opcion.etiqueta);
    this.abierto.set(false);
    this.onChange(opcion.valor);
  }

  protected teclear(event: KeyboardEvent): void {
    const opciones = this.filtradas();

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.abierto()) return this.abrir();
        const paso = event.key === 'ArrowDown' ? 1 : -1;
        let i = this.activa();
        // Saltea las opciones deshabilitadas
        for (let n = 0; n < opciones.length; n++) {
          i = (i + paso + opciones.length) % opciones.length;
          if (!opciones[i].deshabilitada) break;
        }
        this.activa.set(i);
        this.desplazarA(i);
        break;
      }
      case 'Enter':
        if (this.abierto()) {
          event.preventDefault();
          const opcion = opciones[this.activa()];
          if (opcion) this.elegir(opcion);
        }
        break;
      case 'Escape':
        if (this.abierto()) {
          // Que el Escape cierre la lista y no el <dialog> que la contiene
          event.preventDefault();
          event.stopPropagation();
          this.cerrar();
        }
        break;
    }
  }

  /** Cuando el foco sale del componente se cierra y vuelve a mostrar lo elegido. */
  protected alSalir(event: FocusEvent): void {
    if (this.host.nativeElement.contains(event.relatedTarget as Node | null)) return;
    this.cerrar();
    this.onTouched();
  }

  private cerrar(): void {
    this.abierto.set(false);
    this.texto.set(this.seleccionada()?.etiqueta ?? '');
  }

  /** Ubica la lista debajo del input, o arriba si abajo no hay lugar. */
  protected posicionar(): void {
    const lista = this.lista()?.nativeElement;
    if (!lista) return;

    const rect = this.campo().nativeElement.getBoundingClientRect();
    const alto = lista.offsetHeight;
    const abajo = window.innerHeight - rect.bottom;
    const haciaArriba = abajo < alto + 8 && rect.top > abajo;

    lista.style.left = `${rect.left}px`;
    lista.style.width = `${rect.width}px`;
    lista.style.top = `${haciaArriba ? rect.top - alto - 4 : rect.bottom + 4}px`;
  }

  private desplazarA(indice: number): void {
    this.lista()?.nativeElement.children[indice]?.scrollIntoView({ block: 'nearest' });
  }
}
