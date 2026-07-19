# Ingest-Service (Faktensondierung → Draft → Promote nach vergleich).
# WICHTIG: Build-Kontext ist das REPO-ROOT (Monorepo), nicht apps/ingest.
# In Coolify entsprechend "Dockerfile Location = apps/ingest/Dockerfile"
# und "Base Directory = /" setzen.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mwp/ingest build

# Bewusst kein Prune: das Runtime-Image trägt den vollständigen Workspace
# (verlässlicher erster Deploy; Optimierung später).
FROM node:22-slim AS runtime
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PORT=3002
WORKDIR /app/apps/ingest
EXPOSE 3002
CMD ["node", "dist/index.js"]
