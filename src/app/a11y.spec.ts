import { CUSTOM_ELEMENTS_SCHEMA, Component, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { of } from 'rxjs';
import axe from 'axe-core';
import { App } from './app';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Cities } from './pages/cities/cities';
import { Topbar } from './shared/topbar/topbar';
import { Toast } from './shared/toast/toast';
import { CityService } from './services/city.service';
import { City } from './models/city.model';

/**
 * Automated accessibility checks (axe-core) over the rendered DOM.
 * axe only finds part of the problems: keyboard and screen reader
 * testing by hand is still needed (see docs/accessibility.md).
 */
async function expectNoAxeViolations(el: HTMLElement): Promise<void> {
  const { violations } = await axe.run(el, {
    // jsdom does not compute layout or colors: contrast is checked by hand
    rules: { 'color-contrast': { enabled: false } },
  });
  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
  );
  expect(summary).toEqual([]);
}

async function render<T>(component: Type<T>): Promise<ComponentFixture<T>> {
  const fixture = TestBed.createComponent(component);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  return fixture;
}

describe('Accessibility', () => {
  afterEach(() => document.body.replaceChildren());

  describe('auth screens', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    });

    it('login has no axe violations', async () => {
      const fixture = await render(Login);
      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('login with errors moves focus to the first invalid field', async () => {
      const fixture = await render(Login);
      const el: HTMLElement = fixture.nativeElement;

      el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();

      const email = el.querySelector<HTMLInputElement>('#email')!;
      expect(email.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(email);
      await expectNoAxeViolations(el);
    });

    it('register has no axe violations', async () => {
      const fixture = await render(Register);
      await expectNoAxeViolations(fixture.nativeElement);
    });
  });

  describe('cities list', () => {
    const cities: City[] = [
      { postal_code: '2820', name: 'Gualeguaychú' },
      { postal_code: '3100', name: 'Paraná' },
    ];

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          {
            provide: CityService,
            useValue: {
              list: () =>
                of({ cities, page: 1, next: null, prev: null, elements: 2, total_elements: 2 }),
            },
          },
        ],
      });
      // The top bar needs the realtime connection: it is left out of this test
      TestBed.overrideComponent(Cities, {
        remove: { imports: [Topbar] },
        add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      });
    });

    it('has no axe violations (no interactive control nested in another)', async () => {
      const fixture = await render(Cities);
      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('exposes the list as a table with column headers', async () => {
      const fixture = await render(Cities);
      const table: HTMLElement = fixture.nativeElement.querySelector('[role="table"]');

      expect(table.getAttribute('aria-label')).toBe('Ciudades');
      expect(table.querySelectorAll('[role="columnheader"]').length).toBe(3);
      expect(table.querySelectorAll('.table__row--selectable[role="row"]').length).toBe(2);
    });

    it('edits and deletes each city with real, separate buttons', async () => {
      const fixture = await render(Cities);
      const row: HTMLElement = fixture.nativeElement.querySelector('.table__row--selectable');

      expect(row.hasAttribute('tabindex')).toBe(false);
      const buttons = [...row.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
      expect(buttons).toEqual([
        'Editar ciudad Gualeguaychú, código postal 2820',
        'Eliminar ciudad Gualeguaychú',
      ]);
    });
  });

  describe('toast', () => {
    @Component({ imports: [Toast], template: `<app-toast message="Cambios guardados" />` })
    class Host {}

    it('announces its message through the live announcer', async () => {
      const announce = vi.fn().mockResolvedValue(undefined);
      TestBed.configureTestingModule({ providers: [{ provide: LiveAnnouncer, useValue: { announce } }] });

      await render(Host);
      expect(announce).toHaveBeenCalledWith('Cambios guardados', 'polite');
    });
  });

  describe('app shell', () => {
    it('the skip link is the first focusable element and moves focus to the content', async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const fixture = await render(App);
      const el: HTMLElement = fixture.nativeElement;

      // Stands in for a routed screen
      const main = document.createElement('div');
      main.setAttribute('role', 'main');
      el.appendChild(main);

      const skip = el.querySelector<HTMLAnchorElement>('a')!;
      expect(skip.textContent?.trim()).toBe('Saltar al contenido');
      skip.click();
      expect(document.activeElement).toBe(main);
    });
  });
});
