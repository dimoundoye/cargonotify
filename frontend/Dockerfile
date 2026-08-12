# ─────────────────────────────────────────
# Stage 1 : Build React/Vite
# ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# L'API est proxifiée par Nginx en production (pas besoin de l'URL externe)
ENV VITE_API_URL=/api

RUN npm run build

# ─────────────────────────────────────────
# Stage 2 : Serveur Nginx Production
# ─────────────────────────────────────────
FROM nginx:alpine AS production

# Copier la config Nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier le build Vite
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
