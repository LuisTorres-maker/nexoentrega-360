# API de NexoEntrega 360. Contexto de construccion: la raiz del repositorio.
#   docker compose up -d --build --wait db api
FROM node:24.15.0-alpine
WORKDIR /app

# Dependencias (versiones exactas del package-lock.json)
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --include-workspace-root

# Codigo y datos de arranque
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY migrations migrations
COPY seeds seeds
COPY scripts scripts
COPY contracts contracts
COPY tests/fixtures tests/fixtures
COPY evidence/ai-real evidence/ai-real
RUN npm run build -w apps/api

ENV NODE_ENV=production
EXPOSE 3000
# Migraciones y seed son idempotentes: se aplican en cada arranque, luego se levanta la API.
CMD ["sh", "-c", "node scripts/migrate.mjs && node scripts/seed.mjs && node apps/api/dist/server.js"]
