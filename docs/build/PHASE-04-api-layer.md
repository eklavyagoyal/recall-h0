# Phase 04 — API Layer

**Outcome:** Five zod-validated Route Handlers — `POST /api/trace`, `POST /api/explain`, `GET /api/lineage`, `GET /api/incidents`, `GET /api/metrics` — plus their supporting query modules (`lib/db/explain.ts`, `lib/db/queries/lineage.ts`, `lib/db/queries/incidents.ts`) and shared zod schemas (`lib/api/schemas.ts`). Every endpoint returns JSON matching the [API response contract](./CONVENTIONS.md#10-api-response-contract); `meta.latencyMs` is a **real server-measured** value; invalid input returns **HTTP 400** with a zod issue list.

**Depends on / Unblocks:** Depends on **[PHASE-03 — Hero Query](./PHASE-03-hero-query.md)** (provides `lib/db/queries/trace.ts` → `runTrace(tlc, asOf?)`, the `TRACE_SQL` string, and `lib/db/queries/trace.ts` param-building helpers) and **[PHASE-01](./PHASE-01-database-schema.md)** (the schema). Indirectly depends on **[PHASE-00](./PHASE-00-foundation.md)** (`lib/config.ts`, `lib/types.ts`, `lib/db/pool.ts`, `lib/embeddings/index.ts`). **Unblocks** **[PHASE-05 — Outbreak Console](./PHASE-05-outbreak-console.md)**, **[PHASE-06 — Query Inspector](./PHASE-06-query-inspector.md)**, and **[PHASE-07 — Supporting Screens](./PHASE-07-supporting-screens.md)**, which all fetch from these routes.

**Effort:** ~0.5–0.75 day.

---

## 1. Objectives

1. Expose the [hero query](./CONVENTIONS.md#7-canonical-hero-query-forward-trace) over HTTP as **`POST /api/trace`**, returning the exact `TraceResponse` contract — including `meta.latencyMs` measured **server-side** and the `sql` string surfaced for the Query Inspector.
2. Expose a live **`POST /api/explain`** that runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` over the hero query and returns the raw plan text **plus** parsed key nodes (Recursive Union, HNSW index scan, GiST spatial path) — the highest-leverage submission artifact.
3. Expose **`GET /api/lineage?storeId=|lotId=`** — the drill-down "one JOIN, four tables" trail across `lots × facilities × suppliers × shipments`.
4. Expose **`GET /api/incidents`** — the Incident Inbox feed plus pgvector self-similarity **clusters** (incidents grouped by a cosine-distance threshold).
5. Expose **`GET /api/metrics`** — recent trace-latency samples + the last row count, for the top-bar metrics chip.
6. Validate **every** request input with **zod**; return **400** with a structured error on failure. Keep **all DB credentials and SQL server-side**; the routes are the only network surface.
7. Handle serverless connection lifecycle correctly: reuse the module-scope `Pool` from `lib/db/pool.ts` (which already calls `attachDatabasePool`), **never** open a `new Pool`/`new Client` per request, and **always `release()`** any `connect()`-ed client in a `finally`.

> **Contract reminder (the protagonist is the DB):** these handlers are thin. They validate, call into `lib/db/...`, shape the JSON, and measure latency. **No business logic, no caching of the trace, no ORM.** The recursive CTE + PostGIS + pgvector statement does the work; the API just carries the result to the courtroom.

---

## 2. Prerequisites (checklist)

- [ ] **PHASE-00 done:** Next.js 15 App Router app at the repo root, TS strict, `pnpm typecheck`/`lint`/`test` GREEN. `lib/config.ts` exports `DEMO_TLC`, `EMBED_DIM`, `EMBED_PROVIDER`, `DEPLOY_TARGET`, `AWS_REGION`.
- [ ] **PHASE-01 done:** migrations applied; all 9 tables + indexes exist (verify `\d lot_links`, `\d stores`, `\d incidents`).
- [ ] **PHASE-02 done:** seed loaded; `DEMO_TLC` traces to ~1,400 stores. `SELECT count(*) FROM lot_links;` ≈ 250k.
- [ ] **PHASE-03 done and GREEN:** `lib/db/queries/trace.ts` exports:
  - `TRACE_SQL: string` — the canonical hero query string (the one surfaced to the inspector).
  - `runTrace(tlc: string, asOf?: string | null): Promise<TraceResult>` — runs the hero query inside `BEGIN ISOLATION LEVEL SERIALIZABLE`, measures latency with `performance.now()`, and returns a `TraceResult` (see `lib/types.ts`).
  - `buildTraceParams(tlc, asOf?): Promise<[string, string, string | null]>` — resolves the query embedding (via `lib/embeddings`) and returns the positional params `[$1=tlc, $2=embeddingVectorLiteral, $3=asOf]` for both `runTrace` and `EXPLAIN`. (If PHASE-03 named these differently, **align to PHASE-03** — that file is upstream of this one; do not fork the SQL.)
- [ ] `lib/db/pool.ts` exports a module-scope `pool` and has already called `attachDatabasePool(pool)` (per [CONVENTIONS §3](./CONVENTIONS.md#3-pinned-tech-stack)).
- [ ] `lib/types.ts` exports `TraceResult`, `Edge`, `AffectedStore`, `SimilarIncident` (PHASE-00/03).
- [ ] `zod` is installed (`pnpm add zod`) — it is a pinned dependency.

> **If PHASE-03 is not yet merged**, you can still write these files; just keep the `import` from `@/lib/db/queries/trace` matching the names PHASE-03 commits. The `runTrace`/`TRACE_SQL`/`buildTraceParams` names below are the canonical ones PHASE-03 must export.

---

## 3. Step-by-step

> All paths are repo-root-relative (the Next.js app lives at the root — see [CONVENTIONS §5](./CONVENTIONS.md#5-canonical-directory-tree)). Use the `@/` path alias (configured in `tsconfig.json` by PHASE-00).

### 3.1 Confirm the upstream `runTrace` contract (read-only)

Before writing routes, open `lib/db/queries/trace.ts` and confirm the exact signature. The routes below assume this shape (PHASE-03 owns it):

```ts
// lib/db/queries/trace.ts  — OWNED BY PHASE-03 (shown here for reference only; do NOT recreate)
import type { TraceResult } from "@/lib/types";

export const TRACE_SQL: string; // the canonical hero query string (CONVENTIONS §7), verbatim

// Resolves the embedding for the trace query and returns positional params for TRACE_SQL.
// $1 = tlc, $2 = pgvector literal e.g. '[0.1,0.2,...]', $3 = asOf ISO string or null.
export function buildTraceParams(
  tlc: string,
  asOf?: string | null,
): Promise<[string, string, string | null]>;

// Runs TRACE_SQL inside BEGIN ISOLATION LEVEL SERIALIZABLE; measures latency server-side.
export function runTrace(tlc: string, asOf?: string | null): Promise<TraceResult>;
```

And the `TraceResult` shape in `lib/types.ts` (PHASE-00/03 owns it). The route maps it 1:1 onto the contract:

```ts
// lib/types.ts  — OWNED BY PHASE-00/03 (reference)
export type Edge = { parent: number; child: number; transform: string };
export type AffectedStore = {
  storeId: number; name: string; chain: string; address: string;
  lat: number; lng: number; units: number;
};
export type SimilarIncident = {
  incidentId: number; text: string; pathogen: string | null; score: number;
};
export type TraceResult = {
  latencyMs: number;            // REAL measurement from runTrace
  lotCount: number;
  edgeCount: number;
  storeCount: number;
  totalUnits: number;
  asOf: string | null;
  edges: Edge[];
  stores: AffectedStore[];
  incidents: SimilarIncident[];
  sql: string;                  // === TRACE_SQL
};
```

> If `runTrace` returns a slightly different field set, the route's job is to **adapt** it to the contract in [§3.3](#33-postapitraceroutets), not to change `runTrace`. Keep the SQL single-sourced.

### 3.2 Shared zod schemas — `lib/api/schemas.ts`

One file holds every input schema and a single 400-formatting helper, so every route validates identically.

```bash
mkdir -p lib/api lib/db/queries
```

```ts
// lib/api/schemas.ts
import { z } from "zod";

/**
 * A Traceability Lot Code (FSMA-204). We keep validation permissive on charset
 * (lots can be alphanumeric with dashes) but bound the length so a giant string
 * can't be used to probe the DB. The DEMO_TLC is e.g. "PRD-OUTBREAK-0001".
 */
export const tlcSchema = z
  .string()
  .trim()
  .min(1, "tlc is required")
  .max(128, "tlc is too long")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "tlc has invalid characters");

/** Optional point-in-time bound for the trace (sh.shipped_at <= asOf). */
const asOfSchema = z
  .string()
  .datetime({ offset: true })
  .nullish()
  .transform((v) => v ?? null);

/** POST /api/trace  body */
export const traceBodySchema = z.object({
  tlc: tlcSchema,
  asOf: asOfSchema.optional(),
});
export type TraceBody = z.infer<typeof traceBodySchema>;

/** POST /api/explain  body */
export const explainBodySchema = z.object({
  tlc: tlcSchema,
  asOf: asOfSchema.optional(),
});
export type ExplainBody = z.infer<typeof explainBodySchema>;

/**
 * GET /api/lineage  query — exactly ONE of storeId | lotId is required.
 * Coerce from string query params; enforce positive integers.
 */
const idParam = z.coerce.number().int().positive();
export const lineageQuerySchema = z
  .object({
    storeId: idParam.optional(),
    lotId: idParam.optional(),
  })
  .refine(
    (q) => (q.storeId === undefined) !== (q.lotId === undefined),
    { message: "provide exactly one of storeId or lotId" },
  );
export type LineageQuery = z.infer<typeof lineageQuerySchema>;

/** GET /api/incidents  query — optional cluster tuning + paging caps. */
export const incidentsQuerySchema = z.object({
  // cosine-distance threshold below which two incidents are "the same cluster".
  threshold: z.coerce.number().min(0).max(2).optional().default(0.25),
  limit: z.coerce.number().int().positive().max(500).optional().default(200),
});
export type IncidentsQuery = z.infer<typeof incidentsQuerySchema>;

/** GET /api/metrics query — how many recent samples to return. */
export const metricsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;

/** Uniform 400 body for any failed parse. */
export function badRequest(error: z.ZodError) {
  return Response.json(
    {
      error: "invalid_input",
      issues: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 400 },
  );
}

/** Uniform 500 body that never leaks DB internals (only a SQLSTATE if present). */
export function serverError(e: unknown) {
  const code =
    e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : undefined;
  // Log the full error server-side only; the client gets a safe shape.
  console.error("[api] handler error", e);
  return Response.json(
    { error: "trace_failed", sqlstate: code ?? null },
    { status: 500 },
  );
}
```

> **Why `z.coerce` for query params:** `URLSearchParams` values are always strings; `z.coerce.number()` turns `"42"` into `42` and rejects `"abc"` with a clean 400. **Why the regex on `tlc`:** the value is bound to `$1` as a parameter (never string-concatenated into SQL), so injection is already impossible — but bounding charset + length is cheap defense-in-depth and gives a friendlier 400 than a downstream type error.

### 3.3 `POST /api/trace/route.ts`

The hero endpoint. It validates, calls `runTrace` (which measures latency inside the SERIALIZABLE transaction), and maps the `TraceResult` onto the wire contract. **Never cached.**

```ts
// app/api/trace/route.ts
import { traceBodySchema, badRequest, serverError } from "@/lib/api/schemas";
import { runTrace } from "@/lib/db/queries/trace";

// The recall scope must never be stale — freshness is the product (CONVENTIONS §12).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_input", issues: [{ path: "", message: "body must be JSON" }] },
      { status: 400 },
    );
  }

  const parsed = traceBodySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);

  const { tlc, asOf } = parsed.data;

  try {
    // runTrace measures latencyMs server-side via performance.now() around the
    // SERIALIZABLE transaction — this is the number that goes on the top bar.
    const r = await runTrace(tlc, asOf ?? null);

    return Response.json(
      {
        meta: {
          latencyMs: r.latencyMs, // REAL measurement — never hardcoded
          lotCount: r.lotCount,
          edgeCount: r.edgeCount,
          storeCount: r.storeCount,
          totalUnits: r.totalUnits,
          asOf: r.asOf,
        },
        edges: r.edges,         // Edge[]            -> the graph (the recursion)
        stores: r.stores,       // AffectedStore[]   -> the map (the geo JOIN)
        incidents: r.incidents, // SimilarIncident[] -> the rail (the vector search)
        sql: r.sql,             // === TRACE_SQL, surfaced to the Query Inspector
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return serverError(e);
  }
}
```

> **Empty / clean-lot is a 200, not an error.** A TLC with no downstream shipments returns `storeCount: 0`, `stores: []`, `edges: []` — the UI renders the "clean lot — no shelves at risk" state. Only a query/connection failure is a 500.

### 3.4 `lib/db/explain.ts`

Runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` over the **same** `TRACE_SQL` (single-sourced from PHASE-03), then parses the plan text into the key nodes the Query Inspector highlights. `EXPLAIN ANALYZE` **executes** the query, so we run it inside a transaction we `ROLLBACK` to avoid any side effects and to keep the read consistent.

```ts
// lib/db/explain.ts
import { pool } from "@/lib/db/pool";
import { TRACE_SQL, buildTraceParams } from "@/lib/db/queries/trace";

export type PlanNode = { type: string; detail: string };

export type ExplainResult = {
  plan: string;        // full EXPLAIN (ANALYZE, BUFFERS) text
  nodes: PlanNode[];   // parsed key nodes for the inspector
};

/**
 * Patterns we surface as "the three superpowers + the recursion": the Recursive
 * Union node, the index scans at each recursive hop (idx_lot_links_*), the HNSW
 * vector index scan, and the GiST spatial path. Order matters for display.
 */
const NODE_MATCHERS: { type: string; test: RegExp }[] = [
  { type: "Recursive Union", test: /Recursive Union/i },
  { type: "WorkTable Scan", test: /WorkTable Scan/i },
  { type: "Index Scan (lot_links)", test: /Index .*Scan.* (idx_lot_links_parent|idx_lot_links_child|lot_links)/i },
  { type: "Index Scan (shipments)", test: /Index .*Scan.* (idx_shipments_lot|idx_shipments_store|shipments)/i },
  { type: "HNSW Index Scan (incidents.embedding)", test: /Index Scan using idx_incidents_hnsw|hnsw/i },
  { type: "GiST Spatial (stores.geom)", test: /idx_stores_geom|gist|GeomFrom|ST_/i },
  { type: "Aggregate", test: /\bAggregate\b|HashAggregate|GroupAggregate/i },
  { type: "Seq Scan (WARNING — should not be on the hot path)", test: /Seq Scan on (lot_links|shipments|stores|incidents)/i },
];

/**
 * Parse the FORMAT TEXT plan line-by-line. We keep the first matching line for
 * each node type (with its indentation trimmed) so the inspector shows a tidy
 * "these nodes fired" list alongside the raw plan.
 */
function parsePlan(plan: string): PlanNode[] {
  const lines = plan.split("\n");
  const found: PlanNode[] = [];
  const seen = new Set<string>();
  for (const { type, test } of NODE_MATCHERS) {
    const line = lines.find((l) => test.test(l));
    if (line && !seen.has(type)) {
      seen.add(type);
      found.push({ type, detail: line.trim() });
    }
  }
  return found;
}

/**
 * Run EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) on the hero query. Uses a single
 * pooled client, wraps in BEGIN/ROLLBACK so the ANALYZE execution leaves no trace,
 * and ALWAYS releases the client (serverless connection hygiene).
 */
export async function explainTrace(tlc: string, asOf?: string | null): Promise<ExplainResult> {
  const params = await buildTraceParams(tlc, asOf ?? null);
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const res = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT) ${TRACE_SQL}`,
      params,
    );
    await client.query("ROLLBACK"); // ANALYZE ran the query; discard the txn
    const plan = res.rows.map((r) => r["QUERY PLAN"] as string).join("\n");
    return { plan, nodes: parsePlan(plan) };
  } catch (e) {
    // best-effort rollback; ignore secondary errors
    try {
      await client.query("ROLLBACK");
    } catch {
      /* noop */
    }
    throw e;
  } finally {
    client.release(); // return to pool — never close in serverless
  }
}
```

> **Why `ROLLBACK`:** `EXPLAIN ANALYZE` actually executes the statement to collect real timing/buffers. The hero query is read-only, so there's nothing to undo — but wrapping in a transaction we roll back keeps it tidy, isolates the read, and means a future write-bearing variant stays safe. The exact node-type strings depend on the Postgres/pgvector/PostGIS version; the matchers above are forgiving (regex over the line) so they survive minor planner wording changes. **Verify against a real plan** in the DoD ([§5](#5-definition-of-done)).

### 3.5 `POST /api/explain/route.ts`

```ts
// app/api/explain/route.ts
import { explainBodySchema, badRequest, serverError } from "@/lib/api/schemas";
import { explainTrace } from "@/lib/db/explain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_input", issues: [{ path: "", message: "body must be JSON" }] },
      { status: 400 },
    );
  }

  const parsed = explainBodySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);

  const { tlc, asOf } = parsed.data;

  try {
    const { plan, nodes } = await explainTrace(tlc, asOf ?? null);
    return Response.json({ plan, nodes }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
```

### 3.6 `lib/db/queries/lineage.ts`

The drill-down: "one JOIN, four tables." Given a `storeId` **or** a `lotId`, return the parent/child trail of `lot → facility → supplier → shipment → units → shippedAt`. This is RAW parameterized SQL (no ORM), keyed by the node id.

```ts
// lib/db/queries/lineage.ts
import { pool } from "@/lib/db/pool";

export type LineageRow = {
  lot: string;        // lots.tlc
  facility: string;   // facilities.name
  supplier: string;   // suppliers.name
  shipment: number;   // shipments.shipment_id
  units: number;      // shipments.units
  shippedAt: string;  // shipments.shipped_at (ISO)
};

/**
 * Lineage for a STORE: every implicated lot this store received, joined up to
 * its producing facility and originating supplier. One statement, four tables.
 */
const LINEAGE_BY_STORE_SQL = /* sql */ `
  SELECT
    lo.tlc                       AS lot,
    fa.name                      AS facility,
    su.name                      AS supplier,
    sh.shipment_id               AS shipment,
    sh.units                     AS units,
    sh.shipped_at                AS "shippedAt"
  FROM shipments sh
  JOIN lots       lo ON lo.lot_id      = sh.lot_id
  JOIN facilities fa ON fa.facility_id = lo.facility_id
  JOIN suppliers  su ON su.supplier_id = fa.supplier_id
  WHERE sh.store_id = $1
  ORDER BY sh.shipped_at DESC
  LIMIT 500
`;

/**
 * Lineage for a LOT: every store shipment of this lot, with the same
 * facility/supplier provenance. Keyed by lots.lot_id.
 */
const LINEAGE_BY_LOT_SQL = /* sql */ `
  SELECT
    lo.tlc                       AS lot,
    fa.name                      AS facility,
    su.name                      AS supplier,
    sh.shipment_id               AS shipment,
    sh.units                     AS units,
    sh.shipped_at                AS "shippedAt"
  FROM lots lo
  JOIN facilities fa ON fa.facility_id = lo.facility_id
  JOIN suppliers  su ON su.supplier_id = fa.supplier_id
  LEFT JOIN shipments sh ON sh.lot_id   = lo.lot_id
  WHERE lo.lot_id = $1
  ORDER BY sh.shipped_at DESC NULLS LAST
  LIMIT 500
`;

function normalize(rows: Record<string, unknown>[]): LineageRow[] {
  return rows
    .filter((r) => r.shipment !== null) // a lot with no shipments yields one all-null row from the LEFT JOIN
    .map((r) => ({
      lot: String(r.lot),
      facility: String(r.facility),
      supplier: String(r.supplier),
      shipment: Number(r.shipment),
      units: Number(r.units),
      shippedAt: new Date(r.shippedAt as string).toISOString(),
    }));
}

export async function lineageByStore(storeId: number): Promise<LineageRow[]> {
  const { rows } = await pool.query(LINEAGE_BY_STORE_SQL, [storeId]);
  return normalize(rows);
}

export async function lineageByLot(lotId: number): Promise<LineageRow[]> {
  const { rows } = await pool.query(LINEAGE_BY_LOT_SQL, [lotId]);
  return normalize(rows);
}
```

> **`pool.query(text, params)` vs `pool.connect()`:** lineage is a single statement, so we use `pool.query` directly — `node-postgres` checks out a client, runs the query, and **auto-releases** it. We only `connect()` + manual `release()` when we need a multi-statement transaction (the trace and the explain). Both paths respect the module-scope pool + `attachDatabasePool` lifecycle.

### 3.7 `GET /api/lineage/route.ts`

```ts
// app/api/lineage/route.ts
import { lineageQuerySchema, badRequest, serverError } from "@/lib/api/schemas";
import { lineageByStore, lineageByLot } from "@/lib/db/queries/lineage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = lineageQuerySchema.safeParse({
    storeId: url.searchParams.get("storeId") ?? undefined,
    lotId: url.searchParams.get("lotId") ?? undefined,
  });
  if (!parsed.success) return badRequest(parsed.error);

  const { storeId, lotId } = parsed.data;

  try {
    const trail =
      storeId !== undefined
        ? await lineageByStore(storeId)
        : await lineageByLot(lotId!);

    return Response.json({ trail }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
```

### 3.8 `lib/db/queries/incidents.ts`

The Inbox feed + pgvector **self-similarity clustering**. We group incidents whose embeddings are within a cosine-distance `threshold` of each other, sharing a pathogen signature — "these N reports may be one outbreak." This is genuine vector work (cosine distance `<=>` over the HNSW index), not a `LIKE`.

We use a single statement that, for each incident, finds its nearest same-pathogen neighbor within the threshold and assigns a cluster key. A simple, deterministic clustering: the cluster label is the **lowest `incident_id`** reachable as a near neighbor, computed via a lateral nearest-neighbor join. This is intentionally lightweight (the full transitive clustering is precomputed into `incident_lot_matches` at ingest per the data model — see [01-recall.md §5.3](../deep-dives/01-recall.md#53-access-pattern--keyquery-table)); here we surface a live, legible grouping for the inbox badge.

```ts
// lib/db/queries/incidents.ts
import { pool } from "@/lib/db/pool";
import type { SimilarIncident } from "@/lib/types";

export type IncidentRow = SimilarIncident & {
  pathogen: string | null;
  reportedAt: string;
  clusterKey: number; // lowest incident_id in this incident's near-neighborhood
};

export type Cluster = { label: string; incidentIds: number[]; size: number };

/**
 * For each incident, find the smallest incident_id among its same-pathogen
 * neighbors within `threshold` cosine distance (including itself). That id is the
 * cluster key. The HNSW index serves the `<=>` nearest-neighbor probe per row.
 *
 * $1 = cosine-distance threshold (e.g. 0.25)
 * $2 = max incidents to return
 */
const INCIDENTS_SQL = /* sql */ `
  WITH base AS (
    SELECT
      i.incident_id,
      i.raw_text,
      i.pathogen,
      i.reported_at,
      i.embedding
    FROM incidents i
    WHERE i.embedding IS NOT NULL
    ORDER BY i.reported_at DESC
    LIMIT $2
  ),
  clustered AS (
    SELECT
      b.incident_id,
      b.raw_text,
      b.pathogen,
      b.reported_at,
      COALESCE(
        (
          SELECT MIN(n.incident_id)
          FROM incidents n
          WHERE n.embedding IS NOT NULL
            AND n.incident_id <> b.incident_id
            AND (n.pathogen IS NOT DISTINCT FROM b.pathogen)
            AND (n.embedding <=> b.embedding) <= $1
        ),
        b.incident_id
      ) AS neighbor_min,
      b.incident_id AS self_id
    FROM base b
  )
  SELECT
    incident_id,
    raw_text,
    pathogen,
    reported_at,
    LEAST(neighbor_min, self_id) AS cluster_key
  FROM clustered
  ORDER BY reported_at DESC
`;

export async function getIncidents(
  threshold: number,
  limit: number,
): Promise<{ incidents: IncidentRow[]; clusters: Cluster[] }> {
  const { rows } = await pool.query(INCIDENTS_SQL, [threshold, limit]);

  const incidents: IncidentRow[] = rows.map((r) => ({
    incidentId: Number(r.incident_id),
    text: String(r.raw_text),
    pathogen: r.pathogen === null ? null : String(r.pathogen),
    score: 1, // inbox feed entries are not scored against a query; 1 = listed
    reportedAt: new Date(r.reported_at).toISOString(),
    clusterKey: Number(r.cluster_key),
  }));

  // Group by clusterKey; only keep multi-member groups as "clusters" (a badge).
  const byKey = new Map<number, IncidentRow[]>();
  for (const inc of incidents) {
    const arr = byKey.get(inc.clusterKey) ?? [];
    arr.push(inc);
    byKey.set(inc.clusterKey, arr);
  }

  const clusters: Cluster[] = [...byKey.values()]
    .filter((group) => group.length > 1) // a cluster needs ≥2 incidents
    .map((group) => {
      const pathogens = [...new Set(group.map((g) => g.pathogen).filter(Boolean))];
      const label =
        pathogens.length === 1 ? `Possible ${pathogens[0]} cluster` : "Possible outbreak cluster";
      return {
        label,
        incidentIds: group.map((g) => g.incidentId),
        size: group.length,
      };
    })
    .sort((a, b) => b.size - a.size);

  return { incidents, clusters };
}
```

> **Why same-pathogen + threshold:** the demo narrative is "pgvector clustered three differently-worded reports as one pathogen signature **before** anyone connected them" ([01-recall.md §4.2](../deep-dives/01-recall.md#42-screen-by-screen-breakdown)). `pathogen IS NOT DISTINCT FROM` lets `NULL` pathogens cluster with each other. The correlated subquery does an HNSW-backed `<=>` probe per base row over a capped `LIMIT $2` set, so it stays fast for the inbox. If `EXPLAIN` shows this going quadratic at scale, cap `LIMIT` lower or move clustering to the precomputed `incident_lot_matches` path — but for the ~2k incident corpus this is sub-second.

### 3.9 `GET /api/incidents/route.ts`

```ts
// app/api/incidents/route.ts
import { incidentsQuerySchema, badRequest, serverError } from "@/lib/api/schemas";
import { getIncidents } from "@/lib/db/queries/incidents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = incidentsQuerySchema.safeParse({
    threshold: url.searchParams.get("threshold") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return badRequest(parsed.error);

  const { threshold, limit } = parsed.data;

  try {
    const { incidents, clusters } = await getIncidents(threshold, limit);
    // The inbox is eventually-consistent triage — short cache + tag so a future
    // ingest can revalidateTag('inbox'). The trace stays no-store; this can cache.
    return Response.json(
      { clusters, incidents },
      { headers: { "Cache-Control": "private, max-age=10" } },
    );
  } catch (e) {
    return serverError(e);
  }
}
```

> The response field order is `{ clusters, incidents }` to match the [contract](./CONVENTIONS.md#10-api-response-contract). Note the route maps the richer `IncidentRow` down to the contract's `SimilarIncident` shape implicitly via JSON — the extra `reportedAt`/`clusterKey` fields are additive and harmless to consumers, but if PHASE-05/07 wants the strict shape, strip them here. Keep it additive unless a consumer complains.

### 3.10 `lib/db/queries/incidents.ts` — metrics helper (or a tiny `lib/db/metrics.ts`)

`GET /api/metrics` returns recent trace-latency **samples** and the `lastRowCount`. There are two honest sources; pick whichever PHASE-03/05 wired:

- **(A) Persisted (preferred for the "designed for scale" story):** PHASE-03's `runTrace` inserts a row into a small `trace_metrics(ts timestamptz, latency_ms int, row_count int)` table after each trace. The metrics route reads the last N. This survives across function instances and is real history.
- **(B) In-memory ring buffer:** a module-scope array appended by `runTrace`. Simpler, but **per-instance** (Fluid Compute may have several warm instances, so samples look sparse) and lost on cold start. Acceptable for the spine; note the caveat on camera-honesty (don't claim it's global).

This phase ships **(A)** if the `trace_metrics` table exists (add it in PHASE-01/03), else falls back to **(B)**. Put the read in `lib/db/queries/metrics.ts`:

```ts
// lib/db/queries/metrics.ts
import { pool } from "@/lib/db/pool";

export type MetricSample = { ts: string; latencyMs: number };

// In-memory fallback ring buffer (per function instance). PHASE-03's runTrace may
// push here as a belt-and-braces source if the trace_metrics table is absent.
const RING: MetricSample[] = [];
const RING_MAX = 200;
export function recordSample(latencyMs: number) {
  RING.push({ ts: new Date().toISOString(), latencyMs });
  if (RING.length > RING_MAX) RING.shift();
}

const SAMPLES_SQL = /* sql */ `
  SELECT ts, latency_ms
  FROM trace_metrics
  ORDER BY ts DESC
  LIMIT $1
`;
const LAST_ROWCOUNT_SQL = /* sql */ `
  SELECT row_count
  FROM trace_metrics
  ORDER BY ts DESC
  LIMIT 1
`;

async function tableExists(): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT to_regclass('public.trace_metrics') IS NOT NULL AS present",
  );
  return Boolean(rows[0]?.present);
}

export async function getMetrics(
  limit: number,
): Promise<{ samples: MetricSample[]; lastRowCount: number }> {
  if (await tableExists()) {
    const [{ rows: sampleRows }, { rows: lastRows }] = await Promise.all([
      pool.query(SAMPLES_SQL, [limit]),
      pool.query(LAST_ROWCOUNT_SQL),
    ]);
    return {
      samples: sampleRows
        .map((r) => ({ ts: new Date(r.ts).toISOString(), latencyMs: Number(r.latency_ms) }))
        .reverse(), // oldest → newest for charting
      lastRowCount: lastRows[0] ? Number(lastRows[0].row_count) : 0,
    };
  }
  // Fallback: the in-memory ring buffer.
  const samples = RING.slice(-limit);
  return { samples, lastRowCount: 0 };
}
```

> The optional `trace_metrics` DDL (add to `db/migrations/0002_schema.sql` in PHASE-01, or a small forward migration):
> ```sql
> CREATE TABLE IF NOT EXISTS trace_metrics (
>   ts         timestamptz NOT NULL DEFAULT now(),
>   latency_ms int NOT NULL,
>   row_count  int NOT NULL
> );
> CREATE INDEX IF NOT EXISTS idx_trace_metrics_ts ON trace_metrics(ts DESC);
> ```
> If you add it, have PHASE-03's `runTrace` do a fire-and-forget `INSERT INTO trace_metrics(latency_ms, row_count) VALUES ($1,$2)` (don't block the response on it; wrap in a `.catch(() => {})`). **Anti-fake rule:** every sample is a real measured latency from an actual trace — never synthetic.

### 3.11 `GET /api/metrics/route.ts`

```ts
// app/api/metrics/route.ts
import { metricsQuerySchema, badRequest, serverError } from "@/lib/api/schemas";
import { getMetrics } from "@/lib/db/queries/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = metricsQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const { samples, lastRowCount } = await getMetrics(parsed.data.limit);
    return Response.json({ samples, lastRowCount }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError(e);
  }
}
```

### 3.12 Make every route Node-runtime (not Edge)

`pg` and `@xenova/transformers` need the Node.js runtime. Each route already exports `export const runtime = "nodejs"`. Confirm `vercel.json` keeps `app/**` on `nodejs24.x` (or the pinned LTS) and `fluid: true` — this is set in PHASE-00/PHASE-10, not here, but the routes assume it.

### 3.13 Run it locally

```bash
pnpm db:up          # ensure local Postgres is running
pnpm dev            # http://localhost:3000
```

Then exercise every endpoint (see DoD curl examples in [§5](#5-definition-of-done)).

---

## 4. Key files

| Path | Purpose |
|---|---|
| `lib/api/schemas.ts` | All zod input schemas + `badRequest`/`serverError` helpers (one validation surface). |
| `app/api/trace/route.ts` | `POST` hero endpoint → `runTrace` → `TraceResponse` with real `meta.latencyMs` + `sql`. |
| `app/api/explain/route.ts` | `POST` → `explainTrace` → `{ plan, nodes }` (live `EXPLAIN ANALYZE`). |
| `lib/db/explain.ts` | Runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` over `TRACE_SQL`; parses key plan nodes. |
| `app/api/lineage/route.ts` | `GET ?storeId=|lotId=` → `{ trail }` (one JOIN, four tables). |
| `lib/db/queries/lineage.ts` | RAW parameterized lineage JOIN across `lots × facilities × suppliers × shipments`. |
| `app/api/incidents/route.ts` | `GET` → `{ clusters, incidents }` (pgvector self-similarity grouping + feed). |
| `lib/db/queries/incidents.ts` | Inbox feed + cosine-distance clustering over `incidents.embedding` (HNSW). |
| `app/api/metrics/route.ts` | `GET` → `{ samples, lastRowCount }` (real measured latency history). |
| `lib/db/queries/metrics.ts` | Reads `trace_metrics` (or in-memory ring fallback); `recordSample` hook for `runTrace`. |

---

## 5. Definition of Done

Each item has an exact command and expected output. The phase ends **GREEN** only when all pass.

- [ ] **Typecheck / lint / test GREEN.**
  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  ```
  Expected: `tsc --noEmit` → 0 errors; `next lint` → clean; `vitest` → existing suite passes.

- [ ] **`POST /api/trace` returns the contract with a REAL latency.**
  ```bash
  curl -sS -X POST http://localhost:3000/api/trace \
    -H 'content-type: application/json' \
    -d '{"tlc":"PRD-OUTBREAK-0001"}' | jq '{meta, edgeCount: (.edges|length), storeCount: (.stores|length), incidentCount: (.incidents|length), sqlLen: (.sql|length)}'
  ```
  Expected: `meta.latencyMs` is a positive integer (and varies across runs — proof it's measured, not hardcoded); `meta.storeCount` ≈ 1400; `meta.edgeCount` > 0; `.sql` is the full hero query string (length > 500). Run it twice and confirm `latencyMs` differs.

- [ ] **`POST /api/trace` clean-lot is a 200 with empty arrays (not a crash).**
  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/trace \
    -H 'content-type: application/json' -d '{"tlc":"PRD-DOES-NOT-EXIST-9999"}'
  ```
  Expected: `200`. The body has `meta.storeCount: 0`, `stores: []`, `edges: []`.

- [ ] **Invalid input → 400 via zod.**
  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/trace \
    -H 'content-type: application/json' -d '{"tlc":""}'
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/trace \
    -H 'content-type: application/json' -d '{"asOf":"not-a-date","tlc":"PRD-OUTBREAK-0001"}'
  curl -sS -X POST http://localhost:3000/api/trace -H 'content-type: application/json' -d 'not json' | jq .error
  ```
  Expected: `400`, `400`, and `"invalid_input"`. The first 400 body lists a zod issue with `path: "tlc"`.

- [ ] **`POST /api/explain` returns plan text + parsed nodes including the three superpowers.**
  ```bash
  curl -sS -X POST http://localhost:3000/api/explain \
    -H 'content-type: application/json' \
    -d '{"tlc":"PRD-OUTBREAK-0001"}' | jq '{nodes: [.nodes[].type], hasRecursive: (.plan|test("Recursive Union")), hasHNSW: (.plan|test("idx_incidents_hnsw|hnsw"; "i"))}'
  ```
  Expected: `nodes` includes `"Recursive Union"`, an `"Index Scan (lot_links)"` entry, `"HNSW Index Scan (incidents.embedding)"`, and a `"GiST Spatial (stores.geom)"` entry; `hasRecursive` and `hasHNSW` are `true`. **Confirm NO `"Seq Scan (WARNING…)"` node appears** on the hot tables (if it does, fix indexes/seed in PHASE-01/02 before proceeding).

- [ ] **`GET /api/lineage?storeId=` returns a four-table trail.**
  ```bash
  # grab a real store id from a trace, then:
  SID=$(curl -sS -X POST http://localhost:3000/api/trace -H 'content-type: application/json' -d '{"tlc":"PRD-OUTBREAK-0001"}' | jq '.stores[0].storeId')
  curl -sS "http://localhost:3000/api/lineage?storeId=$SID" | jq '.trail[0]'
  ```
  Expected: a row with non-empty `lot`, `facility`, `supplier`, numeric `shipment`, numeric `units`, and an ISO `shippedAt`.

- [ ] **`GET /api/lineage` rejects zero or both params with 400.**
  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' "http://localhost:3000/api/lineage"
  curl -sS -o /dev/null -w '%{http_code}\n' "http://localhost:3000/api/lineage?storeId=1&lotId=2"
  ```
  Expected: `400` for both (the `refine` enforces exactly one).

- [ ] **`GET /api/incidents` returns clusters + feed.**
  ```bash
  curl -sS "http://localhost:3000/api/incidents" | jq '{clusterCount: (.clusters|length), firstCluster: .clusters[0], incidentCount: (.incidents|length)}'
  ```
  Expected: `incidentCount` > 0; at least one cluster with `size >= 2` and a `label` like `"Possible <pathogen> cluster"` (the seed includes ≥1 deliberate cluster of differently-worded same-pathogen reports — confirm with PHASE-02).

- [ ] **`GET /api/metrics` returns measured samples.**
  ```bash
  # fire two traces first so there is history, then:
  curl -sS http://localhost:3000/api/metrics | jq '{n: (.samples|length), lastRowCount, latest: .samples[-1]}'
  ```
  Expected: `samples` non-empty, each with an ISO `ts` and positive integer `latencyMs`; `lastRowCount` ≥ 0 (and = the affected-store count if the `trace_metrics` path is wired).

- [ ] **No leaked credentials / no static AWS keys.**
  ```bash
  grep -rEn 'AWS_SECRET_ACCESS_KEY|AKIA[0-9A-Z]{16}' app lib || echo "OK: no static AWS keys"
  ```
  Expected: `OK: no static AWS keys`. (Creds resolve via OIDC server-side only; routes never touch them directly.)

- [ ] **No per-request pool creation.**
  ```bash
  grep -rEn 'new Pool|new Client' app lib | grep -v 'lib/db/pool.ts' || echo "OK: single module-scope pool"
  ```
  Expected: `OK: single module-scope pool` (the only `new Pool` lives in `lib/db/pool.ts`).

- [ ] **Run the app and verify behavior** (CONVENTIONS global rule): with `pnpm dev` running, hit all five endpoints above, confirm JSON shapes match the contract, and confirm `latencyMs` changes between trace runs. Append the BUILD_LOG entry ([§8](#8-build_log-entry-to-append)).

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **Opening a pool/client per request** | `too many clients already` under any concurrency; the #1 Vercel+Aurora demo-killer | Import the **module-scope** `pool` from `@/lib/db/pool`; never `new Pool` in a route. Use `pool.query` for single statements; `pool.connect()` + `finally release()` only for transactions. |
| **Leaking a checked-out client** | Connections slowly exhaust after several `/api/explain` calls | Every `pool.connect()` must `release()` in a `finally`. `explainTrace` and `runTrace` both do; mirror the pattern in any new transaction. |
| **Hardcoding latency** | `meta.latencyMs` constant across runs (anti-fake violation) | `latencyMs` comes from `runTrace`'s `performance.now()` delta around the SERIALIZABLE txn — never a literal. The DoD checks it varies. |
| **Edge runtime selected** | `pg` import fails at build/runtime ("Module not found: net/tls") | Every route exports `export const runtime = "nodejs"`. |
| **Caching the trace** | Stale recall scope shown — dangerous and off-thesis | `dynamic = "force-dynamic"` + `Cache-Control: no-store` on `/api/trace` and `/api/explain`. Only `/api/incidents` may cache briefly. |
| **`EXPLAIN` node strings differ by version** | `nodes` array missing an expected entry though the plan text has it | The matchers are forgiving regexes; if a node name shifts (pgvector/PostGIS version), update `NODE_MATCHERS` in `lib/db/explain.ts`. The DoD verifies against a *real* plan — adjust to what your DB actually prints. |
| **Large JSON payload** | A trace hitting ~1,400 stores + edges produces a multi-hundred-KB body; slow serialize / browser jank | The hero query already aggregates server-side (`json_agg`, `SUM(units)`), so the payload is bounded to affected stores + distinct edges + top-5 incidents — not raw shipment rows. Don't add raw rows. If still large, the consumer (PHASE-05) can request a `limit`/bbox; do not paginate the trace itself (scope must be complete). |
| **`EXPLAIN ANALYZE` side effects** | Worry that running it mutates data | The hero query is read-only and we wrap in `BEGIN … ROLLBACK`. Safe. |
| **Query param type errors** | `storeId=abc` throws a 500 instead of 400 | `z.coerce.number().int().positive()` rejects non-numerics as a clean 400 before any DB call. |
| **`asOf` timezone ambiguity** | Off-by-hours `asOf` filtering | Schema requires `z.string().datetime({ offset: true })` (RFC3339 with offset); `runTrace` binds it as `$3::timestamptz`. |

---

## 7. Cut-if-scope-bites

If time is short, cut from the **bottom of this list up** — but **never** cut the trace endpoint or the explain endpoint (those are the spine and the 10x artifact respectively):

1. **`/api/metrics`** — the top-bar can read latency directly from the last `/api/trace` response instead of a history endpoint. Cut the metrics route + `trace_metrics` table first.
2. **`/api/incidents` clustering** — degrade to a plain feed (`clusters: []`) if the self-similarity query is slow; keep the incident list. (You lose the inbox-cluster *badge* moment but keep the screen.)
3. **`/api/lineage` by-lot** — ship `?storeId=` only (the demo clicks a store pin, not a lot); narrate by-lot as "also supported."

> **NEVER CUT (the contract's hard rule):** the recursive CTE, the PostGIS map JOIN, the pgvector rail, the **live `EXPLAIN`** (`/api/explain`), real seed volume, the live-URL deploy. `/api/trace` and `/api/explain` are non-negotiable — they ARE the thesis on the wire. Cut features above them, never these.

---

## 8. BUILD_LOG entry to append

````markdown
## Phase 04 — API Layer  (<DATE>)

**Outcome:** Five zod-validated Route Handlers shipped: `POST /api/trace` (hero), `POST /api/explain`,
`GET /api/lineage`, `GET /api/incidents`, `GET /api/metrics`. Supporting query modules:
`lib/db/explain.ts`, `lib/db/queries/lineage.ts`, `lib/db/queries/incidents.ts`, `lib/db/queries/metrics.ts`,
and the shared `lib/api/schemas.ts`.

**Verified GREEN:**
- `pnpm typecheck && pnpm lint && pnpm test` — all pass.
- `POST /api/trace {tlc: DEMO_TLC}` → `meta.storeCount ≈ <N>`, `meta.latencyMs = <ms>` (varies run-to-run — measured, not hardcoded), `.sql` = full hero query.
- Clean-lot TLC → `200` with empty `stores`/`edges`.
- Invalid input (`tlc:""`, bad `asOf`, non-JSON) → `400` with zod issues.
- `POST /api/explain {tlc: DEMO_TLC}` → plan text + parsed nodes: Recursive Union, Index Scan(lot_links), HNSW(incidents.embedding), GiST(stores.geom); **no Seq Scan on hot tables**.
- `GET /api/lineage?storeId=<id>` → four-table trail (lot/facility/supplier/shipment).
- `GET /api/incidents` → `<C>` clusters (largest size <S>), `<I>` incidents.
- `GET /api/metrics` → `<n>` measured latency samples.
- No static AWS keys in `app`/`lib`; single module-scope pool (only `lib/db/pool.ts` has `new Pool`).

**Notes / decisions:**
- Trace + explain are `no-store`/`force-dynamic` (freshness is the product; never cache a recall scope).
- Incident clustering = live pgvector self-similarity (same-pathogen + cosine-distance threshold) over HNSW; full transitive clustering stays in the precomputed `incident_lot_matches` path.
- Metrics source: <persisted trace_metrics | in-memory ring> (note the per-instance caveat if ring).
- EXPLAIN node matchers tuned to actual plan wording from <PG/pgvector/PostGIS versions>.

**Build-in-public angle:** "front-end in minutes, back-end designed for scale" — the API is ~200 lines of
thin validation + JSON shaping; the recursive-CTE + PostGIS + pgvector statement does all the work, and
`/api/explain` proves it with a live `EXPLAIN (ANALYZE, BUFFERS)`.
````

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract (single source of truth): [API response contract §10](./CONVENTIONS.md#10-api-response-contract), [hero query §7](./CONVENTIONS.md#7-canonical-hero-query-forward-trace), [DB objects §9](./CONVENTIONS.md#9-database-objects--indexes), [global rules §12](./CONVENTIONS.md#12-global-rules-every-phase).
- [`./README.md`](./README.md) — build index & phase dependency graph.
- [`./PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) — upstream: `runTrace`, `TRACE_SQL`, `buildTraceParams`, `TraceResult`.
- [`./PHASE-01-database-schema.md`](./PHASE-01-database-schema.md) — tables/indexes the queries hit (incl. optional `trace_metrics`).
- [`./PHASE-02-seed-data.md`](./PHASE-02-seed-data.md) — the seed that makes `DEMO_TLC` trace to ~1,400 stores and seeds the incident cluster.
- [`./PHASE-05-outbreak-console.md`](./PHASE-05-outbreak-console.md) — downstream consumer (graph/map/rail).
- [`./PHASE-06-query-inspector.md`](./PHASE-06-query-inspector.md) — downstream consumer of `/api/explain`.
- [`./PHASE-07-supporting-screens.md`](./PHASE-07-supporting-screens.md) — downstream consumer of `/api/lineage` + `/api/incidents`.
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — product + architecture spec ([data model §5](../deep-dives/01-recall.md#5-data-model), [request path §6.2](../deep-dives/01-recall.md#62-the-requestdata-path)).
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — Fluid Compute pooling, `attachDatabasePool`, OIDC keyless, caching matched to consistency.
- [`../reference/submission-checklist.md`](../reference/submission-checklist.md) — required artifacts (the `/api/explain` plan is the A8 screenshot).
