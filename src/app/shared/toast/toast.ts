import { Component, input, output, OnInit, OnDestroy } from '@angular/core';

/**
 * Floating success notification ("Changes saved successfully" pattern from the
 * Figma). It is purely visual: it persists nothing, it only confirms to the user
 * that an action went well and closes by itself.
 */
@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class Toast implements OnInit, OnDestroy {
  readonly message = input.required<string>();
  readonly durationMs = input(2600);
  readonly closed = output<void>();

  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.timer = setTimeout(() => this.closed.emit(), this.durationMs());
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
