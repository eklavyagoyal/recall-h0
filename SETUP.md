# Recall — Local Setup

Full contract: `docs/build/CONVENTIONS.md`. Product spec: `docs/deep-dives/01-recall.md`.

## Prerequisites

- Node.js 24 LTS (`node -v` prints `v24.x`; current newer Node versions must satisfy `>=24`).
- pnpm via Corepack or a local install.
- Docker Desktop or Docker Engine with Compose v2.

## First Run

```bash
cp .env.example .env.local
pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

Local Postgres maps host port `5433` to container port `5432` because this
workstation already has another service bound to host `5432`.

## Verify The Local DB Extensions

```bash
docker exec recall-postgres psql -U recall -d recall \
  -c "SELECT extname FROM pg_extension WHERE extname IN ('postgis','vector') ORDER BY extname;"
```

Expected rows: `postgis`, `vector`.

## Green Gate

```bash
pnpm typecheck && pnpm lint && pnpm test
```

## Reset The Local Database

```bash
pnpm db:down
docker compose down -v
pnpm db:up
```

## Aurora Swap

Phases 09-10 are gated on AWS credentials. When they land, set `DEPLOY_TARGET=aurora`
and the `AURORA_*` / `AWS_*` variables documented in `.env.example` and
`docs/build/SETUP-AWS-V0.md`.
