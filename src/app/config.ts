/**
 * App configuration.
 * In development `/api` is redirected to the backend (localhost:4989) and `/realtime`
 * to the SignalR hub (localhost:4988) through proxy.conf.json, so the refresh token's
 * HttpOnly cookie stays on the same origin as the frontend.
 */
export const APP_CONFIG = {
  apiUrl: '/api',
  /** Bus arrival notice; outside /api because the camera uses it too. */
  notifyPassengersUrl: '/notify_passengers',
  realtimeUrl: '/realtime',
  /** The hub rejects connections without `?apiKey=` (RealTime/appsettings.json: ApiKey). */
  realtimeApiKey: 'agag2J26sgJ2SAV6ATAJ6aG26sg26JG',
};
