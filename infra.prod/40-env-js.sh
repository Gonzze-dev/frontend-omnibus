#!/bin/sh
# Runs from /docker-entrypoint.d before nginx starts: writes env.js with the
# runtime configuration the Angular app reads (window.__env).
set -eu

cat > /usr/share/nginx/html/env.js <<EOF
window.__env = {
  realtimeApiKey: '${REALTIME_API_KEY:-}',
};
EOF
