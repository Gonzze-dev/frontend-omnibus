# End-to-end flow: notifications with API Key

This document describes the steps that take place between the camera/edge device, the backend (Go), the realtime microservice (SignalR) and the frontend (Angular), for the notifications protected by an API Key.

There are two different API keys; each one protects a different leg of the chain:

| Key | Environment variable | Default (if not in `.env`) | Protects |
|---|---|---|---|
| Camera → Backend | `CAMERA_NOTIFICATION_API_KEY` | `DEFAULT_API_KEY` | Public endpoints `/notify_passengers` and `/notify_camera_error` |
| Backend/Frontend → Realtime | `REALTIME_API_KEY` | `agag2J26sgJ2SAV6ATAJ6aG26sg26JG` | SignalR connection to the `/realtime` hub |

Defined in [internal/config/config.go](../../../../backend/omnibus-backend/internal/config/config.go) (backend) and in `RealTime/appsettings.json` (`ApiKey`) of the realtime microservice.

## 1. Camera → Backend (`X-API-Key`)

1. The camera/device detects a bus arriving at a platform, or an error, and sends `POST /notify_passengers` or `POST /notify_camera_error`.
2. It sends the header `X-API-Key: <CAMERA_NOTIFICATION_API_KEY>`.
3. The `middleware.CameraAPIKey` middleware ([internal/middleware/apikey.go](../../../../backend/omnibus-backend/internal/middleware/apikey.go)) compares that header against `cfg.CameraNotificationAPIKey`. If it does not match, it cuts the request with a 401 before it reaches the handler.
4. If it is valid, the request reaches `NotificationService` ([internal/service/notification.go](../../../../backend/omnibus-backend/internal/service/notification.go)):
   - It resolves the platform by `code`/`code_camera` and its associated terminal.
   - It builds the message (`BUS_ARRIVAL` or `CAMERA`) and persists it in the `notifications` table.
   - If it is `BUS_ARRIVAL`, it also marks the `awaited_trip` rows of that plate+terminal combination as notified and sends "your bus has arrived" emails to the people who were waiting for it.

## 2. Backend → Realtime microservice (SignalR, `apiKey` in the query string)

1. The backend keeps a SignalR client (`realtime.NewClient`, [pkg/realtime/client.go](../../../../backend/omnibus-backend/pkg/realtime/client.go)) that appends `?apiKey=<REALTIME_API_KEY>` to the hub URL when connecting.
2. After persisting the notification, the backend invokes a remote hub method according to the event type:
   - `SendToFrontend` — bus arrival (group `frontend/{plate}:{terminal}`).
   - `SendToFrontendGlobal` — super admin global notification.
   - `NotifyDelayBus` — delay entered by an admin.
   - `NotifyAdminFromCamera` — camera error, goes to the admins group of that terminal.
   - `DeleteNotification` — manual deletion of a notification.
3. In `RealtimeHub.OnConnectedAsync` ([realtime/RealTime/Hubs/RealtimeHub.cs](../../../../realtime/RealTime/Hubs/RealtimeHub.cs)), the hub reads the `apiKey` query param and compares it against `ApiKey` in `appsettings.json`. If it does not match, it aborts the connection — this applies both to the backend connection and to the frontend one.
4. If the key is valid, the hub forwards the payload (`ReceiveNotification`) to every client connected to the group (`Clients.Group(groupName).SendAsync(...)`).

## 3. Frontend → Realtime microservice (same API key, its own connection)

1. The frontend opens its own SignalR connection from `RealtimeService.connect()` ([src/app/services/realtime.service.ts](../../src/app/services/realtime.service.ts)), appending `?apiKey=<realtimeApiKey>` to the hub URL (`APP_CONFIG.realtimeUrl`, defined in [src/app/config.ts](../../src/app/config.ts)).
2. When connecting, the frontend calls `JoinFrontend(groupKey)` to join the group of its trip/terminal. When adding the client, the hub resends the notifications stored in Postgres that have not expired yet (so if the bus arrived before the app was opened, the notice still shows up).
3. When the backend invokes `SendToFrontend` / `NotifyDelayBus` / etc., the hub emits `receiveNotification` to that group, and `RealtimeService.receive()` updates the `arrival` or `delay` signals according to `msg.type` (`BUS_ARRIVAL` / `BUS_DELAY`), which the UI consumes reactively.
4. If the connection drops and SignalR reconnects automatically, the frontend calls `JoinFrontend` again for the active group (SignalR does not keep group membership between reconnections).

## Visual summary

```
[Camera/Edge] --X-API-Key--> [Go Backend] --apiKey (query)--> [SignalR Hub] <--apiKey (query)-- [Angular Frontend]
                                  |                                  |
                          stores in Postgres                forwards to group (receiveNotification)
                         (notifications table)
```

## Notes

- If `CAMERA_NOTIFICATION_API_KEY` or `REALTIME_API_KEY` are not set in the backend `.env`, the defaults hardcoded in `config.go` are used. **This is only suitable for development**: in production both variables must be set with your own values, and `REALTIME_API_KEY` (backend) must be kept in sync with `ApiKey` (realtime `appsettings.json`) and with `realtimeApiKey` (frontend `config.ts`), since all three must match for the hub connection to be accepted.
- The `frontend/{plate}:{terminal}` group is the same one the backend uses when invoking `SendToFrontend`; if it does not match exactly (plate normalization, terminal uuid), the frontend does not receive the event even though the connection is authenticated.
