FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# --- Build stage ---
FROM base AS build
WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# Copy all workspace packages needed for the build
COPY apps/api ./apps/api
COPY packages ./packages

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the api (turbo handles workspace dependency builds)
RUN pnpm turbo run build --filter=api

# --- Production stage ---
FROM base AS production
WORKDIR /app

# Copy root workspace files for pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# Copy db package (migrations + drizzle config) for the start-time migrate step
COPY --from=build /app/packages/db ./packages/db

# Copy api package.json so pnpm can resolve native deps for the runtime
COPY apps/api/package.json ./apps/api/package.json

# Install:
#   - @repo/db with dev deps so drizzle-kit is available for the migrate step
#   - api in prod-only mode for the runtime
RUN pnpm install --frozen-lockfile --filter=@repo/db \
 && pnpm install --frozen-lockfile --filter=api --prod

# Copy bundled API + entrypoint. Use .cjs so Node treats the bundle as
# CommonJS (esbuild's default), even though api/package.json declares
# "type": "module" for the dev/source side.
COPY --from=build /app/apps/api/dist/index.cjs ./apps/api/index.cjs
COPY apps/api/start.sh ./apps/api/start.sh
RUN chmod +x ./apps/api/start.sh

WORKDIR /app/apps/api

ENV NODE_ENV=production
# Run on 3001 (the Railway services also set PORT=3001 so the edge proxy
# routes here). index.ts honors $PORT, defaulting to 3001.
ENV PORT=3001
EXPOSE 3001

CMD ["./start.sh"]
