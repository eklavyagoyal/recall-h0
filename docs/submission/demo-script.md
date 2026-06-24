# Recall — Demo Video Script (timecoded shot list)

**Total runtime: 175s (under the 180s hard cap).** Demo on the **live URL** throughout — `https://recall-h0.vercel.app` — never localhost. Demo lot is **`PRD-OUTBREAK-0001`** (Romaine Lettuce). Every number below is a verified live fact; do not improvise figures.

> One-line thesis to keep in your head while recording: **report in → outbreak scope out, in ~300ms, provably correct, and every visible pixel is a query result.**

---

## Pre-record checklist (do ALL of these before you hit record)

- [ ] **Warm up Aurora ~30s before recording.** The cluster auto-pauses after 5 min idle (MinACU=0, scale-to-zero). Hit `https://recall-h0.vercel.app` once and run one trace so the cluster is resumed — otherwise the first on-camera trace is ~15s (cold resume) instead of ~300ms (warm). Wait for a ~300ms trace, *then* start the script.
- [ ] **Demo on the live URL, not localhost.** Localhost uses the 384-dim MiniLM embeddings; the live URL uses Bedrock Titan V2 1024-dim and is the artifact judges will open. Verify the URL resolves in a **fresh incognito window**.
- [ ] **Have the Query Inspector ready.** Know the toggle location in the TopBar; do one dry run so the panel opens instantly on camera and the EXPLAIN text is already populated (Recursive Union / HNSW Index Scan / GiST Spatial Path legible).
- [ ] **Screen resolution: record at 1920×1080 (16:9), 60fps if possible.** Dark control-room UI — turn off f.lux/Night Shift so the red contamination accent reads true. Hide bookmarks bar and browser chrome clutter; keep the URL bar visible (it's proof).
- [ ] **Pre-load the demo TLC** in the clipboard (`PRD-OUTBREAK-0001`) so the paste is instant; have one store pin pre-identified for the Lineage drill-down so you don't fumble.
- [ ] **Have the proof tabs open in the background:** RDS console (cluster `recall-aurora`, engine 16.6, `us-east-1`) and the CloudWatch `ServerlessDatabaseCapacity` graph showing 0.0 ACU idle → 2.0 ACU under load.
- [ ] **Have the optional title cards ready:** run `pnpm submission:render-demo-cards` and keep `docs/submission/demo-opening-card.png` / `docs/submission/demo-end-card.png` available for the editor.
- [ ] **Mute notifications / close Slack & mail.** One take, no toasts.

---

## Shot list

| Time (s) | On-screen action | Voiceover | On-screen text/number to highlight |
|---|---|---|---|
| `0:00–0:20` (20s) | Black. Cut to a real FDA romaine recall headline, then the live URL `recall-h0.vercel.app` loading into the dark Outbreak Console. | "When a contaminated lot ships, food-safety teams ask one question: *which shelves, right now?* Today that's hours of spreadsheets. **FSMA-204 makes it law** — traceability records to the FDA within **24 hours**, enforced from 2028. We answer in about a quarter of a second." | **FSMA-204 · 24-hour FDA SLA · enforcement 2028**; the live URL in the address bar. |
| `0:20–0:35` (15s) | TopBar in focus: latency chip, affected-store count, and the **FDA SLA clock** anchored to the matching incident report. IncidentRail visible on the right edge with skeleton cards. | "This is a live console wired to **Amazon Aurora PostgreSQL Serverless v2** — real data, not a mock. The clock at the top is the FDA's 24-hour gun, tied to the report timestamp instead of a decorative page-load timer." | **FDA SLA** chip; "Aurora PostgreSQL Serverless v2". |
| `0:35–0:55` (20s) | Paste `PRD-OUTBREAK-0001` into the lot input, hit **Trace**. The GraphPane igniting supply graph propagates red along contaminated edges L→R; the MapPane fills with store pins; the IncidentRail streams in. | "I paste the contaminated Traceability Lot Code for this Romaine Lettuce lot and fire **one serializable SQL statement** — a recursive walk over a quarter-million supply-chain edges. Watch the graph ignite, the map fill, and similar incidents stream in — all at once." | **`PRD-OUTBREAK-0001` · Romaine Lettuce**; graph igniting red; pins dropping. |
| `0:55–1:12` (17s) | Both panes settle. Unit counter ticks up; TopBar locks final latency + store count. Pan graph → map → IncidentRail (cosine-score badges). | "There's the scope: **1,400 affected stores across 38 states**, **674,285 units** to pull, **81 contaminated lots** down **80 edges** — in about **300 milliseconds** over 580,000 rows. And the rail already surfaced the match: a prior FDA alert linking Romaine Lettuce to *Listeria monocytogenes* — cosine score around **0.65**." | **1,400 stores · 38 states · 674,285 units · 81 lots / 80 edges · ~300ms**; Listeria incident badge **~0.65**. |
| `1:12–1:35` (23s) ⭐ | Hit **Replay spread** on the Outbreak Timeline, then drag the scrubber back and forth. Store pins appear/disappear by shipment arrival time while the unit count changes. | "Now scrub the outbreak backward. This is the Time-Travel replay: the same trace has an `asOf` cutoff, so I can ask *what shelves were contaminated at this moment in shipment history?* It's a what-if over an FK-enforced supply DAG plus a temporal filter — not a pre-rendered animation." | Timeline scrubber; changing store count/unit count; "asOf trace cutoff". |
| `1:35–1:59` (24s) ⭐ | Pop the **Query Inspector**. Live `EXPLAIN (ANALYZE, BUFFERS)` text fills the panel. Cursor lands on three nodes in turn. | "Most teams hide their SQL — here's the plan, live from the `/api/explain` endpoint. **The graph IS the recursion** — that's the **Recursive Union** walking the FK-constrained DAG. **The map IS the geospatial join** — that's the **GiST Spatial Path** over PostGIS geography. **The rail IS the vector search** — that's the **HNSW Index Scan** in pgvector. Three index paths, one statement." | Highlight **Recursive Union**, then **GiST Spatial Path**, then **HNSW Index Scan** in the EXPLAIN text. |
| `1:59–2:15` (16s) | Click a store pin → Lineage drawer slides in showing the parent/child lot trail; close it. | "One click drills into any store's exact lineage — which lot, derived from which ingredient lot, which facility, when it shipped. FK constraints enforce the DAG, and a **serializable** transaction means the scope can't shift while shipments are still being ingested." | Lineage parent→child trail; "serializable" + "FK-enforced DAG". |
| `2:15–2:32` (17s) | Split-card overlay snaps in: DynamoDB ✗ / Aurora DSQL ✗ / Aurora PostgreSQL ✓. | "Why only Aurora PostgreSQL? **DynamoDB** can't do recursive traversal or ad-hoc joins. **DSQL** has **no PostGIS, no pgvector, and no foreign keys**. Only **Aurora PostgreSQL** fuses graph recursion, geospatial, and vector similarity in one correct statement." | Cards: **DynamoDB ✗ · DSQL ✗ · Aurora PostgreSQL ✓**; "PostGIS + pgvector + FK". |
| `2:32–2:55` (23s) | Cut to RDS console (cluster `recall-aurora`, engine 16.6, `us-east-1`) then the CloudWatch ACU graph: **0.0 ACU idle → 2.0 ACU** under load. End on the live URL and FDA SLA pressure. | "Real Aurora, real volume — **scale-to-zero**: CloudWatch shows **0.0 ACU and roughly zero dollars when idle**, scaling to **2.0 ACU** for the recall, all inside a $100 budget. No long-lived AWS keys anywhere — the runtime calls Bedrock and the database **keyless over Vercel OIDC**. Live at `recall-h0.vercel.app`." | **0.0 ACU idle (~$0) → 2.0 ACU**; cluster `recall-aurora` / engine 16.6 / `us-east-1`; live URL. |

**Per-beat seconds:** 20 + 15 + 20 + 17 + 23 + 24 + 16 + 17 + 23 = **175s** (5s under the 180s cap; the 5s is buffer for a closing title card with the live URL + Team ID + "Amazon Aurora PostgreSQL").

---

## Judging-criterion map (each beat → the criterion it scores)

| Beat | Primary criterion scored | Why |
|---|---|---|
| `0:00–0:20` FSMA-204 stakes | **Impact & Real-world Applicability** | Names a dated, mandated, budgeted buyer (FDA 24h rule, 2028 enforcement). |
| `0:20–0:35` Live console + Aurora named | **Technological Implementation** | Establishes this is a live app on the named AWS database, not a mock. |
| `0:35–0:55` Fire the trace (graph + map + rail ignite) | **Design** + **Technological Implementation** | The igniting visual is the product; one statement drives three synchronized panes. |
| `0:55–1:12` Payoff numbers | **Impact & Real-world Applicability** | Precise scope (1,400 stores / 38 states / 674,285 units) at ~300ms over 580k rows. |
| `1:12–1:35` Outbreak Time-Travel replay ⭐ | **Originality** + **Design** | A scrubber over shipment history makes the temporal FK-DAG trace visible and interactive. |
| `1:35–1:59` Query Inspector / live EXPLAIN ⭐ | **Technological Implementation** + **Originality** | The live plan proves Recursive Union + GiST + HNSW fuse in one statement. |
| `1:59–2:15` Lineage drawer + serializable/FK | **Technological Implementation** | Shows correctness invariants (FK-enforced DAG, serializable isolation). |
| `2:15–2:32` Why-only-Aurora kill-shot | **Originality** + **Technological Implementation** | The non-interchangeable-DB argument (PostGIS + pgvector + FK that DSQL/Dynamo lack). |
| `2:32–2:55` CloudWatch scale-to-zero + keyless OIDC | **Technological Implementation** + **Impact** | Production-shaped cost/security story: 0.0→2.0 ACU, ~$0 idle, no long-lived keys. |
