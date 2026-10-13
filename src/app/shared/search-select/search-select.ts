import { Component, ElementRef, computed, effect, forwardRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SearchOption {
  value: string;
  label: string;
  /** Secondary text shown to the right of the option (e.g. a code). */
  detail?: string;
  disabled?: boolean;
}

/** Lowercases and strips accents, so searching "cordoba" finds "Córdoba". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Select with match-based search. It is used like any other form
 * control (formControlName): typing filters the options and
 * choosing one stores its value.
 */
@Component({
  selector: 'app-search-select',
  templateUrl: './search-select.html',
  styleUrl: './search-select.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelect), multi: true },
  ],
  host: {
    '(focusout)': 'onLeave($event)',
    '(window:resize)': 'position()',
  },
})
export class SearchSelect implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly list = viewChild<ElementRef<HTMLUListElement>>('list');

  readonly options = input.required<SearchOption[]>();
  readonly placeholder = input('Buscar...');
  readonly inputId = input<string>();
  readonly invalid = input(false);

  protected readonly value = signal('');
  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly disabled = signal(false);

  protected readonly listId = `search-select-${Math.random().toString(36).slice(2, 9)}`;

  private readonly selected = computed(() =>
    this.options().find((o) => o.value === this.value()),
  );

  protected readonly filtered = computed(() => {
    const query = normalize(this.text().trim());
    // With the chosen option in view all of them are shown, not just that one
    if (!query || this.text() === this.selected()?.label) return this.options();
    return this.options().filter(
      (o) => normalize(o.label).includes(query) || normalize(o.detail ?? '').includes(query),
    );
  });

  constructor() {
    // The options can arrive after the value (they are requested from the backend):
    // when they arrive the chosen option's label is shown.
    effect(() => {
      const label = this.selected()?.label ?? '';
      if (!untracked(this.open)) this.text.set(label);
    });

    // The list opens as a popover: it stays in the top layer, above the
    // <dialog> that contains it, without being clipped by its overflow.
    effect((onCleanup) => {
      const list = this.list()?.nativeElement;
      if (!list) return;
      list.showPopover();
      this.position();

      // If the popup (or the page) is scrolled the list follows the input
      const onScroll = () => this.position();
      document.addEventListener('scroll', onScroll, true);
      onCleanup(() => document.removeEventListener('scroll', onScroll, true));
    });

    // Filtering changes the list height: recompute whether it fits below
    effect(() => {
      this.filtered();
      untracked(() => queueMicrotask(() => this.position()));
    });
  }

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
    this.text.set(this.options().find((o) => o.value === value)?.label ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected openList(): void {
    if (this.disabled()) return;
    this.open.set(true);
    this.active.set(Math.max(0, this.filtered().findIndex((o) => o.value === this.value())));
  }

  protected type(text: string): void {
    this.text.set(text);
    this.open.set(true);
    this.active.set(this.filtered().findIndex((o) => !o.disabled));
  }

  protected choose(option: SearchOption): void {
    if (option.disabled) return;
    this.value.set(option.value);
    this.text.set(option.label);
    this.open.set(false);
    this.onChange(option.value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.filtered();

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) return this.openList();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        let i = this.active();
        // Skips disabled options
        for (let n = 0; n < options.length; n++) {
          i = (i + step + options.length) % options.length;
          if (!options[i].disabled) break;
        }
        this.active.set(i);
        this.scrollTo(i);
        break;
      }
      case 'Enter':
        if (this.open()) {
          event.preventDefault();
          const option = options[this.active()];
          if (option) this.choose(option);
        }
        break;
      case 'Escape':
        if (this.open()) {
          // Escape closes the list and not the <dialog> that contains it
          event.preventDefault();
          event.stopPropagation();
          this.close();
        }
        break;
    }
  }

  /** When focus leaves the component it closes and shows the chosen option again. */
  protected onLeave(event: FocusEvent): void {
    if (this.host.nativeElement.contains(event.relatedTarget as Node | null)) return;
    this.close();
    this.onTouched();
  }

  private close(): void {
    this.open.set(false);
    this.text.set(this.selected()?.label ?? '');
  }

  /** Places the list below the input, or above if there is no room below. */
  protected position(): void {
    const list = this.list()?.nativeElement;
    if (!list) return;

    const rect = this.field().nativeElement.getBoundingClientRect();
    const height = list.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    const upwards = below < height + 8 && rect.top > below;

    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;
    list.style.top = `${upwards ? rect.top - height - 4 : rect.bottom + 4}px`;
  }

  private scrollTo(index: number): void {
    this.list()?.nativeElement.children[index]?.scrollIntoView({ block: 'nearest' });
  }
}
