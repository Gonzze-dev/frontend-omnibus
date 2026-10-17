import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
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
  ]
};
