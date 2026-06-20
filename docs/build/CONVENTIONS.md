# CONVENTIONS — The Single Source of Truth for Recall

> **Project:** **Recall — The Outbreak Console**
> **Track:** Monetizable **B2B** (FSMA-204 food traceability)
> **Stack:** Amazon **Aurora PostgreSQL** + `pgvector` (HNSW) + **PostGIS**, **Next.js** on **Vercel**.

---

## How to use this contract

This document is the **contract every build phase obeys**. When a phase doc, a code comment, or even
the flagship spec [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) disagrees with anything
written here, **this file wins.** Read it before you write a line of code.

- It pins **exact names** (files, tables, columns, indexes, env vars, scripts, API shapes) so any agent
  can build without guessing. Use these names verbatim — divergence breaks downstream phases.
- The **canonical hero query** in [§7](#7-canonical-hero-query-forward-trace) is the whole product. Build it
  and prove it sub-second over real seed volume **before any UI**.
- The **global rules** in [§12](#12-global-rules-every-phase) are non-negotiable. The "never-cut" list and the
  anti-fake rules apply to every phase, every commit, every demo frame.
- Where the contract says **"verify"** (e.g. Titan v2 output dimension), do the verification against current
  AWS docs and record the result — do not assume.

> **Thesis in one line:** the **database is the protagonist** and the **UI is its courtroom evidence**.
> The **hero query** — ONE `SERIALIZABLE` recursive-CTE + PostGIS + pgvector statement — **is the whole product.**
> Build it before any UI.

---

## Table of contents

1. [Thesis](#1-thesis)
2. [System diagram](#2-system-diagram)
3. [Pinned tech stack](#3-pinned-tech-stack)
4. [`DEPLOY_TARGET` flag](#4-deploy_target-flag)
5. [Canonical directory tree](#5-canonical-directory-tree)
6. [Environment variables](#6-environment-variables)
7. [Canonical hero query (forward trace)](#7-canonical-hero-query-forward-trace)
8. [`package.json` scripts](#8-packagejson-scripts)
9. [Database objects & indexes](#9-database-objects--indexes)
10. [API response contract](#10-api-response-contract)
11. [Seed volume targets](#11-seed-volume-targets)
12. [Global rules (every phase)](#12-global-rules-every-phase)
13. [Required per-phase doc template](#13-required-per-phase-doc-template)
14. [Phase map](#14-phase-map)
15. [Related docs](#15-related-docs)

---

## 1. Thesis

**The database is the protagonist; the UI is its courtroom evidence.**

A recall is a **graph-traversal-correctness problem over a foreign-key-constrained supply DAG**: given a
contaminated traceability lot, find every downstream store that received derived product. Recall executes
that as **one `SERIALIZABLE` recursive CTE** that walks a `lot_links` edge table, JOINs **PostGIS** store
geography for the map, and selects a **pgvector HNSW** cluster of similar prior incidents — so three database
superpowers (graph recursion, geospatial join, vector similarity) are visible on **one screen** as the trace
fires. **Every visible pixel is a query result.**

- **Track:** Monetizable **B2B** — sold per-facility to grocery chains, distributors, and CPG manufacturers
  as a recall-readiness / **FSMA-204** traceability console. (Secondary public-good tag: faster recalls =
  fewer foodborne illnesses — mention once, lead B2B.)
- **Database, non-interchangeable:** DynamoDB has no recursion or ad-hoc joins; Aurora DSQL has no PostGIS and
  no extension ecosystem (so no pgvector) and no FK-enforced DAG integrity. **Only Aurora PostgreSQL** fuses
  graph recursion + geospatial + vector similarity in one statement, inside one serializable transaction.
- **The hero query is the whole product.** Get it correct and sub-second over ~250k edges **before any UI**.
  The live `EXPLAIN (ANALYZE, BUFFERS)` plan is the hero artifact.

> **Spine-first build order:** **schema → seed → hero query → console → inspector.** Everything else is garnish.

---

## 2. System diagram

```mermaid
flowchart LR
  subgraph Browser["Browser — operator (dark control-room UI)"]
    UI["Outbreak Console<br/>(Next.js 15 App Router, React 19)"]
    GFX["react-force-graph-2d (d3-force)<br/>+ maplibre-gl / react-map-gl"]
  end

  subgraph Vercel["Vercel — region iad1 (us-east-1), Fluid Compute"]
    RSC["RSC first paint<br/>(runs runTrace server-side)"]
    API["Route Handlers<br/>/api/trace · /api/explain · /api/lineage<br/>/api/incidents · /api/metrics"]
    POOL["module-scope pg.Pool<br/>+ attachDatabasePool() (@vercel/functions)"]
  end

  subgraph AWS["AWS — us-east-1"]
    OIDC["STS AssumeRoleWithWebIdentity<br/>(OIDC keyless — no static keys)"]
    AUR[("Aurora PostgreSQL Serverless v2<br/>engine 16+ · MinACU=0 · MaxACU=2<br/>pgvector HNSW + PostGIS + FK-enforced DAG")]
    BR["Bedrock Titan Text Embeddings v2<br/>(optional cloud embed provider)"]
  end

  UI --> RSC
  GFX -. "rows" .- RSC
  UI --> API
  RSC --> POOL
  API --> POOL
  POOL -- "short-lived STS creds" --> OIDC
  OIDC --> AUR
  POOL --> AUR
  BR -. "embeddings backfill (offline)" .-> AUR
```

> No NAT Gateway. No RDS Proxy unless connection limits force it. Streams/SSE are **not** required for the spine.
> `DEPLOY_TARGET=local` swaps Aurora for the Docker Postgres image; nothing else changes.

---

## 3. Pinned tech stack

> Do not substitute without noting why (in `BUILD_LOG.md`).

| Concern | Pinned choice |
|---|---|
| **Runtime** | Node.js **24 LTS** |
| **Package manager** | **pnpm** |
| **Framework** | **Next.js 15+** App Router, **React 19**, **TypeScript strict** |
| **Styling / UI** | **Tailwind CSS v4** + **shadcn/ui**; **dark mode default** (control-room aesthetic) |
| **DB driver** | **`pg`** (node-postgres). **RAW parameterized SQL only** for the hero path (NO ORM). Module-scope `Pool` + `attachDatabasePool` from `@vercel/functions` for Fluid Compute |
| **Migrations** | Plain numbered SQL files in `db/migrations`, applied by `scripts/migrate.ts` (pg + tsx), **forward-only** |
| **Embeddings** | **Pluggable.** Local provider = `@xenova/transformers`, model `Xenova/all-MiniLM-L6-v2` (**384-dim**), pure Node, zero credits. Cloud provider = **AWS Bedrock Titan Text Embeddings v2**. `EMBED_DIM` is **one config constant**; `incidents.embedding` is `vector(EMBED_DIM)` chosen at migrate time from env. (**Verify** Titan v2 output dimension against current AWS docs and set `EMBED_DIM` to match; local stays 384.) |
| **Map** | **`maplibre-gl` + `react-map-gl`** with a free/dark basemap style |
| **Graph** | **`react-force-graph-2d`** (d3-force under the hood) for the igniting supply graph |
| **Validation** | **zod** on every route |
| **Tests** | **vitest**; optional **Playwright** smoke |
| **Scripts** | run via **tsx** |
| **Local DB** | Docker image built **`FROM postgis/postgis:16-3.4`** with package `postgresql-16-pgvector` installed; `docker/init.sql` runs `CREATE EXTENSION IF NOT EXISTS postgis;` + `CREATE EXTENSION IF NOT EXISTS vector;` |
| **Cloud DB** | **Aurora PostgreSQL Serverless v2** (engine 16+), **MinCapacity=0** (scale-to-zero), **MaxCapacity=2**, region **`us-east-1`**, extensions `vector` + `postgis`, publicly-accessible endpoint **LOCKED by security group**. **NO NAT Gateway. NO RDS Proxy** unless connection limits force it |
| **AWS auth from Vercel** | **OIDC keyless** (`@vercel/oidc-aws-credentials-provider`, `awsCredentialsProvider({ roleArn })`, STS `AssumeRoleWithWebIdentity`, IAM trust to `oidc.vercel.com/[TEAM_SLUG]`). **NEVER long-lived AWS keys in the app.** |

---

## 4. `DEPLOY_TARGET` flag

`DEPLOY_TARGET` (`local` | `aurora`) is the **ONLY** difference between dev and cloud.
`lib/db/pool.ts` branches on it.

```mermaid
flowchart LR
  ENV["DEPLOY_TARGET"] -->|local| LOCAL["Docker Postgres<br/>(postgis:16-3.4 + pgvector)<br/>DATABASE_URL, EMBED_PROVIDER=local"]
  ENV -->|aurora| CLOUD["Aurora Serverless v2<br/>OIDC keyless STS creds<br/>AURORA_* env, optional Bedrock embed"]
```

- `local` → connect via `DATABASE_URL` to the Docker container; embeddings via `@xenova/transformers`.
- `aurora` → connect to the Aurora endpoint using OIDC-resolved STS credentials; embeddings via local **or** Bedrock per `EMBED_PROVIDER`.
- Nothing else in the app branches on environment. Keep it that way.

---

## 5. Canonical directory tree

The Next.js app lives at the **REPOSITORY ROOT**. Strategy docs stay under `docs/`. **Do not nest the app inside `docs/`.**
Use these exact paths in every phase.

```
.
├─ app/
│  ├─ layout.tsx
│  ├─ globals.css
│  ├─ page.tsx                         # the Outbreak Console / home
│  ├─ api/
│  │  ├─ trace/route.ts                # POST forward-trace — the hero endpoint
│  │  ├─ explain/route.ts              # POST EXPLAIN ANALYZE (text + nodes)
│  │  ├─ lineage/route.ts              # GET lineage trail
│  │  ├─ incidents/route.ts            # GET incidents + clusters
│  │  └─ metrics/route.ts              # GET latency samples
│  └─ actions/
│     └─ trace.ts                      # optional server action
├─ components/
│  ├─ console/
│  │  ├─ TopBar.tsx
│  │  ├─ GraphPane.tsx
│  │  ├─ MapPane.tsx
│  │  ├─ IncidentRail.tsx
│  │  ├─ QueryInspector.tsx
│  │  ├─ LineageDrawer.tsx
│  │  ├─ IncidentInbox.tsx
│  │  └─ ScopeExport.tsx
│  └─ ui/                              # shadcn/ui components
├─ lib/
│  ├─ config.ts                        # EMBED_DIM, EMBED_PROVIDER, DEPLOY_TARGET, AWS_REGION, DEMO_TLC
│  ├─ types.ts                         # TraceResult, Edge, AffectedStore, SimilarIncident
│  ├─ db/
│  │  ├─ pool.ts                       # module-scope Pool; branches on DEPLOY_TARGET
│  │  ├─ explain.ts
│  │  └─ queries/
│  │     ├─ trace.ts                   # hero query + runTrace
│  │     ├─ lineage.ts
│  │     └─ incidents.ts
│  └─ embeddings/
│     ├─ index.ts                      # embed dispatcher
│     ├─ local.ts                      # @xenova/transformers
│     └─ bedrock.ts                    # AWS Bedrock Titan
├─ db/
│  ├─ migrations/
│  │  ├─ 0001_extensions.sql
│  │  ├─ 0002_schema.sql
│  │  └─ 0003_indexes.sql
│  └─ seed/
│     ├─ generate.ts
│     └─ load.ts
├─ scripts/
│  ├─ migrate.ts
│  └─ trace-bench.ts
├─ test/
│  └─ trace.test.ts
├─ docker/
│  ├─ Dockerfile.postgres
│  └─ init.sql
├─ docker-compose.yml
├─ vercel.json
├─ .env.example
├─ package.json
├─ SETUP.md
└─ BUILD_LOG.md
```

---

## 6. Environment variables

Document these in `.env.example` using these **canonical names**.

| Variable | Example / value | Notes |
|---|---|---|
| `DEPLOY_TARGET` | `local` | `local` \| `aurora` — the only dev↔cloud switch |
| `DATABASE_URL` | `postgres://recall:recall@localhost:5432/recall` | local Docker connection |
| `EMBED_PROVIDER` | `local` | `local` (`@xenova/transformers`) \| `bedrock` (Titan v2) |
| `EMBED_DIM` | `384` | **one** config constant; `incidents.embedding` = `vector(EMBED_DIM)`. Local = 384; Bedrock = verified Titan v2 dim |
| `DEMO_TLC` | `PRD-OUTBREAK-0001` | the pinned demo lot that traces to ~1,400 stores in <1s |
| `AWS_REGION` | `us-east-1` | co-located with the Vercel function region |
| `AWS_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/...` | assumed via OIDC keyless STS |
| `AURORA_HOST` | `<cluster>.cluster-xxxx.us-east-1.rds.amazonaws.com` | Aurora endpoint |
| `AURORA_PORT` | `5432` | |
| `AURORA_DB` | `recall` | |
| `AURORA_USER` | `recall_app` | least-privilege DB user |
| `AURORA_SECRET_ARN` | `arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:recall/db-*` | DB credentials in Secrets Manager |
| `BEDROCK_MODEL_ID` | `amazon.titan-embed-text-v2:0` | **verify dim** and set `EMBED_DIM` to match |

---

## 7. Canonical hero query (forward trace)

The whole product. **Get it correct and sub-second over ~250k edges before any UI.**

- **Params:** `$1` = `tlc` text · `$2` = `query_embedding` cast `::vector` · `$3` = `as_of` `timestamptz` or `NULL`.
- **Execute inside** `BEGIN ISOLATION LEVEL SERIALIZABLE; ... COMMIT;`.
- The `trace.sql` string is **surfaced to the Query Inspector**.

```sql
WITH RECURSIVE contaminated AS (
  SELECT l.lot_id, 0 AS depth, ARRAY[l.lot_id] AS path
  FROM lots l WHERE l.tlc = $1
  UNION ALL
  SELECT ll.child_lot_id, c.depth + 1, c.path || ll.child_lot_id
  FROM contaminated c JOIN lot_links ll ON ll.parent_lot_id = c.lot_id
  WHERE c.depth < 12 AND ll.child_lot_id <> ALL(c.path)        -- depth guard + cycle guard
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
       (SELECT count(*) FROM affected) AS store_count, (SELECT json_agg(similar) FROM similar) AS incidents;
```

**Requirements (must hold, verified via `EXPLAIN`):**

- `EXPLAIN` must show an **Index Scan on `lot_links`** at **each recursive iteration** (never a seq scan).
- `EXPLAIN` must show the **HNSW index scan** on `incidents.embedding`.
- `EXPLAIN` must show the **GiST spatial path** for `stores.geom`.
- **p50 < 1s** over ~250k edges.
- The `trace.sql` string is surfaced to the **Query Inspector**.

> The graph **IS** the recursion, the map **IS** the geo JOIN, the rail **IS** the vector search.

---

## 8. `package.json` scripts

Canonical scripts. Each spine phase ends GREEN with `pnpm typecheck && pnpm lint && pnpm test`.

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | local dev server |
| `build` | `next build` | production build |
| `start` | `next start` | run the production build |
| `lint` | `next lint` (or eslint) | lint |
| `typecheck` | `tsc --noEmit` | strict type check |
| `test` | `vitest` | unit / correctness tests |
| `db:up` | `docker compose up -d` | start local Postgres |
| `db:down` | `docker compose down` | stop local Postgres |
| `db:migrate` | `tsx scripts/migrate.ts` | apply forward-only migrations |
| `db:seed` | `tsx db/seed/load.ts` | generate + load seed data |
| `bench` | `tsx scripts/trace-bench.ts` | measure trace latency (p50/p99) |

---

## 9. Database objects & indexes

> Columns are per [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) **Data Model verbatim**. Foreign keys
> **and** CHECK constraints are **ENFORCED** — this FK-enforced DAG integrity is part of the thesis (the property
> DSQL provably cannot provide and the reason the trace is trustworthy).

### Tables (exact names)

| Table | Role |
|---|---|
| `suppliers` | supply base, `geom geography(Point,4326)` |
| `facilities` | farm/processor/distributor/warehouse, FK → `suppliers` |
| `lots` | traceability lots; `tlc UNIQUE`, `lot_type` CHECK, FK → `facilities` |
| `lot_links` | **the DAG edge table** — `(parent_lot_id, child_lot_id)` PK, `transform_event`, `CHECK(parent_lot_id <> child_lot_id)`, FKs → `lots` |
| `stores` | retail stores; `geom geography(Point,4326) NOT NULL` |
| `shipments` | lot → store; `units > 0` CHECK, `shipped_at`, FKs → `lots`, `stores` |
| `store_inventory` | `(store_id, lot_id)` PK, `units_on_hand >= 0` CHECK, FKs → `stores`, `lots` |
| `incidents` | reports; `embedding vector(EMBED_DIM)`, `suspected_lot_id` FK → `lots`, `pathogen` |
| `incident_lot_matches` | `(incident_id, lot_id)` PK, FKs → `incidents`, `lots` |

### Indexes (exact names — these show up in `EXPLAIN`)

| Index | Definition | Why |
|---|---|---|
| `idx_lot_links_parent` | `lot_links(parent_lot_id)` | forward recursion |
| `idx_lot_links_child` | `lot_links(child_lot_id)` | backward recursion |
| `idx_shipments_lot` | `shipments(lot_id)` | shipments JOIN |
| `idx_shipments_store` | `shipments(store_id)` | store JOIN |
| `idx_store_inventory` | `store_inventory(store_id, lot_id)` | lineage |
| `idx_incidents_hnsw` | `incidents USING hnsw (embedding vector_cosine_ops)` | pgvector similarity |
| `idx_stores_geom` | `stores USING gist (geom)` | PostGIS spatial |

---

## 10. API response contract

TypeScript-ish type sketches. The `lib/types.ts` types (`TraceResult`, `Edge`, `AffectedStore`, `SimilarIncident`)
mirror these shapes. Validate every route input with **zod**.

```ts
// POST /api/trace   body: { tlc: string; asOf?: string }
type TraceResponse = {
  meta: {
    latencyMs: number;     // REAL measurement — never hardcoded
    lotCount: number;
    edgeCount: number;
    storeCount: number;
    totalUnits: number;
    asOf: string | null;
  };
  edges: { parent: number; child: number; transform: string }[];        // -> Edge[]
  stores: {                                                             // -> AffectedStore[]
    storeId: number; name: string; chain: string; address: string;
    lat: number; lng: number; units: number;
  }[];
  incidents: { incidentId: number; text: string; pathogen: string | null; score: number }[]; // -> SimilarIncident[]
  sql: string;             // the trace.sql string, surfaced to the Query Inspector
};

// POST /api/explain  body: { tlc: string }
type ExplainResponse = {
  plan: string;                                  // EXPLAIN (ANALYZE, BUFFERS) text
  nodes: { type: string; detail: string }[];     // parsed: Recursive Union, HNSW, GiST...
};

// GET /api/incidents
type IncidentsResponse = {
  clusters: { label: string; incidentIds: number[]; size: number }[];
  incidents: SimilarIncident[];
};

// GET /api/lineage?storeId=<id>   |   ?lotId=<id>
type LineageResponse = {
  trail: {
    lot: string; facility: string; supplier: string;
    shipment: number; units: number; shippedAt: string;
  }[];
};

// GET /api/metrics
type MetricsResponse = {
  samples: { ts: string; latencyMs: number }[];
  lastRowCount: number;
};
```

---

## 11. Seed volume targets

**Print ACTUAL counts after seeding** (the anti-"12 rows" move — counts go on screen).

| Entity | Target | Notes |
|---|---|---|
| suppliers / facilities | **~5,000** | a credible supply base |
| lots | **~80,000** | a real corpus, not a toy |
| `lot_links` (DAG edges) | **~250,000** | **ACYCLIC** — generate in topological layers; fan-out depth ~4–7 |
| shipments | **~250,000** | the edges to stores |
| stores | **~1,400** | across **38 US states** with real lat/long |
| incidents | **~2,000** | with **REAL** embeddings (precompute — never fake) |

> The `DEMO_TLC` lot must trace to **~1,400 stores in <1s**.
> Acyclicity is built two ways: the generator only links older→newer lots (acyclic by construction), and the
> recursive term carries a `path` visited-set + `depth < 12` guard.

---

## 12. Global rules (every phase)

- **Spine first:** schema → seed → hero query → console → inspector.
- **NEVER cut:** the recursive CTE · the PostGIS map JOIN · the pgvector rail · the live `EXPLAIN` · real seed
  volume · the live-URL deploy. If any of these is at risk, cut features instead.
- **Anti-fake:** no hardcoded latency · no fake history · no toy seed · no localhost passed off as deployed.
  The latency on screen is a **real measurement**.
- **Security:** AWS creds server-side only · OIDC keyless · **never commit secrets**.
- **Each phase ends GREEN:** `pnpm typecheck` + `pnpm lint` + `pnpm test` all pass, **AND** the agent runs the
  app and verifies behavior, **AND** appends a `BUILD_LOG.md` entry (which doubles as bonus build-in-public content).
- **Budget:** $100 AWS is set and fine to use; scale-to-zero (MinACU=0) keeps idle ~$0; **DELETE Aurora +
  snapshots after submission**.
- **Commits:** small, conventional (`feat:` / `chore:` / `fix:`), on a branch; **do not push unless asked**.

---

## 13. Required per-phase doc template

Every `PHASE-NN` doc MUST follow this structure exactly:

- **H1:** `Phase NN — Title`
- One-line **`Outcome:`** — what concretely exists when done.
- A **`Depends on / Unblocks`** line.
- An **`Effort`** estimate.
- Then numbered sections:
  1. **Objectives**
  2. **Prerequisites** (checklist)
  3. **Step-by-step** — numbered; **EXACT shell commands** and **FULL or skeleton file contents** in fenced code
     blocks with language tags; for **spine phases** include **real, complete code, not pseudocode**.
  4. **Key files** (table: path → purpose)
  5. **Definition of Done** — checkbox list **WITH exact verification commands and expected output**.
  6. **Common pitfalls & fixes** (table)
  7. **Cut-if-scope-bites** (and the **never-cut reminder**)
  8. **BUILD_LOG entry to append**
  9. **Related docs** — relative links to `./CONVENTIONS.md`, `./README.md`, sibling PHASE files,
     `../deep-dives/01-recall.md`, `../reference/*`.

Use **GFM tables**, **fenced code**, **task lists**, and **mermaid** where it helps. Be incredibly detailed and
executable — an agent should follow it one-to-one with **no guesswork**.

---

## 14. Phase map

Sibling files in `docs/build/`:

| File | Role |
|---|---|
| [`CONVENTIONS.md`](./CONVENTIONS.md) | this contract (single source of truth) |
| [`README.md`](./README.md) | index & navigation |
| [`PHASE-00-foundation.md`](./PHASE-00-foundation.md) | repo, tooling, scripts, docker scaffold |
| [`PHASE-01-database-schema.md`](./PHASE-01-database-schema.md) | tables, FKs, CHECKs, indexes |
| [`PHASE-02-seed-data.md`](./PHASE-02-seed-data.md) | acyclic DAG generator + real embeddings |
| [`PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) | the recursive-CTE forward trace + `runTrace` |
| [`PHASE-04-api-layer.md`](./PHASE-04-api-layer.md) | route handlers + zod |
| [`PHASE-05-outbreak-console.md`](./PHASE-05-outbreak-console.md) | graph + map + rail wired to real rows |
| [`PHASE-06-query-inspector.md`](./PHASE-06-query-inspector.md) | live `EXPLAIN ANALYZE` panel |
| [`PHASE-07-supporting-screens.md`](./PHASE-07-supporting-screens.md) | lineage drawer, inbox, scope export |
| [`PHASE-08-testing.md`](./PHASE-08-testing.md) | correctness + adversarial + load |
| [`PHASE-09-aws-aurora.md`](./PHASE-09-aws-aurora.md) | provision Aurora Serverless v2, OIDC, IAM |
| [`PHASE-10-vercel-deploy.md`](./PHASE-10-vercel-deploy.md) | deploy, env, Fluid pooling, live URL |
| [`PHASE-11-demo-and-submission.md`](./PHASE-11-demo-and-submission.md) | video, screenshots, required artifacts |
| [`PHASE-12-build-in-public.md`](./PHASE-12-build-in-public.md) | bonus public content |
| [`SETUP-AWS-V0.md`](./SETUP-AWS-V0.md) | AWS + v0 account / workspace setup |

---

## 15. Related docs

- [`./README.md`](./README.md) — build index & navigation
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — the flagship product + architecture spec
- [`../../IDEATION.md`](../../IDEATION.md) — master strategy
- [`../reference/aws-databases.md`](../reference/aws-databases.md) — Aurora PG superpowers + screenshot-proof catalog
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — OIDC keyless, Fluid pooling, RSC/Server Actions
- [`../reference/submission-checklist.md`](../reference/submission-checklist.md) — required artifacts, demo rules, pre-flight
- [`../../CODEX_HANDOFF.md`](../../CODEX_HANDOFF.md) — handoff notes
