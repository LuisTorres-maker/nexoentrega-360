#!/usr/bin/env bash
# Ensayo de clon limpio (RNF04): clona, instala, levanta y comprueba /ready y un login.
# Mide por separado la DESCARGA INICIAL (paquetes e imagenes) y el ARRANQUE.
#   bash scripts/clon-limpio.sh [URL_DEL_REPOSITORIO] [RAMA]
# Requisitos: git, node, npm, docker (motor encendido), curl.
set -euo pipefail

URL="${1:-https://github.com/LuisTorres-maker/nexoentrega-360.git}"
RAMA="${2:-main}"
CLAVE="${DEMO_PASSWORD:-Demo-Nexo-2030}"
DESTINO="$(mktemp -d)/nexoentrega-360"
ahora() { date +%s; }
fmt() { printf '%dm%02ds' $(($1 / 60)) $(($1 % 60)); }

echo "== Clon limpio en $DESTINO (rama $RAMA)"
T0=$(ahora)
git clone --depth 1 --branch "$RAMA" "$URL" "$DESTINO"
cd "$DESTINO"
SHA="$(git rev-parse HEAD)"
T1=$(ahora)

echo "== Descarga inicial: dependencias (npm ci) e imagenes base"
npm ci
docker pull postgres:16.4 >/dev/null
docker pull node:24.15.0-alpine >/dev/null
docker pull nginx:1.27.2-alpine >/dev/null
T2=$(ahora)

echo "== Arranque: construccion de imagenes, migraciones, seed y comprobaciones"
docker compose up -d --build --wait db api web
for i in $(seq 1 60); do
  if curl -fsS http://localhost:3000/ready >/dev/null 2>&1; then break; fi
  sleep 2
done
READY="$(curl -fsS http://localhost:3000/ready)"
LOGIN="$(curl -fsS -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"org-a-coordinador@example.test\",\"password\":\"$CLAVE\"}")"
T3=$(ahora)

echo
echo "== RESULTADO (copie esto en evidence/tests/clon-limpio.md)"
echo "Fecha UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "SHA: $SHA"
echo "Equipo: $(uname -srm)"
echo "ready: $READY"
echo "login (esperado 200): $LOGIN"
echo "Clonado: $(fmt $((T1 - T0)))"
echo "Descarga inicial (paquetes e imagenes): $(fmt $((T2 - T1)))"
echo "Arranque (sin la descarga inicial): $(fmt $((T3 - T2)))"
echo "Total sin la descarga inicial: $(fmt $(( (T1 - T0) + (T3 - T2) )))  (RNF04: <= 15m00s)"
echo "Para apagar: (cd $DESTINO && docker compose down -v)"
