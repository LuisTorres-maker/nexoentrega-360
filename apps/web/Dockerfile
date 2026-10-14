# Interfaz web de NexoEntrega 360. Contexto de construccion: la raiz del repositorio.
FROM node:24.15.0-alpine AS construir
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --include-workspace-root
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM nginx:1.27.2-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=construir /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
