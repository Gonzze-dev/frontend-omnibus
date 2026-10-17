import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { TitleStrategy, provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { BrandTitleStrategy } from './shared/title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Crossfade between screens; the first load comes in without a transition.
    provideRouter(routes, withViewTransitions({ skipInitialTransition: true })),
    // "<page> · Ya llegó" titles and a canonical link per route (SEO).
    { provide: TitleStrategy, useClass: BrandTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Prerendered screens reuse the server DOM instead of drawing it again
    // (no flash, the entry animations keep running); clicks made before the
    // app boots are replayed.
    provideClientHydration(withEventReplay()),
  ]
};
