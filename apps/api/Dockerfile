# Fastify-API (Vergleichs-Engine, Praxisfinder, Newsletter, /go).
# WICHTIG: Build-Kontext ist das REPO-ROOT (Monorepo), nicht apps/api.
# In Coolify entsprechend "Dockerfile Location = apps/api/Dockerfile"
# und "Base Directory = /" setzen.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mwp/api build

# Bewusst kein Prune (pnpm deploy): das Runtime-Image trägt den
# vollständigen Workspace inkl. packages/db + tsx. Dadurch laufen die
# DB-Migrationen (pnpm --filter @mwp/db migrate) im selben Container —
# ein größeres Image, aber ein verlässlicher erster Deploy. Optimierung
# (mehrstufig/pruned) ist ein späterer Schritt.
FROM node:22-slim AS runtime
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
