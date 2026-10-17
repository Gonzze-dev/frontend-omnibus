import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_CONFIG } from '../config';
import { BrandTitleStrategy } from './title-strategy';

@Component({ template: '' })
class Blank {}

describe('BrandTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: Blank, title: 'Iniciar sesión' },
          { path: 'untitled', component: Blank },
        ]),
        { provide: TitleStrategy, useClass: BrandTitleStrategy },
      ],
    });
  });

  afterEach(() => document.head.querySelector('link[rel="canonical"]')?.remove());

  it('appends the brand to the route title', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');
    expect(document.title).toBe('Iniciar sesión · Ya llegó');
  });

  it('uses the brand alone when the route has no title', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/untitled');
    expect(document.title).toBe('Ya llegó');
  });

  it('points the canonical link to the path without query string', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login?returnUrl=%2Fhome');
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(link?.href).toBe(`${APP_CONFIG.siteUrl}/login`);
  });
});
