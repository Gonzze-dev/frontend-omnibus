# Flujo end-to-end: notificaciones con API Key

Este documento describe los pasos que ocurren entre la cámara/dispositivo edge, el backend (Go), el microservicio realtime (SignalR) y el frontend (Angular), para las notificaciones protegidas por API Key.

Hay dos API keys distintas, cada una protege un tramo diferente de la cadena:

| Key | Variable de entorno | Default (si no está en `.env`) | Protege |
|---|---|---|---|
| Cámara → Backend | `CAMERA_NOTIFICATION_API_KEY` | `DEFAULT_API_KEY` | Endpoints públicos `/notify_passengers` y `/notify_camera_error` |
| Backend/Frontend → Realtime | `REALTIME_API_KEY` | `agag2J26sgJ2SAV6ATAJ6aG26sg26JG` | Conexión SignalR al hub `/realtime` |

Definidas en [internal/config/config.go](../../../../backend/omnibus-backend/internal/config/config.go) (backend) y en `RealTime/appsettings.json` (`ApiKey`) del microservicio realtime.

## 1. Cámara → Backend (`X-API-Key`)

1. La cámara/dispositivo detecta la llegada de un colectivo a una plataforma o un error, y hace `POST /notify_passengers` o `POST /notify_camera_error`.
2. Envía el header `X-API-Key: <CAMERA_NOTIFICATION_API_KEY>`.
3. El middleware `middleware.CameraAPIKey` ([internal/middleware/apikey.go](../../../../backend/omnibus-backend/internal/middleware/apikey.go)) compara ese header contra `cfg.CameraNotificationAPIKey`. Si no coincide, corta la request con 401 antes de llegar al handler.
4. Si es válida, el request llega a `NotificationService` ([internal/service/notification.go](../../../../backend/omnibus-backend/internal/service/notification.go)):
   - Resuelve la plataforma por `code`/`code_camera` y su terminal asociado.
   - Construye el mensaje (`BUS_ARRIVAL` o `CAMERA`) y lo persiste en la tabla `notifications`.
   - Si es `BUS_ARRIVAL`, además marca como notificados los `awaited_trip` de esa combinación patente+terminal y dispara mails de "tu bus ha llegado" a quienes lo estaban esperando.

## 2. Backend → Microservicio Realtime (SignalR, `apiKey` en query string)

1. El backend mantiene un cliente SignalR (`realtime.NewClient`, [pkg/realtime/client.go](../../../../backend/omnibus-backend/pkg/realtime/client.go)) que agrega `?apiKey=<REALTIME_API_KEY>` a la URL del hub al conectarse.
2. Tras persistir la notificación, el backend invoca un método remoto del hub según el tipo de evento:
   - `SendToFrontend` — llegada de colectivo (grupo `frontend/{patente}:{terminal}`).
   - `SendToFrontendGlobal` — notificación global de super admin.
   - `NotifyDelayBus` — demora cargada por un admin.
   - `NotifyAdminFromCamera` — error de cámara, va al grupo de admins de esa terminal.
   - `DeleteNotification` — borrado manual de una notificación.
3. En `RealtimeHub.OnConnectedAsync` ([realtime/RealTime/Hubs/RealtimeHub.cs](../../../../realtime/RealTime/Hubs/RealtimeHub.cs)), el hub lee el query param `apiKey` y lo compara contra `ApiKey` de `appsettings.json`. Si no coincide, aborta la conexión — aplica tanto a la conexión del backend como a la del frontend.
4. Si la key es válida, el hub reenvía el payload (`ReceiveNotification`) a todos los clientes conectados al grupo (`Clients.Group(groupName).SendAsync(...)`).

## 3. Frontend → Microservicio Realtime (misma API key, conexión propia)

1. El frontend abre su propia conexión SignalR desde `RealtimeService.conectar()` ([src/app/services/realtime.service.ts](../../src/app/services/realtime.service.ts)), agregando `?apiKey=<realtimeApiKey>` a la URL del hub (`APP_CONFIG.realtimeUrl`, definido en [src/app/config.ts](../../src/app/config.ts)).
2. Al conectar, el frontend hace `JoinFrontend(groupKey)` para unirse al grupo de su viaje/terminal. El hub, al unir al cliente, le reenvía las notificaciones guardadas en Postgres que aún no vencieron (así si el colectivo llegó antes de abrir la app, el aviso igual aparece).
3. Cuando el backend invoca `SendToFrontend` / `NotifyDelayBus` / etc., el hub emite `receiveNotification` a ese grupo, y `RealtimeService.recibir()` actualiza los signals `llegada` o `demora` según `msg.type` (`BUS_ARRIVAL` / `BUS_DELAY`), que la UI consume reactivamente.
4. Si la conexión se cae y SignalR reconecta automáticamente, el frontend vuelve a hacer `JoinFrontend` para el grupo activo (SignalR no conserva membership de grupos entre reconexiones).

## Resumen visual

```
[Cámara/Edge] --X-API-Key--> [Backend Go] --apiKey (query)--> [Hub SignalR] <--apiKey (query)-- [Frontend Angular]
                                  |                                  |
                            guarda en Postgres              reenvía a grupo (receiveNotification)
                            (tabla notifications)
```

## Notas

- Si `CAMERA_NOTIFICATION_API_KEY` o `REALTIME_API_KEY` no están seteadas en el `.env` del backend, se usan los defaults hardcodeados en `config.go`. **Esto es solo apto para desarrollo**: en producción hay que setear ambas variables con valores propios y mantener sincronizado `REALTIME_API_KEY` (backend) con `ApiKey` (`appsettings.json` del realtime) y con `realtimeApiKey` (`config.ts` del frontend), ya que las tres deben coincidir para que la conexión al hub sea aceptada.
- El grupo `frontend/{patente}:{terminal}` es el mismo que usa el backend al invocar `SendToFrontend`; si no coincide exactamente (normalización de patente, uuid de terminal), el frontend no recibe el evento aunque la conexión esté autenticada.
