#!/bin/sh

# ============================================================
# Entrypoint script: Gera config.js e configura nginx
# a partir de variáveis de ambiente do Docker Compose.
#
# A variável API_URL (ex: http://backend:3000) é definida no
# compose.yml. Este script extrai o host:porta e configura
# o proxy reverso do nginx para encaminhar /api/ ao backend.
#
# O config.js é gerado vazio (API_URL = '') porque o nginx
# faz o proxy — o browser usa paths relativos (/api/...).
# ============================================================

# Extract host:port from API_URL (e.g. http://backend:3000 -> backend:3000)
export API_UPSTREAM=$(echo "$API_URL" | sed 's|^https\?://||')

# Generate nginx config from template (only substitute API_UPSTREAM)
envsubst '${API_UPSTREAM}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Generate config.js for the frontend
# API_URL is empty because nginx proxies /api/ to the backend
cat > /usr/share/nginx/html/config.js << 'EOF'
// config.js — Gerado automaticamente pelo entrypoint do container.
// O endereço do backend NÃO está hardcoded no código JS.
// O nginx do container faz proxy reverso de /api/ para o backend,
// então o JS usa paths relativos (API_URL vazio).
window.API_URL = '';
EOF

echo "[entrypoint] API_URL=$API_URL"
echo "[entrypoint] API_UPSTREAM=$API_UPSTREAM"
echo "[entrypoint] config.js e nginx.conf gerados com sucesso!"

# Start nginx in foreground
nginx -g 'daemon off;'
