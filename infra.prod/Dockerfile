# Build context: repo root (docker build -f infra.prod/Dockerfile .)
# On Railway: RAILWAY_DOCKERFILE_PATH=infra.prod/Dockerfile
#
# Runtime environment variables:
#   BACKEND_UPSTREAM   Base URL of the omnibus backend, without trailing slash (e.g. http://omnibus-backend.railway.internal:4989)
#   REALTIME_UPSTREAM  Base URL of the RealTime microservice, without /realtime (e.g. http://realtime.railway.internal:4988)
#   PORT               listening port (injected by Railway)

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
COPY --from=build /app/dist/ya-llego/browser /usr/share/nginx/html

ENV PORT=80 \
    BACKEND_UPSTREAM=http://localhost:4989 \
    REALTIME_UPSTREAM=http://localhost:4988

EXPOSE 80
