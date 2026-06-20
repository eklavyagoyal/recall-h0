# How Recall Works — the build, step by step

> A plain-language walkthrough of what we built and why it wins. Use it to understand the system and to narrate the demo. The thesis throughout: **the database is the protagonist; the UI is its courtroom evidence.**

---

## Step 1 — The problem, and the one idea

**The real-world problem.** When a food product is found contaminated — say E. coli in a batch of romaine lettuce — the company must answer one urgent question *immediately*: **"Which exact store shelves have product from this bad batch, right now?"** Today that takes **hours to days** of spreadsheets, supplier emails, and warehouse lookups — and while people dig, contaminated product stays on shelves. The FDA's **FSMA-204** rule will soon require traceability records **within 24 hours**, so there's a real, dated, budgeted buyer.

**What Recall does.** You paste one **Traceability Lot Code** (e.g. `PRD-OUTBREAK-0001`, a batch of Romaine Lettuce) and in **~300 ms** it traces the batch **backward** to its suppliers and **forward** through every transformation and shipment to **every affected store** (demo: 1,400 stores across 38 states, 2,583,144 units), maps them, and surfaces **similar past incidents**.

**The one idea.** The entire investigation is **a single database query**. The DB isn't storage — it's the detective. The frontend just lets you *watch the query think*.

---

## Step 2 — The data model: the supply chain as a graph

We model the real world as a graph inside Aurora PostgreSQL:

- `suppliers` → `facilities` → `lots` (a lot = one batch, with a unique `tlc` code and a `product_name`).
- `lot_links` is the key table: a **self-referencing edge list** (`parent_lot_id → child_lot_id`) that captures every transformation — blend, repack, slice, freeze. This turns the supply chain into a **directed acyclic graph (DAG)**.
- `shipments` connect finished lots to `stores` (each store has a real lat/long via PostGIS `geography`).
- `incidents` are complaint/outbreak reports, each carrying a **1024-dimensional embedding vector** of its text.

Crucially, every relationship is a **foreign key** the engine enforces. That FK-enforced DAG is what makes the trace *trustworthy* — the edges are valid by database guarantee, not by hope. We seed it at real scale: **80,000 lots, 250,000 edges, 250,000 shipments, 1,400 stores, 2,000 incidents.**

---

## Step 3 — The hero query: report in, outbreak out

One `SERIALIZABLE` SQL statement does the whole investigation. You give it a lot code; it returns, in one round trip: the contaminated sub-graph (for the graph view), every affected store with units and coordinates (for the map), the total blast radius, and the most similar incidents (for the rail). Report in → outbreak scope out, in a few hundred milliseconds. There is no application-side orchestration looping over hops — the database walks the whole thing itself, atomically, so the scope can't shift mid-trace.

---

## Step 4 — The three superpowers fused in that one query

The hero query is special because it combines **three different index types**, each doing a different kind of work, in a single statement — something only Aurora PostgreSQL can do:

1. **Recursive graph traversal** — a `WITH RECURSIVE` CTE walks `lot_links` from the contaminated lot outward (with a depth + cycle guard), using an index scan at every hop. *This is the graph database hiding inside Postgres.*
2. **Geospatial (PostGIS, GiST index)** — finds and orders the affected stores by location for the map.
3. **Vector similarity (pgvector, HNSW index)** — `ORDER BY embedding <=> query LIMIT 5` returns the most semantically similar incidents. We embed the traced lot's **product name** ("Romaine Lettuce"), so the rail surfaces genuinely relevant reports (Romaine + Listeria, ~0.65 cosine).

One subtlety we solved: at demo data volume Aurora's planner preferred a sequential scan over the HNSW index, so we added per-transaction tuning (`SET LOCAL random_page_cost = 1.1` + force the index path) — which both engages HNSW *and* cut total latency ~3.6×. The live `EXPLAIN` proves all three index paths: **Recursive Union + HNSW Index Scan + GiST Spatial Path**.

---

## Step 5 — The frontend: the Outbreak Console

A Next.js App Router app (React Server Components) renders the result as a control-room dashboard:

- **TopBar** — live query latency, affected-store count, total units, and a 24-hour FDA SLA countdown.
- **Graph pane** — a force-directed supply graph that **ignites red** along contaminated edges.
- **Map pane** — store pins dropped from the PostGIS coordinates.
- **Incident rail** — similar incidents with cosine-score badges.
- **Query Inspector** — the actual SQL + the **live EXPLAIN plan**, with the three index nodes highlighted. (Most teams hide their SQL; we make the plan the hero.)

The page is server-rendered on demand, so every number on screen is a real, fresh measurement — never cached, never faked.

---

## Step 6 — The cloud architecture (and how it's keyless)

- **Frontend + compute:** Vercel (Next.js on Fluid Compute, region `iad1` to sit next to the DB).
- **Database:** Amazon **Aurora PostgreSQL Serverless v2** with pgvector + PostGIS, **MinACU = 0** so it **scales to zero** (≈ $0 when idle — verified on CloudWatch: 0 ACU idle, 2 ACU under load).
- **Embeddings:** AWS **Bedrock Titan Text Embeddings V2** (1024-dim), called at request time.
- **Auth — fully keyless:** the Vercel function presents a **Vercel OIDC token** to AWS **STS** (`AssumeRoleWithWebIdentity`) and assumes a least-privilege IAM role (`bedrock:InvokeModel` only). **There are no AWS access keys anywhere** — not in the repo, env, or bundle. The DB password is RDS-managed in Secrets Manager and delivered as an encrypted Vercel env var; the connection is **TLS-verified** against the Amazon RDS CA. That absence of keys *is* the security proof.

---

## Step 7 — Why only Aurora PostgreSQL (the kill-shot)

The hero query needs graph recursion **and** geospatial **and** vector similarity **and** referential integrity — in one statement:

- **DynamoDB** can't do recursive graph traversal or ad-hoc joins at all.
- **Aurora DSQL** has **no PostGIS** (no map), **no pgvector** (no similarity search), and **no foreign keys** (no engine-enforced DAG integrity). *(It does support basic CTEs — we don't claim otherwise; the unimpeachable gaps are PostGIS + pgvector + FK.)*
- **Aurora PostgreSQL** fuses all four. Swap the database out and the product cannot exist. That's what "the database is load-bearing" means.

---

## Step 8 — The proof, and why it wins

What's verifiably true on the live deployment (https://recall-h0.vercel.app):

- **Speed:** the hero query runs in **~300 ms warm** (p50 144 ms in bench) over **580k rows**.
- **Scale honesty:** real volume seeded; one trace lights up **1,400 stores across 38 states / 2.58M units**.
- **The EXPLAIN** shows all three index paths live — irrefutable evidence the DB does the work.
- **Cost:** scale-to-zero verified (ACU 0 → 2), inside a $100 budget.
- **Production-grade:** keyless OIDC, least-privilege IAM (passed an automated security review), TLS-verified DB, 24 tests, CI-green build.

Mapped to the judging criteria: **Technological Implementation** (three index types in one query + keyless cloud), **Design** (the console makes an invisible distributed-systems property visible), **Impact** (a real, FSMA-204-dated buyer; recalls go from days to sub-second), **Originality** (a recall *is* one Postgres query — a thing no one expects from a database hackathon).

> The whole story in one line: **a product recall, solved as a single Aurora PostgreSQL query, watched live.**
