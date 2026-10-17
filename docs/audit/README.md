# Accessibility, SEO and performance audit

Audit of the deployed frontend (`https://frontend-omnibus-production.up.railway.app`),
October 2026. Target: WCAG 2.2 level AA. Conventions and the manual checklist live in
[../accessibility.md](../accessibility.md).

## Tools

| Tool | What it checks | How it was run |
|---|---|---|
| Lighthouse 12.6 | Performance, accessibility, best practices, SEO | Mobile (Moto G Power, slow 4G, simulated) and desktop presets. Private screens with a logged-in session (storage kept between runs). |
| axe-core 4.10 | WCAG 2.0/2.1/2.2 A and AA + best practices | On the rendered DOM of every screen, including the create/edit dialogs and their error state. |
| WAVE (WebAIM) | Structure, contrast, ARIA | By hand on the public screens. |
| Keyboard script (Puppeteer) | Tab order, visible focus, skip link, dialogs | Every main screen, logged in. |

The private screens were audited read-only: forms were opened and submitted empty
(client-side validation, nothing is sent) and edit dialogs were closed with Escape.

## Results

### Public screens (prerendered)

| Screen | Mobile perf. | Desktop perf. | Accessibility | Best practices | SEO |
|---|---|---|---|---|---|
| `/login` | 95 | 100 | 100 | 100 | 100 |
| `/register` | 98 | 100 | 100 | 100 | 100 |
| `/forgot-password` | 98 | 100 | 100 | 100 | 100 |

Mobile: FCP 1.7 s, LCP 2.1 s, TBT 0 ms, CLS ≤ 0.005. Before this work the same screens
scored 76–88 in mobile performance and 82 in SEO, and the server sent an empty
`<app-root>` (WAVE reported "no heading structure" and "no page regions").

`/login` scores lower than the other two because Lighthouse always loads it as a first
visit, so it always plays the 1.2 s brand splash (Speed Index). A returning visitor gets
the static screen.

### Private screens (logged in)

| Screen | Mobile perf. | Desktop perf. | Accessibility | Best practices | SEO |
|---|---|---|---|---|---|
| `/dashboard` | 100 | 100 | 100 | 100 | 66 |
| `/dashboard/terminals` | 100 | 100 | 100 | 100 | 66 |
| `/dashboard/notifications/send` | 100 | 100 | 100 | 100 | 66 |
| `/home` | 100 | 100 | 100 | 96 | 66 |
| `/profile` | 100 | 100 | 100 | 100 | 66 |
| `/notifications` | 100 | 100 | 100 | 100 | 66 |

- SEO 66 is intended: these screens are sent with `X-Robots-Tag: noindex`
  (`is-crawlable` fails on purpose).
- Performance is measured with the app already in cache (same session), so it shows
  in-app navigation, not a cold load.
- Best practices 96 on `/home`: `GET /api/buses/awaited` answers 404 when the user is
  not waiting for any trip. The frontend handles it; the browser logs it as a
  network error.

axe: 0 violations on the 10 private screens and the 5 dialogs, after the fixes below.

## Findings and fixes

| Finding | WCAG | Fix |
|---|---|---|
| `aria-describedby` pointed to error messages that only exist when there is an error | 1.3.1 | Bound only while the error is shown (32 fields). |
| Skip link target `#contenido` did not exist | 2.4.1 | `id="contenido" tabindex="-1"` on every `<main>`. |
| Row buttons in Terminals and Platforms: `aria-label` did not contain the visible text | 2.5.3 | Visually hidden verb + visible text instead of `aria-label`. |
| Tab out of an open combobox (home terminal, search-select, permissions) lost focus to `<body>`: Chrome makes the scrollable listbox a Tab stop and it is removed when the list closes | 2.4.3 | `tabindex="-1"` on the listbox; options are still reached with the arrows through `aria-activedescendant`. |

## Checks that came out fine

- Keyboard: every screen can be used with Tab/Enter/Escape; login works with the
  keyboard only; "Saltar al contenido" is the first Tab stop and moves focus to `<main>`;
  after each navigation focus goes to the new screen's `h1`.
- Visible focus on every control. Table rows draw the ring on the whole row
  (`.table__row--selectable:has(.table__open:focus-visible)`).
- Dialogs (native `<dialog>`): focus starts inside, the page behind is inert, an empty
  submit marks the fields with `aria-invalid` and focuses the first one, Escape closes
  and returns focus to the button that opened it.
- Contrast measured by hand where axe cannot (gradient buttons): white on
  `#002C98`–`#1A43BF` is 8.1:1 to 11.6:1; error text `#BA1A1A` is 6.5:1 on white.

## Not covered by automated tools

A screen reader pass (NVDA + Chrome) is still needed: login → home → search a trip,
and one dashboard CRUD. Check that the page title and `h1` are read on each
navigation, that form errors are read, and that toasts are announced.

## Files

- `reports/public_<screen>_<mobile|desktop>.html` and
  `reports/private_<screen>_<mobile|desktop>.html`: Lighthouse reports (open in a browser).
  The private reports were taken before the last two fixes (the Terminals one still
  shows `label-content-name-mismatch`).
- `login-splash-filmstrip.png`: the login splash at 0, 300, 600, 900 and 1300 ms.
