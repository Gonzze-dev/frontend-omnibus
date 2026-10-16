# Build context: repo root (docker build -f infra.prod/Dockerfile .)
# On Railway: RAILWAY_DOCKERFILE_PATH=infra.prod/Dockerfile
#
# Runtime environment variables:
#   BACKEND_UPSTREAM   Base URL of the omnibus backend, without trailing slash (e.g. http://omnibus-backend.railway.internal:4989)
#   REALTIME_UPSTREAM  Base URL of the RealTime microservice, without /realtime (e.g. http://realtime.railway.internal:4988)
#   REALTIME_API_KEY   API key of the RealTime hub (its ApiKey); written to env.js on startup
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
COPY --chmod=755 infra.prod/40-env-js.sh /docker-entrypoint.d/40-env-js.sh
# The script may have CRLF endings if the context comes from a Windows checkout.
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-env-js.sh

# NGINX_ENTRYPOINT_LOCAL_RESOLVERS makes the image export NGINX_LOCAL_RESOLVERS
# (the container's DNS servers) for the template's resolver directive.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    PORT=80 \
    BACKEND_UPSTREAM=http://localhost:4989 \
    REALTIME_UPSTREAM=http://localhost:4988 \
    REALTIME_API_KEY=

EXPOSE 80
