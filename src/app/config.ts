/**
 * Configuracion de la app.
 * En desarrollo `/api` se redirige al backend (localhost:4989) mediante
 * proxy.conf.json, asi la cookie HttpOnly del refresh token queda en el
 * mismo origen que el frontend.
 */
export const APP_CONFIG = {
  apiUrl: '/api',
};
