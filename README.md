# Pingdo

A minimal, no-auth todo app for measuring end-to-end latency of the same
API + Postgres stack deployed across platforms and regions.

- `apps/api` — Hono + Drizzle todo API (Node 22, bundled with esbuild, Dockerfile for any container host)
- `apps/web` — static Vite page: todo UI + a benchmark table comparing endpoints
- `packages/db` — Drizzle schema + migrations (`todos` table)
- `packages/dto` — shared response types

## API

All routes live under `/api/v1`:

| Method | Path          | Notes                                   |
| ------ | ------------- | --------------------------------------- |
| GET    | `/health`     | Healthcheck + platform/region           |
| GET    | `/ping`       | No DB — network + app baseline          |
| GET    | `/ping/db`    | One `SELECT 1` — adds app↔DB round trip |
| GET    | `/todos`      | Latest 50 todos                         |
| GET    | `/todos/:id`  |                                         |
| POST   | `/todos`      | `{ "title": string }`                   |
| PATCH  | `/todos/:id`  | `{ "title"?: string, "completed"?: bool }` |
| DELETE | `/todos/:id`  |                                         |

Every response carries:

- `Server-Timing: db;dur=…, app;dur=…` — time spent in Postgres and in the handler overall
- `X-Pingdo-Platform` / `X-Pingdo-Region` — where it was served from. Auto-detected on
  Railway, Fly, Render, Vercel, Cloud Run and AWS; override with `PLATFORM` / `REGION` env vars.

So for any request: **client RTT − app ≈ network**, and **app − db ≈ framework overhead**.

## Local development

```sh
pnpm install
docker compose up -d                      # Postgres on :5432
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
pnpm --filter @repo/db db:migrate
pnpm dev                                  # api on :3001, web on :3000
```

## Deploying

**API** — `apps/api/Dockerfile` (build context = repo root) runs migrations on start and
listens on `$PORT` (default 3001). Only `DATABASE_URL` is required. Put the API in the
same region as its database unless you're deliberately measuring cross-region DB latency.

- Railway: `railway.json` + `.github/workflows/railway-api-deploy.yaml` (push to `development` / `main`)
- Fly / Render / Cloud Run / any container host: point it at `apps/api/Dockerfile`

**Web** — `pnpm --filter web build` → static `apps/web/dist` (Cloudflare Pages, etc.).
Set default endpoints at build time with `VITE_ENDPOINTS=label=https://…,label2=https://…`;
more can be added in the page (kept in localStorage).

## Reading the numbers

- Each endpoint gets one discarded warm-up request (DNS, TLS, CORS preflight, cold start),
  so the table reflects warm, kept-alive connections.
- Run the page from different places (laptop, phone on cellular, a VPS) — the client's
  location matters as much as the server's.
- `write` = POST + DELETE, so it's two round trips summed.
