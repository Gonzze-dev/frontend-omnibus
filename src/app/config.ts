/**
 * App configuration.
 * In development `/api` is redirected to the backend (localhost:4989) and `/realtime`
 * to the SignalR hub (localhost:4988) through proxy.conf.json, so the refresh token's
 * HttpOnly cookie stays on the same origin as the frontend.
 */

/**
 * Runtime values from env.js (written by the nginx container on startup in production).
 * globalThis instead of window: this module also loads when prerendering, where there is no window.
 */
const env = (globalThis as { __env?: { realtimeApiKey?: string } }).__env ?? {};

export const APP_CONFIG = {
  /**
   * Public address of the site, for canonical links. Prerendering runs at build
   * time with no real host; also referenced by public/robots.txt,
   * public/sitemap.xml and the og:image in index.html.
   */
  siteUrl: 'https://frontend-omnibus-production.up.railway.app',
  apiUrl: '/api',
  /** Bus arrival notice; outside /api because the camera uses it too. */
  notifyPassengersUrl: '/notify_passengers',
  realtimeUrl: '/realtime',
  /** The hub rejects connections without `?apiKey=` (RealTime ApiKey); REALTIME_API_KEY in production. */
  realtimeApiKey: env.realtimeApiKey ?? '',
};
