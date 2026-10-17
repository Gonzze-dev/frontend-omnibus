import { Component, Injector, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { focusMainContent, modalOpen } from './shared/a11y';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly injector = inject(Injector);

  constructor() {
    // In a SPA screen readers are not told that the page changed: on every
    // route change focus goes to the new screen's h1. The first load is left
    // alone, and so are navigations that only change the query or open a popup.
    let previousPath: string | null = null;
    inject(Router)
      .events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        const changed = previousPath !== null && path !== previousPath;
        previousPath = path;
        if (!changed) return;

        afterNextRender(() => modalOpen() || focusMainContent(), { injector: this.injector });
      });
  }

  protected skipToContent(event: Event): void {
    event.preventDefault();
    focusMainContent(false);
  }
}
