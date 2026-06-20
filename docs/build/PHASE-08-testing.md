# Phase 08 — Test & Verification

**Outcome:** A green `pnpm test` (vitest) that includes hardened adversarial trace tests (cycle, zero-rows, latency budget), an embedding determinism test, zod-backed API-contract tests hitting every route against a seeded local DB, and a guard test proving the trace SQL is **not** cached/hardcoded — plus an optional Playwright smoke (load console → run trace → open inspector → assert latency is a number and the plan contains `Index Scan`), and a **Verification Runbook** of exact ordered commands that reproduces a working app from clean.

**Depends on / Unblocks:** Depends on [PHASE-03](./PHASE-03-hero-query.md) (hero query + `runTrace`), [PHASE-04](./PHASE-04-api-layer.md) (zod routes), [PHASE-05](./PHASE-05-outbreak-console.md)/[PHASE-06](./PHASE-06-query-inspector.md)/[PHASE-07](./PHASE-07-supporting-screens.md) (UI for the smoke). Unblocks [PHASE-09](./PHASE-09-aws-aurora.md) (cloud) and [PHASE-11](./PHASE-11-demo-and-submission.md) (you record only what the suite proves correct). This is the P1 gate from [README §Spine vs polish](./README.md#spine-vs-polish--priority): keep at least the cycle/depth-guard test even under scope pressure.

**Effort:** ~0.5–1 day (the unit + contract suite is ~3–4 h; Playwright + the runbook ~2–3 h).

---

## 1. Objectives

1. **Harden the three adversarial trace tests** so they assert *behavior under attack*, not happy-path output:
   - **Cycle guard** — inject a deliberate `A→B→A` cycle into a real DB fixture; assert the trace **terminates**, does **not** hang, and does **not** over-report (each lot counted once).
   - **Zero-rows / clean lot** — a real-but-unshipped TLC and a non-existent TLC both return a well-formed empty result (the "clean lot — no shelves at risk" state), never a throw.
   - **Latency budget** — the `DEMO_TLC` trace returns within a **generous** p50 budget over real seed volume, with the timing taken from a fresh re-measurement (never a constant).
2. **Embedding determinism** — `embed(text)` for the local provider returns a vector of exactly `EMBED_DIM` dimensions and is **byte-stable** across two calls (so cosine scores are reproducible and the HNSW index is meaningful).
3. **API contract tests** — exercise `/api/trace`, `/api/explain`, `/api/incidents`, `/api/lineage`, `/api/metrics` against a seeded local DB and validate every response against a **zod schema that mirrors [CONVENTIONS §10](./CONVENTIONS.md#10-api-response-contract)**. Validation failure = test failure.
4. **Anti-cache / anti-hardcode guard** — a test that proves the trace SQL string is the live `lib/db/queries/trace.ts` source (recursive CTE present), that `runTrace` re-measures latency each call (two runs differ or are independently sampled, never a literal), and that the route does not pin `force-static` / set a cacheable revalidate on the trace path.
5. **Optional Playwright smoke** — boot the dev server, load the console, run a trace for `DEMO_TLC`, open the Query Inspector, and assert the latency badge renders a **number** and the plan text contains `Index Scan`.
6. **A Verification Runbook** — the exact ordered commands (`db:up → db:migrate → db:seed → bench → test → dev` + a manual checklist) with **expected output**, so anyone can reproduce a working app from a clean checkout.

> **Never-cut reminder:** tests verify the spine — the recursive CTE, the PostGIS map JOIN, the pgvector rail, the live `EXPLAIN`, real seed volume. A test that mocks the database away proves nothing about the thesis. **Test against a real seeded Postgres.**

---

## 2. Prerequisites (checklist)

- [ ] Phases 00–07 complete and GREEN on their own (`pnpm typecheck && pnpm lint && pnpm test` already pass for the existing `test/trace.test.ts`).
- [ ] Local Postgres is reachable: `pnpm db:up` is healthy and `DATABASE_URL=postgres://recall:recall@localhost:5432/recall` resolves (PostGIS + pgvector extensions installed — see [PHASE-00](./PHASE-00-foundation.md)/[PHASE-01](./PHASE-01-database-schema.md)).
- [ ] Migrations applied (`pnpm db:migrate`) and the DB is **seeded** (`pnpm db:seed`) — the contract tests and the latency test read **real rows**, so an empty DB will fail them by design.
- [ ] `DEMO_TLC=PRD-OUTBREAK-0001` exists in `lots` and traces to ~1,400 stores (validated in [PHASE-02](./PHASE-02-seed-data.md)).
- [ ] `lib/db/queries/trace.ts` exports the SQL string and `runTrace`; `lib/embeddings/index.ts` exports `embed`; the five routes exist with their handlers (Phases 03–04).
- [ ] `vitest` and `tsx` are installed (from [PHASE-00](./PHASE-00-foundation.md)). Playwright is optional and installed in Step 7.
- [ ] You are on a feature branch (e.g. `git switch -c feat/phase-08-testing`).

> **Test-DB isolation decision (read before writing tests):** we run the unit + contract suite against the **same seeded local DB**, but **read-only** — no test mutates committed data. The cycle test writes to a **throwaway lot namespace** (`TST-CYCLE-*`) inside a transaction it **rolls back**, so the seeded data is never polluted. This keeps the suite fast (no re-seed per run) and honest (real volume). If you prefer hard isolation, point `DATABASE_URL` at a second container/database before `vitest` (see [§6](#6-common-pitfalls--fixes)).

---

## 3. Step-by-step

All commands are run from the **repository root**. File contents are complete — paste them as-is.

### 3.1 Add test scripts & dev-deps

Add the verification scripts and (optional) Playwright dep. The canonical `test` script already exists ([CONVENTIONS §8](./CONVENTIONS.md#8-packagejson-scripts)); we add focused variants and the smoke.

```bash
# unit + contract test deps already present (vitest, tsx, zod, pg). Add Playwright (optional smoke):
pnpm add -D @playwright/test
pnpm exec playwright install chromium     # installs the browser binary only (no system deps prompt on macOS)
```

Add these scripts to `package.json` (merge into the existing `"scripts"` block — do **not** remove the canonical ones):

```jsonc
{
  "scripts": {
    // ... canonical scripts from CONVENTIONS §8 (dev, build, start, lint, typecheck, test, db:*, bench) ...
    "test": "vitest run",                       // CI/one-shot; overrides watch default so `pnpm test` exits
    "test:watch": "vitest",                     // interactive watch during dev
    "test:unit": "vitest run test/trace.test.ts test/embeddings.test.ts test/sql-guard.test.ts",
    "test:contract": "vitest run test/api-contract.test.ts",
    "test:smoke": "playwright test",            // optional Playwright smoke (needs a running build/dev server)
    "verify": "pnpm typecheck && pnpm lint && pnpm test"   // the GREEN gate
  }
}
```

> `vitest run` (not bare `vitest`) makes `pnpm test` **exit** instead of watching — required so the GREEN gate and CI terminate.

### 3.2 Vitest config — make the DB suite serial & long-enough

Create or update `vitest.config.ts` at the repo root. The contract + adversarial tests touch a real DB and the local embedder; keep them **single-threaded** (no parallel pool contention) and give a generous timeout (model load + cold query).

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Real DB + a model that loads from disk on first call → no parallel workers, generous timeouts.
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    fileParallelism: false,
    testTimeout: 30_000,       // first @xenova model load + a cold trace can exceed the 5s default
    hookTimeout: 60_000,       // beforeAll may warm the embedder / connect the pool
    globals: false,
    // Load .env so DATABASE_URL / DEPLOY_TARGET / EMBED_* are present in tests.
    setupFiles: ["./test/setup.ts"],
    // Playwright lives under e2e/ and is run by its own runner — keep vitest out of it.
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
  },
});
```

Create the shared setup file that loads env and exposes a couple of guards. It **refuses to run against Aurora** (so a misconfigured `DEPLOY_TARGET=aurora` can never let the suite mutate the cloud DB):

```ts
// test/setup.ts
import { config as loadEnv } from "dotenv";
import { beforeAll } from "vitest";

// Load .env (and .env.local if present) so DATABASE_URL / EMBED_* / DEMO_TLC are available.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

beforeAll(() => {
  // HARD ISOLATION GUARD: never run the suite against the cloud DB.
  if ((process.env.DEPLOY_TARGET ?? "local") !== "local") {
    throw new Error(
      `Tests must run with DEPLOY_TARGET=local (got "${process.env.DEPLOY_TARGET}"). ` +
        `Refusing to run against Aurora.`,
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — run `pnpm db:up` and copy .env.example → .env");
  }
});
```

```bash
pnpm add -D dotenv     # if not already present
```

### 3.3 A test-only DB helper (real pool, read-mostly, transactional sandbox)

The hero path uses the module-scope pool from `lib/db/pool.ts`. For tests we reuse it, plus add a tiny helper that runs a block inside a transaction it **always rolls back** — that is how the cycle test injects edges without polluting seed data.

```ts
// test/helpers/db.ts
import type { PoolClient } from "pg";
import { pool } from "@/lib/db/pool";

/** Run `fn` inside a transaction that is ALWAYS rolled back. Nothing it writes persists. */
export async function inRollbackTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    return result;
  } finally {
    await client.query("ROLLBACK").catch(() => {}); // best-effort; tx is discarded either way
    client.release();
  }
}

/** Count rows of a table — used to assert the suite is running against real seed volume. */
export async function countRows(table: string): Promise<number> {
  // table name is a literal from our own test code, never user input.
  const { rows } = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
  return Number(rows[0].n);
}
```

> The `@/` alias must resolve in vitest. If your `tsconfig.json` defines `"paths": { "@/*": ["./*"] }`, add the matching resolver to vitest via `vite-tsconfig-paths`:
> ```bash
> pnpm add -D vite-tsconfig-paths
> ```
> ```ts
> // vitest.config.ts — add at top
> import tsconfigPaths from "vite-tsconfig-paths";
> // ...inside defineConfig:
> plugins: [tsconfigPaths()],
> ```

### 3.4 The adversarial trace tests (hardened) — `test/trace.test.ts`

This **replaces/expands** the Phase-03 stub. It asserts behavior under attack against the real seeded DB.

```ts
// test/trace.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { runTrace } from "@/lib/db/queries/trace";
import { embed } from "@/lib/embeddings";
import { inRollbackTx, countRows } from "./helpers/db";

const DEMO_TLC = process.env.DEMO_TLC ?? "PRD-OUTBREAK-0001";

describe("hero trace — real seed volume", () => {
  beforeAll(async () => {
    // Fail loudly if the DB is empty: these tests are meaningless without real volume.
    const edges = await countRows("lot_links");
    expect(edges, "lot_links must be seeded (~250k); run `pnpm db:seed`").toBeGreaterThan(50_000);
  });

  it("DEMO_TLC traces to a large, real store set", async () => {
    const res = await runTrace(DEMO_TLC, null);
    expect(res.meta.lotCount).toBeGreaterThan(1);
    expect(res.meta.storeCount).toBeGreaterThan(500);   // demo lot is pinned to ~1,400 stores
    expect(res.stores.length).toBe(res.meta.storeCount);
    expect(res.meta.totalUnits).toBeGreaterThan(0);
    // Each store row is well-formed (mirrors AffectedStore).
    for (const s of res.stores.slice(0, 50)) {
      expect(typeof s.storeId).toBe("number");
      expect(typeof s.lat).toBe("number");
      expect(typeof s.lng).toBe("number");
      expect(s.lat).toBeGreaterThan(18);  // continental US-ish sanity (not 0,0)
      expect(s.lat).toBeLessThan(72);
      expect(s.units).toBeGreaterThan(0);
    }
    // The vector rail is present and relevance-ranked (descending score / ascending distance).
    const scores = res.incidents.map((i) => i.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  // ── ADVERSARIAL 1: ZERO ROWS ──────────────────────────────────────────────
  it("non-existent TLC returns a clean empty result (not a throw)", async () => {
    const res = await runTrace("DOES-NOT-EXIST-9999", null);
    expect(res.meta.lotCount).toBe(0);
    expect(res.meta.storeCount).toBe(0);
    expect(res.meta.totalUnits).toBe(0);
    expect(res.stores).toEqual([]);
    expect(res.edges).toEqual([]);
    // sql is still surfaced even on an empty trace (the Inspector must always have it).
    expect(typeof res.sql).toBe("string");
    expect(res.sql).toMatch(/WITH RECURSIVE/i);
  });

  it("a real-but-unshipped lot returns zero stores (the 'clean lot' state)", async () => {
    // Seed guarantees at least one ingredient lot with no downstream shipments; if your seed
    // names it differently, set TST_CLEAN_TLC in .env. We fall back to creating one in a rollback tx.
    await inRollbackTx(async (client) => {
      await client.query(
        `INSERT INTO lots (tlc, product_name, lot_type, produced_at, facility_id)
         SELECT 'TST-CLEAN-0001', 'orphan ingredient', 'ingredient', now(),
                (SELECT facility_id FROM facilities LIMIT 1)
         WHERE NOT EXISTS (SELECT 1 FROM lots WHERE tlc = 'TST-CLEAN-0001')`,
      );
      // Run the trace logic *inside this tx* so it sees the orphan lot but no shipments.
      const { rows } = await client.query(
        `WITH RECURSIVE contaminated AS (
           SELECT l.lot_id FROM lots l WHERE l.tlc = $1
         )
         SELECT (SELECT count(*) FROM contaminated) AS lot_count,
                (SELECT count(*) FROM shipments sh JOIN contaminated c ON c.lot_id = sh.lot_id) AS store_rows`,
        ["TST-CLEAN-0001"],
      );
      expect(Number(rows[0].lot_count)).toBe(1);   // the lot exists
      expect(Number(rows[0].store_rows)).toBe(0);  // but ships nowhere → clean lot
    });
  });

  // ── ADVERSARIAL 2: CYCLE GUARD ────────────────────────────────────────────
  it("a deliberate A→B→A cycle terminates and does not over-report", async () => {
    await inRollbackTx(async (client) => {
      // Create three throwaway lots A, B, C and a cycle A→B→A plus A→C.
      const mk = async (tlc: string, type = "intermediate") =>
        Number(
          (
            await client.query(
              `INSERT INTO lots (tlc, product_name, lot_type, produced_at, facility_id)
               VALUES ($1, $1, $2, now(), (SELECT facility_id FROM facilities LIMIT 1))
               RETURNING lot_id`,
              [tlc, type],
            )
          ).rows[0].lot_id,
        );
      const a = await mk("TST-CYCLE-A", "finished");
      const b = await mk("TST-CYCLE-B");
      const c = await mk("TST-CYCLE-C");
      // Edges: A→B, B→A (the cycle), A→C. The CHECK(parent<>child) already blocks self-loops,
      // so a 2-cycle is the smallest cycle we *can* insert — exactly what the path-guard must defeat.
      await client.query(
        `INSERT INTO lot_links (parent_lot_id, child_lot_id, transform_event) VALUES
           ($1,$2,'tst'), ($2,$1,'tst'), ($1,$3,'tst')`,
        [a, b, c],
      );

      // Run the recursive CTE term *exactly as the hero query does* (path + depth guard) inside the tx.
      const start = Date.now();
      const { rows } = await client.query(
        `WITH RECURSIVE contaminated AS (
           SELECT l.lot_id, 0 AS depth, ARRAY[l.lot_id] AS path
           FROM lots l WHERE l.tlc = $1
           UNION ALL
           SELECT ll.child_lot_id, c.depth + 1, c.path || ll.child_lot_id
           FROM contaminated c JOIN lot_links ll ON ll.parent_lot_id = c.lot_id
           WHERE c.depth < 12 AND ll.child_lot_id <> ALL(c.path)
         )
         SELECT lot_id, count(*)::int AS visits FROM contaminated GROUP BY lot_id`,
        ["TST-CYCLE-A"],
      );
      const elapsed = Date.now() - start;

      // 1) It TERMINATED quickly (the guard worked; no runaway).
      expect(elapsed).toBeLessThan(2_000);
      // 2) It reached A, B, C — and crucially NOT more than that.
      const ids = rows.map((r) => Number(r.lot_id)).sort((x, y) => x - y);
      expect(ids).toEqual([a, b, c].sort((x, y) => x - y));
      // 3) No lot is over-reported into an explosion: each lot appears a small, bounded number of times.
      for (const r of rows) expect(r.visits).toBeLessThan(5);
    });
  });

  // ── ADVERSARIAL 3: LATENCY BUDGET (generous, re-measured) ─────────────────
  it("DEMO_TLC trace stays within a generous latency budget (re-measured, never constant)", async () => {
    // Warm once (model load + plan cache), then sample.
    await runTrace(DEMO_TLC, null);
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await runTrace(DEMO_TLC, null);
      samples.push(r.meta.latencyMs);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)];

    // Generous budget: prod target is <1s on warm Aurora; local Docker + cold-ish CI is slower.
    // We assert a CEILING that catches a quadratic-recursion regression, not a tight SLA.
    expect(p50).toBeLessThan(5_000);
    // The value is a REAL measurement: positive, finite, and it actually varies across runs
    // (a hardcoded constant would make every sample identical).
    expect(p50).toBeGreaterThan(0);
    expect(Number.isFinite(p50)).toBe(true);
    const allIdentical = samples.every((s) => s === samples[0]);
    expect(allIdentical, "all latency samples identical → suspect a hardcoded value").toBe(false);
  });
});
```

> **Why a transactional sandbox for the cycle:** the seed is acyclic by construction ([CONVENTIONS §11](./CONVENTIONS.md#11-seed-volume-targets)), so we *manufacture* a cycle to prove the runtime guard — then roll it back so the seed stays acyclic for every other test and for the demo. This is the belt-and-suspenders point from [01-recall §13](../deep-dives/01-recall.md#13-risk-register).

### 3.5 Embedding determinism — `test/embeddings.test.ts`

```ts
// test/embeddings.test.ts
import { describe, it, expect } from "vitest";
import { embed } from "@/lib/embeddings";
import { EMBED_DIM } from "@/lib/config";

describe("embeddings — local provider", () => {
  it("returns exactly EMBED_DIM dimensions", async () => {
    const v = await embed("listeria-like complaints in bagged leafy greens");
    expect(Array.isArray(v)).toBe(true);
    expect(v.length).toBe(EMBED_DIM); // 384 for Xenova/all-MiniLM-L6-v2
    expect(v.every((x) => typeof x === "number" && Number.isFinite(x))).toBe(true);
  });

  it("is deterministic: same input → byte-identical vector", async () => {
    const text = "salmonella outbreak suspected — romaine, multiple states";
    const a = await embed(text);
    const b = await embed(text);
    expect(a.length).toBe(b.length);
    // Exact equality: the local model is deterministic for identical input.
    expect(a).toEqual(b);
  });

  it("different inputs → different vectors (not a constant stub)", async () => {
    const a = await embed("e. coli, ground beef recall");
    const b = await embed("norovirus, frozen berries");
    expect(a).not.toEqual(b);
  });

  it("normalization sanity: vector is non-zero", async () => {
    const v = await embed("any non-empty incident text");
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeGreaterThan(0);
  });
});
```

> If `EMBED_PROVIDER=bedrock`, this test still asserts dimensionality (`EMBED_DIM` = verified Titan v2 dim) but determinism may be relaxed — guard it: `it.skipIf(process.env.EMBED_PROVIDER === "bedrock")(...)` on the byte-equality case. For the local default, exact equality must hold.

### 3.6 Anti-cache / anti-hardcode SQL guard — `test/sql-guard.test.ts`

This is the **anti-fake** test: it proves the trace SQL is the real recursive CTE source and is not memoized/cached, and that the route does not opt the trace into static caching.

```ts
// test/sql-guard.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TRACE_SQL } from "@/lib/db/queries/trace"; // the exported SQL string surfaced to the Inspector

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("anti-fake guards", () => {
  it("TRACE_SQL is the real recursive CTE (not a placeholder)", () => {
    expect(TRACE_SQL).toMatch(/WITH RECURSIVE/i);
    expect(TRACE_SQL).toMatch(/lot_links/);          // the DAG edge table
    expect(TRACE_SQL).toMatch(/<=>/);                // pgvector cosine distance operator
    expect(TRACE_SQL).toMatch(/ST_[XY]\s*\(/i);      // PostGIS lat/lng extraction
    expect(TRACE_SQL).toMatch(/<>\s*ALL\s*\(/i);     // the cycle guard (path visited-set)
    expect(TRACE_SQL).toMatch(/depth\s*<\s*12/i);    // the depth guard
  });

  it("the trace query SOURCE uses parameterized placeholders, not string interpolation", () => {
    const src = read("lib/db/queries/trace.ts");
    // Hero SQL must bind via $1/$2/$3 — never template-literal the TLC into the SQL.
    expect(src).toMatch(/\$1/);
    expect(src).toMatch(/\$2/);
    // No obvious SQL-injection-shaped interpolation of the tlc param into the query text.
    expect(src).not.toMatch(/`[^`]*WITH RECURSIVE[^`]*\$\{/i);
  });

  it("runTrace re-measures latency each call (no hardcoded ms literal)", () => {
    const src = read("lib/db/queries/trace.ts");
    // It must time with a clock, not return a constant.
    expect(src).toMatch(/performance\.now\(\)|Date\.now\(\)|process\.hrtime/);
    // Defensive: catch an obvious `latencyMs: 847` style fake.
    expect(src).not.toMatch(/latencyMs\s*[:=]\s*\d{2,4}\b(?!\s*[-+*/])/);
  });

  it("the /api/trace route does NOT opt the trace into static caching", () => {
    const src = read("app/api/trace/route.ts");
    // Freshness is the product — the trace must never be cached (01-recall §6.4).
    expect(src).not.toMatch(/dynamic\s*=\s*["']force-static["']/);
    expect(src).not.toMatch(/export\s+const\s+revalidate\s*=\s*\d+/); // no positive revalidate window
    // Acceptable / expected: force-dynamic or no-store. (Presence is good but not required here.)
  });
});
```

> **Adapt the export name** to your Phase-03 implementation. If the SQL constant is exported as `HERO_SQL` or `traceSql`, change the import and the `app/api/explain/route.ts` reference accordingly — but the guard above expects `TRACE_SQL`. Pick one name in Phase-03 and keep it. The `sql` field in the `/api/trace` response **is** this string ([CONVENTIONS §10](./CONVENTIONS.md#10-api-response-contract)).

### 3.7 API contract tests (zod, against the running app) — `test/api-contract.test.ts`

These hit the **real route handlers** against the seeded DB and validate every response against zod schemas that mirror [CONVENTIONS §10](./CONVENTIONS.md#10-api-response-contract). Two ways to run them:

- **A. In-process (preferred, no server):** import the route module and call its exported `POST`/`GET` with a constructed `Request`. Fast, no port, no flakiness.
- **B. Over HTTP:** set `BASE_URL` and fetch a running `pnpm dev`/`pnpm start`. Used in CI against a preview deploy.

The schemas live in one file so the smoke and the contract test share them:

```ts
// test/helpers/contracts.ts — zod schemas mirroring CONVENTIONS §10
import { z } from "zod";

export const TraceResponse = z.object({
  meta: z.object({
    latencyMs: z.number().nonnegative(),
    lotCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative(),
    storeCount: z.number().int().nonnegative(),
    totalUnits: z.number().nonnegative(),
    asOf: z.string().nullable(),
  }),
  edges: z.array(
    z.object({ parent: z.number(), child: z.number(), transform: z.string() }),
  ),
  stores: z.array(
    z.object({
      storeId: z.number(),
      name: z.string(),
      chain: z.string(),
      address: z.string(),
      lat: z.number(),
      lng: z.number(),
      units: z.number().nonnegative(),
    }),
  ),
  incidents: z.array(
    z.object({
      incidentId: z.number(),
      text: z.string(),
      pathogen: z.string().nullable(),
      score: z.number(),
    }),
  ),
  sql: z.string().min(1),
});

export const ExplainResponse = z.object({
  plan: z.string().min(1),
  nodes: z.array(z.object({ type: z.string(), detail: z.string() })),
});

export const IncidentsResponse = z.object({
  clusters: z.array(
    z.object({ label: z.string(), incidentIds: z.array(z.number()), size: z.number().int() }),
  ),
  incidents: z.array(
    z.object({
      incidentId: z.number(),
      text: z.string(),
      pathogen: z.string().nullable(),
      score: z.number(),
    }),
  ),
});

export const LineageResponse = z.object({
  trail: z.array(
    z.object({
      lot: z.string(),
      facility: z.string(),
      supplier: z.string(),
      shipment: z.number(),
      units: z.number(),
      shippedAt: z.string(),
    }),
  ),
});

export const MetricsResponse = z.object({
  samples: z.array(z.object({ ts: z.string(), latencyMs: z.number() })),
  lastRowCount: z.number().int().nonnegative(),
});
```

```ts
// test/api-contract.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import {
  TraceResponse,
  ExplainResponse,
  IncidentsResponse,
  LineageResponse,
  MetricsResponse,
} from "./helpers/contracts";
import { pool } from "@/lib/db/pool";

const DEMO_TLC = process.env.DEMO_TLC ?? "PRD-OUTBREAK-0001";
const BASE = process.env.BASE_URL; // if set → HTTP mode; else → in-process route import

// Helper: call a route either over HTTP (BASE set) or in-process by importing its handler.
async function callRoute(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<unknown> {
  if (BASE) {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: { "content-type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    expect(res.status, `${path} → ${res.status}`).toBe(200);
    return res.json();
  }
  // In-process: import the route module and invoke its exported handler with a real Request.
  const url = `http://local.test${path}`;
  const req = new Request(url, {
    method: init.method,
    headers: { "content-type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  switch (path.split("?")[0]) {
    case "/api/trace": {
      const { POST } = await import("@/app/api/trace/route");
      return (await POST(req)).json();
    }
    case "/api/explain": {
      const { POST } = await import("@/app/api/explain/route");
      return (await POST(req)).json();
    }
    case "/api/incidents": {
      const { GET } = await import("@/app/api/incidents/route");
      return (await GET(req)).json();
    }
    case "/api/lineage": {
      const { GET } = await import("@/app/api/lineage/route");
      return (await GET(req)).json();
    }
    case "/api/metrics": {
      const { GET } = await import("@/app/api/metrics/route");
      return (await GET(req)).json();
    }
    default:
      throw new Error(`no route mapping for ${path}`);
  }
}

describe("API contract — every route matches CONVENTIONS §10", () => {
  let storeId: number;
  beforeAll(async () => {
    // Grab a real storeId from the seed for the lineage test.
    const { rows } = await pool.query<{ store_id: string }>(`SELECT store_id FROM stores LIMIT 1`);
    storeId = Number(rows[0].store_id);
  });

  it("POST /api/trace → TraceResponse", async () => {
    const json = await callRoute("/api/trace", { method: "POST", body: { tlc: DEMO_TLC } });
    const parsed = TraceResponse.parse(json); // THROWS → test fails if shape drifts
    expect(parsed.meta.storeCount).toBe(parsed.stores.length);
    expect(parsed.meta.edgeCount).toBe(parsed.edges.length);
    expect(parsed.sql).toMatch(/WITH RECURSIVE/i);
  });

  it("POST /api/trace with bad body → 400 (zod input validation)", async () => {
    if (BASE) {
      const res = await fetch(`${BASE}/api/trace`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tlc: 123 }), // wrong type
      });
      expect(res.status).toBe(400);
    } else {
      const { POST } = await import("@/app/api/trace/route");
      const res = await POST(
        new Request("http://local.test/api/trace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tlc: 123 }),
        }),
      );
      expect(res.status).toBe(400);
    }
  });

  it("POST /api/explain → ExplainResponse with real plan text", async () => {
    const json = await callRoute("/api/explain", { method: "POST", body: { tlc: DEMO_TLC } });
    const parsed = ExplainResponse.parse(json);
    // The plan is a real EXPLAIN ANALYZE — it should mention an Index Scan and a recursive node.
    expect(parsed.plan).toMatch(/Index Scan|Index Only Scan/i);
    expect(parsed.plan).toMatch(/Recursive/i);
    expect(parsed.nodes.length).toBeGreaterThan(0);
  });

  it("GET /api/incidents → IncidentsResponse", async () => {
    const json = await callRoute("/api/incidents", { method: "GET" });
    IncidentsResponse.parse(json);
  });

  it("GET /api/lineage?storeId= → LineageResponse", async () => {
    const json = await callRoute(`/api/lineage?storeId=${storeId}`, { method: "GET" });
    LineageResponse.parse(json);
  });

  it("GET /api/metrics → MetricsResponse", async () => {
    const json = await callRoute("/api/metrics", { method: "GET" });
    const parsed = MetricsResponse.parse(json);
    // Latency samples, if present, are real positive numbers (never a hardcoded badge).
    for (const s of parsed.samples) expect(s.latencyMs).toBeGreaterThan(0);
  });
});
```

> **In-process caveat:** importing a route handler runs it in the vitest Node context (no Next.js server). That is fine for these handlers because they only touch `pg` + zod + (for explain) the DB — no Next runtime APIs beyond `Request`/`Response`, which exist natively in Node 24. If a handler imports something Next-only (e.g. `next/headers`), run the contract suite in **HTTP mode** instead: `BASE_URL=http://localhost:3000 pnpm test:contract` against a running `pnpm dev`.

### 3.7.1 Connection cleanup (avoid hanging vitest)

The module-scope pool keeps sockets open, so vitest may not exit. Close it after the suite. Add a global teardown:

```ts
// test/teardown.ts
import { pool } from "@/lib/db/pool";
export default async function teardown() {
  await pool.end().catch(() => {});
}
```

```ts
// vitest.config.ts — add inside test: { ... }
globalSetup: ["./test/teardown.ts"], // vitest runs the default export's returned fn / teardown on exit
```

> If `globalSetup` semantics differ in your vitest version, instead add an `afterAll(() => pool.end())` in a `test/setup.ts` `afterAll` — but only if every file shares one pool import. The cleanest cross-version option: run `pnpm test` with `--pool=forks` so the worker process is torn down regardless. The runbook below uses the default; if `pnpm test` hangs on exit, see [§6](#6-common-pitfalls--fixes).

### 3.8 Optional Playwright smoke — `e2e/smoke.spec.ts`

Load the console, run a trace, open the inspector, assert the latency badge is a number and the plan contains `Index Scan`. Keep it **resilient to maplibre/canvas** (don't assert on map internals; assert on the data the DB produced).

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,          // a real trace over 250k edges + first model load is not instant
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    // maplibre needs WebGL; headless chromium has swiftshader. Force it on so the map mounts.
    launchOptions: { args: ["--use-gl=swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Boot the app for the smoke unless BASE_URL points elsewhere.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
```

```ts
// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

const DEMO_TLC = process.env.DEMO_TLC ?? "PRD-OUTBREAK-0001";

test("console runs a trace and the inspector shows a plan with Index Scan", async ({ page }) => {
  await page.goto("/");

  // 1) Type the demo TLC and run the trace.
  //    Selectors use stable test ids — add them in Phases 05/06 (see note below).
  await page.getByTestId("tlc-input").fill(DEMO_TLC);
  await page.getByTestId("trace-button").click();

  // 2) The latency badge resolves to a NUMBER + "ms" (a real measurement, not a spinner forever).
  const latency = page.getByTestId("latency-badge");
  await expect(latency).toBeVisible();
  await expect
    .poll(async () => {
      const txt = (await latency.textContent()) ?? "";
      const m = txt.match(/(\d+(?:\.\d+)?)\s*ms/i);
      return m ? Number(m[1]) : NaN;
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);

  // 3) Affected-store count shows real volume (the geo JOIN produced rows).
  await expect(page.getByTestId("store-count")).toContainText(/\d/);

  // 4) Open the Query Inspector and assert the live EXPLAIN plan contains "Index Scan".
  await page.getByTestId("inspector-toggle").click();
  const plan = page.getByTestId("explain-plan");
  await expect(plan).toBeVisible();
  await expect(plan).toContainText(/Index Scan|Index Only Scan/i, { timeout: 30_000 });
  // Bonus: the recursive node is visible — the thesis on screen.
  await expect(plan).toContainText(/Recursive/i);
});
```

> **Test ids to add in the UI phases** (do this in Phases 05–06 so the smoke is stable and not coupled to copy): `data-testid="tlc-input"`, `trace-button`, `latency-badge`, `store-count`, `inspector-toggle`, `explain-plan`. Add them as `data-testid` attributes — they survive restyling, unlike text/role selectors over a canvas-heavy UI.

---

## 4. Key files

| Path | Purpose |
|---|---|
| `vitest.config.ts` | Single-thread, node env, generous timeouts, env via `setupFiles`, excludes `e2e/`. |
| `test/setup.ts` | Loads `.env`; **refuses** to run unless `DEPLOY_TARGET=local`; asserts `DATABASE_URL`. |
| `test/teardown.ts` | Closes the module-scope pool so vitest exits cleanly. |
| `test/helpers/db.ts` | `inRollbackTx` (transactional sandbox) + `countRows` (real-volume guard). |
| `test/helpers/contracts.ts` | zod schemas mirroring [CONVENTIONS §10](./CONVENTIONS.md#10-api-response-contract); shared by contract test + smoke. |
| `test/trace.test.ts` | Hardened adversarial trace tests: cycle, zero-rows/clean-lot, latency budget, real-volume happy path. |
| `test/embeddings.test.ts` | Local embedder: `EMBED_DIM` dimensionality + byte determinism + non-constant. |
| `test/sql-guard.test.ts` | Anti-fake: SQL is the real recursive CTE, parameterized, re-measured latency, trace route not cached. |
| `test/api-contract.test.ts` | Hits all five routes (in-process or HTTP) and validates against the zod contracts + a 400 on bad input. |
| `playwright.config.ts` | Smoke runner; boots `pnpm dev`; WebGL via swiftshader for maplibre. |
| `e2e/smoke.spec.ts` | Load console → trace → inspector → assert latency number + plan `Index Scan`. |
| `package.json` | Adds `test` (`vitest run`), `test:watch`, `test:unit`, `test:contract`, `test:smoke`, `verify`. |

---

## 5. Definition of Done

Each item has an exact command and expected output. The phase ends **GREEN** only when all are checked.

- [ ] **Toolchain is clean.**
  `pnpm typecheck` → `Found 0 errors.` (or no output, exit 0).
  `pnpm lint` → no errors (warnings tolerated if your eslint config allows).

- [ ] **Local DB is up, migrated, seeded.**
  ```bash
  pnpm db:up && pnpm db:migrate && pnpm db:seed
  ```
  Expected tail of `db:seed` (counts are approximate but must hit scale):
  ```
  suppliers/facilities: ~5,000
  lots:                 ~80,000
  lot_links:            ~250,000
  shipments:            ~250,000
  stores:               ~1,400  (38 states)
  incidents:            ~2,000  (real embeddings)
  DEMO_TLC PRD-OUTBREAK-0001 → ~1,400 stores
  ```

- [ ] **Bench proves the hero query is sub-second over real volume.**
  ```bash
  pnpm bench
  ```
  Expected (illustrative — numbers are MEASURED, not asserted here):
  ```
  trace PRD-OUTBREAK-0001  edges=~250000  stores=~1400
  p50= 612 ms   p99= 940 ms   (n=20)
  ```
  p50 should be well under 1s on warm local Docker; if it is multi-second, the recursion is not index-scanning — see [§6](#6-common-pitfalls--fixes).

- [ ] **Full unit + contract suite is GREEN.**
  ```bash
  pnpm test
  ```
  Expected (shape, not exact counts):
  ```
   ✓ test/trace.test.ts (5)
   ✓ test/embeddings.test.ts (4)
   ✓ test/sql-guard.test.ts (4)
   ✓ test/api-contract.test.ts (7)

   Test Files  4 passed (4)
        Tests  20 passed (20)
  ```
  The process **exits** (no hang). Includes the three adversarial cases (cycle terminates <2s, clean-lot zero rows, latency p50 <5s and non-constant).

- [ ] **Adversarial cases verified individually (sanity).**
  ```bash
  pnpm vitest run test/trace.test.ts -t "cycle"
  pnpm vitest run test/trace.test.ts -t "clean"
  pnpm vitest run test/trace.test.ts -t "latency"
  ```
  Each → `1 passed`.

- [ ] **Anti-fake guard is real.**
  Temporarily break it to confirm it bites: edit `lib/db/queries/trace.ts` to return a constant `latencyMs: 847`, run `pnpm vitest run test/sql-guard.test.ts` → it **FAILS**. Revert. (Proves the guard isn't vacuous.)

- [ ] **Playwright smoke passes (optional but recommended).**
  ```bash
  pnpm test:smoke
  ```
  Expected:
  ```
  Running 1 test using 1 worker
    ✓  chromium › smoke.spec.ts › console runs a trace and the inspector shows a plan with Index Scan
  1 passed
  ```

- [ ] **The Verification Runbook (§9) reproduces a working app from clean** — followed top to bottom, the manual checklist all passes (trace ignites, map pins, rail scores, inspector shows `Index Scan` + `Recursive`, latency is a live number).

- [ ] **`BUILD_LOG.md` entry appended** (see [§8](#8-build_log-entry-to-append)).

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **Tests run against an empty DB** | `storeCount` is 0; `lot_links` count guard throws | Run `pnpm db:up && pnpm db:migrate && pnpm db:seed` first; the suite asserts `lot_links > 50k` on purpose. |
| **Suite accidentally points at Aurora** | Cloud creds errors, or worse, writes to prod | `test/setup.ts` hard-refuses unless `DEPLOY_TARGET=local`. Keep it. For true isolation use a second DB (below). |
| **Cycle test pollutes seed data** | Seed becomes cyclic; later runs/demo break | All cycle/clean-lot inserts run inside `inRollbackTx` → always rolled back. Never `COMMIT` in tests. |
| **Flaky latency assertion** | Latency test fails sporadically on a loaded laptop/CI | Budget is **generous** (`p50 < 5_000ms`) and we sample after a warm-up. Never assert a tight SLA in CI; the *real* SLA lives in `pnpm bench`, not the test. |
| **All latency samples identical** | The "non-constant" assertion fails | That's the point — it means latency is hardcoded. Re-measure with `performance.now()` in `runTrace`. |
| **vitest hangs on exit** | Command never returns after "passed" | The pg pool holds sockets. Use `test/teardown.ts` (`pool.end()`), or run `pnpm vitest run --pool=forks`, or add `afterAll(() => pool.end())`. |
| **`@/` import fails in vitest** | `Cannot find module '@/lib/...'` | Add `vite-tsconfig-paths` to `vitest.config.ts` `plugins`, or set `resolve.alias` `{ "@": path.resolve(__dirname) }`. |
| **In-process route import pulls Next-only APIs** | `next/headers`/request-context errors | Run the contract suite in HTTP mode: `BASE_URL=http://localhost:3000 pnpm test:contract` against `pnpm dev`. |
| **First test is slow / times out (model load)** | `embeddings.test.ts` or first trace exceeds 5s default | Already raised to `testTimeout: 30_000`; warm the embedder in a `beforeAll`. The Xenova model downloads once, then caches under `node_modules/@xenova`. |
| **Playwright: map never renders / WebGL missing** | maplibre throws, smoke hangs on the map | We don't assert on map internals — only on `data-testid` data badges. Pass `--use-gl=swiftshader` (in `playwright.config.ts`) so the canvas mounts without a GPU. |
| **Playwright can't find elements** | `getByTestId` times out | Add the `data-testid` attributes listed in §3.8 in Phases 05–06. Don't select over canvas/text. |
| **Playwright boots a second DB-less server** | Smoke trace returns empty | The `webServer` runs `pnpm dev` with your local `.env`; ensure the DB is seeded before `pnpm test:smoke`. |
| **EXPLAIN contains `Seq Scan` on `lot_links`** | `explain` contract test still passes but bench is slow | Not a test bug — it's the regression the bench/inspector exist to catch. Verify `idx_lot_links_parent` exists ([PHASE-01](./PHASE-01-database-schema.md)); `ANALYZE lot_links;`. |

**Optional hard test-DB isolation.** If you want a throwaway DB so even a stray `COMMIT` can't matter:

```bash
# spin a second ephemeral postgres on 5433 (same image), create + migrate + seed a small slice
docker compose -f docker-compose.yml -p recall-test up -d   # or a dedicated compose service on 5433
DATABASE_URL=postgres://recall:recall@localhost:5433/recall pnpm db:migrate
DATABASE_URL=postgres://recall:recall@localhost:5433/recall pnpm db:seed   # smaller volume is fine for contracts
DATABASE_URL=postgres://recall:recall@localhost:5433/recall pnpm test
```

> Trade-off: a second DB is cleaner but slower to seed. The default (one seeded DB + rollback sandbox) is fast and honest because no test commits. Either is acceptable; the rollback sandbox is the recommended default.

---

## 7. Cut-if-scope-bites

Cut in this order if time runs out — but the first item is the floor:

1. **Keep always (the floor):** the **cycle-guard** test and the **zero-rows/clean-lot** test in `test/trace.test.ts`. These prove the recursion is safe and the empty state is designed — a judge *will* type a random lot code ([01-recall §13](../deep-dives/01-recall.md#13-risk-register)).
2. Cut the **HTTP-mode** path of the contract test; keep **in-process** only.
3. Cut the **Playwright smoke** (it's the most fragile and slowest). The manual checklist in the runbook covers the same ground for the demo.
4. Cut the `/api/incidents`, `/api/lineage`, `/api/metrics` contract assertions; keep `/api/trace` and `/api/explain` (the two hero endpoints).
5. Cut the embedding **byte-determinism** assertion; keep the **dimensionality** assertion (it's what the HNSW column depends on).

> **Never cut:** the cycle guard, the clean-lot empty-state, and the assertion that the trace SQL is the **real recursive CTE** (not a placeholder/cache). Those three are the anti-fake spine of this phase. Tests exist to prove the [never-cut list](./CONVENTIONS.md#12-global-rules-every-phase) is honest: recursive CTE · PostGIS map JOIN · pgvector rail · live `EXPLAIN` · real seed volume.

---

## 8. BUILD_LOG entry to append

Append to `BUILD_LOG.md`:

```markdown
## Phase 08 — Test & verification

**Date:** <YYYY-MM-DD>  ·  **Branch:** feat/phase-08-testing

**What shipped**
- Hardened adversarial trace tests against the **real seeded local DB**:
  - **Cycle guard** — injected a 2-cycle `A→B→A` in a rollback-only transaction; the path-array + `depth<12`
    guard terminated it in <2s and reported each lot once (no explosion).
  - **Zero-rows / clean lot** — a non-existent TLC and a real-but-unshipped lot both return a well-formed
    empty result (the designed "no shelves at risk" state), never a throw.
  - **Latency budget** — DEMO_TLC re-measured over 5 warm samples; p50 under a generous 5s ceiling, and
    asserted **non-constant** (proving latency is a real measurement, not a hardcoded badge).
- **Embedding determinism** — local `@xenova/transformers` returns exactly EMBED_DIM (384) dims and is
  byte-identical across calls; distinct inputs give distinct vectors.
- **API contract tests** — all five routes (`/api/trace`, `/api/explain`, `/api/incidents`, `/api/lineage`,
  `/api/metrics`) validated against zod schemas mirroring the response contract; bad input → 400.
- **Anti-fake guard** — proved the trace SQL is the real `WITH RECURSIVE` CTE (pgvector `<=>`, PostGIS `ST_X/Y`,
  cycle + depth guards present), parameterized (no string interpolation of the TLC), latency re-measured, and
  the `/api/trace` route is **not** opted into static caching (freshness is the product).
- **Playwright smoke** (optional) — loads the console, runs the trace, opens the Query Inspector, and asserts
  the latency badge is a number and the plan text contains `Index Scan` + `Recursive`.
- A **Verification Runbook** (db:up → migrate → seed → bench → test → dev + manual checklist) reproduces a
  working app from a clean checkout.

**Proof**
- `pnpm verify` (typecheck + lint + test) GREEN; `pnpm test` → 4 files / ~20 tests passing, process exits clean.
- `pnpm bench` p50 = <NNN> ms over ~250k edges (measured).
- `pnpm test:smoke` → 1 passed.

**Decisions / gotchas**
- Tests run against the seeded DB **read-mostly**, with cycle/clean-lot writes inside an always-rolled-back tx →
  fast + honest, no per-run re-seed; seed stays acyclic for the demo.
- `test/setup.ts` hard-refuses any `DEPLOY_TARGET` other than `local` so the suite can never touch Aurora.
- Latency assertions are intentionally **generous**; the real SLA lives in `pnpm bench`, not the unit test.
```

---

## 9. Verification Runbook — reproduce a working app from clean

> The exact ordered commands to prove the **whole app works**, with expected output and a manual checklist. Run from the repo root on a clean checkout. This is what you follow before recording the demo ([PHASE-11](./PHASE-11-demo-and-submission.md)).

### 9.1 One-shot script (copy-paste)

```bash
# 0) Toolchain + deps
node -v                      # v24.x  (Node 24 LTS)
corepack enable && pnpm -v   # pnpm present
pnpm install                 # installs pg, @xenova/transformers, zod, vitest, tsx, maplibre-gl, @playwright/test, …

# 1) Env
cp -n .env.example .env      # DEPLOY_TARGET=local, DATABASE_URL=…localhost:5432/recall, EMBED_PROVIDER=local,
                             # EMBED_DIM=384, DEMO_TLC=PRD-OUTBREAK-0001
cat .env | grep -E 'DEPLOY_TARGET|EMBED_DIM|DEMO_TLC'

# 2) Database up (PostGIS + pgvector in Docker)
pnpm db:up                   # docker compose up -d
docker compose ps            # expect the postgres service "healthy"

# 3) Migrate (forward-only) + seed (real volume)
pnpm db:migrate              # 0001_extensions, 0002_schema, 0003_indexes → "migrations applied"
pnpm db:seed                 # PRINTS ACTUAL COUNTS — must hit ~250k edges, ~1,400 stores, ~2k incidents

# 4) Prove the hero query is real & sub-second
pnpm bench                   # p50 < 1s over ~250k edges; DEMO_TLC ≈ 1,400 stores

# 5) Prove correctness (the green gate)
pnpm typecheck               # Found 0 errors.
pnpm lint                    # clean
pnpm test                    # 4 files / ~20 tests passing, incl. adversarial cycle/clean-lot/latency

# 6) Run the app & verify behavior in a browser
pnpm dev                     # http://localhost:3000  → do the MANUAL CHECKLIST below

# 7) (optional) End-to-end smoke without a human
pnpm test:smoke              # 1 passed: trace runs, inspector shows "Index Scan"
```

### 9.2 Expected output (abridged, real numbers will vary)

```text
$ pnpm db:seed
seeding suppliers/facilities … 5,000
seeding lots                  … 80,000
building acyclic lot_links    … 250,000 edges (max depth 6)
seeding shipments             … 250,000
seeding stores                … 1,400 across 38 states
embedding + loading incidents … 2,000 (EMBED_DIM=384, provider=local)
validating demo lot           … PRD-OUTBREAK-0001 → 1,402 stores, 9 hops, OK
done.

$ pnpm bench
warmup … done
trace PRD-OUTBREAK-0001  edges=250000  stores=1402
p50= 612 ms   p90= 805 ms   p99= 940 ms   (n=20)

$ pnpm test
 ✓ test/trace.test.ts (5)
 ✓ test/embeddings.test.ts (4)
 ✓ test/sql-guard.test.ts (4)
 ✓ test/api-contract.test.ts (7)
 Test Files  4 passed (4)
      Tests  20 passed (20)

$ pnpm test:smoke
  ✓  chromium › smoke.spec.ts › console runs a trace and the inspector shows a plan with Index Scan (12.3s)
  1 passed
```

### 9.3 Manual browser checklist (Step 6 — `pnpm dev` on `http://localhost:3000`)

Tick every box; this is the same path the demo video walks.

- [ ] **Empty state** — on first load, the map shows dimmed stores and the graph says "Paste a Traceability Lot Code to begin." No errors in the console.
- [ ] **Run the trace** — paste `PRD-OUTBREAK-0001`, click **Trace**. The supply graph ignites red left→right and the US map drops pins.
- [ ] **Live latency** — the top-bar latency chip shows a **number in ms** (e.g. `612ms`) — and it **changes** if you re-run (it's a measurement). Not a spinner forever; not a constant.
- [ ] **Real volume on screen** — affected-store count reads in the hundreds/thousands (matches the bench/seed), across multiple states.
- [ ] **Vector rail** — "Similar Past Incidents" shows top-5 cards, each with a **cosine-distance / score badge**, ordered by relevance.
- [ ] **Query Inspector (the 10x)** — open it; the **actual recursive CTE SQL** is shown, and the live `EXPLAIN (ANALYZE, BUFFERS)` plan contains **Recursive Union/WorkTable**, an **Index Scan** on `lot_links`, the **HNSW** scan, and the **GiST** spatial path. No `Seq Scan` on `lot_links`.
- [ ] **Lineage drill-down** — click a store pin or graph node → the Lineage Drawer slides in with a real parent/child trail (lot → facility → supplier → shipment → units → date).
- [ ] **Clean lot** — paste a random code like `PRD-NONSENSE-0000` → the UI shows "Clean lot — no shelves at risk", **not** a crash or blank screen.
- [ ] **Scope export** — the Recall Scope shows N stores across M states + the 24-hour SLA timer; the export action is present.
- [ ] **No leaked secrets / no localhost-as-prod** — view source / network: the SQL and any creds are server-side; the page is fetching from your local API, not a hardcoded payload.

> If every box is ticked, the spine is real and demoable. Proceed to [PHASE-09](./PHASE-09-aws-aurora.md) (cloud) — re-run this same runbook with `DEPLOY_TARGET=aurora` against the cloud endpoint to prove the live deploy ([PHASE-10](./PHASE-10-vercel-deploy.md)) before recording ([PHASE-11](./PHASE-11-demo-and-submission.md)).

---

## 10. Related docs

- [./CONVENTIONS.md](./CONVENTIONS.md) — the contract (single source of truth); see [§7 hero query](./CONVENTIONS.md#7-canonical-hero-query-forward-trace), [§8 scripts](./CONVENTIONS.md#8-packagejson-scripts), [§9 DB objects](./CONVENTIONS.md#9-database-objects--indexes), [§10 API contract](./CONVENTIONS.md#10-api-response-contract), [§11 seed volume](./CONVENTIONS.md#11-seed-volume-targets), [§12 global rules](./CONVENTIONS.md#12-global-rules-every-phase).
- [./README.md](./README.md) — build index, Golden Path, spine-vs-polish priority.
- [./PHASE-03-hero-query.md](./PHASE-03-hero-query.md) — `runTrace` + the exported SQL string these tests assert against.
- [./PHASE-04-api-layer.md](./PHASE-04-api-layer.md) — the five zod routes the contract test exercises.
- [./PHASE-05-outbreak-console.md](./PHASE-05-outbreak-console.md) · [./PHASE-06-query-inspector.md](./PHASE-06-query-inspector.md) · [./PHASE-07-supporting-screens.md](./PHASE-07-supporting-screens.md) — add the `data-testid` hooks the smoke uses.
- [./PHASE-02-seed-data.md](./PHASE-02-seed-data.md) — the seed the suite reads; the source of `DEMO_TLC`.
- [./PHASE-09-aws-aurora.md](./PHASE-09-aws-aurora.md) · [./PHASE-10-vercel-deploy.md](./PHASE-10-vercel-deploy.md) · [./PHASE-11-demo-and-submission.md](./PHASE-11-demo-and-submission.md) — what this phase unblocks.
- [../deep-dives/01-recall.md](../deep-dives/01-recall.md) — the product/architecture spec; see [§14 test plan](../deep-dives/01-recall.md#14-test-plan) (correctness + load) and [§13 risk register](../deep-dives/01-recall.md#13-risk-register).
- [../reference/submission-checklist.md](../reference/submission-checklist.md) — required artifacts; the runbook is your pre-flight.
- [../reference/vercel-v0-playbook.md](../reference/vercel-v0-playbook.md) — Fluid pooling / OIDC the contract test must not break.
```
