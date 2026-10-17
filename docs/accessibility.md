# Accessibility

Target: WCAG 2.2 level AA.

## Automated checks

- `npm run lint`: angular-eslint template rules (`templateAccessibility`). Every
  `eslint-disable-next-line` in a template has a comment explaining the keyboard
  alternative (backdrop clicks close with Escape or the close button, combobox
  options are driven with the arrow keys through `aria-activedescendant`).
- `npm test`: `src/app/a11y.spec.ts` runs axe-core over the login, register and
  cities screens and checks focus handling, the skip link and the toast announcer.
  Color contrast is not checked there (jsdom has no layout); the tokens in
  `src/styles.scss` were measured by hand.

axe only detects part of the problems. The manual pass below is still required.

## Conventions

- Each screen renders one `<main>` with an `h1`. On every route change `App` moves
  focus to that `h1` (`shared/a11y.ts`), unless a modal is open.
- "Saltar al contenido" is the first focusable element of every screen.
- Forms: `<label for>`, `aria-invalid` + `aria-describedby` pointing to the error,
  and `focusFirstInvalid()` after a submit with errors.
- Messages that appear by themselves (toasts, delay, lost connection) are announced
  with the CDK `LiveAnnouncer`. Do not rely on a `role="status"` element that is
  inserted already filled: screen readers do not read it reliably.
- Modals: native `<dialog>` with `showModal()`; the camera modals use `cdkTrapFocus`
  and close with Escape. Focus returns to the button that opened them.
- Lists with columns are ARIA tables (`role="table"`, `row`, `columnheader`, `cell`).
  A row that opens on click has a real edit button whose `::after` covers the row
  (`.table__open`); never put `role="button"` on a row that contains other buttons.
- Text colors must reach 4.5:1 (3:1 for icons and focus rings). Placeholders use
  `--ab-placeholder`, never a translucent color.
- Interactive targets are at least 24×24 px.

## Manual test

1. Keyboard only, on every flow (login, register, track a trip, profile, each
   dashboard CRUD, send a notice): Tab, Shift+Tab, Enter, Space, Escape, arrows.
   Focus must always be visible and never get lost behind a modal.
2. Screen reader: NVDA + Firefox or Chrome on Windows; VoiceOver + Safari on iOS
   for the passenger flow. Check that route changes, form errors, toasts, the bus
   delay and the lost connection notice are read.
3. Zoom at 200% and a 320px wide viewport: no horizontal scroll (reflow).
4. `prefers-reduced-motion: reduce` turns off the animations.
