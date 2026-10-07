/**
 * Configuracion de la app.
 * En desarrollo `/api` se redirige al backend (localhost:4989) y `/realtime`
 * al hub de SignalR (localhost:4988) mediante proxy.conf.json, asi la cookie
 * HttpOnly del refresh token queda en el mismo origen que el frontend.
 */
export const APP_CONFIG = {
  apiUrl: '/api',
  /** Aviso de llegada de colectivo; fuera de /api porque tambien lo usa la camara. */
  notifyPassengersUrl: '/notify_passengers',
  realtimeUrl: '/realtime',
  /** El hub rechaza conexiones sin `?apiKey=` (RealTime/appsettings.json: ApiKey). */
  realtimeApiKey: 'agag2J26sgJ2SAV6ATAJ6aG26sg26JG',
};
