import { Component, inject, input, output, OnInit, OnDestroy } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Floating success notification ("Changes saved successfully" pattern from the
 * Figma). It is purely visual: it persists nothing, it only confirms to the user
 * that an action went well and closes by itself.
 *
 * A live region that is inserted already filled is not read reliably, so the
 * message is announced through the CDK LiveAnnouncer, whose region already
 * exists in the page (WCAG 4.1.3).
 */
@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class Toast implements OnInit, OnDestroy {
  private readonly announcer = inject(LiveAnnouncer);

  readonly message = input.required<string>();
  readonly durationMs = input(2600);
  readonly closed = output<void>();

  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.announcer.announce(this.message(), 'polite');
    this.timer = setTimeout(() => this.closed.emit(), this.durationMs());
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
