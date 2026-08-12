# ─────────────────────────────────────────
# Stage 1 : Installation des dépendances
# ─────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Dépendances système pour @whiskeysockets/baileys
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

COPY package*.json ./
RUN npm ci --omit=dev

# ─────────────────────────────────────────
# Stage 2 : Image de production
# ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Dépendances runtime légères
RUN apk add --no-cache \
    wget \
    dumb-init

# Copier les dépendances compilées
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source
COPY src ./src
COPY package.json ./

# Créer le dossier pour les sessions WhatsApp
RUN mkdir -p /app/whatsapp_sessions

# Utilisateur non-root pour la sécurité
RUN chown -R node:node /app
USER node

EXPOSE 5000

# dumb-init gère les signaux UNIX proprement (SIGTERM, etc.)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
