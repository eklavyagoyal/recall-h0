# Recall — The Outbreak Console

> **Paste one contaminated lot code. In one SQL statement, trace it through the supply chain to every affected store, map them, and surface every similar past outbreak — in ~300ms over 580,000 rows.**

---

## What it is

**Recall** is a live product-recall dispatch console for food-safety operations. A QA director pastes a contaminated **Traceability Lot Code (TLC)** and, in a single SQL query, Recall:

1. **Traces the lot through the supply chain** — walking a foreign-key-constrained supply DAG to find every downstream lot derived from the contaminated one.
2. **Maps every affected store** — the exact retail locations that received product from any implicated lot, with recalled-unit counts.
3. **Surfaces semantically-similar past incidents** — prior outbreak reports clustered by vector similarity, so a new report is instantly connected to history.

The UI is a dark control-room console: a **TopBar** (live query latency, affected-store count, and an FDA 24-hour SLA clock anchored to the latest matching incident report), a **GraphPane** that ignites red along contaminated supply edges, a **MapPane** that drops store pins, and an **IncidentRail** of similar incidents with cosine-score badges. An **Outbreak Time-Travel replay** scrubs the temporal blast radius by shipment arrival time; because `/api/trace` accepts `asOf`, the same recursive trace can be re-run at any point in shipment history with the FK-DAG + temporal filter in one query. A **Query Inspector** shows the live `EXPLAIN` plan. **Every visible pixel is a query result — the database is the protagonist and the UI is its courtroom evidence.**

- **Track:** Monetizable B2B — sold per-facility to grocery chains, distributors, and CPG manufacturers as a recall-readiness / FSMA-204 traceability console.
- **Buyer:** a VP of Food Safety with a federal deadline and a budget.
- **Live URL:** https://recall-h0.vercel.app

---

## The AWS database we used: Amazon Aurora PostgreSQL

The AWS database is **Amazon Aurora PostgreSQL** — Serverless v2, engine 16.6, region `us-east-1`, cluster `recall-aurora`, scale-to-zero (MinACU=0, auto-pause 300s, MaxACU=2). Two extensions do the heavy lifting: **pgvector 0.8** (HNSW index, `vector_cosine_ops`) and **PostGIS** (GiST geography index).

### AWS Database Usage (required submission item)

**The hero query is one `SERIALIZABLE` statement that fuses three index paths the live `EXPLAIN` proves.** It is not three queries stitched in app code — it is one round trip the planner executes against three different index structures inside one transaction, so the recall scope cannot shift while shipments are still being ingested.

```sql
WITH RECURSIVE contaminated AS (
  SELECT l.lot_id, 0 AS depth, ARRAY[l.lot_id] AS path
  FROM lots l WHERE l.tlc = $1
  UNION ALL
  SELECT ll.child_lot_id, c.depth + 1, c.path || ll.child_lot_id
  FROM contaminated c JOIN lot_links ll ON ll.parent_lot_id = c.lot_id
  WHERE c.depth < 12 AND ll.child_lot_id <> ALL(c.path)   -- depth guard + cycle guard
),
...
similar_incidents AS (
  SELECT i.incident_id, i.raw_text, i.pathogen, 1 - (i.embedding <=> $2::vector) AS score
  FROM incidents i WHERE EXISTS (SELECT 1 FROM contaminated)
  ORDER BY i.embedding <=> $2::vector LIMIT 5   -- pgvector HNSW
);
```

The three fused index paths (served live by `/api/explain` as three node types):

1. **Recursive Union — graph traversal.** A `WITH RECURSIVE` CTE walks the FK-constrained supply DAG over the `lot_links` edge table, carrying a `path` array as a visited-set and a `depth < 12` guard so a cycle or a pathological chain can never hang the trace. `EXPLAIN` shows an **index scan on `lot_links` at every recursive iteration** — never a seq scan.
2. **GiST Spatial Path — the map.** A PostGIS path over `stores.geom` (`geography(Point,4326)`, GiST-indexed) joins shipments of implicated lots to physical store locations, returning lat/lng for the map pins and `SUM(units)` per store.
3. **HNSW Index Scan — similar incidents.** A pgvector HNSW index scan over `incidents.embedding` ranks prior outbreak reports by cosine distance (`ORDER BY embedding <=> $query LIMIT 5`).

**The data model.** A foreign-key-constrained schema enforces DAG integrity *in the engine*: `lot_links(parent_lot_id, child_lot_id)` is a PK with `CHECK(parent_lot_id <> child_lot_id)` and FKs to `lots`; `shipments` FK to `lots` and `stores`; `incidents` carry the embedding column. Because the edges are FK-enforced, the trace is trustworthy — there are no dangling edges that would silently under- or over-report the recall scope.

**The embeddings.** Similar-incident search runs over **AWS Bedrock Titan Text Embeddings V2 (1024-dim)** vectors. `EMBED_DIM` is one config constant — 1024 in the cloud (Titan), 384 locally (`@xenova/transformers` all-MiniLM-L6-v2, zero credits). The HNSW index is built over real embeddings, and every incident card shows its cosine score so the search is visibly relevance-ranked, not a `LIKE` in disguise.

**Scale-to-zero economics.** Aurora Serverless v2 with MinACU=0 means **CloudWatch `ServerlessDatabaseCapacity` sits at 0.0 ACU when idle (~$0)** and scales to 2.0 ACU under the trace burst, then back down — all inside a $100 AWS budget. Per-transaction planner tuning is scoped with `SET LOCAL` (so nothing global is affected) to keep the vector and relational index paths engaged at demo volume.

**The hard problems designed around:** depth-guarded + visited-set recursion (no cycles, no quadratic blowup); `SERIALIZABLE` isolation with a bounded `40001` serialization-conflict retry loop (so an ingest mid-trace can't corrupt the scope); HNSW kept on the planner's critical path; and a module-scope `pg.Pool` with `attachDatabasePool` to survive Vercel Fluid Compute connection churn.

### Verified live numbers

Seeded at scale: **80,000 lots, 250,000 `lot_links` edges, 250,000 shipments, 1,400 stores across 38 US states, 2,000 incidents** (all with real 1024-dim embeddings). Tracing the demo lot **`PRD-OUTBREAK-0001` (Romaine Lettuce)** reaches **1,400 affected stores across 38 states, 674,285 units, 81 contaminated lots / 80 edges**. Hero-query latency on real Aurora: **p50 ~144ms (bench), warm API ~305–514ms over 580k rows**; the first request after auto-pause is ~15s only while the cluster resumes from scale-to-zero. Similar-incidents return genuinely relevant matches (e.g. *"FDA alert: outbreak ... linked to Romaine Lettuce. Pathogen panel positive for Listeria monocytogenes"*, cosine score ~0.65).

---

## Why only Aurora PostgreSQL (the kill-shot)

A recall is a **graph-traversal-correctness problem over an FK-constrained supply DAG**. Only one of the three AWS databases can express it in a single statement:

- **DynamoDB** cannot do recursive graph traversal or ad-hoc joins. You'd fan out N round-trips per hop in app code and lose the serializable scope — a shipment ingested mid-trace could corrupt the recall.
- **Aurora DSQL** has **no PostGIS** (no geometry/geography types, so no spatial join for the map), **no pgvector** (no extension ecosystem, so no similarity search), and **no foreign keys** (so no engine-enforced DAG integrity). DSQL *does* support basic recursive CTEs — we don't claim otherwise; the unimpeachable points are PostGIS + pgvector + FK integrity.

**Only Aurora PostgreSQL fuses graph recursion + geospatial + vector similarity + serializable correctness in one statement.** The DB is provably non-interchangeable — and that's the whole entry.

---

## How we built it

- **Frontend:** Next.js 16 App Router (TypeScript, RSC first paint, dynamic route, API route handlers) on **Vercel Fluid Compute**, region `iad1` co-located with Aurora in `us-east-1` so there's no cross-region latency tax. Tailwind v4 + shadcn/ui for the dark control-room UI; `maplibre-gl` / `react-map-gl` for the PostGIS store map; `react-force-graph-2d` for the igniting supply graph; zod validation on every route.
- **Database access:** `pg` (node-postgres) with a module-scope pool + `attachDatabasePool`; raw parameterized SQL on the hero path (no ORM).
- **Keyless AWS auth:** Bedrock embeddings are called **keyless** from the Vercel runtime — **Vercel OIDC → AWS STS `AssumeRoleWithWebIdentity` → IAM role `recall-vercel-runtime`** (least-privilege `bedrock:InvokeModel`). **No long-lived AWS keys anywhere.** The RDS-managed master password lives in Secrets Manager; the app receives the DB password as `PGPASSWORD` via Vercel encrypted env; TLS is verified against the Amazon RDS global CA bundle (`rejectUnauthorized: true`); the IAM trust is pinned to production + preview (no wildcard).
- **One config switch:** `DEPLOY_TARGET` (`local` | `aurora`) is the only dev↔cloud difference — local dev runs Docker `postgis:16-3.4` + pgvector with MiniLM embeddings (zero credits); cloud runs Aurora with Titan.
- **Tested:** vitest (34 passing unit/contract tests) + a Playwright smoke test.

**Request path:** browser → Next.js RSC / route handler on Vercel → module-scope `pg.Pool` → (Bedrock embed via OIDC/STS) → Aurora PostgreSQL Serverless v2.

---

## Inspiration / Impact

**FSMA-204 (the FDA Food Traceability Final Rule) legally requires producing traceability records to the FDA within 24 hours of request, with enforcement beginning 2028.** Today, when a contamination report lands, food-safety teams answer "which stores have product from this lot?" by hand — reconciling spreadsheets, supplier EDI exports, and warehouse systems. It takes **hours to days**, and during that window contaminated product stays on shelves and liability compounds. Because they can't trace precisely, chains over-recall the entire region.

Recall collapses that into **one query**: paste the lot, and the exact affected stores, unit counts, and similar prior outbreaks are on the table in ~300ms. The value is **scope precision** (pull the exactly-affected shelves, not the metro) under a **mandated, dated, budgeted** deadline.

---

## Challenges

- **Getting HNSW chosen by the planner.** At a few thousand incidents, Postgres's default cost model prefers a seq scan + top-N sort over the pgvector HNSW index; at production incident volume the HNSW path dominates. We reflect Aurora's real fast-distributed-storage I/O profile with transaction-scoped `SET LOCAL random_page_cost = 1.1` and `SET LOCAL enable_seqscan = off`, keeping the HNSW (and recursive/spatial index) paths engaged without touching anything outside the trace transaction.
- **Keyless OIDC.** Wiring Vercel OIDC → STS `AssumeRoleWithWebIdentity` → a least-privilege IAM role (so Bedrock is called with zero long-lived keys) required getting the trust policy audience/subject pinned to production + preview without a wildcard.
- **Connection & secret handling under serverless.** Surviving Fluid Compute connection churn took a module-scope pool + `attachDatabasePool`; the DB password is delivered as `PGPASSWORD` via Vercel encrypted env with TLS verified against the RDS global CA bundle — never a hardcoded key.
- **Recursion safety.** Keeping the recursive CTE from cycling or going quadratic on a 250k-edge graph: an acyclic-by-construction seed, plus a `path` visited-set and a `depth < 12` guard in the recursive term.

---

## Accomplishments we're proud of

- **Three index paths in one ~300ms query** — Recursive Union + GiST Spatial Path + HNSW Index Scan — fused in a single `SERIALIZABLE` statement over **580k rows**, with the live `EXPLAIN` plan as proof.
- **Outbreak Time-Travel replay** — a scrubber reconstructs the spreading blast radius over shipment history, and the API can re-run the same recursive trace with an `asOf` cutoff.
- **Fully keyless** — no long-lived AWS credentials anywhere; Bedrock via OIDC/STS, DB secret in Secrets Manager.
- **Scale-to-zero** — verified 0.0 ACU at idle (~$0) on CloudWatch, scaling to 2.0 ACU under load, inside a $100 budget.
- **A provably non-interchangeable database choice** — the entry literally cannot run on DynamoDB or DSQL.
- **Real volume, real numbers** — 1,400 stores across 38 states, 674,285 units, on the live deployed URL.

---

## What's next

- **Backward (upstream) trace** — the same recursive CTE flipped to walk `child → parent`, to find the source supplier/ingredient that introduced the contaminant.
- **Live shipment ingest** — a Vercel Cron / SQS-backed stream so the affected-store scope updates as new shipments land, exercising the SERIALIZABLE retry path on camera.
- **FDA-ready record export** — a one-click traceability record (affected stores, lot codes, unit counts, timestamps) plus shelf-pull notifications to affected stores.
- **Multi-tenant** — onboard each client facility as a traceable node for a Recall-as-a-Service consultancy, billed per facility.
- **Observability** — structured telemetry with trace IDs, per-node latency, and CloudWatch dashboards/alerts tied to the 24h SLA.

---

## Required submission fields

| Field | Value |
|---|---|
| **AWS database** | **Amazon Aurora PostgreSQL** (Serverless v2, engine 16.6, `us-east-1`, cluster `recall-aurora`; pgvector 0.8 HNSW + PostGIS) |
| **Published Vercel project link (live)** | https://recall-h0.vercel.app |
| **Vercel Team ID** | `team_vr98mdXQJyxKN5yAtBuO48T8` |
| **GitHub** | https://github.com/eklavyagoyal/recall-h0 (visibility flip pending owner confirmation before final submission) |

**v0 status:** Official H0 FAQ says v0 is recommended for speed, not required; the requirement is a deployed Vercel frontend. Recall is deployed on Vercel with a hand-built Next.js 16 interface around the Aurora query spine.
