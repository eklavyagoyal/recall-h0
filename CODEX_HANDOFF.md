# Codex Build Prompt — Recall: The Outbreak Console (H0 Hackathon Flagship)

> Paste everything below the line into Codex. It is written as a direct instruction to the agent and is self-contained; the repo's `docs/` are the canonical spec.

---

You are taking over a hackathon build as the lead engineer + product builder. The strategy work is done and it is excellent — your job is to turn it into a real, deployed, demo-winning application. **Cook generationally.** I want a judge to watch the demo and think: *"I did not expect this from a database hackathon. This could be a company. I can't forget that screen."* Be ambitious and tasteful, but ruthlessly disciplined about the one thing that wins.

## 0. Orient yourself (read before writing code)
This repo contains a complete strategy. Read these, in order, and treat them as ground truth:
1. `docs/README.md` — the index and the winning thesis.
2. `docs/deep-dives/01-recall.md` — **your primary build spec. This is the project. Internalize all 17 sections.**
3. `docs/reference/aws-databases.md` — why Aurora PostgreSQL is load-bearing and the other two DBs are wrong.
4. `docs/reference/vercel-v0-playbook.md` — OIDC keyless auth, Fluid Compute connection pooling, SSE, deploy patterns.
5. `docs/reference/submission-checklist.md` — the required artifacts and the demo rubric.
6. `docs/01-judging-model.md` and `docs/05-recommendation.md` — the meta-game and why Recall is the flagship.

The governing thesis for every decision you make: **make the database the protagonist and the frontend its courtroom evidence.** The field of 6,000 entrants splits into two losing archetypes — pretty UIs with interchangeable backends, and "scales to millions" claims with no proof. You win by doing the opposite: one workload where *only* Aurora PostgreSQL is correct, one signature screen that makes that hard property visible and clickable on a live URL, real data volume, and a measured latency number on screen.

## 1. What you are building
**Recall — The Outbreak Console.** A live dispatch console for product recalls that, the instant a contaminated-lot report lands, traces the lot **backward** to its source suppliers and **forward** to every affected store shelf — **in one SQL query** — then renders the outbreak as an igniting supply graph + a map of affected stores + a cluster of related incidents.

- **Track:** Monetizable B2B (FSMA-204 food-traceability; real, dated, budgeted buyer).
- **Database:** Amazon Aurora PostgreSQL (Serverless v2) with **pgvector (HNSW)** + **PostGIS**.
- **The one-sentence kill-shot you must be able to defend on camera:** *"DynamoDB can't do recursive traversal or ad-hoc joins; Aurora DSQL has no PostGIS and no extensions, so no geo and no pgvector — only Aurora PostgreSQL fuses graph recursion + geospatial + vector similarity in one statement."* (Precision: DSQL *does* support basic CTEs — never claim otherwise; the unimpeachable kill-shots are PostGIS, pgvector, and FK-enforced DAG integrity.)

## 2. The prime directive
**The hero query is the entire product. Build the query before the UI. The UI exists to prove the query.**

The hero query is a single `SERIALIZABLE` statement: a recursive CTE walking an FK-constrained `lot_links` supply DAG, JOINed to PostGIS store geography, with a `pgvector` HNSW LEFT JOIN for related incidents — returning the exact row shape the three UI panes need (contaminated edges → graph; affected stores w/ geom + unit counts → map; similar incidents w/ cosine distance → rail). Get it **correct, cycle-safe, and sub-second over ~250k DAG edges** before you style a single component. Then show its live `EXPLAIN (ANALYZE, BUFFERS)` plan in the product — most teams hide SQL; you make the plan the hero.

Non-negotiables that must be real, never faked: real seed volume (numbers on screen), the live EXPLAIN plan, a measured p50/p99 latency badge (a real measurement, not a hardcoded number), and a demo on the deployed URL — never localhost.

## 3. Reality: credits are pending — build credit-free first, swap later
AWS and v0 credits have **not** landed yet. Do **not** block on them. Architect so the whole app runs **100% locally today** and promotes to Aurora with a **config-only flip** when credits arrive.

- **Local DB = the Aurora stand-in:** Postgres 16 in Docker with **both** `postgis` and `vector` extensions. Provide a `docker-compose.yml` + a tiny Dockerfile so one command brings it up:
  ```dockerfile
  FROM postgis/postgis:16-3.4
  RUN apt-get update && apt-get install -y postgresql-16-pgvector && rm -rf /var/lib/apt/lists/*
  ```
  Init SQL runs `CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS vector;`.
- **Embeddings without credits — and they must be REAL, not fake:** use **Transformers.js** (`@xenova/transformers`, model `Xenova/all-MiniLM-L6-v2`, 384-dim) to generate genuine semantic embeddings entirely in Node with no API and no credits. Put the embedding provider behind an interface (`embed(texts: string[]): Promise<number[][]>`) with two implementations: `local` (Transformers.js) and `bedrock` (Titan, 1536-dim) for later. Make embedding **dimension a single config constant** (`EMBED_DIM`) so the `vector(N)` column and migrations parameterize cleanly when you swap providers.
- **Connection layer** behind one thin module: local uses a `DATABASE_URL` pool; prod uses the same pool through **RDS Proxy** with **OIDC keyless** STS auth (`@vercel/oidc-aws-credentials-provider`) and Vercel **Fluid Compute** + `attachDatabasePool`. **Never** commit or use long-lived AWS keys.
- A single `DEPLOY_TARGET=local|aurora` env flag should be the only thing that changes between dev and the eventual cloud deploy. Document the swap in `SETUP.md`.

## 4. Stack (decided — do not re-litigate)
- **Next.js (App Router, latest) + TypeScript**, deployed to **Vercel** with `fluid: true`.
- **Tailwind + shadcn/ui**, dark mode by default (control-room aesthetic).
- **Data access:** raw, parameterized SQL via `pg` in a small typed query module (the hero query must stay legible and EXPLAIN-able — do not bury it in an ORM). Schema via plain `.sql` migrations (or `node-pg-migrate`).
- **Map:** `maplibre-gl` / `react-map-gl` over the PostGIS geom. **Supply graph:** a force-directed layout (`d3-force`, or `@xyflow/react` if it animates better) driven directly off the query's edge rows.
- **First paint via React Server Components**; re-runs (new lot code, time-scrub, node click) via **Server Actions / Route Handlers**; stream the vector rail with `<Suspense>`. The trace is **never cached** (a stale recall scope is dangerous — and that's a talking point).
- Package manager: `pnpm`. Lint + typecheck + a test runner (`vitest`) wired into CI from day one.

## 5. Build order — spine first (this is the law)
Ship in this sequence; the first three are the spine that must work end-to-end before any polish:

- **M0 — Foundation.** Repo, `docker-compose.yml` + Dockerfile, Next.js scaffold, Tailwind/shadcn, env handling, CI (lint+typecheck+test). `pnpm dev` + `docker compose up` works on a clean machine.
- **M1 — Schema + seed at volume.** Full FK-constrained schema from the deep dive (`suppliers, facilities, lots, lot_links, stores, shipments, store_inventory, incidents`) with HNSW + GiST indexes. A seed generator producing **~80k lots, ~250k acyclic `lot_links` edges, ~250k shipments, ~1,400 geo-located stores across 38 states, ~2,000 embedded incidents.** The DAG **must be truly acyclic** and fan-out capped at realistic depth (~4–7 hops). Print row counts.
- **M2 — The hero query.** The forward-trace recursive CTE + PostGIS join + pgvector LEFT JOIN, `SERIALIZABLE`, **depth-guarded against cycles**, index-scan at every iteration (verify with EXPLAIN), returning the three-pane row shape **sub-second over 250k edges**. Prove it in a script with a printed latency number and the EXPLAIN plan **before touching the UI.**
- **M3 — The Outbreak Console** (signature screen). RSC first paint + Server Action re-run: graph igniting red along contaminated edges, map dropping store pins with ticking unit counts, the "similar incidents" vector rail with cosine-distance badges; top bar shows live row count + measured query latency + a 24h FDA SLA countdown.
- **M4 — Query Inspector** (the 10x credibility moment). A toggle that shows the actual recursive-CTE SQL and its live `EXPLAIN (ANALYZE, BUFFERS)` with the recursive-union node, HNSW scan, and GiST spatial join visibly called out.
- **M5 — Depth.** Lot Lineage drill-down drawer (one JOIN, four tables), Incident Inbox with the pgvector cluster badge, Recall Scope Export.
- **M6 — Production path.** Wire the Aurora/RDS-Proxy/OIDC swap behind the config flag, deploy to Vercel, capture URL + Team ID. (Gated on credits — until they land, prove the swap is a one-flag change and document it; keep the live demo on the local stack if needed, but never call localhost "deployed".)
- **M7 — Demo + artifacts.** Execute the storyboard in the deep dive, capture the required screenshots, polish.

## 6. Definition of done
- One-command local bring-up documented in `SETUP.md`; clean-machine reproducible.
- Pasting a lot code fires the trace and the graph + map + vector rail light up **sub-second over real volume**, with the latency number and row count on screen.
- The live EXPLAIN plan is visible in the Query Inspector.
- Tests pass, including the **adversarial** ones: (a) the recursive CTE terminates on a deliberately cyclic edge set (cycle guard), (b) a lot with zero affected stores returns a clean "no shelves at risk" state, (c) a latency-budget assertion on the hero query over the full seed.
- `typecheck`, `lint`, `test` all green; the app has real empty/loading/error states.
- The demo storyboard from `docs/deep-dives/01-recall.md` is rehearsable on the running app in under 180 seconds.
- Submission artifacts staged per `docs/reference/submission-checklist.md` (architecture diagram that draws the **data model**, the EXPLAIN-plan + RDS/CloudWatch screenshots when on Aurora, Vercel URL + Team ID).

## 7. Guardrails — what will get you killed
- **Never cut** any of: the recursive CTE, the PostGIS map JOIN, the pgvector rail, the live EXPLAIN inspector, real seed volume, or the live-URL deploy. If scope bites, cut in the order given in the deep dive (backward trace first, then the cron ingest counter, then export, then the inbox) — protect the spine.
- **Never fake:** no hardcoded latency badges, no "history" that isn't a real query result, no seeded toy of a dozen rows, no localhost footage passed off as deployed.
- **Never leak AWS credentials** to the client or commit long-lived keys; OIDC keyless only; all SDK/DB calls server-side.
- Keep the database the protagonist — if a screen would look the same on any database, redesign it.
- Don't over-scope: forward trace is the dramatic, judge-legible direction; backward trace is a stretch goal. No chatbot bolt-ons.
- Watch the hero-query failure mode obsessively: a quadratic/cycling CTE turning the trace into a spinner on camera is the single biggest risk — solve it in M2, not demo night.

## 8. Working agreement
- Work on a branch; small, well-described commits; run typecheck/lint/test before declaring anything done; actually run the app and verify behavior (screenshot it) — don't claim done from code-reading alone.
- Maintain a `BUILD_LOG.md` narrating key decisions (the single-statement trace, the cycle guard, the OIDC swap). This doubles as the hackathon's **bonus build-in-public content** — write it like a technical thread.
- Default to sensible choices and keep moving; only stop to ask when a decision is genuinely blocking and irreversible (e.g., real AWS credentials/region when credits land). Otherwise, pick the obvious option, note it in `BUILD_LOG.md`, and proceed.
- Start your first reply with a tight plan: confirm the stack, restate the milestone checklist, then begin M0 → M1 immediately. Do not open with a wall of questions.

## 9. The taste bar (this is where "generational" lives)
Dark control-room aesthetic. The supply-graph ignition is **driven by the query's result rows**, animating contamination propagation left-to-right. Animated unit counters, badge pulses as new store pins land, skeleton states on the streaming vector rail, a mono-font latency readout that radiates "this is real and at scale." Cosine-distance scores visible on every incident badge so relevance is legible, not asserted. Empty/error states that look intentional. Every pixel should be a query result a judge can click into. Make the full-stack integration *felt*, not just shown.

## 10. Optionality
The default and recommendation is **build Recall**. If the team later pivots, `docs/deep-dives/` holds four other complete, build-ready specs (Provenance/DynamoDB, Sky Claim/DynamoDB, HourBank/Aurora PG, Settlement Floor/Aurora DSQL) and `docs/05-recommendation.md` explains the trade-offs. Unless told otherwise: **Recall, all the way to a deployed, unforgettable demo.**

Now read the docs, confirm the plan, and start building. Cook.
