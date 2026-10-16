/**
 * App configuration.
 * In development `/api` is redirected to the backend (localhost:4989) and `/realtime`
 * to the SignalR hub (localhost:4988) through proxy.conf.json, so the refresh token's
 * HttpOnly cookie stays on the same origin as the frontend.
 */

/** Runtime values from env.js (written by the nginx container on startup in production). */
const env = (window as unknown as { __env?: { realtimeApiKey?: string } }).__env ?? {};

export const APP_CONFIG = {
  apiUrl: '/api',
  /** Bus arrival notice; outside /api because the camera uses it too. */
  notifyPassengersUrl: '/notify_passengers',
  realtimeUrl: '/realtime',
  /** The hub rejects connections without `?apiKey=` (RealTime ApiKey); REALTIME_API_KEY in production. */
  realtimeApiKey: env.realtimeApiKey ?? '',
};
