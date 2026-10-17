import { Injector, afterNextRender } from '@angular/core';

/** Main landmark of the current screen (each page renders its own). */
function mainElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main, [role="main"]');
}

/** Focuses an element that is not focusable by itself (heading, landmark). */
function focusStatic(el: HTMLElement): void {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: false });
}

/**
 * Moves focus to the start of the current screen: its h1 if it has one,
 * otherwise the main landmark. Used by the skip link and after a route
 * change, so that keyboard and screen reader users land on the new content
 * (WCAG 2.4.1 and 2.4.3).
 */
export function focusMainContent(preferHeading = true): void {
  const main = mainElement();
  if (!main) return;
  const heading = preferHeading ? main.querySelector<HTMLElement>('h1') : null;
  focusStatic(heading ?? main);
}

/** True while a modal dialog is open: it owns focus and must keep it. */
export function modalOpen(): boolean {
  return !!document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
}

/**
 * After a form is submitted with errors, focuses its first invalid field
 * so the user lands on the problem and hears its message (WCAG 3.3.1).
 * It waits a render so the fields already have aria-invalid set.
 */
export function focusFirstInvalid(injector: Injector): void {
  afterNextRender(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), {
    injector,
  });
}
