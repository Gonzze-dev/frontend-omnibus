import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Only the public screens are rendered to HTML at build time, so crawlers,
 * link previews and checkers like WAVE get their content without running JS.
 * Everything else depends on the session and stays a client-side SPA.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'register', renderMode: RenderMode.Prerender },
  { path: 'forgot-password', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
