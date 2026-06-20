# Phase 03 — The hero query (THE PRODUCT)

> **Outcome:** The one `SERIALIZABLE` recursive-CTE + PostGIS + pgvector statement exists as a single canonical SQL string and a typed `runTrace(tlc, asOf?)` that opens the transaction, embeds the query text, runs the statement, returns a typed `TraceResult`, and **measures real latency**. `pnpm bench` proves **p50 < 1s over ~250k edges** and prints a full `EXPLAIN (ANALYZE, BUFFERS)` showing an Index Scan on `lot_links` at every recursive iteration, an HNSW index scan, and a GiST spatial path. `pnpm test` is green on adversarial cases (cycle guard, clean-lot empty arrays, latency budget).

**Depends on / Unblocks:** Depends on [PHASE-01-database-schema.md](./PHASE-01-database-schema.md) (the 9 tables + indexes) and [PHASE-02-seed-data.md](./PHASE-02-seed-data.md) (~250k acyclic edges, ~1,400 stores, ~2k real embeddings live in the DB). Unblocks [PHASE-04-api-layer.md](./PHASE-04-api-layer.md) (routes wrap `runTrace`), [PHASE-05-outbreak-console.md](./PHASE-05-outbreak-console.md) (graph/map/rail render the `TraceResult`), and [PHASE-06-query-inspector.md](./PHASE-06-query-inspector.md) (surfaces `trace.sql` + the EXPLAIN plan).

**Effort:** ~1 day (M2 in [../deep-dives/01-recall.md §11](../deep-dives/01-recall.md#11-build-plan--milestones)).

> ## ⛔ THIS PHASE MUST BE GREEN BEFORE ANY UI IS WRITTEN. ⛔
>
> The thesis ([CONVENTIONS.md §1](./CONVENTIONS.md#1-thesis)) is **the database is the protagonist; the UI is its courtroom evidence.** The hero query **is the whole product** — the Console, the Inspector, and the API are just rendering surfaces for the `TraceResult` this phase produces. **Do not open a `.tsx` file until `pnpm bench` shows p50 < 1s and `pnpm test` is green.** If you wire UI first you are building a courtroom with no evidence.

---

## 1. Objectives

1. **`lib/db/pool.ts`** — a single **module-scope** `pg.Pool` wired with `attachDatabasePool` from `@vercel/functions`, branching on `DEPLOY_TARGET` (`local` → `DATABASE_URL`; `aurora` → host/port/db + OIDC-resolved STS auth). Survives across serverless invocations; drains idle clients before Fluid Compute suspends.
2. **`lib/db/queries/trace.ts`** — exports the **canonical hero SQL as a string** (`TRACE_SQL`, verbatim from [CONVENTIONS.md §7](./CONVENTIONS.md#7-canonical-hero-query-forward-trace)) and **`runTrace(tlc, asOf?)`** that:
   - opens `BEGIN ISOLATION LEVEL SERIALIZABLE`,
   - embeds the implicit query text (the TLC, or an explicit incident string) to a `query_embedding` vector — **or accepts a pre-computed embedding**,
   - runs the statement with three bound params, `COMMIT`s,
   - **retries on `40001` serialization_failure** (bounded),
   - maps the single result row into the typed `TraceResult` matching the [API response contract](./CONVENTIONS.md#10-api-response-contract),
   - measures latency with `performance.now()` (a **real** measurement, never hardcoded).
3. **`lib/db/explain.ts`** — `explainTrace(tlc, asOf?)` runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` against the exact same SQL + params and returns the plan text plus a parsed node list (Recursive Union, HNSW, GiST). Used by `pnpm bench` and later by `/api/explain`.
4. **`scripts/trace-bench.ts`** — runs `runTrace(DEMO_TLC)` `N = 30` times against the seeded DB, prints **p50 / p99 / min / max**, the affected-store/edge/lot counts, and a **full `EXPLAIN (ANALYZE, BUFFERS)`**. Exits non-zero if p50 ≥ 1000ms (the bench is also a gate).
5. **`test/trace.test.ts`** — adversarial vitest cases against a small isolated fixture schema: **(a)** a deliberately cyclic edge set terminates (cycle guard holds, no hang, no over-report); **(b)** a lot with zero downstream shipments returns clean **empty arrays**, not `null` and not an error; **(c)** a latency-budget assertion (`p50 < 1000ms`) over the seeded DB.

---

## 2. Prerequisites

- [ ] **Phase 00 GREEN** — repo scaffolded, `pnpm`, TS strict, scripts wired. `lib/config.ts` and `lib/types.ts` exist (this phase finalizes their hero-relevant fields).
- [ ] **Phase 01 GREEN** — `db/migrations/0001..0003` applied; the 9 tables, all FK + CHECK constraints, and **every** index in [CONVENTIONS.md §9](./CONVENTIONS.md#9-database-objects--indexes) exist (`idx_lot_links_parent`, `idx_lot_links_child`, `idx_shipments_lot`, `idx_shipments_store`, `idx_incidents_hnsw` USING hnsw, `idx_stores_geom` USING gist).
- [ ] **Phase 02 GREEN** — seed loaded; `SELECT count(*) FROM lot_links;` ≈ **250,000** and `DEMO_TLC` (`PRD-OUTBREAK-0001`) exists in `lots` and traces to ~1,400 stores.
- [ ] **Local DB up:** `pnpm db:up` (Docker `postgis/postgis:16-3.4` + `postgresql-16-pgvector`).
- [ ] **`.env` present** with at least `DEPLOY_TARGET=local`, `DATABASE_URL=postgres://recall:recall@localhost:5432/recall`, `EMBED_PROVIDER=local`, `EMBED_DIM=384`, `DEMO_TLC=PRD-OUTBREAK-0001`.
- [ ] **Deps installed:** `pg`, `@vercel/functions`, `@xenova/transformers`, `tsx`, `vitest`, `dotenv` (and `@types/pg`).

```bash
# sanity: confirm the spine below this phase is real before you build on it
pnpm db:up
psql "$DATABASE_URL" -c "select count(*) as edges from lot_links;"            # ≈ 250000
psql "$DATABASE_URL" -c "select lot_id, tlc from lots where tlc = 'PRD-OUTBREAK-0001';"   # 1 row
psql "$DATABASE_URL" -c "\d+ lot_links" | grep -E 'idx_lot_links_(parent|child)'          # both indexes present
psql "$DATABASE_URL" -c "select indexname from pg_indexes where tablename='incidents';"   # idx_incidents_hnsw present
```

> If any of those fail, **stop** — fix Phase 01/02 first. The hero query is only sub-second because the indexes and the acyclic DAG are real.

---

## 3. Step-by-step

### 3.0 Confirm `lib/config.ts` and `lib/types.ts` carry the hero contract

These are introduced in Phase 00; this phase depends on these exact fields. If they are thinner, extend them now.

```ts
// lib/config.ts — central, env-driven config. The ONLY place env is read for the hero path.
import "server-only"; // guard: never bundle DB/embedding config into the client

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export type DeployTarget = "local" | "aurora";
export type EmbedProvider = "local" | "bedrock";

export const DEPLOY_TARGET = req("DEPLOY_TARGET", "local") as DeployTarget;
export const EMBED_PROVIDER = req("EMBED_PROVIDER", "local") as EmbedProvider;

/** ONE config constant. incidents.embedding is vector(EMBED_DIM), chosen at migrate time.
 *  local (@xenova/transformers Xenova/all-MiniLM-L6-v2) = 384. Bedrock Titan v2 = verified dim. */
export const EMBED_DIM = Number(req("EMBED_DIM", "384"));

export const AWS_REGION = req("AWS_REGION", "us-east-1");
export const DEMO_TLC = req("DEMO_TLC", "PRD-OUTBREAK-0001");

/** Recursion guard, kept in sync with the SQL (depth < TRACE_MAX_DEPTH). Real DAGs are ~4–7 hops. */
export const TRACE_MAX_DEPTH = 12;
```

```ts
// lib/types.ts — mirrors CONVENTIONS.md §10 (API response contract). Single source for the hero shapes.
export type Edge = { parent: number; child: number; transform: string };

export type AffectedStore = {
  storeId: number;
  name: string;
  chain: string;
  address: string;
  lat: number;
  lng: number;
  units: number;
};

export type SimilarIncident = {
  incidentId: number;
  text: string;
  pathogen: string | null;
  score: number; // 1 - cosine_distance (higher = more similar)
};

export type TraceMeta = {
  latencyMs: number; // REAL measurement — never hardcoded
  lotCount: number;
  edgeCount: number;
  storeCount: number;
  totalUnits: number;
  asOf: string | null;
};

export type TraceResult = {
  meta: TraceMeta;
  edges: Edge[];
  stores: AffectedStore[];
  incidents: SimilarIncident[];
  sql: string; // the TRACE_SQL string, surfaced to the Query Inspector
};
```

> **Embeddings (`lib/embeddings/*`)** are delivered in Phase 02 as a pluggable dispatcher `embed(text: string): Promise<number[]>` returning an `EMBED_DIM`-length array. This phase **consumes** it. If Phase 02 hasn't shipped it yet, a minimal local stub is in [§3.5](#35-embedding-dispatcher-consumed-here-shipped-in-phase-02) so this phase can go GREEN independently.

---

### 3.1 `lib/db/pool.ts` — the module-scope pool (DEPLOY_TARGET branch)

The **#1 Vercel+Aurora demo-killer is connection exhaustion** ([../reference/vercel-v0-playbook.md §4](../reference/vercel-v0-playbook.md#4-pattern-b--fluid-compute--connection-pooling-aurora--dsql)). Create the pool **once at module scope** and call `attachDatabasePool` so Fluid Compute drains idle clients before suspend. `local` uses `DATABASE_URL`; `aurora` uses host/port/db with an **async password** that resolves a short-lived token/secret via OIDC keyless STS — **no long-lived keys in the app** ([CONVENTIONS.md §3](./CONVENTIONS.md#3-pinned-tech-stack)).

```ts
// lib/db/pool.ts — server-only, module scope so it survives across serverless invocations.
import "server-only";
import { Pool, type PoolConfig } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { DEPLOY_TARGET, AWS_REGION } from "@/lib/config";

/**
 * Build the pool config from DEPLOY_TARGET — the ONLY dev↔cloud switch (CONVENTIONS.md §4).
 *  - local  → DATABASE_URL to the Docker Postgres (postgis:16-3.4 + pgvector). No SSL.
 *  - aurora → AURORA_* host/port/db; password is an async fn that mints a short-lived
 *             RDS IAM auth token using OIDC-resolved STS creds. NO long-lived AWS keys.
 *
 * `max` is intentionally SMALL: many warm Fluid instances × max can exhaust Aurora.
 */
function buildConfig(): PoolConfig {
  const base: PoolConfig = {
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // App-level statement timeout: a runaway CTE must fail fast, never hang the demo.
    statement_timeout: 15_000,
  };

  if (DEPLOY_TARGET === "local") {
    return {
      ...base,
      connectionString: process.env.DATABASE_URL,
      ssl: false,
    };
  }

  // DEPLOY_TARGET === "aurora"
  return {
    ...base,
    host: process.env.AURORA_HOST,
    port: Number(process.env.AURORA_PORT ?? "5432"),
    database: process.env.AURORA_DB ?? "recall",
    user: process.env.AURORA_USER ?? "recall_app",
    ssl: { rejectUnauthorized: true },
    // Async password → a fresh short-lived token per new physical connection.
    // OIDC keyless: @vercel/functions/oidc resolves STS creds; the RDS Signer mints a 15-min token.
    // (Wired in PHASE-09/10. Stubbed to throw until then so we never accidentally ship static keys.)
    password: async () => {
      const { awsCredentialsProvider } = await import("@vercel/functions/oidc");
      const { Signer } = await import("@aws-sdk/rds-signer");
      const credentials = awsCredentialsProvider({
        roleArn: process.env.AWS_ROLE_ARN!,
      });
      const signer = new Signer({
        region: AWS_REGION,
        hostname: process.env.AURORA_HOST!,
        port: Number(process.env.AURORA_PORT ?? "5432"),
        username: process.env.AURORA_USER ?? "recall_app",
        credentials,
      });
      return signer.getAuthToken();
    },
  };
}

// Module scope: created ONCE per instance, reused across invocations.
export const pool = new Pool(buildConfig());

// Fluid Compute: drain idle clients before the instance suspends — prevents connection leakage.
attachDatabasePool(pool);

// Surface unexpected idle-client errors instead of crashing the process.
pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[pg pool] idle client error", err);
});
```

> **Why `password` is a function, not a string:** node-postgres calls it per new physical connection, so each connection gets a freshly-signed 15-minute RDS IAM token. There is never a static secret in env or in the bundle. On `local` there is no password at all (`DATABASE_URL` carries `recall:recall`). The dynamic `import()` of `@aws-sdk/rds-signer` keeps it out of the local bundle. (If Phase 09 chooses Secrets-Manager password over IAM auth, swap the body to fetch the secret; the call site is identical.)

---

### 3.2 `lib/db/queries/trace.ts` — `TRACE_SQL` + `runTrace`

The SQL is **verbatim** from [CONVENTIONS.md §7](./CONVENTIONS.md#7-canonical-hero-query-forward-trace). Do **not** paraphrase it — the same string is surfaced byte-for-byte in the Query Inspector, so the on-camera SQL is provably the SQL that ran.

```ts
// lib/db/queries/trace.ts
import "server-only";
import { pool } from "@/lib/db/pool";
import { embed } from "@/lib/embeddings";
import { EMBED_DIM, TRACE_MAX_DEPTH } from "@/lib/config";
import type {
  TraceResult,
  Edge,
  AffectedStore,
  SimilarIncident,
} from "@/lib/types";

/**
 * THE HERO QUERY — one SERIALIZABLE statement fusing recursive graph traversal (lot_links),
 * a PostGIS geo JOIN (stores.geom), and a pgvector HNSW similarity scan (incidents.embedding).
 * Verbatim from CONVENTIONS.md §7. This string is surfaced byte-for-byte to the Query Inspector.
 *
 *   $1 = tlc (text)              — the contaminated lot code
 *   $2 = query_embedding (::vector) — embedding of the incident text / TLC, cast to vector(EMBED_DIM)
 *   $3 = as_of (timestamptz|NULL)   — time filter for the historical slider; NULL = "now"
 */
export const TRACE_SQL = `WITH RECURSIVE contaminated AS (
  SELECT l.lot_id, 0 AS depth, ARRAY[l.lot_id] AS path
  FROM lots l WHERE l.tlc = $1
  UNION ALL
  SELECT ll.child_lot_id, c.depth + 1, c.path || ll.child_lot_id
  FROM contaminated c JOIN lot_links ll ON ll.parent_lot_id = c.lot_id
  WHERE c.depth < ${TRACE_MAX_DEPTH} AND ll.child_lot_id <> ALL(c.path)        -- depth guard + cycle guard
),
edges AS (
  SELECT DISTINCT ll.parent_lot_id, ll.child_lot_id, ll.transform_event
  FROM lot_links ll JOIN contaminated p ON p.lot_id = ll.parent_lot_id JOIN contaminated c ON c.lot_id = ll.child_lot_id
),
affected AS (
  SELECT s.store_id, s.name, s.chain, s.address, ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lng, SUM(sh.units) AS units
  FROM shipments sh JOIN contaminated c ON c.lot_id = sh.lot_id JOIN stores s ON s.store_id = sh.store_id
  WHERE ($3::timestamptz IS NULL OR sh.shipped_at <= $3)
  GROUP BY s.store_id, s.name, s.chain, s.address, s.geom
),
similar AS (
  SELECT i.incident_id, i.raw_text, i.pathogen, 1 - (i.embedding <=> $2::vector) AS score
  FROM incidents i WHERE i.suspected_lot_id IN (SELECT lot_id FROM contaminated) OR i.suspected_lot_id IS NULL
  ORDER BY i.embedding <=> $2::vector LIMIT 5
)
SELECT (SELECT count(*) FROM contaminated) AS lot_count, (SELECT json_agg(edges) FROM edges) AS edges,
       (SELECT json_agg(affected ORDER BY units DESC) FROM affected) AS stores, (SELECT coalesce(sum(units),0) FROM affected) AS total_units,
       (SELECT count(*) FROM affected) AS store_count, (SELECT json_agg(similar) FROM similar) AS incidents;`;

/** pgvector wants a string literal like '[0.1,0.2,...]', not a JS array. */
export function toVectorLiteral(v: number[]): string {
  if (v.length !== EMBED_DIM) {
    throw new Error(
      `Embedding dim mismatch: got ${v.length}, expected EMBED_DIM=${EMBED_DIM}. ` +
        `Check EMBED_PROVIDER/EMBED_DIM and that incidents.embedding is vector(${EMBED_DIM}).`,
    );
  }
  return `[${v.join(",")}]`;
}

/** Shape of the single result row the hero SQL returns (all aggregates collapse to one row). */
type RawTraceRow = {
  lot_count: string | number;
  edges: { parent_lot_id: number; child_lot_id: number; transform_event: string }[] | null;
  stores:
    | {
        store_id: number;
        name: string;
        chain: string;
        address: string;
        lat: number;
        lng: number;
        units: string | number;
      }[]
    | null;
  total_units: string | number;
  store_count: string | number;
  incidents:
    | { incident_id: number; raw_text: string; pathogen: string | null; score: number }[]
    | null;
};

export type RunTraceOptions = {
  /** Time filter for the historical slider; undefined/null = "now" (no filter). */
  asOf?: string | null;
  /** Provide a pre-computed embedding to skip embedding the TLC (e.g. the incident's real text). */
  queryEmbedding?: number[];
  /** Override the text that gets embedded (defaults to the TLC). */
  queryText?: string;
};

/**
 * Run the hero forward-trace inside one SERIALIZABLE transaction.
 * Embeds the implicit query text (the TLC, or opts.queryText) UNLESS a queryEmbedding is supplied.
 * Returns the typed TraceResult with a REAL measured latency. Retries once on 40001.
 */
export async function runTrace(tlc: string, opts: RunTraceOptions = {}): Promise<TraceResult> {
  const asOf = opts.asOf ?? null;

  // Embed OUTSIDE the transaction so model load / inference time is NOT counted as DB latency
  // and the transaction is held for the minimum possible window.
  const vec = opts.queryEmbedding ?? (await embed(opts.queryText ?? tlc));
  const embeddingLiteral = toVectorLiteral(vec);

  const MAX_RETRIES = 3; // SERIALIZABLE can raise 40001 under concurrent writes — bounded retry.
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const t0 = performance.now();
      const res = await client.query<RawTraceRow>(TRACE_SQL, [tlc, embeddingLiteral, asOf]);
      const latencyMs = Math.round(performance.now() - t0);
      await client.query("COMMIT");

      const row = res.rows[0];
      return mapRow(row, latencyMs, asOf);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      const code = (e as { code?: string }).code;
      if (code === "40001" && attempt < MAX_RETRIES - 1) {
        attempt += 1;
        continue; // serialization_failure: retry the whole transaction
      }
      throw e;
    } finally {
      client.release(); // return to pool — NEVER end() the client in serverless
    }
  }
}

/** Map the raw single-row result into the typed TraceResult. Clean lot → empty arrays, not null. */
function mapRow(row: RawTraceRow, latencyMs: number, asOf: string | null): TraceResult {
  const edges: Edge[] = (row.edges ?? []).map((e) => ({
    parent: e.parent_lot_id,
    child: e.child_lot_id,
    transform: e.transform_event,
  }));

  const stores: AffectedStore[] = (row.stores ?? []).map((s) => ({
    storeId: s.store_id,
    name: s.name,
    chain: s.chain,
    address: s.address,
    lat: Number(s.lat),
    lng: Number(s.lng),
    units: Number(s.units),
  }));

  const incidents: SimilarIncident[] = (row.incidents ?? []).map((i) => ({
    incidentId: i.incident_id,
    text: i.raw_text,
    pathogen: i.pathogen,
    score: Number(i.score),
  }));

  return {
    meta: {
      latencyMs,
      lotCount: Number(row.lot_count),
      edgeCount: edges.length,
      storeCount: Number(row.store_count),
      totalUnits: Number(row.total_units),
      asOf,
    },
    edges,
    stores,
    incidents,
    sql: TRACE_SQL,
  };
}
```

> **Three things that bite, all handled above:**
> 1. **`json_agg` returns `null`, not `[]`, when a CTE is empty.** The clean-lot path therefore yields `null` for `edges`/`stores`/`incidents` — `mapRow` coalesces every one to `[]` so the UI never sees `null` and never crashes. (Test (b) asserts this.)
> 2. **Embedding-dim mismatch** is the classic pgvector footgun. `toVectorLiteral` throws a *clear* error if the array length ≠ `EMBED_DIM`, instead of letting Postgres raise an opaque `expected N dimensions` deep in the query.
> 3. **Embedding happens outside `BEGIN…COMMIT`** so first-call model-load time (xenova lazily loads the model) is never charged to the measured DB latency and the SERIALIZABLE lock window stays minimal.

---

### 3.3 `lib/db/explain.ts` — the live EXPLAIN

Runs the **exact same SQL + params** as `runTrace` under `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`, so the plan on screen is provably the plan for the query that ran. Returns the raw plan text plus a parsed node list for the Query Inspector chips. `pnpm bench` calls this; `/api/explain` (Phase 04) reuses it.

```ts
// lib/db/explain.ts
import "server-only";
import { pool } from "@/lib/db/pool";
import { TRACE_SQL, toVectorLiteral } from "@/lib/db/queries/trace";
import { embed } from "@/lib/embeddings";

export type ExplainNode = { type: string; detail: string };
export type ExplainResult = { plan: string; nodes: ExplainNode[] };

/** Run EXPLAIN (ANALYZE, BUFFERS) over the hero query with real params; return plan text + parsed nodes. */
export async function explainTrace(
  tlc: string,
  asOf: string | null = null,
  queryEmbedding?: number[],
): Promise<ExplainResult> {
  const vec = queryEmbedding ?? (await embed(tlc));
  const lit = toVectorLiteral(vec);

  const client = await pool.connect();
  try {
    // ANALYZE actually runs the query, so do it in a read-only txn we roll back.
    await client.query("BEGIN");
    const res = await client.query<{ "QUERY PLAN": string }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${TRACE_SQL}`,
      [tlc, lit, asOf],
    );
    await client.query("ROLLBACK");
    const plan = res.rows.map((r) => r["QUERY PLAN"]).join("\n");
    return { plan, nodes: parsePlanNodes(plan) };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Pull the load-bearing nodes out of the text plan for the Inspector chips + bench assertions. */
export function parsePlanNodes(plan: string): ExplainNode[] {
  const nodes: ExplainNode[] = [];
  for (const raw of plan.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("->")) continue; // keep matching on the node-type words below
    const grab = (type: string) => {
      if (line.includes(type)) nodes.push({ type, detail: line });
    };
    grab("Recursive Union");
    grab("WorkTable Scan");
    // The three superpowers we MUST see in EXPLAIN (CONVENTIONS.md §7 requirements):
    if (line.includes("Index Scan") && line.includes("lot_links"))
      nodes.push({ type: "Index Scan (lot_links)", detail: line });
    if (line.includes("idx_incidents_hnsw") || /HNSW/i.test(line))
      nodes.push({ type: "HNSW Index Scan", detail: line });
    if (line.includes("idx_stores_geom") || line.includes("Index Scan") === false)
      grab("GiST");
  }
  // de-dup by detail line
  return nodes.filter((n, i) => nodes.findIndex((m) => m.detail === n.detail) === i);
}
```

---

### 3.4 `scripts/trace-bench.ts` — the latency gate + EXPLAIN dump

`pnpm bench`. Runs `runTrace(DEMO_TLC)` N=30 times against the seeded DB, prints **p50/p99/min/max** + scope counts, then prints the **full `EXPLAIN (ANALYZE, BUFFERS)`** and asserts the three required node kinds are present. **Exits non-zero** if p50 ≥ 1000ms or a required node is missing — the bench is the Definition-of-Done gate, not just a report.

```ts
// scripts/trace-bench.ts — run with: pnpm bench   (tsx scripts/trace-bench.ts)
import "dotenv/config";
import { runTrace } from "@/lib/db/queries/trace";
import { explainTrace } from "@/lib/db/explain";
import { pool } from "@/lib/db/pool";
import { DEMO_TLC } from "@/lib/config";

const N = 30;
const BUDGET_MS = 1000;

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  const tlc = process.argv[2] ?? DEMO_TLC;
  console.log(`\n=== Recall hero-query bench ===`);
  console.log(`TLC: ${tlc}   iterations: ${N}   budget(p50): ${BUDGET_MS}ms\n`);

  // Warm-up: load the embedding model + warm the connection/plan cache (NOT counted).
  const warm = await runTrace(tlc);
  console.log(
    `warm-up scope → lots=${warm.meta.lotCount} edges=${warm.meta.edgeCount} ` +
      `stores=${warm.meta.storeCount} totalUnits=${warm.meta.totalUnits} ` +
      `incidents=${warm.incidents.length}`,
  );

  const samples: number[] = [];
  for (let i = 0; i < N; i++) {
    const r = await runTrace(tlc);
    samples.push(r.meta.latencyMs);
  }
  samples.sort((a, b) => a - b);

  const p50 = pct(samples, 50);
  const p99 = pct(samples, 99);
  const min = samples[0];
  const max = samples[samples.length - 1];

  console.log(`\nlatency over ${N} runs (ms): min=${min} p50=${p50} p99=${p99} max=${max}`);

  // Full EXPLAIN (ANALYZE, BUFFERS) — the hero artifact for the submission screenshot.
  const { plan, nodes } = await explainTrace(tlc);
  console.log(`\n=== EXPLAIN (ANALYZE, BUFFERS) ===\n${plan}\n`);

  // Assert the three required superpowers are visible in the plan.
  const planLc = plan.toLowerCase();
  const hasRecursiveIndexScan =
    planLc.includes("recursive union") &&
    /index scan[^\n]*lot_links/.test(planLc); // index scan on lot_links inside the recursion
  const hasHnsw = planLc.includes("idx_incidents_hnsw");
  const hasGist = planLc.includes("idx_stores_geom") || planLc.includes("gist");
  const hasSeqScanOnHotPath =
    /seq scan[^\n]*lot_links/.test(planLc) || /seq scan[^\n]*shipments/.test(planLc);

  console.log(`required-node check:`);
  console.log(`  recursive Index Scan on lot_links : ${hasRecursiveIndexScan ? "OK" : "MISSING"}`);
  console.log(`  HNSW index scan (incidents)       : ${hasHnsw ? "OK" : "MISSING"}`);
  console.log(`  GiST spatial path (stores.geom)   : ${hasGist ? "OK" : "MISSING"}`);
  console.log(`  NO seq scan on lot_links/shipments: ${hasSeqScanOnHotPath ? "FAIL (seq scan!)" : "OK"}`);
  console.log(`  parsed nodes: ${nodes.map((n) => n.type).join(", ") || "(none parsed)"}`);

  await pool.end(); // bench is a one-shot script (NOT serverless) — closing the pool is correct here.

  const failures: string[] = [];
  if (p50 >= BUDGET_MS) failures.push(`p50 ${p50}ms >= budget ${BUDGET_MS}ms`);
  if (!hasRecursiveIndexScan) failures.push("recursive Index Scan on lot_links missing");
  if (!hasHnsw) failures.push("HNSW index scan missing");
  if (!hasGist) failures.push("GiST spatial path missing");
  if (hasSeqScanOnHotPath) failures.push("seq scan on hot path (lot_links/shipments)");

  if (failures.length) {
    console.error(`\nBENCH FAILED:\n  - ${failures.join("\n  - ")}\n`);
    process.exit(1);
  }
  console.log(`\nBENCH PASSED — p50 ${p50}ms < ${BUDGET_MS}ms, all required nodes present.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

---

### 3.5 Embedding dispatcher (consumed here; shipped in Phase 02)

`runTrace`, `explainTrace`, and the tests import `embed` from `@/lib/embeddings`. Phase 02 delivers the full pluggable dispatcher (local `@xenova/transformers` + Bedrock Titan). For reference, the local path it must satisfy — and the minimal stub to keep **this** phase GREEN if Phase 02 lags:

```ts
// lib/embeddings/index.ts  (full version lives in Phase 02 — shown for the contract this phase relies on)
import "server-only";
import { EMBED_PROVIDER, EMBED_DIM } from "@/lib/config";

export async function embed(text: string): Promise<number[]> {
  const vec =
    EMBED_PROVIDER === "bedrock"
      ? await (await import("./bedrock")).embedBedrock(text)
      : await (await import("./local")).embedLocal(text);
  if (vec.length !== EMBED_DIM) {
    throw new Error(`embed() returned dim ${vec.length}, expected EMBED_DIM=${EMBED_DIM}`);
  }
  return vec;
}
```

```ts
// lib/embeddings/local.ts — @xenova/transformers, Xenova/all-MiniLM-L6-v2 (384-dim), pure Node, zero credits.
import "server-only";

let extractorPromise: Promise<unknown> | null = null;

export async function embedLocal(text: string): Promise<number[]> {
  const { pipeline } = await import("@xenova/transformers");
  extractorPromise ??= pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  const extractor = (await extractorPromise) as (
    t: string,
    o: { pooling: "mean"; normalize: boolean },
  ) => Promise<{ data: Float32Array }>;
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(out.data); // length 384
}
```

> Test (a) and (b) below run on an **isolated fixture schema**, so they do **not** depend on the real seed and barely touch embeddings (they pass a zero-vector). Test (c) uses the real `embed`.

---

### 3.6 `test/trace.test.ts` — adversarial vitest suite

Three cases. (a) and (b) build a tiny **isolated** schema in a uniquely-named Postgres `search_path` schema (created and dropped per test) so they assert query *correctness* independent of the 250k-edge seed and run in milliseconds. (c) is the **latency-budget** assertion over the real seeded DB and is skipped automatically if the seed isn't present, so the suite is green on a fresh checkout but enforces the budget once seeded.

```ts
// test/trace.test.ts — run with: pnpm test  (vitest)
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { TRACE_SQL } from "@/lib/db/queries/trace";
import { runTrace } from "@/lib/db/queries/trace";
import { EMBED_DIM, DEMO_TLC } from "@/lib/config";

// A zero-vector of the right dim: valid for ::vector, deterministic, no model load needed.
const ZERO_VEC = `[${new Array(EMBED_DIM).fill(0).join(",")}]`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, ssl: false });

// Build a throwaway schema with the minimal tables the hero SQL touches.
async function makeFixtureSchema(schema: string) {
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await c.query(`SET search_path TO ${schema}, public`); // public has the postgis/vector extensions
    await c.query(`
      CREATE TABLE lots (
        lot_id bigint PRIMARY KEY, tlc text UNIQUE NOT NULL
      );
      CREATE TABLE lot_links (
        parent_lot_id bigint NOT NULL REFERENCES lots(lot_id),
        child_lot_id  bigint NOT NULL REFERENCES lots(lot_id),
        transform_event text NOT NULL,
        PRIMARY KEY (parent_lot_id, child_lot_id),
        CHECK (parent_lot_id <> child_lot_id)
      );
      CREATE TABLE stores (
        store_id bigint PRIMARY KEY, name text NOT NULL, chain text NOT NULL,
        address text NOT NULL, geom geography(Point,4326) NOT NULL
      );
      CREATE TABLE shipments (
        shipment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        lot_id bigint NOT NULL REFERENCES lots(lot_id),
        store_id bigint NOT NULL REFERENCES stores(store_id),
        units int NOT NULL CHECK (units > 0),
        shipped_at timestamptz NOT NULL
      );
      CREATE TABLE incidents (
        incident_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        reported_at timestamptz NOT NULL DEFAULT now(),
        raw_text text NOT NULL,
        embedding vector(${EMBED_DIM}),
        suspected_lot_id bigint REFERENCES lots(lot_id),
        pathogen text
      );
    `);
    return c;
  } catch (e) {
    c.release();
    throw e;
  }
}

// Run the hero SQL directly against a fixture schema (search_path scoped to that schema + public).
async function traceInFixture(schema: string, tlc: string) {
  const c = await pool.connect();
  try {
    await c.query(`SET search_path TO ${schema}, public`);
    await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const res = await c.query(TRACE_SQL, [tlc, ZERO_VEC, null]);
    await c.query("COMMIT");
    return res.rows[0];
  } finally {
    c.release();
  }
}

async function dropSchema(schema: string) {
  const c = await pool.connect();
  try {
    await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  } finally {
    c.release();
  }
}

afterAll(async () => {
  await pool.end();
});

describe("hero query — adversarial correctness", () => {
  // (a) CYCLE GUARD: a deliberately cyclic edge set must TERMINATE, not hang or over-report.
  it("(a) terminates on a deliberately cyclic edge set", async () => {
    const schema = `tracetest_cycle_${Date.now()}`;
    const setup = await makeFixtureSchema(schema);
    try {
      await setup.query(`
        INSERT INTO lots (lot_id, tlc) VALUES (1,'CYCLE-A'),(2,'CYCLE-B'),(3,'CYCLE-C');
        -- A -> B -> C -> A  (a real cycle; CHECK(parent<>child) only blocks self-loops)
        INSERT INTO lot_links (parent_lot_id, child_lot_id, transform_event) VALUES
          (1,2,'mix'),(2,3,'cook'),(3,1,'repack');
        INSERT INTO stores (store_id,name,chain,address,geom) VALUES
          (10,'S1','Chain','Addr', ST_SetSRID(ST_MakePoint(-73.9,40.7),4326)::geography);
        INSERT INTO shipments (lot_id, store_id, units, shipped_at) VALUES
          (1,10,5, now()), (2,10,7, now()), (3,10,3, now());
      `);
    } finally {
      setup.release();
    }

    try {
      // Must resolve quickly; the path-array visited-set + depth guard prevent infinite recursion.
      const row = (await Promise.race([
        traceInFixture(schema, "CYCLE-A"),
        new Promise((_, rej) => setTimeout(() => rej(new Error("TRACE HUNG — cycle guard failed")), 5000)),
      ])) as Record<string, unknown>;

      // 3 distinct lots reached exactly once each (no over-report from the cycle).
      expect(Number(row.lot_count)).toBe(3);
      // Each lot ships 1 line to store 10 → SUM(units) = 5+7+3 = 15, one store row, not inflated.
      const stores = (row.stores as { store_id: number; units: string }[]) ?? [];
      expect(stores).toHaveLength(1);
      expect(Number(stores[0].units)).toBe(15);
    } finally {
      await dropSchema(schema);
    }
  });

  // (b) CLEAN LOT: zero downstream shipments → clean EMPTY ARRAYS (after mapRow), not null, not error.
  it("(b) returns clean empty arrays for a lot with zero downstream shipments", async () => {
    const schema = `tracetest_clean_${Date.now()}`;
    const setup = await makeFixtureSchema(schema);
    try {
      await setup.query(`
        INSERT INTO lots (lot_id, tlc) VALUES (1,'LONELY-LOT');  -- no links, no shipments
      `);
    } finally {
      setup.release();
    }
    try {
      const row = (await traceInFixture(schema, "LONELY-LOT")) as Record<string, unknown>;
      // The seed lot itself is the only contaminated lot; no edges, no stores.
      expect(Number(row.lot_count)).toBe(1);
      // json_agg over empty CTEs is NULL at the SQL layer...
      expect(row.edges).toBeNull();
      expect(row.stores).toBeNull();
      // total_units coalesces to 0; store_count is 0.
      expect(Number(row.total_units)).toBe(0);
      expect(Number(row.store_count)).toBe(0);
      // ...and runTrace's mapRow MUST coalesce those nulls to []. Assert at the typed boundary too:
      const arr = (v: unknown) => v ?? [];
      expect(arr(row.edges)).toEqual([]);
      expect(arr(row.stores)).toEqual([]);
    } finally {
      await dropSchema(schema);
    }
  });

  // (c) LATENCY BUDGET: p50 < 1000ms over the real seeded DB. Skipped if the seed isn't loaded.
  it("(c) p50 < 1000ms over the seeded DB", async () => {
    const seeded = await pool.query("SELECT count(*)::int AS n FROM lot_links").then(
      (r) => r.rows[0].n as number,
      () => 0,
    );
    if (seeded < 100_000) {
      // No real seed in this environment (e.g. fresh checkout / CI without data) — skip cleanly.
      console.warn(`[trace.test] seed not present (lot_links=${seeded}); skipping latency budget.`);
      return;
    }
    const N = 11;
    const samples: number[] = [];
    for (let i = 0; i < N; i++) {
      const r = await runTrace(DEMO_TLC);
      samples.push(r.meta.latencyMs);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)];
    console.log(`[trace.test] DEMO_TLC p50 over ${N} runs = ${p50}ms`);
    expect(p50).toBeLessThan(1000);
  }, 60_000);
});
```

> **Why a fixture schema instead of mocking `pg`:** the bug we are guarding against (cycle non-termination, `json_agg` null) lives **in the SQL**, not in TS. Mocking the driver would test nothing. Running the real `TRACE_SQL` against a 3-row cyclic graph proves the `path` visited-set + depth guard actually terminate the recursion in Postgres. The fixture reuses `public`'s `postgis`/`vector` extensions, so `geography`/`vector` types resolve.

---

## 4. Key files

| Path | Purpose |
|---|---|
| `lib/config.ts` | `DEPLOY_TARGET`, `EMBED_PROVIDER`, `EMBED_DIM`, `AWS_REGION`, `DEMO_TLC`, `TRACE_MAX_DEPTH` — single env-read for the hero path (finalized this phase). |
| `lib/types.ts` | `TraceResult`, `Edge`, `AffectedStore`, `SimilarIncident`, `TraceMeta` — mirror the API response contract. |
| `lib/db/pool.ts` | **Module-scope `pg.Pool`** + `attachDatabasePool`; `DEPLOY_TARGET` branch (local `DATABASE_URL` vs aurora host/STS-token). |
| `lib/db/queries/trace.ts` | **`TRACE_SQL`** (verbatim hero SQL) + **`runTrace(tlc, opts)`** (SERIALIZABLE, embed, measure, retry, map) + `toVectorLiteral`. |
| `lib/db/explain.ts` | `explainTrace(tlc)` → live `EXPLAIN (ANALYZE, BUFFERS)` text + parsed nodes; reused by `/api/explain`. |
| `scripts/trace-bench.ts` | `pnpm bench` — N=30 latency p50/p99 + full EXPLAIN + required-node gate; exits non-zero on failure. |
| `test/trace.test.ts` | Adversarial vitest: (a) cycle terminates, (b) clean-lot empty arrays, (c) p50 < 1000ms. |
| `lib/embeddings/index.ts` | (Phase 02) `embed(text) → number[]` dispatcher consumed here. |

---

## 5. Definition of Done

> Run each command; the expected output must hold. **All boxes must be checked before any UI phase begins.**

- [ ] **Typecheck clean.**
  ```bash
  pnpm typecheck
  ```
  → `tsc --noEmit` exits 0, no errors.

- [ ] **Lint clean.**
  ```bash
  pnpm lint
  ```
  → no errors.

- [ ] **Tests green** (cycle guard, clean-lot empty arrays, latency budget).
  ```bash
  pnpm test
  ```
  → `test/trace.test.ts` passes. With the seed present, case (c) logs `DEMO_TLC p50 over 11 runs = <n>ms` and asserts `< 1000`. Without the seed it logs the skip notice and still passes.

- [ ] **Bench passes the gate** — p50 < 1s over ~250k edges, all three nodes present, no seq scan.
  ```bash
  pnpm bench
  ```
  → prints `latency over 30 runs (ms): min=… p50=… p99=… max=…` with **p50 < 1000**; the EXPLAIN dump shows a **Recursive Union** with an **Index Scan … on lot_links** inside it, an **idx_incidents_hnsw** scan, and an **idx_stores_geom** GiST path; ends with `BENCH PASSED`. Exit code 0.

- [ ] **Scope is real, not a toy** — the warm-up line shows `stores≈1400`, a real `edges` count, and `totalUnits` in the thousands for `DEMO_TLC`.

- [ ] **The on-screen latency will be a real measurement** — `runTrace` returns `meta.latencyMs` from `performance.now()` around the SQL only; nothing is hardcoded. Verify by eye that `meta.latencyMs` differs run-to-run in the bench output.

- [ ] **Manual EXPLAIN spot-check** (capture this for the submission screenshot later):
  ```bash
  pnpm bench 2>&1 | sed -n '/EXPLAIN/,/BENCH/p'
  ```
  → confirm with your own eyes: `Recursive Union`, `Index Scan using idx_lot_links_parent on lot_links`, `Index Scan using idx_incidents_hnsw`, `Index Scan using idx_stores_geom` (or a Bitmap/GiST path on `stores`). **No `Seq Scan on lot_links` or `Seq Scan on shipments`.**

- [ ] **BUILD_LOG.md entry appended** ([§8](#8-build_log-entry-to-append)).

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **Quadratic / cycling CTE** | `pnpm bench` hangs or p50 is multi-second; on camera the hero moment becomes a spinner | The SQL already carries `c.path \|\| ll.child_lot_id` (visited-set) + `child_lot_id <> ALL(c.path)` + `depth < TRACE_MAX_DEPTH`. Confirm the seed is **acyclic** (older→newer links only). Test (a) proves termination even on a real cycle. |
| **Seq scan on `lot_links` at each iteration** | EXPLAIN shows `Seq Scan on lot_links`; latency balloons | `idx_lot_links_parent` (forward) **and** `idx_lot_links_child` (backward) must exist (Phase 01). Run `ANALYZE lot_links;`. If the planner still picks seq scan on a tiny test set that's fine — the gate only fails on the **seeded** DB. |
| **Embedding dim mismatch** | `expected N dimensions, not M` from Postgres, or `toVectorLiteral` throws | Keep `EMBED_DIM` (config) = the migrated `vector(EMBED_DIM)` column = the provider output (local MiniLM = 384). The HNSW index is dim-locked; re-migrating the column requires a re-index. |
| **`json_agg` returns `null` for clean lots** | UI crashes mapping `null.map(...)`; or API returns `edges: null` | `mapRow` coalesces every `json_agg` result to `[]`. Never consume `row.edges` directly — always go through `runTrace`. Test (b) locks this. |
| **`SERIALIZABLE` 40001 mid-demo** | `could not serialize access due to read/write dependencies` during the live-ingest beat | `runTrace` retries up to 3× on `40001`. The whole txn is replayed (embedding is reused, not re-run). |
| **Pool client leaked / `too many clients already`** | Connections climb; Aurora rejects new connections under concurrency | Always `client.release()` in `finally`; **never** `client.end()` in serverless. `attachDatabasePool` drains idle clients on suspend. Bench is the one place `pool.end()` is correct (one-shot script). |
| **Latency counts model-load time** | First `runTrace` is seconds slower; p50 polluted | `embed()` runs **outside** `BEGIN…COMMIT`; the bench warm-up call absorbs the one-time model load. |
| **Cold scale-up (Aurora)** | First cloud query slow because the cluster scaled from 0 ACU | Pre-warm before recording (one trace), or set a small ACU floor for the demo window; not a local concern. |

---

## 7. Cut-if-scope-bites

If time is tight **within this phase**, you may trim in this order — but the spine of the phase is sacred:

1. **EXPLAIN node-parsing chips** (`parsePlanNodes`) — the bench can assert on the raw plan text via string match alone; the parsed `nodes[]` is a nicety for the Inspector. Keep the raw plan + the gate.
2. **The `aurora` branch in `pool.ts`** — can be stubbed until Phase 09, *as long as* the `local` branch is complete and the function-as-password shape is in place (so Phase 09 is a body-swap, not a rewrite). Do not delete it.
3. **Test (c) latency assertion in vitest** — `pnpm bench` already gates p50; (c) is redundant insurance. Keep (a) and (b) — they are correctness proofs, not perf.

> **NEVER cut** (per [CONVENTIONS.md §12](./CONVENTIONS.md#12-global-rules-every-phase)): the **recursive CTE**, the **PostGIS map JOIN**, the **pgvector rail subquery**, the **live `EXPLAIN`**, **real seed volume**, the **SERIALIZABLE isolation**, or the **real latency measurement**. The single statement that fuses recursion + geo + vector **is the product** — if any part of it is at risk, cut a *feature in a later phase*, never this query. And **do not start any UI phase until this one is GREEN.**

---

## 8. BUILD_LOG entry to append

````md
## Phase 03 — The hero query (THE PRODUCT) — <DATE>

**Outcome:** The one SERIALIZABLE recursive-CTE + PostGIS + pgvector statement is live and proven sub-second.

- `lib/db/pool.ts` — module-scope `pg.Pool` + `attachDatabasePool`; branches on `DEPLOY_TARGET`
  (local `DATABASE_URL`; aurora host + async RDS-IAM-token password via OIDC keyless — no static keys).
- `lib/db/queries/trace.ts` — `TRACE_SQL` (verbatim from CONVENTIONS §7) + `runTrace(tlc, opts)`:
  embeds outside the txn, runs inside `BEGIN ISOLATION LEVEL SERIALIZABLE`, retries 40001,
  measures real latency, coalesces `json_agg` nulls to `[]`, returns the typed `TraceResult`.
- `lib/db/explain.ts` — `explainTrace` runs `EXPLAIN (ANALYZE, BUFFERS)` over the same SQL+params.
- `scripts/trace-bench.ts` — N=30 p50/p99 + full EXPLAIN; gates on p50<1s and required nodes.
- `test/trace.test.ts` — (a) cyclic edge set terminates (cycle guard), (b) clean lot → empty arrays,
  (c) p50 < 1000ms over the seeded DB.

**Measured (local Docker Postgres, ~250k edges):**
- `DEMO_TLC` scope: lots=<N>, edges=<N>, stores≈1400, totalUnits=<N>.
- latency over 30 runs: min=<n> p50=<n> p99=<n> max=<n> ms  → **p50 < 1000ms ✅**
- EXPLAIN: Recursive Union → Index Scan using idx_lot_links_parent on lot_links (every iteration);
  Index Scan using idx_incidents_hnsw; idx_stores_geom GiST path. **No seq scan on the hot path.**

**Green:** `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ · `pnpm bench` ✅ (exit 0).

**Notes / decisions:** <e.g. ANALYZE'd lot_links to get index scans; EMBED_DIM=384 (local MiniLM);
aurora password fn stubbed until Phase 09; embedding moved outside the txn so model-load ≠ DB latency.>

**Next:** Phase 04 — wrap `runTrace`/`explainTrace` in zod-validated route handlers.
````

> The latency + EXPLAIN lines are **build-in-public gold** ([PHASE-12](./PHASE-12-build-in-public.md)): "one SQL statement, 250k edges, sub-second, here's the plan."

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract; **§7 (canonical hero query)**, **§9 (DB objects/indexes)**, **§10 (API response contract)**, **§4 (`DEPLOY_TARGET`)**, **§12 (global rules)**. Overrides everything.
- [`./README.md`](./README.md) — build index; the Golden Path and the spine-vs-polish priority.
- [`./PHASE-01-database-schema.md`](./PHASE-01-database-schema.md) — the tables + indexes this query depends on.
- [`./PHASE-02-seed-data.md`](./PHASE-02-seed-data.md) — the ~250k acyclic edges + real embeddings + the embedding dispatcher consumed here.
- [`./PHASE-04-api-layer.md`](./PHASE-04-api-layer.md) — wraps `runTrace`/`explainTrace` in zod-validated routes (unblocked by this phase).
- [`./PHASE-06-query-inspector.md`](./PHASE-06-query-inspector.md) — surfaces `TRACE_SQL` + the live EXPLAIN plan (unblocked by this phase).
- [`./PHASE-08-testing.md`](./PHASE-08-testing.md) — extends the adversarial suite (serializable scope-stability, FK integrity, vector relevance) + k6 load.
- [`./PHASE-09-aws-aurora.md`](./PHASE-09-aws-aurora.md) — completes the `aurora` branch of `pool.ts` (OIDC keyless, RDS IAM token).
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — §5.4 (hero query rationale), §13 (risk register: quadratic CTE, seq scans, connection exhaustion), §14 (test plan).
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — §4 (Fluid Compute pooling), §7 (SERIALIZABLE + 40001 retry).
- [`../reference/aws-databases.md`](../reference/aws-databases.md) — Aurora PG superpowers + the EXPLAIN screenshot-proof catalog.
