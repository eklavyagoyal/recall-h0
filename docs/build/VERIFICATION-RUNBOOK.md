# Verification Runbook

Run these commands from the repository root to reproduce a working local app from a clean checkout.

## 1. Toolchain

```bash
node -v
corepack enable
pnpm -v
pnpm install
```

Expected: Node 24+ and pnpm 10+. This environment currently runs on Node 26, which satisfies the repo engine.

## 2. Environment

```bash
cp -n .env.example .env
cat .env | grep -E 'DEPLOY_TARGET|DATABASE_URL|EMBED_DIM|DEMO_TLC'
```

Expected local values:

```text
DEPLOY_TARGET=local
DATABASE_URL=postgres://recall:recall@localhost:5433/recall
EMBED_DIM=384
DEMO_TLC=PRD-OUTBREAK-0001
```

## 3. Database

```bash
pnpm db:up
docker compose ps
pnpm db:migrate
pnpm db:seed
```

Expected: `recall-postgres` is healthy, migrations are idempotent, and seed volume is about
80k lots, 250k lot links, 250k shipments, 1,400 stores, and 2,000 incidents.

## 4. Hero Query

```bash
pnpm bench
```

Expected: `PRD-OUTBREAK-0001` returns about 81 lots, 80 edges, and 1,400 stores with warm p50
well under the generous 5s test ceiling.

## 5. DB-Free Green Gate

```bash
pnpm verify
```

Expected: typecheck, lint, and the default DB-free vitest suite exit 0 without local Postgres
running. `pnpm test` excludes `*.integration.test.ts`; the integration suite is gated separately
for a seeded database.

Equivalent expanded commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all commands exit 0. The default DB-free suite covers deterministic embeddings, SQL
guards, pool config, API error shapes, health/ready degraded behavior, page boot fallback,
serialization retry/backoff, embedding degraded mode, admission control, metrics, observability,
and SLA anchoring.

## 6. Production Build

```bash
pnpm build
```

Expected: the Next.js production build exits 0.

## 7. Seeded Integration

These commands require a seeded local database and are intentionally outside the DB-free gate:

```bash
pnpm test:integration
pnpm bench
```

Expected: `PRD-OUTBREAK-0001` returns about 81 lots, 80 edges, and 1,400 stores with warm p50
well under the generous 5s test ceiling.

## 8. App

```bash
pnpm exec next dev --turbopack --port 3002
```

Manual checklist:

- Load the console and confirm the first paint is populated for `PRD-OUTBREAK-0001`.
- Re-run the trace and confirm latency is a live millisecond number.
- Confirm the graph ignites, the map shows store pins, and the incident rail has score badges.
- Open Query Inspector and confirm the plan contains Recursive, HNSW, GiST, and Index Scan proof.
- Click a map pin or graph node and confirm Lineage Drawer opens with shipment rows.
- Trace a random nonexistent TLC and confirm the clean state renders without an error.
- Export FDA record and confirm JSON/CSV downloads are created from live rows.

## 9. Optional Smoke

```bash
pnpm test:smoke
```

Expected: one Chromium smoke test passes. The config uses system Chrome on macOS and port 3002
by default; set `BASE_URL=http://localhost:<port>` to target an already-running server.
