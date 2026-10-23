# API Sanjeevani (NestJS). Image Linux : déployable sur un VPS (Dokploy, Docker Compose), contrairement au backend .NET Framework.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npx nest build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
# L'utilisateur « node » (non root) existe déjà dans l'image officielle.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
# Migrations SQL idempotentes appliquées au démarrage (IAM, audit).
COPY --chown=node:node tools/apply-sql.mjs ./tools/apply-sql.mjs
COPY --chown=node:node migration/schema/iam.pg.sql ./migration/schema/iam.pg.sql
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/Health || exit 1
CMD ["sh", "-c", "node tools/apply-sql.mjs migration/schema/iam.pg.sql && node dist/main.js"]
