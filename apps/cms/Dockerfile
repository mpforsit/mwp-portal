# Payload v3 (Next.js). Build-Kontext = REPO-ROOT (Monorepo).
# Payloads Next-Build initialisiert Payload (generate:types/importmap)
# und braucht dafür DATABASE_URL + PAYLOAD_SECRET bereits zur BUILD-Zeit.
# In Coolify diese beiden Variablen als "Build Variable" markieren.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG DATABASE_URL
ARG PAYLOAD_SECRET
ENV DATABASE_URL=$DATABASE_URL
ENV PAYLOAD_SECRET=$PAYLOAD_SECRET
RUN pnpm --filter @mwp/cms build

FROM node:22-slim AS runtime
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app/apps/cms
EXPOSE 3000
CMD ["pnpm", "start"]
