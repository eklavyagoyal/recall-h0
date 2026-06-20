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

Expected: `PRD-OUTBREAK-0001` returns about 83 lots, 82 edges, and 1,400 stores with warm p50
well under the generous 5s test ceiling.

## 5. Green Gate

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all commands exit 0. `pnpm test` includes adversarial cycle, clean lot, latency,
embedding determinism, SQL guard, parser, and API contract tests.

## 6. App

```bash
pnpm dev
```

If port 3000 is occupied, use:

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

## 7. Optional Smoke

```bash
pnpm test:smoke
```

Expected: one Chromium smoke test passes. The config uses system Chrome on macOS and port 3002
by default; set `BASE_URL=http://localhost:<port>` to target an already-running server.
