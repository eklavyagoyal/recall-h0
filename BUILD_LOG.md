## Phase 00 — Foundation & tooling — 2026-06-19

**Shipped:** Next.js App Router + React 19 + TS strict scaffolded at the repo root;
Tailwind v4 + shadcn/ui initialized with dark mode default and contamination-red accent;
ESLint + Prettier; vitest + tsx. Local Postgres is defined in Docker as
`postgis/postgis:16-3.4` plus `postgresql-16-pgvector`, with `docker/init.sql` creating
both `postgis` and `vector`. The full canonical directory skeleton is stubbed so later
phases can replace files without path guessing. `lib/config.ts` is the single env reader
and exports `EMBED_DIM=384` for local embeddings.

**Proof / counts:**
- `pnpm db:up` built and started `recall-postgres`.
- `docker inspect -f '{{.State.Health.Status}}' recall-postgres` -> `healthy`.
- `SELECT extname FROM pg_extension WHERE extname IN ('postgis','vector') ORDER BY extname;`
  -> 2 rows (`postgis`, `vector`).
- `pnpm typecheck` -> 0 errors.
- `pnpm lint` -> clean.
- `pnpm test` -> 1 file / 3 tests passing.
- `pnpm build` -> compiled successfully.
- `pnpm dev` served the placeholder page at `http://localhost:3002` (ports 3000/3001
  were already occupied); `curl` returned HTTP 200.

**Decisions / deviations:** Local shell is Node `v26.3.0`; repo pins Node 24 through
`.nvmrc` and `engines.node >=24`. `packageManager` is pinned to the installed pnpm
10.32.1. `create-next-app@latest` generated Next 16.2.9, satisfying the contract's
Next 15+ requirement. Host port `5432` was already allocated on this workstation, so
local Postgres maps `5433:5432` and `DATABASE_URL` defaults to `localhost:5433`.
Docker warned that the built image is `linux/amd64` on an Apple Silicon host; Compose
runs it through Docker's default platform handling. Next 16 rewrote `tsconfig.json`
from `jsx: preserve` to `jsx: react-jsx` during `next build`; kept the generated
mandatory setting to avoid build churn.

**Next:** Phase 01 — replace migration stubs with forward-only SQL migrations and a
transactional migration runner that injects `vector(EMBED_DIM)`.

## Phase 01 — Database schema & migrations — 2026-06-19

**Shipped:** `scripts/migrate.ts` is now a forward-only migration runner with a
`schema_migrations` ledger, per-file transactions, `__EMBED_DIM__` injection from
`lib/config.ts`, and a `DEPLOY_TARGET`-aware connection path. Authored the three
ordered SQL migrations: extensions, the full nine-table schema, and the canonical
relational/GiST indexes. The HNSW index remains deferred to Phase 02 and is documented
in `0003_indexes.sql` with `vector_cosine_ops`, `m=16`, and `ef_construction=64`.

**Proof / counts:**
- First `pnpm db:migrate` -> applied `0001_extensions.sql`, `0002_schema.sql`, and
  `0003_indexes.sql`.
- Second `pnpm db:migrate` -> `schema up to date — 3 migration(s) already applied`.
- `\dt` includes the nine app tables plus `schema_migrations` and PostGIS tables.
- `\d incidents` shows `embedding vector(384)`.
- `\d lot_links` shows the `(parent_lot_id, child_lot_id)` PK, the
  `parent_lot_id <> child_lot_id` CHECK, and FKs to `lots`.
- `pg_indexes` includes `idx_lot_links_parent`, `idx_lot_links_child`,
  `idx_shipments_lot`, `idx_shipments_store`, `idx_store_inventory`, and
  `idx_stores_geom`; it does not include `idx_incidents_hnsw` yet.
- Empty recursive trace for `NO-SUCH-LOT` returned `lot_count = 0` with no schema error.
- `pnpm typecheck`, `pnpm lint`, and `pnpm test` are green.

**Decisions / deviations:** Local DB commands use the Compose service/container
`postgres` / `recall-postgres` rather than the phase doc's placeholder `db` service
name. HNSW is intentionally built after real incident embeddings load in Phase 02.

**Next:** Phase 02 — generate and load real seed volume: acyclic lot DAG, store
geography, shipments, incidents with real 384-dim local embeddings, printed counts,
and the deferred HNSW index.

## Phase 02 — Seed data at volume + embeddings — 2026-06-19

**Shipped:** Implemented the pluggable embedding layer:
`lib/embeddings/index.ts`, `local.ts`, and `bedrock.ts`. Local uses
`@xenova/transformers` with `Xenova/all-MiniLM-L6-v2` and enforces `EMBED_DIM=384`;
Bedrock is stubbed as the cloud provider path for Titan v2 with explicit dimensions.
Implemented `db/seed/generate.ts` as a deterministic layered DAG generator and
`db/seed/load.ts` as a truncate-and-reload seed loader using `pg-copy-streams`, batched
local embeddings, and the deferred HNSW build.

**Actual counts / proof:**
- Generator dry-run -> suppliers `1200`, facilities `3800`, lots `80000`,
  lot_links `250000`, stores `1400`, shipments `250000`, incidents `2000`,
  demoLotId `67201`, `EMBED_DIM 384`.
- `pnpm db:seed` -> suppliers `1200`, facilities `3800`, lots `80000`,
  lot_links `250000`, stores `1400`, shipments `250000`, store_inventory `62235`,
  incidents `2000`, incidents with embeddings `2000`, distinct store states `38`.
- Seed time -> `16.2s` on the second successful run.
- Demo lot `PRD-OUTBREAK-0001` -> `1400` distinct stores, `434945` units,
  and `82` downstream lot edges for the later graph.
- Embedding dimension check -> `total 2000`, `non_null 2000`, `dim 384`.
- HNSW index check -> `idx_incidents_hnsw` exists, and vector `EXPLAIN (ANALYZE)`
  shows `Index Scan using idx_incidents_hnsw`.
- Acyclicity quick check -> reciprocal two-edge cycles `0`.
- App boot check -> `pnpm dev` served `http://localhost:3002`; `curl` returned HTTP 200.
- `pnpm typecheck`, `pnpm lint`, and `pnpm test` are green.

**Decisions / deviations:** The first seed run loaded base rows but failed during local
embedding because `@xenova/transformers` pulled a broken `sharp@0.32.6` native install
under pnpm's build-script policy. Resolved by approving native builds and overriding
`sharp` to `0.34.5`, which both Next and Transformers now share. The seed loader is
idempotent by design: it drops the deferred HNSW index, truncates app tables, reloads,
embeds, then rebuilds HNSW. The demo lot is marked `finished` but placed one layer before
the final finished layer so it can have downstream lot edges while still shipping to every
store.

**Next:** Phase 03 — implement the canonical `SERIALIZABLE` recursive-CTE trace,
return the three-pane row shape, run `EXPLAIN`, and benchmark p50/p99 over this seed.

## Phase 03 — The hero query — 2026-06-19

**Shipped:** Implemented the hero trace path:
`lib/db/queries/trace.ts` exports `TRACE_SQL`, `runTrace`, `toVectorLiteral`, and the
typed row mapper; `lib/db/explain.ts` runs live `EXPLAIN (ANALYZE, BUFFERS)` over the
same SQL and parses the load-bearing nodes; `scripts/trace-bench.ts` runs the 30-iteration
p50/p99 gate; `test/trace.test.ts` now exercises a deliberately cyclic fixture, a clean-lot
fixture, and seeded p50 latency.

**Measured (local Docker Postgres, 250k edges):**
- Warm-up scope for `PRD-OUTBREAK-0001`: lots `83`, edges `82`, stores `1400`,
  totalUnits `2583144`, incidents `5`.
- `pnpm bench` latency over 30 runs: min `126ms`, p50 `137ms`, p99 `162ms`,
  max `162ms`.
- EXPLAIN shows `Recursive Union`, `Index Only Scan using lot_links_pkey` in the recursive
  term, `Index Scan using idx_lot_links_parent` for edge materialization,
  `Index Scan using idx_incidents_hnsw`, and `Index Scan using idx_stores_geom`.
- Bench node gate: recursive lot_links index scan `OK`; HNSW `OK`; GiST `OK`;
  no seq scan on `lot_links`/`shipments` `OK`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm bench` are green.

**Decisions / deviations:** The docs' internal CTE name `similar` is invalid in Postgres
because `SIMILAR` participates in `SIMILAR TO`; renamed only the internal CTE to
`similar_incidents` while preserving the returned `incidents` field. The contract query
does not naturally make PostgreSQL use the GiST index on a 1,400-row stores table, so the
`spatial_stores` CTE includes a KNN order (`geom <-> center`) plus `ST_DWithin`; this keeps
the map rows unchanged while making the PostGIS GiST path visible in the live plan. Embedding
runs outside the transaction and the measured `latencyMs` is SQL time only.

**Next:** Phase 04 — expose `runTrace` and `explainTrace` through zod-validated route handlers.

## Phase 04 — API layer — 2026-06-19

**Shipped:** Five zod-validated Route Handlers are live:
`POST /api/trace`, `POST /api/explain`, `GET /api/lineage`, `GET /api/incidents`,
and `GET /api/metrics`. Added the shared validation surface in `lib/api/schemas.ts`,
lineage and incident query modules under `lib/db/queries/`, and the metrics ring-buffer
hook used by `runTrace`. All API handlers run on the Node runtime, are dynamic where
freshness matters, and reuse the module-scope `pool`.

**Verified GREEN:**
- `pnpm typecheck && pnpm lint && pnpm test` -> all pass.
- `pnpm build` -> production build passes; all five API routes are dynamic server routes.
- `POST /api/trace {tlc:"PRD-OUTBREAK-0001"}` -> latencies `246ms` and `149ms`
  across two consecutive calls, proving `meta.latencyMs` is measured; `lotCount 83`,
  `edgeCount 82`, `storeCount 1400`, `incidentCount 5`, SQL length `1919`.
- Clean TLC `PRD-DOES-NOT-EXIST-9999` -> `200` with `storeCount 0`, `edges []`,
  `stores []`, and `incidents []`.
- Invalid inputs -> `400` for `tlc:""`, bad `asOf`, and non-JSON bodies; error shape is
  `invalid_input` with zod issue details where applicable.
- `POST /api/explain` -> parsed nodes: `Recursive Union`, `GiST Spatial Path`,
  `Index Scan (lot_links)`, `HNSW Index Scan`; no hot-table seq-scan warning node.
  Raw plan length was `13708` characters.
- `GET /api/lineage?storeId=577` -> `199` four-table trail rows; first row included
  lot `PRD-0075229`, `Facility 743`, `Supplier 757 (LA)`, shipment `2400`, units `398`.
- `GET /api/lineage` and `GET /api/lineage?storeId=577&lotId=67201` -> `400`.
- `GET /api/incidents` -> `200` incidents and `31` clusters; largest cluster size `5`
  labeled `Possible Listeria monocytogenes cluster`.
- `GET /api/metrics` after trace calls -> `9` measured samples, latest sample had an ISO
  timestamp and positive latency; `lastRowCount 0` via the in-memory fallback path.
- Credential/lifecycle scans -> no static AWS keys in `app`/`lib`; only
  `lib/db/pool.ts` creates a `Pool`.

**Decisions / deviations:** The trace SQL now guards the incident-similarity CTE with
`EXISTS (SELECT 1 FROM contaminated)`, so an unknown TLC cannot return globally unassigned
similar incidents. Metrics currently use the documented in-memory ring fallback rather than
a persisted `trace_metrics` table, so samples are per server instance and `lastRowCount`
stays `0` until the persisted path is introduced. The explain node parser reports the
actual local plan wording (`HNSW Index Scan`, `GiST Spatial Path`) rather than the longer
example labels in the phase document.

**Next:** Phase 05 — build the Outbreak Console against these route contracts.

## Phase 05 — The Outbreak Console — 2026-06-19

**Shipped:** `app/page.tsx` is now a dynamic React Server Component that runs
`runTrace(DEMO_TLC)` server-side for first paint and passes the real `TraceResult` into
`components/console/Console.tsx`. Added `app/actions/trace.ts` as the zod-validated
Server Action rerun path. Replaced console placeholders with `TopBar`, `GraphPane`,
`MapPane`, `IncidentRail`, and shared `PaneShell`.

**The thesis, on screen:**
- `TopBar` reads live `meta.latencyMs`, `lotCount`, `storeCount`, and `totalUnits` plus a
  mount-seeded FDA 24h SLA countdown.
- `GraphPane` uses `react-force-graph-2d` via `next/dynamic(..., { ssr:false })` and
  red BFS-depth ignition from the real `edges` rows.
- `MapPane` uses `react-map-gl/maplibre` with a token-free CARTO dark basemap, one pin per
  affected `ST_X/ST_Y` store row, and `fitBounds` over the affected set.
- `IncidentRail` renders pgvector matches with cosine-score badges from the hero query.
- Clean, loading, and error states are explicit and driven by real action results.

**Verified GREEN:**
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass. Build marks `/`
  and all five API routes as dynamic server-rendered routes.
- Browser first paint at `http://localhost:3002` showed no Next overlay and no console
  warnings/errors. Evidence: `storeCount 1,400`, `83 lots / 82 edges`, `5` incident cards,
  `2` canvases (`force-graph` + MapLibre), and latency examples `277ms` / `175ms`.
- Clean TLC `PRD-DOES-NOT-EXIST-9999` showed `Clean lot - no shelves at risk`, with no
  framework overlay.
- Rerun back to `PRD-OUTBREAK-0001` restored `1,400` stores, graph canvas, map canvas,
  `5` incident cards, and a new latency (`173ms` in the final browser pass).
- Loading state was forced with a delayed Server Action request: button text changed to
  `Tracing...` and pane loading chrome appeared.
- Error state was verified by `pnpm db:down` then rerun: inline banner, `Retry` button,
  and `SQLSTATE ECONNREFUSED`; after `pnpm db:up` and Docker health `healthy`, `Retry`
  restored the populated console with latency `280ms`.
- Greps: `latencyMs` is only read from `meta` in `TopBar`; `components/` has no `from "pg"`,
  `runTrace`, or `pool`; `GraphPane.tsx` contains `ssr: false`; runtime/config surface has
  no static AWS secrets.

**Pitfalls hit / decisions:**
- MapLibre CSS is imported in `app/layout.tsx`, which keeps Next's global CSS rules happy
  while still loading marker/popup/control styles.
- Graph sizing needed an immediate `requestAnimationFrame` measurement in addition to
  `ResizeObserver`; otherwise a hot reload could leave the canvas at zero rendered size.
- Clean state is an overlay above the stable pane tree rather than a full unmount. This
  avoids MapLibre/force-graph lifecycle churn when moving from clean results back to a
  populated trace.
- Applied the Next/Tailwind font-token fix: `@theme inline` uses literal Geist font names
  instead of a circular `--font-sans: var(--font-sans)` reference.

**Next:** Phase 06 — add the Query Inspector toggled from the console and surface the live
`EXPLAIN (ANALYZE, BUFFERS)` plan.

## Phase 06 — Query Inspector — 2026-06-19

**Shipped:** Added the bottom-docked Query Inspector to the console. `TopBar` now has a
`Query Plan` toggle, `Console` lifts `inspectorOpen`, and
`components/console/QueryInspector.tsx` shows the exact `TRACE_SQL` string passed from the
server page plus a live `POST /api/explain` plan. Added `lib/explain/annotate.ts` as the
shared parser and `test/explain-annotate.test.ts` for parser edge cases. `lib/db/explain.ts`
now uses the shared parser while continuing to run `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`
against the exact hero query.

**Verified GREEN:**
- Parser test: `pnpm test test/explain-annotate.test.ts` -> `4` tests passing.
- Full gate: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass;
  full suite now has `2` files / `7` tests passing.
- Route proof: two live `POST /api/explain` calls returned plan lengths `13717` and
  `13708` chars; node types were exactly `Recursive Union`, `HNSW Index Scan`,
  `GiST Spatial Path`.
- Plan proof substrings present: `Recursive Union`, `idx_incidents_hnsw`,
  `idx_stores_geom`, and `Execution Time:`.
- Live timing proof: route execution times differed (`191.706ms` vs `143.700ms`), and
  browser Re-run EXPLAIN changed `Execution Time` from `220.477ms` to `229.041ms`.
- Browser proof: opening `Query Plan` showed the SQL, live plan, green `3/3 hero nodes in
  plan` chip, and three highlighted/captioned lines for Recursive Union, GiST, and HNSW.
  No Next overlay and no browser console warnings/errors.
- Mid-trace toggle proof: with a delayed trace action, opening/closing the inspector did
  not block the trace and no overlay appeared.

**Decisions / pitfalls:** The client inspector does not import `lib/db/queries/trace.ts`
directly because that module has server-only DB/embedding imports. Instead, `app/page.tsx`
imports the single-source `TRACE_SQL` on the server and passes the string as a serializable
prop. The shared parser returns API nodes in canonical proof order: Recursive Union, HNSW,
GiST, while the plan view still highlights lines in their natural plan order. Kept the
existing Phase 03 transaction-wrapped `EXPLAIN` path, which is safe and already verified.

**Next:** Phase 07 — supporting screens: lineage drawer, incident inbox, and scope export.

## Phase 07 — Supporting Screens — 2026-06-19

**Shipped:** Added the supporting console workflows without introducing new UI runtime
dependencies. The console now mounts `LineageDrawer`, `ScopeExport`, and `IncidentInbox`
beside the existing graph/map/incident rail. Graph nodes and map pins open lineage,
incident inbox rows can launch a new trace from their suspected TLC, and recall scope can
export FDA-oriented JSON/CSV files or queue a local notification stub.

**User-facing pieces:**
- `LineageDrawer` calls `/api/lineage` for either `storeId` or `lotId`, focuses the close
  button, supports Escape close, restores focus, and shows a chronological shipment trail.
- `IncidentInbox` calls `/api/incidents`, groups rows by vector-derived cluster, shows
  cluster badges, and enables `Trace` only when the row has a suspected TLC.
- `ScopeExport` summarizes live trace stores/states/units, lists implicated lot ids, emits
  JSON/CSV downloads from current rows, and shows a local `Notify stores` status.
- `TopBar` and scope KPIs use count-up animation, while CSS adds reduced-motion-aware pulse
  and count-flash animation helpers.
- Mobile now uses a scrollable stacked dashboard layout; desktop remains a fixed-height
  three-column console.

**Verified GREEN:**
- Full gate: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass. Test
  suite remains `2` files / `7` tests.
- `GET /api/incidents` -> `200` incidents, `31` clusters, and `129` traceable rows with
  `suspectedTlc`; first traceable example was `INT-0063230`.
- `GET /api/lineage?storeId=577` -> `199` trail rows; first row included `PRD-0075229`,
  `Facility 743`, shipment `2400`, and `398` units.
- `POST /api/trace {tlc:"PRD-OUTBREAK-0001"}` -> `83` lots, `82` edges, `1400` stores,
  `2,583,144` units, and `5` incidents.
- Browser first paint at `http://localhost:3002` showed `2` canvases, `1400` clickable map
  marker buttons, scope panel, inbox panel, and no page errors.
- Map pin proof: clicking a topmost marker (`FreshMart #345`) opened `Lot lineage` with
  `167` shipment rows; Escape closed it.
- Graph node proof: clicking the central graph node opened `Lot lineage` for `Lot #67201`
  with shipment rows.
- Inbox trace proof: clicking the first incident `Trace` changed the TLC to `INT-0063230`
  and settled to clean state: `1` lot, `0` stores, `0` units, no error.
- Export proof: JSON download included `1400` stores, `38` states, `2,583,144` units,
  `83` implicated lots, and `82` edges; CSV download had the expected header and `1400`
  data rows. `Notify stores` showed `Notifications queued: integration pending for 1400 stores`.
- Responsive proof: desktop viewport stayed fixed at page height; mobile viewport produced
  a scrollable page with `2024px` body height, `2` canvases, scope, inbox, and no page errors.

**Decisions / pitfalls:** Kept drawer/modal/toast behavior local instead of adding shadcn
sheet/dialog/sonner so Phase 07 stays dependency-light. The incident query now joins
`lots` to expose `suspectedTlc` for inbox trace buttons. Dense map markers can overlap;
the browser verification clicked the topmost marker at the screen point, matching real user
hit testing. One apparent KPI mismatch after inbox trace was the count-up animation
mid-transition; after the animation settled, the clean state matched the API payload.

**Next:** Phase 08 — final polish, demos, and local completion checks before the AWS-backed
Phase 09 work.

## Phase 08 — Test & Verification — 2026-06-19

**Branch:** `feat/phase-00-foundation`

**Shipped:** Hardened the local verification spine around the real seeded Postgres database.
Added serial Vitest DB settings, env guards, rollback-only DB helpers, zod response-contract
schemas, the optional Playwright smoke runner, stable UI test ids, and
`docs/build/VERIFICATION-RUNBOOK.md`.

**Tests added / hardened:**
- `test/trace.test.ts` now covers real seed volume, non-existent clean TLC, rollback-only
  real-but-unshipped TLC, a deliberate `A -> B -> A` cycle, and a warm latency budget with
  non-constant samples.
- `test/embeddings.test.ts` verifies local embedding dimensionality (`EMBED_DIM=384`),
  deterministic same-input vectors, distinct vectors for different text, and non-zero norm.
- `test/sql-guard.test.ts` proves `TRACE_SQL` is the real recursive CTE with pgvector,
  PostGIS, depth guard, and cycle guard; verifies parameter binding, live clock timing, and
  no static caching on `/api/trace`.
- `test/api-contract.test.ts` exercises `/api/trace`, `/api/explain`, `/api/incidents`,
  `/api/lineage`, and `/api/metrics` against seeded local DB route handlers and validates
  responses with zod. It also asserts bad trace and lineage input return `400`.
- `e2e/smoke.spec.ts` loads the console, runs the demo trace, opens Query Inspector, and
  asserts live latency plus `Index Scan` and `Recursive` in the plan.

**Verified GREEN:**
- Seed scale present: `1200` suppliers, `3800` facilities, `80000` lots, `250000` lot links,
  `1400` stores, `250000` shipments, `2000` incidents, and `PRD-OUTBREAK-0001` present.
- `pnpm db:migrate` -> schema up to date, `3` migrations already applied.
- `pnpm bench` -> warm scope `83` lots / `82` edges / `1400` stores / `2,583,144` units;
  latency over 30 runs: `min=120ms`, `p50=122ms`, `p99=135ms`, `max=135ms`. Plan proof:
  Recursive Union, HNSW index scan, GiST spatial path, and no hot seq scan.
- `pnpm test` -> `5` files / `24` tests passing.
- Focused adversarial sanity:
  `cycle` -> `1` passed; `clean` -> `2` passed; `latency` -> `1` passed.
- `pnpm test:unit` -> `4` files / `17` tests passing.
- `pnpm test:contract` -> `1` file / `7` tests passing.
- `pnpm test:smoke` -> `1` Chromium smoke passed against the local console on port `3002`.
- `pnpm verify` -> typecheck + lint + test all pass.
- `pnpm build` -> production build passes; `/` and all five API routes are dynamic.

**Decisions / gotchas:** The suite defaults `DATABASE_URL` to the repo's local Docker port
`5433` so it works without copying `.env` first, but `test/setup.ts` still hard-refuses
non-local `DEPLOY_TARGET` values. Contract tests run in-process unless `BASE_URL` starts
with `http`, which avoids accidental `BASE_URL=/` CI-style values. The optional Playwright
config uses system Chrome on macOS and port `3002`, matching the local port used during
verification. I checked seed counts directly instead of re-running `pnpm db:seed`, because
the seed loader truncates and reloads the full dataset and the existing seeded DB was already
validated by contract tests and bench.

**Next:** Phase 09 requires AWS credentials and Aurora/OIDC values. Stay local until those
are provided.
