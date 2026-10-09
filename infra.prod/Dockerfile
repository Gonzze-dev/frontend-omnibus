# Build context: raíz del repo (docker build -f infra.prod/Dockerfile .)
# En Railway: RAILWAY_DOCKERFILE_PATH=infra.prod/Dockerfile
#
# Variables de entorno en runtime:
#   BACKEND_UPSTREAM   URL base del backend omnibus, sin barra final (ej: http://omnibus-backend.railway.internal:4989)
#   REALTIME_UPSTREAM  URL base del microservicio RealTime, sin /realtime (ej: http://realtime.railway.internal:4988)
#   PORT               puerto de escucha (Railway lo inyecta)

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
RUN npx ng build --configuration production

FROM nginx:1.29-alpine
COPY infra.prod/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/alerta-bus/browser /usr/share/nginx/html

ENV PORT=80 \
    BACKEND_UPSTREAM=http://localhost:4989 \
    REALTIME_UPSTREAM=http://localhost:4988

EXPOSE 80
