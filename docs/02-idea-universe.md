# H0 — The Idea Universe (22 Serious Concepts)

**Purpose:** The full catalog of the 22 *serious* (shippable, fundable) concepts generated for H0, grouped by track, each with a complete build-decision block — so the team can pick with eyes open and lift the load-bearing thesis straight into a build.

> **Last updated:** H0 ideation workflow (22-agent orchestration: grounding → fan-out → 3 judge panels → deep dives). **Source:** `../IDEATION.md` (Phase 2) + `/tmp/h0_serious.txt` (full fidelity) + `/tmp/h0_scored.json` (composites).

**Sibling docs:** scoring methodology & the full 32-concept matrix → [`./04-scoring-matrix.md`](./04-scoring-matrix.md) · the 10 generational/unreasonable ideas → [`./03-generational-ideas.md`](./03-generational-ideas.md) · what wins → [`./01-judging-model.md`](./01-judging-model.md) · the call → [`./05-recommendation.md`](./05-recommendation.md).

---

## Table of contents

- [How to read this doc](#how-to-read-this-doc)
- [One-screen comparison table (all 22)](#one-screen-comparison-table-all-22)
- [Track 1 — Monetizable B2C](#track-1--monetizable-b2c)
  - [S1 · Encore](#s1--encore--dynamodb) · [S2 · Splitstream](#s2--splitstream--aurora-dsql) · [S3 · Cellar](#s3--cellar--aurora-postgresql) · [S4 · Dropgate](#s4--dropgate--dynamodb) · [S5 · Throwback](#s5--throwback--dynamodb) · [S6 · Margin Call](#s6--margin-call--aurora-postgresql) · [S7 · Settle](#s7--settle--aurora-postgresql)
- [Track 2 — Monetizable B2B](#track-2--monetizable-b2b)
  - [S8 · Meridian](#s8--meridian--aurora-dsql) · [S9 · Cadence](#s9--cadence--dynamodb) · [S10 · Clausewise](#s10--clausewise--aurora-postgresql) · [S11 · Ledgerline](#s11--ledgerline--aurora-postgresql) · [S12 · Overbook](#s12--overbook--aurora-postgresql) · [S13 · Tribunal](#s13--tribunal--aurora-postgresql) · [S14 · Splitwire](#s14--splitwire--aurora-dsql)
- [Track 3 — Million-scale global](#track-3--million-scale-global)
  - [S15 · Tempo](#s15--tempo--dynamodb) · [S16 · Driftwatch](#s16--driftwatch--dynamodb) · [S17 · Splitsecond](#s17--splitsecond--dynamodb) · [S18 · Pulsefeed](#s18--pulsefeed--dynamodb) · [S19 · Tessellate](#s19--tessellate--aurora-dsql)
- [Track 4 — Open innovation](#track-4--open-innovation)
  - [S20 · Sky Claim ★](#s20--sky-claim--dynamodb-) · [S21 · Provenance (Carbon Ledger)](#s21--provenance-carbon-retirement-ledger--aurora-dsql) · [S22 · Loreweaver](#s22--loreweaver--aurora-postgresql)
- [Patterns across the universe](#patterns-across-the-universe)

---

## How to read this doc

Every idea is one self-contained block with the same 11 fields. The two fields that decide the hackathon are **Why-the-DB-is-load-bearing** (the kill-shot — can you say in one sentence why the other two DBs are *wrong*?) and **Demo moment** (the single clickable thing on the live URL that proves it). If those two are weak, the idea is dead regardless of polish — that is the thesis of [`./01-judging-model.md`](./01-judging-model.md).

- **★ = made the Top 5.** Of the 22 serious concepts, **only S20 · Sky Claim** reached the Top 5 deep dives (the other four deep-dive winners are *generational* — see [`./03-generational-ideas.md`](./03-generational-ideas.md)). Sky Claim links to its full deep dive: [`./deep-dives/03-sky-claim.md`](./deep-dives/03-sky-claim.md).
- **Composite** = the risk-adjusted composite from the 3-panel scoring (1–10). Weighting and per-dimension scores live in [`./04-scoring-matrix.md`](./04-scoring-matrix.md).
- **Status:** `Top-5` · `Strong` (≥ 7.8) · `Solid` (7.0–7.8) · `Killed` (< 7.0, see kills in the matrix).
- Two ideas named **Provenance** exist: **S21** here (Aurora DSQL, carbon retirement ledger) and **G4** (DynamoDB, AI-agent time-travel debugger, a Top-5 generational). Don't conflate them.

---

## One-screen comparison table (all 22)

> Sorted by composite. `DB` is the *one correct* database, not a menu. Status is relative to the full field in [`./04-scoring-matrix.md`](./04-scoring-matrix.md).

| ID | Name | DB | Track | Composite | Status |
|---|---|---|---|--:|---|
| **S20** | **Sky Claim** ★ | DynamoDB | Open | **8.65** | **Top-5** → [deep dive](./deep-dives/03-sky-claim.md) |
| S18 | Pulsefeed | DynamoDB | Million-scale | 8.37 | Strong |
| S12 | Overbook | Aurora PostgreSQL | B2B | 8.31 | Strong |
| S15 | Tempo | DynamoDB | Million-scale | 8.09 | Strong |
| S10 | Clausewise | Aurora PostgreSQL | B2B | 7.90 | Strong |
| S19 | Tessellate | Aurora DSQL | Million-scale | 7.89 | Strong |
| S22 | Loreweaver | Aurora PostgreSQL | Open | 7.88 | Strong |
| S17 | Splitsecond | DynamoDB | Million-scale | 7.84 | Strong |
| S21 | Provenance (Carbon) | Aurora DSQL | Open / B2B | 7.67 | Solid |
| S9 | Cadence | DynamoDB | B2B | 7.67 | Solid |
| S13 | Tribunal | Aurora PostgreSQL | B2B | 7.65 | Solid |
| S4 | Dropgate | DynamoDB | B2C | 7.64 | Solid |
| S1 | Encore | DynamoDB | B2C | 7.61 | Solid |
| S8 | Meridian | Aurora DSQL | B2B | 7.47 | Solid |
| S3 | Cellar | Aurora PostgreSQL | B2C | 7.30 | Solid |
| S16 | Driftwatch | DynamoDB | Million-scale | 7.26 | Solid |
| S14 | Splitwire | Aurora DSQL | B2B | 7.08 | Solid |
| S5 | Throwback | DynamoDB | B2C | 6.94 | Killed |
| S6 | Margin Call | Aurora PostgreSQL | B2C | 6.75 | Killed |
| S11 | Ledgerline | Aurora PostgreSQL | B2B | 6.67 | Killed |
| S2 | Splitstream | Aurora DSQL | B2C | 6.47 | Killed |
| S7 | Settle | Aurora PostgreSQL | B2C | 5.94 | Killed |

**DB distribution:** DynamoDB ×8 · Aurora PostgreSQL ×9 · Aurora DSQL ×5. **Killed cluster** is almost entirely the Splitwise-variant / finance-toy archetypes (S2, S5, S6, S7, S11) — see the kill rationale in [`./04-scoring-matrix.md`](./04-scoring-matrix.md#kills--why-be-harsh).

---

## Track 1 — Monetizable B2C

> Track odds: **most crowded, lowest base rate.** v0 polish is table stakes here; you only win with a novel consumer *mechanic whose data model is the product* plus real backend rigor. Three of this track's seven (S2, S5, S6, S7) were killed as clones/toys — read those as cautionary blocks, not build targets.

### S1 · Encore — *DynamoDB*

*Track 1 (B2C) · Composite **7.61** · Status: Solid*

- **Pitch:** A live-tipping wall for street performers where 800 people in a crowd tap-to-tip at the song's peak and every coin lands on a shared screen in single-digit milliseconds.
- **Target user:** Buskers, open-mic performers, and street artists — plus the live crowds who want to tip without cash and watch their support land instantly.
- **Why the DB is load-bearing:** The workload is a hot-partition write-storm — hundreds of fans tap the SAME performer-set in the same 20 seconds. Write-shard the hot key (`PK=PERF#id#SHARD#0..N`, `SK=EVT#ts`) so the storm spreads across partitions; a Streams→Lambda fans each tap into an aggregate item (running total + reaction count) as a materialized view; conditional writes on a client-supplied token make every tap idempotent against double-taps. **Aurora would deadlock on the single hot total row; DSQL's OCC would reject every concurrent increment and force a retry storm.** Only DynamoDB holds flat single-digit-ms latency while the crowd 100×'s.
- **Frontend moment:** A full-screen tip wall — animated coins arc upward, emoji reactions burst, a running-total counter ticks visibly via SSE off the Streams aggregate, with a fixed p99-latency badge in the corner.
- **Demo moment:** Fire a 2,000-tap/sec load generator at one wall; the embedded CloudWatch `ConsumedWriteCapacity` graph climbs into the thousands while the on-screen p99 badge stays pinned at single-digit ms — total ticking smoothly, zero lost or doubled tips.
- **Why it could win:** Makes "designed for scale" literally visible — throughput line explodes while latency line stays flat in one frame — and it's genuinely shareable consumer fun, not an enterprise dashboard.
- **Why it could fail:** If the storm is 12 seed taps the scale claim collapses; must run a real load generator and show the flat-latency graph live.
- **What most competitors build instead:** A Venmo-style tip-jar CRUD app with a profile page and a transactions table, no concurrency design, claiming "scales to millions" on 20 seed rows.
- **How we make it 10× sharper:** Design for the hot-partition failure most ignore — explicit write-sharding with a labeled shard count, a Streams-driven aggregate, conditional-write idempotency tokens shown deduping a double-tap, and a live storm graph under real audience-driven load.

### S2 · Splitstream — *Aurora DSQL*

*Track 1 (B2C) · Composite **6.47** · Status: Killed (Splitwise-variant; two-region plumbing not worth it for a consumer expense app)*

- **Pitch:** A group-travel money app where 30 friends across 4 countries log expenses simultaneously and balances stay strongly consistent, so two people can't double-settle the same debt from two continents.
- **Target user:** Friend groups on international trips, destination weddings, and group houses currently fighting over who-owes-who in a chaotic chat and a broken spreadsheet.
- **Why the DB is load-bearing:** Genuinely multi-region active-active — friends in Tokyo, London, NYC write the SAME ledger concurrently; the who-owes-whom math is relational (JOINs across members/expenses/splits/settlements); a settlement must be strongly consistent cross-region so two people clearing the same debt can't double-settle. **DynamoDB isn't relational and cross-region is eventual (stale read → double-pay); single-writer Aurora can't make a London and a Tokyo write both strongly consistent + low-latency.** DSQL's OCC detects the conflicting double-settle at commit.
- **Frontend moment:** Split-screen of two phones in two regions — a reconciling balance graph where everyone's net position sums to exactly zero, a settle button, and a region badge per pane.
- **Demo moment:** Both regions tap "settle the $200 dinner debt" in the same instant — one commits, the other gets a clean OCC serialization error and a one-tap retry showing the debt already cleared; then disconnect one region's endpoint and keep adding expenses with no failover wait.
- **Why it could win:** The only B2C idea where multi-region strong consistency IS the product feature; the double-settle-rejected shot is unique to DSQL.
- **Why it could fail:** Deployed in one region with no cross-region write shown, a DSQL-literate judge asks for active-active proof and the thesis evaporates.
- **What most competitors build instead:** A Splitwise clone on Aurora with a single expenses table that never runs a real transaction, ignores concurrency, single-region.
- **How we make it 10× sharper:** Model the actual failure (concurrent cross-region double-settle), show OCC rejection + retry, demonstrate a region-kill with writes continuing, keep balances-sum-to-zero as live courtroom evidence.

### S3 · Cellar — *Aurora PostgreSQL*

*Track 1 (B2C) · Composite **7.30** · Status: Solid (a less-sharp sibling of Clausewise/Encore-casting)*

- **Pitch:** A taste-graph app that recommends your next bottle of wine or whisky by semantically matching flavor notes from thousands of real tasting reviews, filtered by what's in stock near you and under budget — in one query.
- **Target user:** Enthusiast consumers building a collection or gifting, overwhelmed by choice, who don't trust star ratings and want "something like this but cheaper and available now."
- **Why the DB is load-bearing:** The core query is irreducibly semantic-AND-relational in ONE statement — pgvector HNSW ANN over flavor-note embeddings `ORDER BY similarity`, JOINed against live inventory (in stock near user), a price-band filter, and the user's owned-cellar table (exclude what they have). **Only Aurora co-locates vectors with relational data; DynamoDB has no vector search and can't express the JOIN; DSQL has neither pgvector nor the extension ecosystem.** The recommendation correctness lives in the DB, not app code.
- **Frontend moment:** A search bar where "smoky like an Islay but smoother and under $60" streams in ranked bottle cards with similarity-score badges, in-stock pills, and price, plus an expandable "why this" flavor-notes panel.
- **Demo moment:** Live `EXPLAIN (ANALYZE, BUFFERS)` on the recommendation query showing the HNSW vector node AND the inventory/price/cellar JOIN nodes in one sub-100ms plan over tens of thousands of embedded bottles — proving it's not a `LIKE` in disguise.
- **Why it could win:** Dodges the RAG-chatbot trap — pgvector load-bearing inside a JOIN no other DB can do, with visible relevance scores and a one-query semantic+relational EXPLAIN as the hero shot.
- **Why it could fail:** Precomputed embeddings for a handful of bottles + keyword "search" = the pgvector-as-fake-AI failure; needs real volume with review-derived embeddings.
- **What most competitors build instead:** A "chat with your wine docs" RAG bot where pgvector is an interchangeable embedding store and the access pattern is a trivial top-k lookup.
- **How we make it 10× sharper:** Fuse vector + inventory + budget + owned-cellar exclusion into a single ranked SQL statement with EXPLAIN on screen, real review-derived embeddings at scale, similarity scores exposed as product UI.

### S4 · Dropgate — *DynamoDB*

*Track 1 (B2C) · Composite **7.64** · Status: Solid*

- **Pitch:** A fair-drop platform for limited sneakers, tickets, and collectibles where 50,000 people race for 500 items and every buyer can see, provably, that there were zero oversells and no bot jumped the line.
- **Target user:** Collectors and fans burned by drops that oversell, crash, or get botted — and small brands who want a trustworthy fair-launch tool.
- **Why the DB is load-bearing:** Extreme-concurrency claim-the-slot — 50,000 simultaneous buyers hammer a tiny finite inventory at the exact drop second. A conditional `UpdateItem` (`remaining > 0`, atomic guarded decrement) guarantees exactly-one-winner per unit with no row locks; idempotency tokens dedupe double-clicks; TTL items auto-expire unpaid holds at no read cost; Streams feed a live sold/remaining counter. **Aurora would serialize on the inventory row and deadlock under 50k contenders; DSQL's OCC would turn the contention into a retry storm on the same hot row.** Only DynamoDB conditional writes give correctness AND flat latency at that concurrency.
- **Frontend moment:** A live drop screen — remaining-inventory counter ticking down in real time, a personal hold timer (TTL-backed) counting down, and a public `OVERSELLS: 0` integrity badge, all via Streams-driven SSE under visible load.
- **Demo moment:** Unleash 50,000 genuinely parallel simulated buyers (k6) at 500 units — UI shows exactly 500 winners, oversells locked at zero, latency badge flat at single-digit ms, consumed-write graph spiking; then a held-but-unpaid slot's TTL expires and re-enters inventory live.
- **Why it could win:** Provable fairness under brutal load is a real consumer grievance, and "zero oversells across 50k contenders" with a flat-latency graph is exactly the correctness-under-storm evidence AWS judges reward.
- **Why it could fail:** If load is sequential (a for-loop) or the conditional write isn't truly exactly-once, a judge stress-clicking produces a double-claim and the fairness thesis dies on camera.
- **What most competitors build instead:** An e-commerce drop clone with a products table that decrements via a plain `UPDATE`, no conditional writes, no idempotency, "scales" with a dozen seed items.
- **How we make it 10× sharper:** Make the conditional-write expression and idempotency-key design visible on screen, write-shard reservations to avoid the single-item hot partition while keeping the exactly-one guarantee, show TTL holds recycling live, back the zero-oversell claim with a real k6 contention test + CloudWatch graph.

### S5 · Throwback — *DynamoDB*

*Track 1 (B2C) · Composite **6.94** · Status: Killed (weak scale story + low monetizability; G4 Provenance does event-sourcing time-travel better with a real buyer)*

- **Pitch:** A time machine for your own life — a scrubbable timeline that replays the full edit history of your habits, journals, and finances so you can scroll back to who you were on any given day.
- **Target user:** Quantified-self and journaling consumers, people in therapy or recovery, anyone who wants to see their own change over time instead of just the latest snapshot.
- **Why the DB is load-bearing:** Event-sourcing as the product. Item collections (`PK=USER#id`, `SK=ENTITY#id#EVT#ts`) return a full entity history in one Query with `begins_with`; Streams fan each write into per-day materialized snapshot items so the scrubber loads any date instantly; conditional writes (`attribute_not_exists` on `EVT#ts`) make appends idempotent. **Aurora needs a bolted-on events table + trigger-built snapshots; DSQL lacks Streams and the cheap append model.**
- **Frontend moment:** A timeline with a draggable time-travel slider — as you scrub, cards morph to your exact state on that date (habits, mood, balances) from the Streams-built daily snapshot item, with a "one Query" trace shown for the full history fetch.
- **Demo moment:** Scrub a year (instant per-date re-render), make a live edit, show the new event append to the immutable log + snapshot rebuild via Streams within ~1s — proving history is never mutated.
- **Why it could win:** Time-travel over your own life is an emotionally original interface that could only exist on an event-sourced model; textbook Streams→snapshot.
- **Why it could fail:** If it secretly stores only the latest snapshot and fakes history, the scrub reveals nothing; needs a real append-only log with enough depth to feel alive.
- **What most competitors build instead:** A journaling/habit-tracker CRUD app that overwrites current state in one table and calls a list of past entries a "timeline."
- **How we make it 10× sharper:** Make append-only event sourcing + Streams-driven snapshot materialization the literal interface; show the one-Query history fetch and the immutable log; prove edits never rewrite the past.

### S6 · Margin Call — *Aurora PostgreSQL*

*Track 1 (B2C) · Composite **6.75** · Status: Killed (reads as the warned-against finance toy; monetizability/originality scored low)*

- **Pitch:** A real-time peer-to-peer prediction exchange with a true double-entry order book where balances reconcile to zero on every trade and no participant can ever spend money they don't have.
- **Target user:** Prediction-market operators, fantasy/esports platforms, and event organizers who want a fair, auditable order-matching exchange with provable settlement, not a house-edge sportsbook.
- **Why the DB is load-bearing:** Order matching + settlement demand SERIALIZABLE transactions with `CHECK(balance >= 0)`, double-entry netting to zero, and planner-driven relational queries: a window function for live last-traded price/depth, a recursive CTE walking the book, a multi-table JOIN (user→position→order→market→settlement) in one query. **DynamoDB can't express the book joins or enforce cross-row balance invariants; DSQL lacks the constraint/trigger/window machinery and you don't need active-active for a single-region exchange.**
- **Frontend moment:** A trading-terminal UI — live order book with depth bars, a streaming last-traded-price chart from a window function, optimistic order placement, and a ledger-integrity panel showing total debits = total credits = 0 recomputing live after every fill.
- **Demo moment:** Fire two concurrent buy orders that together exceed balance — SERIALIZABLE commits exactly one, rejects the other with a visible serialization error; the double-entry panel stays balanced to zero; a double-click on "place order" is provably idempotent. No phantom money.
- **Why it could win:** The Aurora financial-correctness hero shot as a real exchange — a double-spend prevented under concurrency, a balanced double-entry ledger, plus genuine relational power visible in the UI.
- **Why it could fail:** If "transaction" is SELECT-then-UPDATE without SERIALIZABLE / idempotency / `CHECK`, it becomes the "finance app that never uses a transaction that matters" failure; matching under concurrency is genuinely hard.
- **What most competitors build instead:** A sportsbook-style betting UI backed by a bets table with `SELECT *`, no transaction, no double-entry, no isolation — and a double-click double-spends.
- **How we make it 10× sharper:** Weaponize isolation — a live concurrent over-spend rejected on camera, an always-balanced ledger netting to zero, idempotency keys surviving a deliberate double-click, and `EXPLAIN (ANALYZE)` on the order-book recursive CTE + window-function price feed.

### S7 · Settle — *Aurora PostgreSQL*

*Track 1 (B2C) · Composite **5.94** · Status: Killed (lowest score in the field — Splitwise clone smell; single-region negates any DSQL angle)*

- **Pitch:** A group-expense ledger that computes the provably minimal set of transfers to settle a tangled debt graph, as one recursive SQL settlement with no double-counting.
- **Target user:** Roommates, travel groups, supper clubs, small partnerships managing shared multi-currency expenses with complex split rules.
- **Why the DB is load-bearing:** The debt graph is relational + graph-reduction — expenses fan out via weighted splits, net positions via window functions/CTEs, then reduced to a minimal-transfer settlement inside a transaction (fully applies or rolls back); a zero-sum invariant is enforced; serializable isolation avoids double-settling. **DynamoDB can't express the aggregation/netting; this is single-region correctness work so DSQL's active-active buys nothing.**
- **Frontend moment:** A force-directed debt graph that animates from a tangled web of 30 IOUs into the minimal 4 settlement arrows on "optimize," with a running zero-sum tally always exactly `$0.00`.
- **Demo moment:** Add a messy multi-currency expense live — the graph re-nets, the zero-sum badge holds; then two people settle the same debt in two tabs and the serializable transaction rejects the duplicate so no one is double-charged.
- **Why it could win:** Turns a beloved-but-shallow category (Splitwise) into a database thesis — minimal-settlement netting + always-zero invariant as visible relational correctness, with a graph-collapse animation that only exists because of the aggregation query.
- **Why it could fail:** Minimal-settlement + multi-currency rounding must be exactly right or the zero-sum invariant breaks on camera; keep to two or three currencies.
- **What most competitors build instead:** A Splitwise clone storing expenses in a table with naive pairwise "you owe Bob $5," no netting, no transaction, no invariant.
- **How we make it 10× sharper:** Make the minimal-transfer graph reduction in SQL + the provable zero-sum invariant under concurrent settlement the product; show the CTE and the rejected duplicate-settlement on screen — which clones never do.

---

## Track 2 — Monetizable B2B

> Track odds: **best.** B2B workloads naturally make the DB load-bearing (multi-tenant, audit/event history, billing/metering, real-JOIN reporting), real-world applicability + monetization read instantly, and the track is *less crowded* because B2B is "less fun" to build. A serious one stands out.

### S8 · Meridian — *Aurora DSQL*

*Track 2 (B2B) · Composite **7.47** · Status: Solid*

- **Pitch:** A multinational's regional entities settle intercompany cash positions across regions in real time, and a double-pay is rejected at commit — not reconciled the next morning.
- **Target user:** Corporate treasury / FP&A at multinationals with entities in multiple regions; the buyer is a VP Treasury with budget already spent on Kyriba/FIS reconciliation tooling.
- **Why the DB is load-bearing:** Intercompany netting requires two regional treasurers (us-east-1 and eu-west-1) to write the SAME account balances concurrently with strong consistency, so a Frankfurt transfer can't double-spend a balance New York is also drawing down — active-active relational writes with serializable-at-commit semantics across regions. **Single-writer Aurora goes stale cross-region or needs a failover the demo can't survive; DynamoDB Global Tables (eventual, last-writer-wins) silently allow the double-spend and MRSC is key-value, not relational netting with JOINs across accounts/entities/positions.** DSQL's OCC detects the conflict at commit — no 2PC, no failover.
- **Frontend moment:** Split-screen of two live Vercel deployments labeled us-east-1 / eu-west-1 — a running "globally consistent committed transactions" counter, a ledger reconciling to zero, and a region kill-switch that disconnects one endpoint mid-demo while writes continue.
- **Demo moment:** Two treasurers simultaneously draw $4M from an entity holding $5M — one commit lands, the other returns an OCC serialization error live and auto-retries against the corrected balance, so the double-spend never happens; then a region is killed and writes continue.
- **Why it could win:** The hardest thing to fake and the one demo no other DB can produce — strongly-consistent cross-region relational writes with a visible conflict rejection — paired with a real B2B buyer and a region-failure resilience beat most entrants won't attempt.
- **Why it could fail:** A one-region demo collapses to "Postgres with extra steps"; risk is not wiring two regional endpoints + two deployments before the deadline.
- **What most competitors build instead:** A single-region finance dashboard doing `SELECT * FROM transactions`, claiming multi-region in the copy without ever showing a cross-region write.
- **How we make it 10× sharper:** Make the OCC conflict clickable — an on-screen "fire two concurrent transfers" button, a live commit-latency-per-region widget, and the region kill switch — turning DSQL's invisible consistency guarantee into a tactile, repeatable judge interaction.

### S9 · Cadence — *DynamoDB*

*Track 2 (B2B) · Composite **7.67** · Status: Solid*

- **Pitch:** Every metered API call lands as an idempotent event at storm scale, materializes into a live billing balance via Streams, and a double-clicked retry never bills the customer twice.
- **Target user:** Finance/RevOps and platform teams at usage-based SaaS and AI-API companies competing with Metronome, Orb, and Amberflo — where metering errors directly leak revenue and trigger disputes.
- **Why the DB is load-bearing:** Metering is unbounded high-write telemetry (millions of events/sec, spiky) where per-event latency must stay flat regardless of volume; each event needs a conditional write keyed on an idempotency token so retries don't double-bill; the running balance is a Streams-driven materialized view (event→Lambda→aggregate item) giving native event-sourcing for audit. **Aurora falls over on the write storm and forces a bolted-on queue + CDC; DSQL is correctness-first and transaction-size/throughput-bounded — wrong shape for unbounded append-only telemetry — with no native Streams fan-out.**
- **Frontend moment:** A live ops dashboard — a write-storm meter ticking past millions with a p99-latency badge pinned at single-digit ms, beside a per-customer billing ledger updating instantly (Streams→aggregate→SSE).
- **Demo moment:** Load gen to 50k events/sec with latency badge flat at ~5ms; then double-fire the SAME event with one idempotency key and show the balance increment exactly once; CloudWatch `ConsumedWriteCapacity` climbing as latency holds.
- **Why it could win:** Puts DynamoDB's two signature features on screen at once — flat latency under a storm AND conditional-write idempotency preventing revenue leakage — tied to a real B2B dollar problem, with the Streams materialized view as the product.
- **Why it could fail:** Without a real load gen and a visible latency/CloudWatch graph it becomes "scales to millions" with 12 seed rows; faking volume instead of generating it live is fatal.
- **What most competitors build instead:** A Stripe-clone billing CRUD on Aurora that stores invoices in a table and never demonstrates write throughput, idempotency, or a materialized view under load.
- **How we make it 10× sharper:** Show the idempotency token and the single-table item-collection design (`CUSTOMER#id` PK, `EVENT#ts` / `METER#window` SK) as a labeled access-pattern table in the UI, and let a judge press "simulate a retry storm" to watch the balance refuse to double-count.

### S10 · Clausewise — *Aurora PostgreSQL*

*Track 2 (B2B) · Composite **7.90** · Status: Strong*

- **Pitch:** Ask "which active vendor contracts auto-renew in 90 days, with uncapped liability, in EMEA?" and one SQL query runs pgvector semantic match JOINed against structured obligation, jurisdiction, and renewal data.
- **Target user:** In-house legal ops, procurement, and GCs managing thousands of executed contracts (competing with Ironclad/Evisort); the pain is missed renewals and unseen liability buried in PDFs.
- **Why the DB is load-bearing:** The core query is semantic similarity AND hard relational filters in ONE statement — pgvector HNSW ANN over clause embeddings `ORDER BY similarity`, JOINed to extracted obligation rows (`renewal_date`, `liability_cap`, `governing_law`, `counterparty`, `status`) with WHERE filters + aggregation. **Only Aurora co-locates vectors with relational data (one query, one plan, no vector DB to sync); DynamoDB has no vector search and can't express the ad-hoc JOIN/filter combinatorics; DSQL has neither pgvector nor the extensions, so the signature feature doesn't exist there.**
- **Frontend moment:** A faceted search bar where a natural-language clause query returns ranked results with similarity-score badges beside hard filters (jurisdiction, cap, renewal window); clicking a result opens a drawer with the matched clause text and the JOINed structured obligations.
- **Demo moment:** Type a fuzzy query ("liability we can't cap"), watch ranked clauses appear by HNSW similarity, then show the live `EXPLAIN (ANALYZE)` revealing the vector index node AND the JOIN/filter on obligation tables in one sub-100ms plan over thousands of real-shaped clauses.
- **Why it could win:** The pgvector idea that defeats "chat-with-your-docs" — the value is the JOIN against structured legal metadata, not embeddings as a dumb store — with the query plan on screen and a concrete ROI story (avoided auto-renewals).
- **Why it could fail:** Embeddings for 5 contracts + `LIKE` in disguise dies as keyword search; risk is too little real volume and no visible index hit in EXPLAIN.
- **What most competitors build instead:** A RAG "chat with your contracts" bot where pgvector is an interchangeable embedding store, no relational JOIN, no obligation model, no query plan shown.
- **How we make it 10× sharper:** Lead with the EXPLAIN plan as a hero artifact, seed thousands of real-shaped clauses so the HNSW index demonstrably matters, and overlay a "one query, semantic + 4 tables" annotation so judges see the relational power.

### S11 · Ledgerline — *Aurora PostgreSQL*

*Track 2 (B2B) · Composite **6.67** · Status: Killed (strong DB craft, but visually similar to the warned-against finance toys; less visceral than Settlement Floor's cross-region race)*

- **Pitch:** Every marketplace payout splits across seller, platform fee, tax, and escrow in one serializable transaction that provably balances to zero, and a constraint violation rejects an unbalanced write before it lands.
- **Target user:** Finance/payments engineering at marketplaces and platforms handling split payouts and escrow (competing with internal ledger builds and Modern Treasury); the pain is reconciliation breaks and money that doesn't tie out.
- **Why the DB is load-bearing:** Double-entry ledgering is correctness-first single-region relational work — SERIALIZABLE isolation, `NUMERIC`/`DECIMAL`, `CHECK` constraints enforcing debits = credits, FKs across accounts/entries/transfers, a balanced multi-entry transaction that fully commits or rolls back, window functions for running balances, materialized views for reconciliation. **DynamoDB can't enforce a cross-row balance constraint or a real serializable multi-entry transaction; DSQL lacks `CHECK`, FKs, triggers, and views — the exact integrity primitives that make this ledger provably correct — and the workload is single-writer.**
- **Frontend moment:** A double-entry ledger view where each payout expands into its constituent entries (seller credit, fee debit, tax, escrow), a running-balance column from a window function, and a "balances to zero" badge that turns red the instant any entry is tampered.
- **Demo moment:** Fire two concurrent payouts against the same escrow balance plus an intentionally unbalanced transfer — show the serializable conflict and the `CHECK`-constraint rejection happening at the DB layer (not app code), then a correct double-entry committing and reconciling to exactly zero.
- **Why it could win:** Uses the transaction, constraint, and isolation level the briefing warns most entrants skip; the rejected-unbalanced-write and balances-to-zero beats are DB-enforced evidence, and reconciliation is a real CFO-grade pain with budget.
- **Why it could fail:** If it never shows a transaction, constraint, or serialization conflict it collapses into the warned-against "expense tracker that just SELECTs"; risk is demoing happy-path inserts and claiming correctness without proving rejection.
- **What most competitors build instead:** A personal-finance/expense tracker on Aurora that stores rows and never uses a transaction, constraint, or isolation level that matters.
- **How we make it 10× sharper:** Put the `CHECK` constraint and SERIALIZABLE transaction on screen, then let a judge press "try to double-spend the escrow" and "post an unbalanced entry" and watch the DB itself reject both, with a materialized-view reconciliation report as the closer.

### S12 · Overbook — *Aurora PostgreSQL*

*Track 2 (B2B) · Composite **8.31** · Status: Strong*

- **Pitch:** A reservation engine for scarce time-slot inventory that provably never double-books overlapping reservations, enforced by Postgres range-exclusion constraints under concurrent load.
- **Target user:** Clinics, studios, equipment-rental and co-working operators who lose money and trust to double-bookings and overlapping reservations.
- **Why the DB is load-bearing:** The unbeatable property is Postgres's `EXCLUDE` constraint with a GiST index over `tstzrange` — the database itself guarantees no two confirmed bookings for the same resource can overlap, a declarative correctness guarantee at the storage layer — combined with serializable transactions for the hold-then-confirm flow and JOINs across resources/customers/pricing. **DynamoDB can only approximate this with fragile app logic and cannot express range-overlap exclusion; DSQL lacks exclusion constraints and the GiST extension.** Double-booking impossibility is a feature only Aurora PostgreSQL provides natively.
- **Frontend moment:** An availability grid (resources × time) with optimistic holds that turn green on confirm and red-flash-then-revert when the exclusion constraint rejects a colliding booking, plus a live "collisions prevented" counter.
- **Demo moment:** Fire 2,000 genuinely concurrent attempts at the same hot slot — the grid shows exactly one confirmed booking, the rest cleanly rejected by `EXCLUDE`, a throughput graph proving the load was real, a "zero double-books" badge; then show the one-line constraint definition that made it impossible.
- **Why it could win:** A Postgres superpower 99% of entrants don't know exists, turning correctness-under-contention into a one-line declarative guarantee with load evidence — exactly the visible-correctness-under-load judges reward.
- **Why it could fail:** The hold-expiry/payment-confirm state machine adds complexity, and a weak load test (a dozen requests) kills the scale claim; the concurrency demo must use a real load generator with a graph.
- **What most competitors build instead:** A booking/calendar app that checks availability with a SELECT-then-INSERT and races itself into double-bookings, calling polling "real-time."
- **How we make it 10× sharper:** Make the `EXCLUDE`-over-`tstzrange` constraint the protagonist — declarative double-booking impossibility rejecting thousands of concurrent collisions with a measured throughput graph — not the application-level lock hacks everyone else writes.

### S13 · Tribunal — *Aurora PostgreSQL*

*Track 2 (B2B-leaning) · Composite **7.65** · Status: Solid*

- **Pitch:** A duplicate-and-conflict detector for any knowledge base that finds near-identical and contradictory entries via a pgvector self-join against authorship and version lineage, so orgs can prune and reconcile their documentation.
- **Target user:** Support/ops leaders and legal/compliance teams drowning in redundant, conflicting internal docs, macros, and policy clauses.
- **Why the DB is load-bearing:** The core operation is a self-JOIN on a vector column — find all pairs of documents whose embeddings are within a similarity threshold (pgvector ANN) JOINed to version/author/team metadata and a recursive CTE over edit history, surfacing "these two clauses are 0.94 similar but say contradictory things, written by different teams 6 months apart," with window functions clustering near-dupes into equivalence classes. **DynamoDB can't do similarity or self-joins; DSQL has no pgvector.** One engine does semantic + relational + temporal in a single query surface.
- **Frontend moment:** A conflict board clustering near-duplicate docs into visual groups with a similarity heatmap, plus a side-by-side diff drawer showing two contradictory clauses with their similarity score and the date/author lineage pulled via JOIN.
- **Demo moment:** Run the detector over a seeded 200k-clause corpus — it surfaces a cluster of 5 near-identical refund policies that disagree on the refund window, shows the pgvector similarity matrix and the `EXPLAIN` with the HNSW index hit, then merges them in a transaction that updates all references atomically.
- **Why it could win:** pgvector for something other than RAG — similarity as a deduplication/conflict primitive joined to lineage — genuinely original, dodges the chatbot trap, makes both the vector math and the JOIN legible on a real, fundable B2B pain.
- **Why it could fail:** Defining "contradictory" vs merely "similar" is fuzzy; if clusters look arbitrary the product feels like a gimmick, so thresholds must be tuned on a realistic corpus with precision shown.
- **What most competitors build instead:** Another RAG "search your docs" chatbot where pgvector is an interchangeable embedding store and the access pattern is a single top-k lookup.
- **How we make it 10× sharper:** Use the vector index for a self-join clustering + contradiction query (not top-k retrieval), JOINed to temporal authorship lineage, with the similarity matrix and EXPLAIN on screen over a 200k-row corpus — a pgvector access pattern almost no entrant will attempt.

### S14 · Splitwire — *Aurora DSQL*

*Track 2 (B2B) · Composite **7.08** · Status: Solid (a less-sharp sibling of Settlement Floor — don't build a weaker twin)*

- **Pitch:** A globally-distributed treasury ledger for cross-border creator/affiliate payouts where the same wallet balance is debited from whichever region the payment processor lands in, and a double-payout is physically impossible.
- **Target user:** Payment ops teams at marketplaces, affiliate networks, and creator platforms paying out to a global base from multiple regional rails (US ACH, EU SEPA, APAC local) running concurrently.
- **Why the DB is load-bearing:** One wallet, N regional payout workers, balance must never go negative, and a payout must execute exactly once even when two regions race the same wallet in the same millisecond. **DSQL alone gives ACID + strong consistency ACROSS regions simultaneously (both endpoints one logical DB) — a SERIALIZABLE/OCC transaction debiting in us-east-1 and another in eu-west-1 conflict-detect at commit, exactly one wins, no 2PC, no failover. DynamoDB eventual mode would double-pay; single-region Aurora can't accept active-active cross-region writes at all.**
- **Frontend moment:** A double-entry ledger (shadcn data table + animated running balance) split into two region tabs side-by-side; each row reconciles to zero, with an idempotency-key column and a "committed in region X, conflicted in region Y" badge making the OCC outcome visible per transaction.
- **Demo moment:** One button fires two payout transactions against the same wallet from two regional endpoints at the same instant — one commits, the other returns a serialization error and auto-retries against the corrected balance, the running balance never goes negative, per-region commit latency on a badge; then a regional endpoint is killed and payouts keep flowing.
- **Why it could win:** The canonical DSQL hero shot (active-active ledger + region kill + OCC conflict) applied to a real B2B pain (multi-rail global payouts), every claim provable on screen, and the architecture diagram doubling as the data model (`accounts`/`transactions`/`idempotency_keys` with FK + `CHECK balance>=0`).
- **Why it could fail:** Risk of looking like "just a finance tracker" if the cross-region race isn't dramatized; mitigate by making the concurrent two-region double-spend the FIRST thing in the demo.
- **What most competitors build instead:** A single-region expense/payment tracker on Aurora doing `SELECT * FROM transactions`, never opening a transaction or showing a constraint firing.
- **How we make it 10× sharper:** Don't claim correctness — attack your own ledger live with a concurrent cross-region double-spend and show the DB reject it at commit, idempotency key + OCC retry visible, the frontend as courtroom evidence the balance can't go wrong even under a region failure.

---

## Track 3 — Million-scale global

> Track odds: **high ceiling / high risk.** Most rewards DSQL multi-region + DynamoDB latency-at-scale; can win overall *if you SHOW scale* (load test, latency graphs, real multi-region). Easiest track to fake → most entrants get deflated. Win condition is strict: a real load generator and a CloudWatch/k6 graph, not seed rows.

### S15 · Tempo — *DynamoDB*

*Track 3 (Million-scale) · Composite **8.09** · Status: Strong*

- **Pitch:** A planet-scale second screen that turns 50M fans tapping reactions during a World Cup match into a live, sub-second emotional heatmap of the world.
- **Target user:** Broadcasters, sports rights-holders, and fans watching a major live event simultaneously across every continent.
- **Why the DB is load-bearing:** A known set of access patterns (write a reaction; read aggregated counts per match/region/minute) at unbounded spiky write volume where per-item latency MUST stay flat while writes 100× at a goal. Reactions are sharded across `PK=MATCH#id#SHARD#n` to dodge the hot partition; Streams fan raw taps into per-minute/per-region materialized aggregate items (the heatmap) with zero extra queue; TTL expires raw taps after the match; Global Tables put ingestion near each region. **Aurora would deadlock on the write spike and need bolted-on CDC; DSQL's OCC would generate commit conflicts on the same hot counters and is overkill for non-relational tallies.**
- **Frontend moment:** A live world map (maplibre/recharts) where regions pulse and bloom in color intensity as reactions land, a reactions/sec counter ticking past millions, and a fixed p99-latency badge staying flat — driven by SSE off the Streams-built aggregates.
- **Demo moment:** Fire a load gen simulating a stadium goal — ops/sec rockets 2k→80k writes/sec, the world map erupts in synchronized pulses, the p99 badge does NOT move; one chart proving "designed for scale," with a CloudWatch `ConsumedWriteCapacity` graph beside it.
- **Why it could win:** Makes DynamoDB's single signature property — flat latency under a viral write storm — literally visible and clickable on a live map, backed by a CloudWatch graph and a k6 load test, with the Streams-driven heatmap as the product.
- **Why it could fail:** Under-provisioned load gen or seeded counts make the storm look staged; the heatmap must be driven by genuine simulated taps with the CloudWatch graph shown live.
- **What most competitors build instead:** A polling-based live-poll widget hitting one table every few seconds, calling it real-time, a dozen seed rows, no hot-partition or sharding design.
- **How we make it 10× sharper:** Expose the single-table item-collection diagram + a 7-access-pattern table on screen, write-shard the hot match partition explicitly, and show the X-Ray trace of one Streams record becoming a materialized aggregate.

### S16 · Driftwatch — *DynamoDB*

*Track 3 (Million-scale) · Composite **7.26** · Status: Solid (a less-sharp sibling of G4 Provenance / G8 Tape)*

- **Pitch:** Ingest 1M sensor readings/sec from a global device fleet and surface the anomalous ones on a live time-scrubbable timeline within the same second they arrive.
- **Target user:** Industrial IoT, EV charging networks, and connected-fleet operators monitoring millions of edge devices across regions for real-time anomalies.
- **Why the DB is load-bearing:** Telemetry is append-only, write-dominated, unbounded, queried by a fixed pattern (device timeline + recent anomalies), demanding flat single-digit-ms writes regardless of fleet size. `PK=DEVICE#id`, `SK=TS#iso` gives one Query for a device's history; Streams drive a Lambda computing rolling z-score anomalies into a materialized `ANOMALY#` collection + a global recent-anomalies feed; TTL ages out raw readings cheaply; Global Tables put ingestion near each region. **Aurora chokes on sustained 1M writes/sec and needs external CDC for the anomaly view; DSQL's transactional/OCC model and 10k-row transaction limits are wrong for firehose ingest.**
- **Frontend moment:** An ops console with a device-fleet map, a horizontally scrubbable time-travel slider replaying the last hour of anomalies as state changes, and a live anomaly feed (SSE) with "just now" timestamps and pulsing severity badges.
- **Demo moment:** Crank ingestion to 1M readings/sec across simulated regions — the writes/sec meter and CloudWatch graph climb while p99 stays flat; an injected sensor fault appears as a red anomaly within ~1s; scrub the slider backward to replay the exact drift moment.
- **Why it could win:** The time-travel slider over a Streams-built anomaly history is an interaction that could only exist on this model, and the flat-latency-under-firehose graph is the most legible "designed for scale" evidence an AWS judge can ask for.
- **Why it could fail:** A pretty timeline with 50 seeded readings and no sustained load test reduces it to a generic dashboard; the firehose volume and the Streams-to-materialized-view path must be real and graphed.
- **What most competitors build instead:** A generic IoT dashboard with a line chart over a few hundred rows, no streams, no anomaly derivation in the DB, a "scales to millions" caption with no proof.
- **How we make it 10× sharper:** Publish the single-table item-collection diagram, write-shard the hottest devices/time-buckets, show the Streams→Lambda→materialized-anomaly path in X-Ray, and put a measured p50/p99 + row-count-in-the-millions on screen.

### S17 · Splitsecond — *DynamoDB*

*Track 3 (Million-scale) primary; B2B secondary as sellable live-ops infra · Composite **7.84** · Status: Strong*

- **Pitch:** A live-ops control room for game studios where a global leaderboard, kill feed, and per-player profile all update in single-digit milliseconds under a real write storm you can trigger on stage.
- **Target user:** Indie and mid-size game studios running live-ops events (tournaments, seasonal ladders) and event-platform teams who need real-time ranking infrastructure they don't want to build.
- **Why the DB is load-bearing:** The protagonist is a Streams-driven materialized leaderboard — raw score events land at unbounded spiky write volume (`PK=MATCH#id`, `SK=EVENT#ts`), a Stream→Lambda consumer atomically increments per-player aggregates + rank buckets, and leaderboard reads are one Query against a GSI (`GSI1PK=SEASON#id`, `GSI1SK=SCORE#zero-padded`) returning a pre-sorted top-N in a single round trip. **Aurora would hot-UPDATE a ranking row that serializes under concurrency; DSQL's OCC would generate commit conflicts on the same hot aggregate exactly when load spikes.** The flat-latency-under-storm graph only exists here.
- **Frontend moment:** A split dashboard — left a raw event firehose ticking past, center a leaderboard whose rows animate and reorder live (Streams→Lambda→SSE), right a fat latency badge showing p50/p99 holding at single-digit ms while a `ConsumedWriteCapacity` sparkline climbs into the thousands/sec.
- **Demo moment:** Press "unleash storm" (a k6 generator the audience can also tap into) — WriteCapacity rockets to thousands/sec on the embedded CloudWatch graph, the leaderboard keeps reordering smoothly, p99 never leaves single digits; the latency line flat WHILE the throughput line explodes.
- **Why it could win:** Directly satisfies the AWS judges' top reward — visible scale/latency evidence with a real load test + CloudWatch graph on the actual UI — plus a Streams-driven materialized view as the literal product and named GSIs mapping one-to-one to screens.
- **Why it could fail:** A faked/under-powered storm collapses into "scales to millions with 12 seed rows"; too-generic a game theme reads as a leaderboard toy.
- **What most competitors build instead:** A static leaderboard table populated from seed rows, polling one table every 3 seconds, "scales to millions," zero load evidence.
- **How we make it 10× sharper:** Make the load test live and audience-driven, put p50/p99 + WCU on the actual UI (not a slide), show the X-Ray trace of one Query serving the leaderboard, name the hot-aggregate failure mode of Aurora/DSQL out loud, and write-shard the rank counter.

### S18 · Pulsefeed — *DynamoDB*

*Track 3 (Million-scale) primary; B2C on the consumer surface · Composite **8.37** · Status: Strong (highest-scoring serious idea after Sky Claim)*

- **Pitch:** A creator-platform activity and notification fabric where every follow, like, and post fans out into millions of personalized timelines that each render from a single Query — with the fan-out strategy visible as the product.
- **Target user:** Social and creator platforms (newsletters, communities, short-video apps) that need a notification + home-feed system that survives a viral spike from one mega-creator without melting.
- **Why the DB is load-bearing:** The protagonist is item-collection feed materialization with deliberate fan-out-on-write vs fan-out-on-read modeling. Each user's timeline is `PK=USER#id`, `SK=FEED#ts` so a home feed is one paginated Query, no joins. A normal creator's post triggers Streams→Lambda fan-out-on-write into followers' feed partitions; a mega-creator above a follower threshold is flagged "celebrity" and served fan-out-on-read (merged at query time) to avoid a million-write amplification storm; write-sharding spreads the celebrity's own activity to dodge a hot key. **Aurora/DSQL can't fan out natively and would need EventBridge + a feed table read with an expensive join per pull.**
- **Frontend moment:** A two-pane view — left a real-time notification inbox updating live (Streams→SSE), right the home feed — with a toggle exposing engine internals, a per-user "feed assembly" panel showing which posts came via fan-out-on-write vs read, and a partition-activity heatmap that lights up when a celebrity posts.
- **Demo moment:** A normal creator posts and the event fans out instantly into a follower's live feed; then a "celebrity" with 1M followers posts and the heatmap shows the system switching to fan-out-on-read instead of issuing a million writes, while the follower's feed still assembles in one Query in single-digit ms.
- **Why it could win:** Refuses the lazy "Twitter clone on DynamoDB because a blog said so" trap by making the fan-out decision and hot-key avoidance the explicit visualized thesis — exactly what the briefing says weak submissions skip — and the partition heatmap is original UI that could only exist given this data model.
- **Why it could fail:** If it's just a feed that polls one table it becomes the named anti-pattern social-feed clone; both fan-out strategies must actually be implemented and visible.
- **What most competitors build instead:** A Twitter/social-feed clone with naive fan-out-on-write only, no celebrity handling, no hot-key thought, polling for "real-time," no timeline-materialization story.
- **How we make it 10× sharper:** Implement BOTH fan-out strategies with a real follower-threshold switch, visualize partition activity as a heatmap, surface per-post assembly provenance, show the X-Ray single-Query feed read, and name the hot-partition and write-amplification failure modes + the exact sharding/threshold designed around.

### S19 · Tessellate — *Aurora DSQL*

*Track 3 (Million-scale) · Composite **7.89** · Status: Strong*

- **Pitch:** A worldwide live-event seat engine where audiences in every region claim the same scarce seats at once, and strongly-consistent distributed SQL guarantees zero oversells with no single bottleneck region.
- **Target user:** Global ticketing platforms, conference organizers, and flash-sale commerce selling a single fixed inventory to a planet-wide audience that all clicks at the on-sale instant.
- **Why the DB is load-bearing:** The invariant is finite scarce inventory (seat 14C exists once) claimed concurrently by buyers nearest different regional writers, sold exactly once globally with strong consistency, while every buyer writes to their nearest low-latency endpoint. **DynamoDB Global Tables (eventual/MREC) would oversell because last-writer-wins on a held seat isn't a correctness guarantee; single-region Aurora makes APAC buyers pay a cross-ocean RTT on every hold and dies if that region degrades during the on-sale.** DSQL's multi-region strong consistency + OCC at commit is the only fit: active-active writers, one logical inventory, conflicts rejected at commit.
- **Frontend moment:** A seat-map grid (availability heatmap, green/amber/red seats, optimistic "held by you" state) with a global seats-remaining counter identical across two region tabs in real time; a temporary HOLD shows a TTL countdown and on commit flips to SOLD across both regions at once.
- **Demo moment:** Fire 5,000 concurrent buyers from two regions all targeting the same 200 seats — the map fills with exactly 200 SOLD and zero oversells, a live tally shows "claims: 5000, seats: 200, oversells: 0" while the remaining counter stays strongly consistent across both region tabs; then a region is dropped mid-sale and selling continues.
- **Why it could win:** Fuses two judge-rewarded moments — the high-concurrency exactly-one-winner claim AND the cross-region strong-consistency read — into one visceral artifact (a seat map that cannot oversell globally); "oversells: 0" under a cross-region storm is a number no other DB in the field can honestly show.
- **Why it could fail:** Could be mistaken for an e-commerce clone; the defense is there are no products to browse — the entire product IS the contention surface — and the demo opens with the storm and a real second region.
- **What most competitors build instead:** A DynamoDB flash sale claiming scale with 12 seed SKUs, no conditional-write story, that silently oversells under real concurrency; or a marketplace MVP that never tests contention.
- **How we make it 10× sharper:** Sell from multiple regions AT ONCE (not one region with replicas), prove the global inventory is strongly consistent during the storm, survive a region drop mid-sale, and render the hold/commit/TTL lifecycle on the seat itself so the consistency model is literally clickable.

---

## Track 4 — Open innovation

> Track odds: **wildcard / originality magnet, highest variance.** A novel data model can top the leaderboard; this is also where vague art-projects pile up. Strong for a technically sharp, conceptually distinct entry; weak as a hiding place for an unfinished idea. **The single highest-scoring serious concept in the whole field lives here: S20 · Sky Claim.**

### S20 · Sky Claim — *DynamoDB* ★

*Track 4 (Open) with a Million-scale flavor · Composite **8.65** · Status: **Top-5** → full deep dive: [`./deep-dives/03-sky-claim.md`](./deep-dives/03-sky-claim.md)*

- **Pitch:** A live air-traffic control for the sub-400ft drone economy where every flight atomically claims 3D airspace voxels before entering them, and double-bookings are physically impossible.
- **Target user:** Drone-delivery operators, BVLOS survey fleets, and municipal UAS Traffic Management (UTM) coordinators who need to deconflict thousands of simultaneous flights over a city.
- **Why the DB is load-bearing:** The core operation is a conditional write to claim a `(geohash-voxel, time-bucket)` item with `attribute_not_exists`, giving exactly-one-winner deconfliction under massive concurrency at single-digit-ms latency that stays flat as flight count 100×'s; Streams fan each claim into a materialized live-skymap view; TTL auto-expires voxel reservations the instant a flight clears them, at zero read cost. The access patterns (claim voxel, query my corridor, expire on exit) are all known in advance and key-shaped. **Aurora would deadlock on the hot spatial rows under a write storm; DSQL's OCC would retry-storm the same contended voxels — and you don't need cross-region writes for one city's airspace.**
- **Frontend moment:** A dark-mode 3D city skymap (voxel grid over a map) where hundreds of drone corridors light up live as claims land, a flat p99-latency badge pinned in the corner, a flights/sec counter climbing, and a red flash the instant a conflicting claim is rejected.
- **Demo moment:** Two operators tap "fly through this voxel at 10:42:15" simultaneously on a contended corridor — one lights green (claim won), the other instantly flashes red (voxel held, rerouting); zero oversells across a 5,000-flight load test, with the `ConsumedWriteCapacity` graph climbing and p99 latency flat on screen.
- **Why it could win:** Makes correctness-under-write-storm *physically* visible (airspace can't be double-claimed), pairs the signature DynamoDB superpower (conditional writes + flat latency + Streams + TTL) with a real load test and CloudWatch graph, and lives in a domain that reads as senior-level systems thinking, not a dropdown pick.
- **Why it could fail:** A sloppy geohash scheme creates hot partitions (everyone over downtown hits one PK), so without explicit write-sharding of dense voxels the latency graph won't stay flat; a 3D map UI can also eat all the build time.
- **What most competitors build instead:** A generic fleet tracker that polls one positions table every 3 seconds and calls it real-time, with the DB as mere location storage and no claim semantics.
- **How we make it 10× sharper:** Make the conditional write the protagonist with a head-to-head race for the same voxel showing a visible winner/loser, a published k6 load-test screenshot at thousands of claims/sec, a single-table item-collection diagram (`FLIGHT#id`, `VOXEL#geohash#timebucket`) with named GSIs and a 7-access-pattern table, and write-sharding named explicitly as the hot-partition mitigation. **Full build plan in [`./deep-dives/03-sky-claim.md`](./deep-dives/03-sky-claim.md).**

### S21 · Provenance (Carbon Retirement Ledger) — *Aurora DSQL*

*Track 4 (Open) with a B2B angle · Composite **7.67** · Status: Solid* — *not to be confused with the Top-5 generational G4 Provenance (DynamoDB, AI-agent debugger) in [`./03-generational-ideas.md`](./03-generational-ideas.md).*

- **Pitch:** A global retirement ledger for carbon credits where the same tonne of CO₂ can be retired exactly once across every regional registry on Earth, with strongly-consistent active-active writes and no registry able to sell it twice.
- **Target user:** Carbon registries, corporate ESG buyers retiring offsets, and auditors who need a tamper-evident, globally-consistent record that a credit retired in the EU is instantly unavailable in the US and APAC.
- **Why the DB is load-bearing:** The unique property required is multi-region active-active writes with strong consistency on *relational* data — a retirement committed by the EU endpoint must be strongly consistent to the US and APAC endpoints so no second buyer can retire the same serial, and DSQL's OCC detects the conflicting concurrent retirement at commit and rejects the loser, with no failover. **DynamoDB eventual mode would let a stale read double-retire (and MRSC caps at 3 regions / key-value, losing the credit→vintage→project joins); single-region Aurora is single-writer so a region outage means you can't retire there at all.** This is AWS's own positioning: global financial correctness without running your own Postgres failover.
- **Frontend moment:** A split-screen "two registries, one truth" console — an EU pane and a US pane side by side, each showing the same project's credit inventory reconciling in real time, with a globally-consistent "tonnes retired" counter and a per-region commit-latency widget proving SQL JOINs (credit→vintage→project→registry) still run sub-100ms.
- **Demo moment:** Two buyers in two regions hit "Retire serial #EU-2024-0042" at the same instant — one commit burns the credit globally, the other gets a serialization conflict and a clean "already retired in us-east-1 12ms ago" rejection; then disconnect one regional endpoint mid-demo and retirements keep committing on the other.
- **Why it could win:** The canonical DSQL hero shot (strongly-consistent cross-region write + OCC conflict + region-kill resilience) attached to a domain judges find genuinely important and original, and the double-entry retirement ledger gives real relational JOINs proving you didn't give up SQL for global scale.
- **Why it could fail:** DSQL's >10k-rows / >10MiB-per-transaction limits and lack of triggers/sequences/extensions can bite if you over-model; faking the second region with one deployment lets a DSQL-literate judge ask for the cross-region write and find nothing.
- **What most competitors build instead:** A single-region Postgres or spreadsheet-grade offset marketplace with a credits table and a status column, claiming integrity it never demonstrates with a transaction, no concept of cross-registry double-counting.
- **How we make it 10× sharper:** Script the failure mode — a live concurrent-retirement race with a visible winner/loser, a literal endpoint disconnect on camera that doesn't stop writes, a region-topology diagram as the architecture artifact, and an on-screen serialization-error-then-retry proving OCC correctness without locks.

### S22 · Loreweaver — *Aurora PostgreSQL*

*Track 4 (Open) with a B2C leaning · Composite **7.88** · Status: Strong*

- **Pitch:** A living-canon engine for collaborative fiction that semantically checks every new chapter against thousands of canon facts so a character can't die twice or contradict their own backstory.
- **Target user:** Tabletop RPG game masters, serial-fiction writing rooms, and franchise/IP continuity editors managing sprawling worlds with hundreds of entities and contradictory contributors.
- **Why the DB is load-bearing:** Continuity checking is one query that JOINs a pgvector HNSW semantic search ("find canon facts similar to this new sentence") against a relational entity graph with hard constraints — a `CHECK` that an entity flagged deceased can't have a later "speaks" event, an FK from event→character→world, and a window function over the timeline — semantic similarity AND relational truth in a single SELECT. **Only Aurora + pgvector can do this; DynamoDB has no vector search and no joins for the entity graph; DSQL has neither pgvector nor the FKs, triggers, and `CHECK` constraints this leans on.**
- **Frontend moment:** A split-pane writer's room — you type a new chapter on the left and the right pane streams live continuity flags: ranked pgvector matches with similarity-score badges, plus hard red "constraint violation" cards ("Lyra died in Ch.7, she cannot speak here"), over an interactive entity-timeline graph.
- **Demo moment:** Type "Lyra smiled and drew her sword" — the screen instantly surfaces the EXPLAIN-visible vector hit to her death scene with a 0.91 similarity badge AND a relational constraint card citing the exact FK/timeline row that makes it impossible; semantic recall and relational truth in one query trace.
- **Why it could win:** The rare AI-era app where pgvector is genuinely load-bearing because it's JOINed to constraints and a timeline rather than a bare embedding store, and showing the live query plan (HNSW node + JOIN + window function) is exactly the Aurora hero shot judges reward over the inevitable RAG chatbots.
- **Why it could fail:** Can drift into "just another chat-with-your-lore" if the relational constraints aren't real and enforced; the differentiator lives entirely in the schema, so weak modeling makes it indistinguishable from the most common, near-unwinnable submission.
- **What most competitors build instead:** A "chat with your worldbuilding wiki" RAG app where pgvector is an interchangeable embedding store and the access pattern is a trivial top-k lookup with no relational reasoning.
- **How we make it 10× sharper:** Put the SQL on screen — one statement doing vector ANN + a 3-table JOIN + a window function over the event timeline — run live with `EXPLAIN (ANALYZE)` showing the HNSW index hit, plus a hard SERIALIZABLE-enforced constraint visibly rejecting a continuity violation, proving the database (not the model) does the continuity work.

---

## Patterns across the universe

A few shapes recur — use them as a sanity check when picking, and see [`./05-recommendation.md`](./05-recommendation.md) for the call.

| Pattern | DB | Ideas | One-line thesis |
|---|---|---|---|
| **Conditional-write claim-the-slot under a storm** | DynamoDB | S4, S20, (S15/S17/S18 are the aggregate-fan-out variant) | Exactly-one-winner with flat p99 — the most legible scale demo. |
| **Streams → materialized view (event sourcing)** | DynamoDB | S1, S5, S9, S15, S16, S17, S18 | The aggregate/feed/leaderboard/anomaly view IS the product, built by CDC not polling. |
| **Multi-region active-active strong consistency (OCC reject at commit)** | Aurora DSQL | S2, S8, S14, S19, S21 | The double-spend/double-settle/oversell rejected across regions — un-fakeable in one region. |
| **pgvector ANN fused with a JOIN (not RAG)** | Aurora PostgreSQL | S3, S10, S13, S22 | Vector relevance *inside* a relational query/self-join — defeats "chat with your docs." |
| **Transaction / constraint / isolation as the proof** | Aurora PostgreSQL | S6, S7, S11, S12 | `SERIALIZABLE` / `CHECK` / `EXCLUDE` rejecting a bad write on camera. |

**The killed cluster (S2, S5, S6, S7, S11)** is dominated by Splitwise-variants and finance toys — categories that *read as clones before the judge clicks*. Even with a clever invariant they start in a credibility hole. If you love a mechanic in that cluster, port the load-bearing idea onto a non-crowded surface (e.g., S7's minimal-settlement netting onto a B2B treasury context, or S6's SERIALIZABLE double-spend onto S11/S12's correctness story) rather than building the consumer clone.

For the full per-dimension breakdown, weighting, and harsh kill rationale → [`./04-scoring-matrix.md`](./04-scoring-matrix.md). For the 10 swing-for-the-fences concepts (where 4 of the 5 deep-dive winners actually live) → [`./03-generational-ideas.md`](./03-generational-ideas.md).
