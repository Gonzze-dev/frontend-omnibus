import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Fundido entre pantallas; la primera carga entra sin transicion.
    provideRouter(routes, withViewTransitions({ skipInitialTransition: true })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ]
};
