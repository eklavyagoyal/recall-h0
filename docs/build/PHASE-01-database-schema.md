# Phase 01 — Database Schema & Migrations

**Outcome:** A forward-only migration runner (`scripts/migrate.ts`) and three SQL migrations (`0001_extensions.sql`, `0002_schema.sql`, `0003_indexes.sql`) that, on `pnpm db:migrate`, create all **9 canonical tables** (with their FKs + CHECK constraints) and all **canonical relational/GiST indexes** in the local Docker Postgres — with `incidents.embedding` typed as `vector(EMBED_DIM)` (EMBED_DIM injected from config), the **HNSW index deferred to Phase 02** (built after seeding for speed), applied migrations recorded in a `schema_migrations` table, and re-running the command a no-op.

**Depends on / Unblocks:** Depends on [`PHASE-00-foundation.md`](./PHASE-00-foundation.md) (Next.js app at root, `lib/config.ts` exporting `EMBED_DIM`/`DEPLOY_TARGET`, `pg` + `tsx` installed, `db:up`/`db:migrate` scripts wired, Docker Postgres with PostGIS + pgvector). **Unblocks** [`PHASE-02-seed-data.md`](./PHASE-02-seed-data.md) (needs the tables to load into and owns the deferred HNSW build) and transitively [`PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) (needs the schema + indexes the hero query relies on).

**Effort:** ~0.5 day (≈3–4 hours). The SQL is dictated verbatim by the Data Model; the only real engineering is the idempotent, EMBED_DIM-injecting runner.

---

## 1. Objectives

1. Write `scripts/migrate.ts` — a tiny, dependency-light, **forward-only** migration runner that:
   - reads `db/migrations/*.sql` in lexical (numeric-prefix) order;
   - tracks which files have been applied in a `schema_migrations` table (so re-runs are idempotent);
   - **injects `EMBED_DIM`** (from `lib/config.ts`) into the `vector(N)` column at apply time by replacing a `__EMBED_DIM__` placeholder token;
   - runs each migration **inside a transaction** (DDL in Postgres is transactional), records it, and stops cleanly on the first error;
   - branches its connection on `DEPLOY_TARGET` (local `DATABASE_URL` vs. Aurora) but otherwise behaves identically.
2. Write **`0001_extensions.sql`** — enable `vector` + `postgis` idempotently (belt-and-suspenders with `docker/init.sql`).
3. Write **`0002_schema.sql`** — the **FULL DDL for all 9 tables** with FKs + CHECKs **verbatim** from the deep-dive Data Model, with `incidents.embedding vector(__EMBED_DIM__)`.
4. Write **`0003_indexes.sql`** — all canonical **relational + GiST** indexes (forward/backward `lot_links`, `shipments`, `store_inventory`, `stores.geom` GiST). **Defer the HNSW index** on `incidents.embedding` to Phase 02 (created *after* embeddings are seeded), with a commented, copy-paste-ready statement documenting the exact parameters (`vector_cosine_ops`, `m=16`, `ef_construction=64`).
5. End **GREEN**: `pnpm db:migrate` applies cleanly to the local DB, `psql \d` shows all tables + indexes, an empty trace executes with no rows and no error, and a second `pnpm db:migrate` is a no-op.

> **Why is the HNSW index deferred and not in `0003`?** Building HNSW on an **empty** table is fast but useless — you would then have to drop and rebuild it after seeding, or live with an index that never indexed real vectors. Building it **once, after** ~2,000 real embeddings exist (Phase 02) is both faster overall and produces a correctly populated index. See [§6](#6-common-pitfalls--fixes) and [`PHASE-02-seed-data.md`](./PHASE-02-seed-data.md), which **owns** running the deferred HNSW `CREATE INDEX`. `0003` ships the statement as a documented, idempotent comment so there is zero guesswork about its exact shape.

---

## 2. Prerequisites (checklist)

- [ ] Phase 00 complete: Next.js 15 app at repo root, `pnpm install` succeeds, `pnpm typecheck` / `pnpm lint` / `pnpm test` are GREEN on the scaffold.
- [ ] `lib/config.ts` exists and exports at minimum `EMBED_DIM: number`, `EMBED_PROVIDER`, `DEPLOY_TARGET`, `AWS_REGION`, `DEMO_TLC` (per [CONVENTIONS §5](./CONVENTIONS.md#5-canonical-directory-tree)). For local, `EMBED_DIM === 384`.
- [ ] `pg` and `tsx` are installed (`pnpm add pg @types/pg && pnpm add -D tsx` if Phase 00 didn't).
- [ ] `package.json` has `"db:migrate": "tsx scripts/migrate.ts"` and `"db:up": "docker compose up -d"` (per [CONVENTIONS §8](./CONVENTIONS.md#8-packagejson-scripts)).
- [ ] Local Docker Postgres is **running and healthy**: `pnpm db:up` then `docker compose ps` shows the container `healthy`. The image is `FROM postgis/postgis:16-3.4` with `postgresql-16-pgvector` installed, and `docker/init.sql` runs the two `CREATE EXTENSION` statements (per [CONVENTIONS §3](./CONVENTIONS.md#3-pinned-tech-stack)).
- [ ] `.env` (or `.env.local`) has `DEPLOY_TARGET=local`, `DATABASE_URL=postgres://recall:recall@localhost:5432/recall`, `EMBED_DIM=384` (per [CONVENTIONS §6](./CONVENTIONS.md#6-environment-variables)).
- [ ] `psql` available locally for verification (or use `docker compose exec db psql`). Optional but recommended.

> If `pnpm db:up` was never run, `pnpm db:migrate` will fail with `ECONNREFUSED 127.0.0.1:5432`. Bring the DB up first.

---

## 3. Step-by-step

### 3.0 Confirm config exposes `EMBED_DIM`

The runner reads `EMBED_DIM` from config so the schema's `vector(N)` dimension is set in **exactly one place** ([CONVENTIONS §3](./CONVENTIONS.md#3-pinned-tech-stack)). Verify `lib/config.ts` looks like this (it should already exist from Phase 00 — if not, add the `EMBED_DIM` export):

```ts
// lib/config.ts  (excerpt — created in Phase 00; confirm EMBED_DIM is present)
export const DEPLOY_TARGET = (process.env.DEPLOY_TARGET ?? "local") as "local" | "aurora";
export const EMBED_PROVIDER = (process.env.EMBED_PROVIDER ?? "local") as "local" | "bedrock";

/**
 * The ONE place the embedding dimension is defined.
 * Local (@xenova/transformers all-MiniLM-L6-v2) = 384.
 * Bedrock Titan Text Embeddings v2 = verify against AWS docs and set EMBED_DIM to match.
 * incidents.embedding is vector(EMBED_DIM); migrate.ts injects this into 0002_schema.sql.
 */
export const EMBED_DIM = Number(process.env.EMBED_DIM ?? 384);

export const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
export const DEMO_TLC = process.env.DEMO_TLC ?? "PRD-OUTBREAK-0001";
```

> `EMBED_DIM` must be a **positive integer** ≤ 16000 (pgvector's `vector` type limit). The runner guards this.

---

### 3.1 Write `db/migrations/0001_extensions.sql`

Enable both extensions idempotently. This duplicates `docker/init.sql` on purpose: when we later migrate the **Aurora** cluster (Phase 09), `init.sql` does **not** run there, so the extensions must be created by a migration too. `IF NOT EXISTS` makes it harmless to run twice.

```sql
-- db/migrations/0001_extensions.sql
-- Enable the two extensions the hero query depends on.
-- Idempotent: safe to re-run, and safe even though docker/init.sql also runs these locally.
-- On Aurora (Phase 09) init.sql does NOT run, so this migration is the source of truth there.

CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector: vector(EMBED_DIM) + HNSW
CREATE EXTENSION IF NOT EXISTS postgis;   -- PostGIS: geography(Point,4326) + GiST
```

> **Aurora note (forward reference):** on Aurora PostgreSQL, `CREATE EXTENSION vector`/`postgis` requires the extensions to be allow-listed (`rds.allowed_extensions`) and the connecting role to have permission. Phase 09 handles the cluster parameter group; this file does not change.

---

### 3.2 Write `db/migrations/0002_schema.sql`

The **full DDL for all 9 tables**, columns/constraints **verbatim** from [`../deep-dives/01-recall.md` §5.1](../deep-dives/01-recall.md#51-full-ddl-aurora-postgresql) and [CONVENTIONS §9](./CONVENTIONS.md#9-database-objects--indexes). Note the single substitution token **`__EMBED_DIM__`** on `incidents.embedding` — the runner replaces it with the integer from `EMBED_DIM` before executing. Every `CREATE TABLE` uses `IF NOT EXISTS` so a partial prior run never blocks a re-apply.

```sql
-- db/migrations/0002_schema.sql
-- The 9-table FK-constrained supply DAG. FKs + CHECKs are ENFORCED on purpose:
-- DAG integrity enforced by the engine is the property DSQL cannot provide and the
-- reason the trace is trustworthy (see ../deep-dives/01-recall.md §2.2).
--
-- NOTE: incidents.embedding uses the token __EMBED_DIM__ which scripts/migrate.ts
-- replaces with EMBED_DIM (from lib/config.ts) at apply time. Do NOT hardcode a number here.

-- ── 1. suppliers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text NOT NULL,
  region       text NOT NULL,
  geom         geography(Point, 4326)                        -- PostGIS: supplier location
);

-- ── 2. facilities ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facilities (
  facility_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text NOT NULL,
  type         text NOT NULL CHECK (type IN ('farm','processor','distributor','warehouse')),
  supplier_id  bigint NOT NULL REFERENCES suppliers(supplier_id)
);

-- ── 3. lots ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lots (
  lot_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tlc          text UNIQUE NOT NULL,                          -- Traceability Lot Code (FSMA-204)
  product_name text NOT NULL,
  lot_type     text NOT NULL CHECK (lot_type IN ('ingredient','intermediate','finished')),
  produced_at  timestamptz NOT NULL,
  facility_id  bigint NOT NULL REFERENCES facilities(facility_id)
);

-- ── 4. lot_links  (THE DAG EDGE TABLE) ───────────────────────────────────────
-- child lot derived from parent lot (a "Transformation" in FSMA-204 terms).
CREATE TABLE IF NOT EXISTS lot_links (
  parent_lot_id   bigint NOT NULL REFERENCES lots(lot_id),
  child_lot_id    bigint NOT NULL REFERENCES lots(lot_id),
  transform_event text NOT NULL,
  PRIMARY KEY (parent_lot_id, child_lot_id),
  CHECK (parent_lot_id <> child_lot_id)                       -- no self-loops: first line of cycle defense
);

-- ── 5. stores ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  store_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name      text NOT NULL,
  chain     text NOT NULL,
  address   text NOT NULL,
  geom      geography(Point, 4326) NOT NULL                   -- PostGIS: store location for the map
);

-- ── 6. shipments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
  shipment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot_id      bigint NOT NULL REFERENCES lots(lot_id),
  store_id    bigint NOT NULL REFERENCES stores(store_id),
  units       int NOT NULL CHECK (units > 0),
  shipped_at  timestamptz NOT NULL,
  received_at timestamptz
);

-- ── 7. store_inventory ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_inventory (
  store_id      bigint NOT NULL REFERENCES stores(store_id),
  lot_id        bigint NOT NULL REFERENCES lots(lot_id),
  units_on_hand int NOT NULL CHECK (units_on_hand >= 0),
  PRIMARY KEY (store_id, lot_id)
);

-- ── 8. incidents ────────────────────────────────────────────────────────────
-- embedding dimension is injected from EMBED_DIM (local=384, Bedrock Titan v2=verified dim).
CREATE TABLE IF NOT EXISTS incidents (
  incident_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reported_at      timestamptz NOT NULL,
  raw_text         text NOT NULL,
  embedding        vector(__EMBED_DIM__),                     -- pgvector column (HNSW-indexed in Phase 02)
  suspected_lot_id bigint REFERENCES lots(lot_id),
  pathogen         text
);

-- ── 9. incident_lot_matches ──────────────────────────────────────────────────
-- Materialized clustering output (Streams-free: refreshed by the inbox ingest job).
CREATE TABLE IF NOT EXISTS incident_lot_matches (
  incident_id bigint NOT NULL REFERENCES incidents(incident_id),
  lot_id      bigint NOT NULL REFERENCES lots(lot_id),
  PRIMARY KEY (incident_id, lot_id)
);
```

> **Verbatim-fidelity check:** all 9 tables, the `type`/`lot_type` CHECKs, the `units > 0` and `units_on_hand >= 0` CHECKs, the `CHECK(parent_lot_id <> child_lot_id)`, `tlc UNIQUE NOT NULL`, `stores.geom ... NOT NULL`, and every FK match the Data Model exactly. The **only** divergence from the deep-dive snippet is `IF NOT EXISTS` (idempotency) and `__EMBED_DIM__` in place of the hardcoded `1536` (EMBED_DIM is the single source of truth; local = 384). Both are mandated by the contract.

---

### 3.3 Write `db/migrations/0003_indexes.sql`

All canonical **relational + GiST** indexes, idempotent via `IF NOT EXISTS`. The HNSW index is **deferred to Phase 02** and shipped here only as a documented, copy-paste-ready comment (exact parameters `m=16, ef_construction=64, vector_cosine_ops`).

```sql
-- db/migrations/0003_indexes.sql
-- Canonical indexes (these are the nodes that show up in EXPLAIN).
-- Idempotent: every index uses IF NOT EXISTS.
--
-- HNSW on incidents.embedding is DEFERRED to Phase 02 (built AFTER ~2,000 real
-- embeddings are seeded — building HNSW on an empty/under-populated table is wasted
-- work and would need a rebuild). The exact statement is documented at the bottom of
-- this file; Phase 02's loader runs it. See ../deep-dives/01-recall.md §7.1 step 5.

-- ── lot_links: both directions of the DAG (recursion does an Index Scan per hop) ──
CREATE INDEX IF NOT EXISTS idx_lot_links_parent ON lot_links (parent_lot_id);  -- forward recursion (hero)
CREATE INDEX IF NOT EXISTS idx_lot_links_child  ON lot_links (child_lot_id);   -- backward recursion

-- ── shipments: lot→store and store→lot JOINs in the affected-store CTE ──
CREATE INDEX IF NOT EXISTS idx_shipments_lot    ON shipments (lot_id);
CREATE INDEX IF NOT EXISTS idx_shipments_store  ON shipments (store_id);

-- ── store_inventory: lineage drill-down (Phase 07) ──
CREATE INDEX IF NOT EXISTS idx_store_inventory  ON store_inventory (store_id, lot_id);

-- ── stores: PostGIS spatial index for the map / bbox queries ──
CREATE INDEX IF NOT EXISTS idx_stores_geom      ON stores USING gist (geom);

-- ─────────────────────────────────────────────────────────────────────────────
-- DEFERRED TO PHASE 02 — DO NOT UNCOMMENT HERE. Phase 02's loader runs this verbatim
-- AFTER embeddings are seeded. Kept here as the single canonical definition so there
-- is zero guesswork about parameters:
--
--   CREATE INDEX IF NOT EXISTS idx_incidents_hnsw
--     ON incidents USING hnsw (embedding vector_cosine_ops)
--     WITH (m = 16, ef_construction = 64);
--
-- (vector_cosine_ops because the hero query orders by  embedding <=> $2  — cosine distance.)
-- ─────────────────────────────────────────────────────────────────────────────
```

> **Decision (recorded):** the HNSW index is **built after seed** for speed. `0003` is intentionally HNSW-free; the canonical statement above lives in [`PHASE-02-seed-data.md`](./PHASE-02-seed-data.md) and runs once embeddings exist. The `idx_incidents_hnsw` name and `vector_cosine_ops`/`m=16`/`ef_construction=64` parameters are pinned here and there identically.

---

### 3.4 Write `scripts/migrate.ts` (the runner)

Forward-only, idempotent, transactional, EMBED_DIM-injecting, `DEPLOY_TARGET`-aware. Pure `pg` + Node `fs` — no extra deps.

```ts
// scripts/migrate.ts
// Forward-only SQL migration runner.
//   - Reads db/migrations/*.sql in lexical order (0001_, 0002_, 0003_, …).
//   - Records applied files in a schema_migrations table → re-runs are no-ops.
//   - Injects EMBED_DIM (lib/config.ts) into the __EMBED_DIM__ token.
//   - Each migration runs inside its own transaction (Postgres DDL is transactional).
//   - Branches the connection on DEPLOY_TARGET (local DATABASE_URL vs. Aurora).
//
// Run: pnpm db:migrate   (alias for: tsx scripts/migrate.ts)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Pool, type PoolConfig } from "pg";
import { DEPLOY_TARGET, EMBED_DIM } from "../lib/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "db", "migrations");
const EMBED_DIM_TOKEN = "__EMBED_DIM__";

// ── validate EMBED_DIM once, loudly ──────────────────────────────────────────
if (!Number.isInteger(EMBED_DIM) || EMBED_DIM < 1 || EMBED_DIM > 16000) {
  throw new Error(
    `EMBED_DIM must be an integer in 1..16000 (pgvector limit); got ${String(EMBED_DIM)}. ` +
      `Set EMBED_DIM in your env (local=384).`,
  );
}

// ── connection config: the ONLY thing DEPLOY_TARGET changes here ──────────────
function poolConfig(): PoolConfig {
  if (DEPLOY_TARGET === "aurora") {
    // Aurora: connect to the cluster endpoint. Credentials handling for the app at
    // runtime is OIDC/Secrets-Manager (Phase 09); for the migrate script we accept a
    // DATABASE_URL pointed at Aurora (set in CI / locally with a port-forward or the
    // public-but-SG-locked endpoint). Keep this branch minimal — no app logic here.
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DEPLOY_TARGET=aurora requires DATABASE_URL to point at the Aurora endpoint.");
    // VERIFIED TLS: validate the server cert against the Amazon RDS root CA bundle.
    // NEVER set rejectUnauthorized:false — that disables verification and invites MITM.
    // Download once: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
    const caPath = process.env.RDS_CA_BUNDLE ?? join(__dirname, "..", "certs", "rds-global-bundle.pem");
    if (!existsSync(caPath)) {
      throw new Error(
        `Aurora TLS CA bundle not found at ${caPath}. Download the RDS global bundle ` +
          `(https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem) or set RDS_CA_BUNDLE.`,
      );
    }
    return {
      connectionString: url,
      ssl: { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true },
    };
  }
  // local Docker Postgres
  const url = process.env.DATABASE_URL ?? "postgres://recall:recall@localhost:5432/recall";
  return { connectionString: url };
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function appliedSet(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations");
  return new Set(rows.map((r) => r.filename));
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // 0001_ < 0002_ < 0003_  → lexical sort is correct for zero-padded prefixes
}

function loadSql(filename: string): string {
  const raw = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
  // Inject EMBED_DIM. Only 0002_schema.sql contains the token; replaceAll on the rest is a no-op.
  return raw.split(EMBED_DIM_TOKEN).join(String(EMBED_DIM));
}

async function main(): Promise<void> {
  const pool = new Pool(poolConfig());
  try {
    await ensureMigrationsTable(pool);
    const done = await appliedSet(pool);
    const files = migrationFiles();
    const pending = files.filter((f) => !done.has(f));

    if (pending.length === 0) {
      console.log(`✓ schema up to date — ${files.length} migration(s) already applied. No-op.`);
      return;
    }

    console.log(`Applying ${pending.length} migration(s) [DEPLOY_TARGET=${DEPLOY_TARGET}, EMBED_DIM=${EMBED_DIM}]…`);
    for (const filename of pending) {
      const sql = loadSql(filename);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        console.log(`  ✓ ${filename}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ✗ ${filename} — rolled back. ${(err as Error).message}`);
        throw err; // stop on first failure; forward-only, no auto-down
      } finally {
        client.release();
      }
    }
    console.log("✓ migrations complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

> **Design notes (call out on review):**
> - **Idempotent two ways:** the `schema_migrations` ledger skips already-applied files, **and** every DDL statement uses `IF NOT EXISTS` so even a half-applied file (interrupted mid-run) re-applies cleanly.
> - **Transactional per file:** Postgres runs DDL inside transactions, so a failing statement rolls the whole file back — you never get a half-created `0002`.
> - **EMBED_DIM injection** is a simple token replace (`__EMBED_DIM__` → integer). It is validated up front and only `0002_schema.sql` contains the token, so the replace is a no-op everywhere else.
> - **Forward-only:** there is no `down`. Local resets use `pnpm db:down && docker volume rm` (see [§6](#6-common-pitfalls--fixes)); we never write down-migrations.
> - **Verified TLS on the aurora branch:** the script validates the server certificate against the **Amazon RDS global root CA bundle** (`rejectUnauthorized: true` + the downloaded `ca`). Never set `rejectUnauthorized: false` — that disables verification and invites a MITM on the DB connection. The app's runtime pool (`lib/db/pool.ts`, Phase 03/09) uses the same verified-TLS + OIDC setup.

---

### 3.5 Apply and verify

```bash
# 1. Bring the local DB up (if not already), wait for healthy.
pnpm db:up
docker compose ps                      # STATUS should read "healthy"

# 2. Apply migrations.
pnpm db:migrate
# Expected:
#   Applying 3 migration(s) [DEPLOY_TARGET=local, EMBED_DIM=384]…
#     ✓ 0001_extensions.sql
#     ✓ 0002_schema.sql
#     ✓ 0003_indexes.sql
#   ✓ migrations complete.

# 3. Re-run → must be a no-op.
pnpm db:migrate
# Expected:
#   ✓ schema up to date — 3 migration(s) already applied. No-op.
```

See [§5](#5-definition-of-done) for the full verification battery (`\d`, empty-trace, idempotency, EMBED_DIM check).

---

## 4. Key files

| Path | Purpose |
|---|---|
| `scripts/migrate.ts` | Forward-only runner: ordered apply, `schema_migrations` ledger, `__EMBED_DIM__` injection, per-file transaction, `DEPLOY_TARGET`-aware connection. |
| `db/migrations/0001_extensions.sql` | `CREATE EXTENSION IF NOT EXISTS vector; postgis;` — idempotent; source of truth for Aurora where `init.sql` doesn't run. |
| `db/migrations/0002_schema.sql` | Full DDL for all 9 tables with FKs + CHECKs verbatim; `incidents.embedding vector(__EMBED_DIM__)`. |
| `db/migrations/0003_indexes.sql` | All relational + GiST indexes (`idx_lot_links_parent/child`, `idx_shipments_lot/store`, `idx_store_inventory`, `idx_stores_geom`); HNSW deferred to Phase 02 as a documented comment. |
| `lib/config.ts` | (from Phase 00) Exports `EMBED_DIM` — the single source of truth the runner injects. |
| `schema_migrations` (table) | Created by the runner; the applied-migrations ledger that makes re-runs no-ops. |

---

## 5. Definition of Done

Run each command; the **expected output** must match.

- [ ] **Migrations apply cleanly.**
  ```bash
  pnpm db:migrate
  ```
  Expected: three `✓` lines (`0001…`, `0002…`, `0003…`) then `✓ migrations complete.` and exit code `0`.

- [ ] **Re-running is idempotent (no-op).**
  ```bash
  pnpm db:migrate
  ```
  Expected: `✓ schema up to date — 3 migration(s) already applied. No-op.` — and **no** DDL re-runs.

- [ ] **All 9 tables exist** (plus `schema_migrations` + PostGIS's `spatial_ref_sys`).
  ```bash
  docker compose exec -T db psql -U recall -d recall -c '\dt'
  ```
  Expected to include: `suppliers`, `facilities`, `lots`, `lot_links`, `stores`, `shipments`, `store_inventory`, `incidents`, `incident_lot_matches`, `schema_migrations`.

- [ ] **`\d` shows the constraints and the embedding column type.**
  ```bash
  docker compose exec -T db psql -U recall -d recall -c '\d incidents'
  docker compose exec -T db psql -U recall -d recall -c '\d lot_links'
  ```
  Expected: `incidents.embedding` shows type `vector(384)` (EMBED_DIM injected); `lot_links` shows PK `(parent_lot_id, child_lot_id)`, a `CHECK (parent_lot_id <> child_lot_id)`, and two FKs to `lots`.

- [ ] **Canonical relational + GiST indexes exist; HNSW does NOT yet (deferred).**
  ```bash
  docker compose exec -T db psql -U recall -d recall -c \
    "SELECT indexname FROM pg_indexes WHERE schemaname='public' ORDER BY indexname;"
  ```
  Expected to include: `idx_lot_links_parent`, `idx_lot_links_child`, `idx_shipments_lot`, `idx_shipments_store`, `idx_store_inventory`, `idx_stores_geom`. Expected to **NOT** include `idx_incidents_hnsw` (Phase 02 builds it).

- [ ] **Extensions are enabled.**
  ```bash
  docker compose exec -T db psql -U recall -d recall -c \
    "SELECT extname FROM pg_extension WHERE extname IN ('vector','postgis');"
  ```
  Expected: both `vector` and `postgis` listed.

- [ ] **An empty trace executes with no rows and no error** (schema supports the hero query shape before any data). This is the canonical hero query against an empty DB — it must return one all-empty row, not error:
  ```bash
  docker compose exec -T db psql -U recall -d recall -c \
  "WITH RECURSIVE contaminated AS (
     SELECT l.lot_id, 0 AS depth, ARRAY[l.lot_id] AS path
     FROM lots l WHERE l.tlc = 'NO-SUCH-LOT'
     UNION ALL
     SELECT ll.child_lot_id, c.depth + 1, c.path || ll.child_lot_id
     FROM contaminated c JOIN lot_links ll ON ll.parent_lot_id = c.lot_id
     WHERE c.depth < 12 AND ll.child_lot_id <> ALL(c.path))
   SELECT (SELECT count(*) FROM contaminated) AS lot_count;"
  ```
  Expected: `lot_count = 0`, query returns successfully (no relation/column errors), confirming the schema and the recursive CTE shape are valid.

- [ ] **Repo stays GREEN.**
  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  ```
  Expected: all pass (the runner is plain `pg`/`fs`; no new test required for this phase, but `tsc --noEmit` must be clean over `scripts/migrate.ts`).

- [ ] **BUILD_LOG.md updated** with the [§8](#8-build_log-entry-to-append) entry.

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **HNSW built on empty table** | Slow re-build later, or an index that never indexed real vectors | **Decision: build HNSW AFTER seed** (Phase 02). `0003` deliberately omits it; the canonical statement (`m=16, ef_construction=64, vector_cosine_ops`) lives as a comment in `0003` and is run by Phase 02's loader. |
| **Hardcoding `vector(1536)`** | Local embeddings are 384-dim → dimension mismatch on insert | Never hardcode. Use the `__EMBED_DIM__` token; the runner injects `EMBED_DIM` (local 384). One config constant ([CONVENTIONS §3](./CONVENTIONS.md#3-pinned-tech-stack)). |
| **DB not up** | `ECONNREFUSED 127.0.0.1:5432` | `pnpm db:up` first; wait for `docker compose ps` → `healthy`. |
| **Extensions missing** | `type "vector" does not exist` / `type "geography" does not exist` | Ensure `0001_extensions.sql` applied (it runs first). On a brand-new local volume, `docker/init.sql` should also create them; on Aurora only the migration does. |
| **Non-idempotent re-run** | `relation "suppliers" already exists` on second `db:migrate` | Two guards: the `schema_migrations` ledger skips applied files, **and** every `CREATE` uses `IF NOT EXISTS`. If you edited a file after it was applied, the ledger won't re-run it — reset the DB instead (below). |
| **Editing an already-applied migration** | Your SQL change "doesn't take" | Forward-only: applied files are frozen. For local dev, **reset**: `pnpm db:down && docker volume rm <project>_pgdata && pnpm db:up && pnpm db:migrate`. Never rewrite history on a shared DB. |
| **`tsx` can't import `lib/config.ts`** | `Cannot find module` / ESM path error | Use the relative import `../lib/config` (shown), run via `tsx` (not `node`), and keep `"type": "module"` consistent with Phase 00's `package.json`. |
| **`spatial_ref_sys` / PostGIS tables in `\dt`** | Unexpected extra tables | Expected — PostGIS creates `spatial_ref_sys`. Not an error. |
| **`vector` dim > 2000 and HNSW** | (Future, Bedrock) HNSW has a 2000-dim ceiling for some ops | Titan v2 default 1024 is fine; if a larger dim is ever chosen, verify HNSW dim support in Phase 02. Local 384 is unaffected. |

---

## 7. Cut-if-scope-bites

This is a **spine phase** — there is almost nothing to cut, only to defer:

- **Defer (already the plan):** the HNSW index → Phase 02 (built after seeding). This is a deliberate sequencing choice, **not** a cut.
- **Acceptable trim:** the fancy console output in `migrate.ts` (the `✓`/`✗` lines) — pure cosmetics; the ledger + transaction logic must stay.

> **NEVER cut** (per [CONVENTIONS §12](./CONVENTIONS.md#12-global-rules-every-phase)): the FK + CHECK constraints (FK-enforced DAG integrity is the thesis), the `vector(EMBED_DIM)` column, the GiST index on `stores.geom`, the both-directions `lot_links` indexes (the recursion's Index Scan depends on them), or real-volume readiness. The schema must support the recursive CTE + PostGIS JOIN + pgvector rail exactly as written. If pressed for time, defer *features in later phases*, never the schema's correctness.

---

## 8. BUILD_LOG entry to append

```markdown
## Phase 01 — Database schema & migrations  (YYYY-MM-DD)

- Wrote `scripts/migrate.ts`: forward-only runner, `schema_migrations` ledger (idempotent
  re-runs), per-file transaction, `__EMBED_DIM__` → EMBED_DIM injection, DEPLOY_TARGET-aware
  connection. No extra deps (pg + node:fs only).
- Authored 3 migrations:
  - `0001_extensions.sql` — `vector` + `postgis` (IF NOT EXISTS).
  - `0002_schema.sql` — all 9 tables (suppliers, facilities, lots, lot_links, stores,
    shipments, store_inventory, incidents, incident_lot_matches) with FKs + CHECKs verbatim;
    `incidents.embedding vector(384)` via injected EMBED_DIM.
  - `0003_indexes.sql` — idx_lot_links_parent/child, idx_shipments_lot/store,
    idx_store_inventory, idx_stores_geom (GiST). HNSW deferred to Phase 02 (documented comment,
    m=16 ef_construction=64 vector_cosine_ops) — building HNSW after seed is faster and indexes
    real vectors.
- Verified: `pnpm db:migrate` applies clean; re-run is a no-op; `\d incidents` shows
  `vector(384)`; `\d lot_links` shows the PK + CHECK + FKs; all 6 relational/GiST indexes present;
  empty trace (`tlc='NO-SUCH-LOT'`) returns `lot_count=0` with no error. `pnpm typecheck/lint/test` GREEN.
- Decision recorded: HNSW index built AFTER seed (Phase 02), not in 0003.
```

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract (single source of truth); see [§3 stack](./CONVENTIONS.md#3-pinned-tech-stack), [§6 env](./CONVENTIONS.md#6-environment-variables), [§9 DB objects & indexes](./CONVENTIONS.md#9-database-objects--indexes).
- [`./README.md`](./README.md) — build index & phase ordering.
- [`./PHASE-00-foundation.md`](./PHASE-00-foundation.md) — scaffold, `lib/config.ts`, pnpm scripts, Docker Postgres (prerequisite).
- [`./PHASE-02-seed-data.md`](./PHASE-02-seed-data.md) — acyclic DAG generator, real embeddings, **and the deferred HNSW `CREATE INDEX`** (unblocked by this phase).
- [`./PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) — the recursive-CTE forward trace that runs on this schema.
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — flagship spec; [§5.1 Full DDL](../deep-dives/01-recall.md#51-full-ddl-aurora-postgresql) (the verbatim source), [§7.1 provisioning step 5](../deep-dives/01-recall.md#71-ordered-steps) (build HNSW after seed).
- [`../reference/aws-databases.md`](../reference/aws-databases.md) — Aurora PG / pgvector / PostGIS capabilities.
- [`../reference/submission-checklist.md`](../reference/submission-checklist.md) — the row-count + schema proofs the schema must support.
