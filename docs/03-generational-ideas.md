# H0 — Generational / Unreasonable Ideas (all 10)

**Purpose:** The 10 ambitious, strange, *memorable* concepts — each still shippable as a real working app on a hackathon clock. Same full-block format as the idea universe (Pitch / User / DB-why / Frontend / Demo / Win / Fail / Competitors / 10x), plus a one-line **"Why a judge remembers it."** Four of these made the overall Top 5 — they get a banner and a link to their deep dive.

> **Last updated / source:** the H0 ideation workflow (22-agent orchestration → grounding → fan-out → 3-panel scoring → top-5 deep dives). Raw detail: `/tmp/h0_generational.txt`. Authoritative master: the project `IDEATION.md`.

**Sibling docs:** [README / index](./README.md) · [01 — Judging model](./01-judging-model.md) · [02 — Idea universe (22 serious)](./02-idea-universe.md) · [04 — Scoring matrix (full 32)](./04-scoring-matrix.md) · [05 — Recommendation](./05-recommendation.md)

---

## Table of contents

- [What "generational" means here](#what-generational-means-here)
- [Comparison table (with composite scores)](#comparison-table-with-composite-scores)
- [The Top 5 — link map](#the-top-5--link-map)
- [G1 · Recall — The Outbreak Console (Aurora PostgreSQL) ★ TOP 5](#g1--recall--the-outbreak-console-aurora-postgresql--top-5)
- [G2 · Settlement Floor (Aurora DSQL) ★ TOP 5](#g2--settlement-floor-aurora-dsql--top-5)
- [G3 · Aftermarket (DynamoDB)](#g3--aftermarket-dynamodb)
- [G4 · Provenance (DynamoDB) ★ TOP 5](#g4--provenance-dynamodb--top-5)
- [G5 · Encore — Talent Casting (Aurora PostgreSQL)](#g5--encore--talent-casting-aurora-postgresql)
- [G6 · Strikezone (DynamoDB)](#g6--strikezone-dynamodb)
- [G7 · GridLock (Aurora DSQL)](#g7--gridlock-aurora-dsql)
- [G8 · Tape (DynamoDB)](#g8--tape-dynamodb)
- [G9 · Hivemind (DynamoDB)](#g9--hivemind-dynamodb)
- [G10 · HourBank — Second Brain Market (Aurora PostgreSQL) ★ TOP 5](#g10--hourbank--second-brain-market-aurora-postgresql--top-5)
- [Read next](#read-next)

---

## What "generational" means here

These are the "unreasonable" branch of the ideation fan-out: concepts pitched to be **strange and unforgettable** rather than safe. The bar was *still shippable* — a generational idea that can't be a working app on the live URL by the deadline is just a pitch deck. They were scored on the **exact same matrix** as the 22 serious concepts (see [04 — scoring matrix](./04-scoring-matrix.md)), and they earned **4 of the overall Top 5 seats** — proof that the memorable-but-load-bearing combination is what actually wins this field.

The thesis they all chase (from [01 — judging model](./01-judging-model.md)): **make the database the protagonist and the frontend its courtroom evidence.** Every one of these makes a single AWS-DB hard property *visible and clickable on the live URL*.

> **Read this as a menu, not a backlog.** Pick exactly one. The genius of a generational idea evaporates the moment it's a half-built second project. If you're choosing, jump to [05 — recommendation](./05-recommendation.md); G1 Recall is the call.

---

## Comparison table (with composite scores)

Composite weighting (from [04](./04-scoring-matrix.md)): `risk-adjusted-win ×0.45 + demo-clarity ×0.20 + AWS-DB-fit ×0.15 + originality ×0.10 + overall ×0.10`, averaged across 3 independent judge panels. **Rank** = position in the full 32-concept ranking. Higher composite = better.

| ID | Concept | DB | Primary track | Composite | Rank (of 32) | Top 5? | One-sentence kill-shot (why this DB, not the others) |
|----|---------|----|---------------|----------:|-------------:|:------:|------------------------------------------------------|
| **G1** | **Recall — Outbreak Console** | Aurora PG | B2B (+ Open) | **9.23** | **#1** | ★ | Recursive CTE over an FK-constrained supply DAG + PostGIS geo + pgvector clustering in ONE statement — Dynamo has no joins/recursion; DSQL has no PostGIS/pgvector. |
| **G4** | **Provenance** (agent forensics) | DynamoDB | B2B (+ Open) | **8.81** | **#2** | ★ | One agent's full ordered history is a single key-condition Query; Streams build the live state/anomaly view — Aurora chokes on the write rate, DSQL has no Streams. |
| **G10** | **HourBank** (Second Brain Mkt) | Aurora PG | B2C (+ Open) | **8.51** | **#4** | ★ | pgvector ANN match JOINed to filters **and** a `CHECK(balance>=0)` SERIALIZABLE double-entry ledger in one engine — Dynamo has no vectors, DSQL has neither pgvector nor the constraint stack. |
| **G2** | **Settlement Floor** (microinsurance) | Aurora DSQL | B2B + Global | **8.41** | **#5** | ★ | Strongly-consistent *relational* money movement from two regions against one pool; OCC rejects the duplicate payout at commit — Dynamo Global Tables (eventual) double-pay, single-region Aurora can't write in two regions. |
| G7 | GridLock (energy exchange) | Aurora DSQL | Global + B2B | 8.17 | #8 | | A kWh committed in one region can't be re-sold in another; OCC at commit + a real `accounts⋈trades⋈meters` JOIN — Dynamo eventual double-sells, single-region Aurora can't take multi-region writes. |
| G5 | Encore (talent casting) | Aurora PG | B2B | 8.09 | #10 | | HNSW pgvector ANN `ORDER BY similarity` FILTERED by availability/rate/rights/geo in one planned query — Dynamo/DSQL have no vectors; a separate vector DB can't filter inside the ANN. |
| G6 | Strikezone (game-show) | DynamoDB | Global | 7.79 | #15 | | Synchronized unbounded write spike on a write-sharded `GAME#id`; Streams materialize the leaderboard — no RDBMS holds single-digit ms under that spike. |
| G3 | Aftermarket (flash-drop) | DynamoDB | B2C + Global | 7.54 | #19 | | Thousands contend for ONE item; conditional writes = exactly-one winner, TTL auto-releases holds, Streams drive the view — Aurora/DSQL serialize into lock/deadlock. |
| G8 | Tape (industrial forensics) | DynamoDB | Global + B2B | 7.43 | #21 | | `DEVICE#id`/`EVENT#ts` returns a machine's full history in one Query; Streams fan out the anomaly view — an RDBMS buckles under the firehose, DSQL is for moderate correctness-writes. |
| G9 | Hivemind (order book) | DynamoDB | Global + B2C | 7.23 | #24 | | Thousands hammer a FEW hot contracts; conditional writes + `TransactWriteItems` = no oversell/double-fill, write-sharding spreads the hot key — Aurora/DSQL deadlock or throttle. |

**Composite spread:** 9.23 → 7.23. The four Top-5 entries (G1, G4, G10, G2) clear 8.4; the back half (G3/G8/G9) are honest, well-built ideas that score lower mainly because each is **a less-sharp sibling of a higher-ranked concept** — see the kill notes in [04](./04-scoring-matrix.md) (Tape→Provenance, Hivemind→Strikezone, Aftermarket→the same hot-item story done with more drama). Don't build a weaker twin.

> **Distinct-DB coverage.** The 10 span all three engines: Aurora PG ×3 (G1, G5, G10), Aurora DSQL ×3 (G2, G7), DynamoDB ×4 (G3, G4, G6, G8, G9). Whichever DB excites you, there's a generational fit.

---

## The Top 5 — link map

Four generational ideas reached the overall Top 5 and have full build-ready deep dives. The fifth Top-5 seat went to **Sky Claim** (DynamoDB, Open Innovation), a *serious*-bucket idea — see [02 — idea universe](./02-idea-universe.md#s20) and its [deep dive](./deep-dives/03-sky-claim.md).

| Rank | Concept | Deep dive |
|-----:|---------|-----------|
| #1 | **Recall** (G1) | [deep-dives/01-recall.md](./deep-dives/01-recall.md) — **FLAGSHIP** |
| #2 | **Provenance** (G4) | [deep-dives/02-provenance.md](./deep-dives/02-provenance.md) |
| #4 | **HourBank** (G10) | [deep-dives/04-hourbank.md](./deep-dives/04-hourbank.md) |
| #5 | **Settlement Floor** (G2) | [deep-dives/05-settlement-floor.md](./deep-dives/05-settlement-floor.md) |

(#3 = Sky Claim → [deep-dives/03-sky-claim.md](./deep-dives/03-sky-claim.md).)

---

## G1 · Recall — The Outbreak Console (Aurora PostgreSQL) ★ TOP 5

> ★ **TOP 5 — overall #1, composite 9.23.** Full build plan: [deep-dives/01-recall.md](./deep-dives/01-recall.md). Reference: [aws-databases.md](./reference/aws-databases.md).

- **Pitch:** A live dispatch console for product recalls that traces a contaminated lot **backward** to its source and **forward** to every affected store shelf **in one query**, the instant a report lands.
- **User:** Food-safety / QA teams at grocery chains, QSR franchises, and CPG manufacturers; FDA/USDA recall coordinators. The dated, budgeted buyer: anyone facing **FSMA-204** traceability (24-hour records SLA).
- **DB · why load-bearing:** A recall is a graph-traversal correctness problem over a `supplier→lot→shipment→store` ledger: a **recursive CTE** over an FK-constrained DAG (`lot_links` edge table), JOINed against store inventory and **PostGIS** store geography, inside a **SERIALIZABLE** transaction so the recall scope can't shift mid-trace. Layer **pgvector** over incident/complaint text to cluster nine differently-worded reports as one outbreak *before any human connected them*. **DynamoDB** can't do recursive traversal or ad-hoc joins; **Aurora DSQL** lacks PostGIS and pgvector (and FK-enforced DAG integrity). Only Aurora PG fuses graph-recursion + geospatial + vector similarity in ONE statement.
- **Frontend moment:** Split map+graph console. Paste a lot code → an animated force-directed supply graph **ignites red** as the recursive trace propagates, while a synchronized US map drops pins on every affected store with recalled-unit counts ticking up. A "similar past incidents" rail surfaces pgvector matches with relevance badges.
- **Demo moment:** A judge types one lot number. In <1s: a live `EXPLAIN ANALYZE` of a recursive CTE traversing ~250k synthetic shipment edges, then ~1,400 affected stores across 38 states render, and three earlier complaints pgvector flagged as the same pathogen signature surface — SQL visible. *One query, the whole outbreak.*
- **Why it wins:** The database **is** the protagonist and the UI is its courtroom evidence — the graph *is* the recursion, the map *is* the geospatial JOIN, the cluster *is* pgvector. Recall management is a real, expensive enterprise category; it can never be mistaken for CRUD or a chatbot.
- **Why it could fail:** Supply data looks synthetic if seeded too small → generate a realistic multi-tier graph with hundreds of thousands of edges and show row counts on screen. Scope creep (forecasting/chat) dilutes the win; the win is the single-query trace, nothing more.
- **What competitors build:** A generic inventory dashboard with a products table, or a RAG chatbot answering "is this recalled?" from embedded FDA PDFs.
- **10x sharper:** Show the recursive CTE *and* its EXPLAIN plan live; drive the outbreak-propagation animation directly off the query result rows; prove the cross-domain JOIN (graph + geo + vector) in a single statement no other DB here can execute.
- **Why a judge remembers it:** *They typed one lot code and watched a recursive SQL query light up 1,400 stores on a live map in under a second.*

---

## G2 · Settlement Floor (Aurora DSQL) ★ TOP 5

> ★ **TOP 5 — overall #5, composite 8.41.** Full build plan: [deep-dives/05-settlement-floor.md](./deep-dives/05-settlement-floor.md). Reference: [aws-databases.md](./reference/aws-databases.md).

- **Pitch:** A global parametric **microinsurance exchange** where 50,000 flight-delay and weather micropolicies pay out the instant an oracle fires, and every payout is a strongly-consistent cross-region ledger write that can **never double-pay or read stale**.
- **User:** Embedded-insurance fintechs and gig/travel/events platforms that write tiny policies and must settle claims globally in real time.
- **DB · why load-bearing:** Each claim is money movement that must settle **exactly once** when two regions and a retrying oracle webhook observe the same event simultaneously. DSQL's multi-region **active-active strong consistency + OCC** means the claim row commits once across `us-east-1` and `eu-west-1` with no failover and no 2PC stall; the duplicate **loses at commit with a serialization error (SQLSTATE 40001)**. **DynamoDB Global Tables'** last-writer-wins eventual model risks cross-region double-pays on a shared capital pool; **single-region Aurora PG** can't accept writes in two regions at once. The unique property: strongly-consistent **relational** writes from two regions against one balance, with a real `accounts⋈policies⋈claims` JOIN behind the scenes.
- **Frontend moment:** A split-screen **Settlement Floor** — left tab `us-east-1`, right `eu-west-1`, both bound to the SAME pooled-capital balance. An oracle event ticker rains down; policies flip `ACTIVE→PAID` with the pool decrementing **in lockstep on both tabs** within ~1s, animated counters, a live capital-adequacy gauge.
- **Demo moment:** Fire the SAME oracle payout into both regional endpoints at once (a real double-pay race), then yank one region's connection mid-settlement. The pool decrements exactly once, the surviving region keeps paying with zero downtime, and on reconnect the dead region reconciles instantly. On screen: the OCC serialization error rejecting the duplicate, and a pool balance that never goes negative.
- **Why it wins:** Puts DSQL's one truly unique capability (strongly-consistent active-active **relational** money movement) on screen as a courtroom exhibit — a double-pay rejected and a region killed, live. Insurance is obviously fundable; the workload genuinely breaks the other two DBs in one sentence; the architecture diagram is a region topology AWS judges reward.
- **Why it could fail:** If the demo doesn't run **two real peered DSQL clusters** and stage a genuine cross-region race + region kill, it collapses into "a Postgres ledger" and the DSQL claim becomes marketing copy. The two-cluster setup and the OCC retry path are the make-or-break plumbing.
- **What competitors build:** A generic insurance CRUD dashboard on any DB, or a single-region ledger that never shows a cross-region write or a rejected double-pay.
- **10x sharper:** Make the failure visible — stage the exact double-pay race **and** region kill on camera with the capital pool as protagonist; show the OCC rejection plus reconnect reconciliation, the one thing no DynamoDB or single-region Aurora team can fake.
- **Why a judge remembers it:** *Two regions tried to pay the same claim, one got a serialization error, then they unplugged a whole region and money kept flowing.*

---

## G3 · Aftermarket (DynamoDB)

- **Pitch:** A flash-drop resale floor for scarce inventory where 10,000 buyers stampede the **SAME last unit**, conditional writes crown **exactly one winner with zero oversells**, and unpaid holds auto-release on a TTL countdown.
- **User:** Marketplaces and brands running scarce drops, event-ticket resale, and reservation systems that melt down under stampede load.
- **DB · why load-bearing:** The canonical high-concurrency hot-item problem — thousands of simultaneous writes contend for ONE inventory item during a drop. DynamoDB **conditional writes** (`attribute_not_exists` / version checks) guarantee exactly-one claim with optimistic concurrency and no row locks; **TTL** auto-expires unpaid holds at zero read cost; **Streams** drive a live sold/held/available materialized view. Aurora and DSQL would serialize into lock contention and deadlock under a stampede, and the access patterns (claim this unit, list holds, expire holds) are pure key + conditional ops, not relational queries. The flat-p99-under-storm graph is only honest on DynamoDB.
- **Frontend moment:** A scarcity grid where the last units glow red, a held-unit **countdown ring** ticks down via TTL, and a live "claimed by" feed streams winners in real time. Two tabs stay in sync via Streams→SSE, with an **oversell counter pinned at ZERO**.
- **Demo moment:** Stampede the LAST unit with **10,000 concurrent virtual buyers** on stage (or let the room scan a QR to tap-to-buy). The UI crowns exactly one winner, shows 9,999 clean "sold out" rejections, freezes the oversell counter at zero, holds a p99 badge flat at single-digit ms while a live CloudWatch panel shows WCU spiking. Then a held unit's TTL expires **on camera** and the item pops back to AVAILABLE and is instantly re-claimed.
- **Why it wins:** Proves correctness-under-stampede that famously breaks naive systems, using three signature DynamoDB features (conditional writes, TTL, Streams) honestly. Flat-p99-under-storm beside a zero-oversell counter is an unforgettable, defensible scale exhibit and a real billion-dollar category.
- **Why it could fail:** Seeded with a few rows and no real load test, it's just an e-commerce clone claiming scale. The TTL hold-release and the conditional-write rejection must be **demonstrated live**, not described, or the DynamoDB story becomes interchangeable.
- **What competitors build:** A Ticketmaster/StockX clone with a products table, a dozen seed rows, and a "scales to millions" claim backed by no load test.
- **10x sharper:** Run the real 10k-buyer stampede live with the oversell counter pinned at zero; show the TTL hold expiring and the unit re-entering the market; put the flat-p99 and spiking-WCU graphs side by side — correctness and scale both proven, not asserted.
- **Why a judge remembers it:** *10,000 people fought over one item, exactly one won, the oversell counter never left zero — then a hold expired and the item came back to life.*

---

## G4 · Provenance (DynamoDB) ★ TOP 5

> ★ **TOP 5 — overall #2, composite 8.81.** Full build plan: [deep-dives/02-provenance.md](./deep-dives/02-provenance.md). Reference: [aws-databases.md](./reference/aws-databases.md).

- **Pitch:** A **time-travel debugger for AI agent fleets** — every tool call, state mutation, and dollar spent is an immutable append, and you scrub a slider **backward** through an agent's entire decision history to replay exactly why it went rogue.
- **User:** Teams running fleets of autonomous AI agents in production (customer ops, trading, coding agents) needing forensics + live anomaly ops. Already paying for observability (LangSmith/AgentOps/Langfuse) → a line-item swap.
- **DB · why load-bearing:** Agent telemetry is extreme high-write **append-only event sourcing** — thousands of agents each emitting ordered events per second. Item-collection design (`AGENT#id` PK, `EVENT#<zeroPadSeq>` SK) returns one agent's full ordered history in **ONE Query**, no joins, no scan — and **Streams** fan out each write to build materialized current-state views and anomaly aggregates as events land. **TTL** expires ephemeral traces. This is precisely the CDC/event-sourcing backbone Streams was built for; Aurora would need bolted-on logical replication and would choke on the write rate; DSQL gives unused active-active, has no Streams, and a 10k-row/txn ceiling.
- **Frontend moment:** A cinematic time-travel slider over an agent's life — drag it and the reconstructed state, tool-call cards, and running spend rewind **in place**, with a parallel event-stream lane showing each immutable record and a Streams-built **anomaly heatmap** pulsing where things went wrong.
- **Demo moment:** An agent goes rogue (loops, overspends). Grab the slider, scrub to the exact event where it forked, watch the materialized state reconstruct **frame-by-frame purely from the raw event log** (client-side fold), with the single-Query X-Ray trace for the whole timeline on screen — then show the SAME write hitting Streams and updating the live anomaly view in real time. The history *is* the source of truth, not a logging afterthought.
- **Why it wins:** Agent observability is a screaming-hot category, and time-travel over an append-only Streams-driven model is an interface that could **only** exist on this data shape — exactly the "UI as a thesis about the data" originality judges reward. The one-query timeline + Streams materialized view is honest, signature DynamoDB usage.
- **Why it could fail:** If replay is faked from a relational table, or there's no real Streams→Lambda→view path under load, the DB becomes interchangeable and it reads as a logging dashboard. Needs **genuine event-sourced reconstruction** and visible write volume.
- **What competitors build:** A "chat with your agent logs" RAG app where DynamoDB is just a log dump with a trivial access pattern.
- **10x sharper:** Reconstruct state **purely from the event log on the client** as you scrub (true event sourcing); show the single-query X-Ray trace for the entire timeline; drive a live anomaly view off Streams in the same screen — replay and real-time from one immutable spine.
- **Why a judge remembers it:** *They dragged a slider backward and watched an AI agent's mind rebuild itself, dollar by dollar, straight from the raw event log.*

---

## G5 · Encore — Talent Casting (Aurora PostgreSQL)

- **Pitch:** Describe a vibe in plain English (*"gravelly indie voice like rain on a tin roof, free next week, under $400"*) and get a ranked talent shortlist where pgvector similarity, availability, budget, rights, and location all resolve in **ONE SQL query**.
- **User:** Creative producers, ad agencies, and game studios casting voices, faces, session musicians, or stock talent from huge catalogs.
- **DB · why load-bearing:** The hero query is semantic + relational in a single statement: an **HNSW pgvector ANN** search over talent-style embeddings, JOINed against availability calendars, rate tables, usage-rights constraints, and geo, `ORDER BY similarity` but **FILTERED by hard business rules**. Only Aurora PG co-locates vectors with relational data so one planned query does semantic ranking AND transactional filtering with EXPLAIN-visible index hits. DynamoDB and DSQL have no vector search at all; a separate vector DB forces app-side fan-out joins that **break ranking-with-constraints** (you can't filter by availability inside the ANN search).
- **Frontend moment:** A natural-language search bar that streams in a ranked grid of talent cards — each with a similarity-score badge, an availability strip, and a live price — plus a **"show the query" toggle** revealing the actual SQL + `EXPLAIN (ANALYZE)` showing the HNSW node fused with a 4-table join.
- **Demo moment:** Type a weird, specific vibe; results rank instantly with similarity badges. Flip one filter ("available this Friday, under $400") and the ranking **re-sorts live** while preserving semantic relevance; drop the EXPLAIN plan on screen showing the vector index hit fused with the joins, sub-100ms. *One query: semantic + financial + availability, provable.*
- **Why it wins:** Weaponizes the ONE thing only Aurora PG can do (vectors JOINed to constraints in a single planned query) and makes it courtroom-visible via on-screen SQL + EXPLAIN with similarity badges — the opposite of the interchangeable "pgvector as embedding store" chatbot the whole field will submit.
- **Why it could fail:** If embeddings are precomputed for a handful of rows and filters are afterthoughts, it degrades into a fancy `LIKE`. Needs a meaningfully large embedded catalog and the constraint-fused ranking as the centerpiece, not a side feature.
- **What competitors build:** A "chat with your docs" RAG app, or a search bar where pgvector is a bolt-on embedding store with no relational fusion.
- **10x sharper:** Make the SQL the showpiece — a toggle reveals the live HNSW+JOIN EXPLAIN plan on every search, similarity scores render as badges, and a filter flip re-ranks in real time, proving the database (not app code) is doing the intelligent work.
- **Why a judge remembers it:** *They typed a poetic, impossible vibe, flipped a budget filter, and the database re-ranked humans by meaning in real time — with the SQL on screen.*

---

## G6 · Strikezone (DynamoDB)

- **Pitch:** A live mass-participation **game-show backend** where tens of thousands of viewers tap predictions in the same second, a Streams-driven leaderboard reshuffles instantly, and a flat-latency graph proves the database never flinches as the crowd 100x's.
- **User:** Live sports/esports broadcasters, streamers, and second-screen interactive-TV platforms monetizing live-event engagement.
- **DB · why load-bearing:** The textbook viral-spike high-write workload with fully known access patterns — every viewer tap is a write keyed by `GAME#id` with a **write-sharded SK** to avoid a hot partition; **Streams→Lambda** aggregate into a real-time leaderboard materialized view; per-tap latency must stay flat whether 50 or 500,000 people tap at once. **TTL** expires each round's raw votes. No RDBMS holds single-digit-ms under an unbounded synchronized write spike, and the demo's whole point is the flat-latency-under-storm graph only DynamoDB makes honest. Designing explicitly around the hot-key failure mode with write sharding signals senior intent.
- **Frontend moment:** A broadcast-overlay UI — a giant live prediction prompt with tap-to-vote, a real-time crowd-sentiment bar, and a leaderboard that visibly reshuffles **every second** as Streams aggregates land, with a taps/sec throughput readout and a p99 badge.
- **Demo moment:** Unleash a load generator simulating a synchronized crowd spiking from **200 to 50,000 taps/sec** at the climactic moment (or let the room tap live via QR). The CloudWatch `ConsumedWriteCapacity` graph rockets while the on-screen p99 badge stays flat at single-digit ms and the leaderboard never drops a beat — then point at the write-sharding scheme and name the hot partition you designed around.
- **Why it wins:** The most literal demonstration of "back-end designed for scale" — the crowd spikes, the latency line stays flat, the leaderboard never stutters. Genuinely fun, unforgettable, and an obvious live-events business with the Streams materialized view as the product.
- **Why it could fail:** Without correct write sharding it creates its own hot key and the latency graph betrays the claim. Credibility hinges on doing the sharding right and **showing the load test**, not seed data.
- **What competitors build:** A Kahoot / Twitter-poll clone storing votes in one partition, claiming scale with no load test and a single hot key it never stress-tested.
- **10x sharper:** Run a real synchronized write-storm load test on camera with the flat p99 badge beside the climbing capacity graph, and openly show the write-sharded key design and the Streams-materialized leaderboard as the engineering story.
- **Why a judge remembers it:** *The crowd went from 200 to 50,000 taps a second and the latency line on screen didn't even twitch.*

---

## G7 · GridLock (Aurora DSQL)

- **Pitch:** A real-time **carbon-aware energy exchange** matching surplus rooftop and battery power to demand across a metro grid, settling thousands of micro-trades per second so **no kilowatt is ever sold twice** across regional nodes.
- **User:** Virtual power plant operators, energy co-ops, and grid balancers running distributed energy resources at metro/national scale.
- **DB · why load-bearing:** Energy dispatch is correctness-critical commodity-and-money movement happening concurrently across geographic nodes that must agree on one authoritative ledger — a kWh committed to a buyer in one region cannot be re-sold in another, ever. DSQL's **strong cross-region consistency + OCC** means concurrent dispatch transactions from multiple grid nodes settle against one balance with conflict detection at commit, while still running a real `accounts⋈trades⋈meters` relational query behind the map. **DynamoDB's** eventual cross-region model risks double-selling a unit; **single-region Aurora PG** can't accept writes from multiple grid regions simultaneously.
- **Frontend moment:** A live grid map with nodes pulsing supply and demand, a flowing dispatch ledger, and a metro-wide **"net balance must equal zero"** reconciliation bar — with two regional control-room tabs side by side showing the SAME settled grid state, plus a carbon-intensity heat overlay that shifts as clean energy dispatches first.
- **Demo moment:** Two regional nodes try to sell the SAME battery's last kWh at the same instant. On screen DSQL commits one and rejects the other with an OCC serialization error; the grid balance reconciles to zero with zero double-allocation. Then sever one region (dispatch keeps clearing on the other with no failover) and reconnect to instant reconciliation.
- **Why it wins:** Energy markets are obviously fundable and impact-heavy, and the demo makes DSQL's unique active-active strong-consistency relational property tangible as "a kWh sold exactly once across regions," with a region kill, an OCC rejection, and a real multi-table JOIN behind the map. The architecture diagram is a node/region topology judges love.
- **Why it could fail:** Over-scoping the energy domain (forecasting, pricing models) could swallow the build. The win is narrow — prove the no-double-sell cross-region settlement live; everything beyond the ledger, map, and region kill is a distraction risking a half-working demo.
- **What competitors build:** A pretty energy dashboard with charts on any DB, or a single-region trading table that never shows a cross-region settlement or conflict.
- **10x sharper:** Anchor everything on the "net balance = zero, no kWh sold twice" invariant displayed live; stage the exact cross-node double-sell race and region kill; show the relational JOIN behind the map — making DSQL's consistency the visible hero rather than the grid art.
- **Why a judge remembers it:** *Two cities tried to sell the same battery's last kilowatt, the grid said no, then they killed a region and the lights stayed on.*

---

## G8 · Tape (DynamoDB)

- **Pitch:** A **time-travel forensics console for industrial sensor fleets** — millions of telemetry events stream in flat at single-digit ms, and you scrub a slider to reconstruct any machine's exact state at any millisecond as anomalies materialize live.
- **User:** Manufacturing and operations teams running fleets of machines, energy grids, or logistics sensors needing post-incident forensics plus live anomaly ops.
- **DB · why load-bearing:** Pure high-velocity event sourcing — millions of spiky unbounded sensor writes per second where per-item latency must stay flat; the access pattern is known in advance (`DEVICE#id` PK, `EVENT#ts` SK returns a device's full history in one Query); and **Streams** natively drive the materialized anomaly view and websocket fan-out with **no separate queue**. **TTL** expires raw events while keeping rollups. An RDBMS buckles under the write storm and needs a bolted-on CDC pipeline; DSQL is for correctness-critical *moderate* writes, not a telemetry firehose. The flat-latency-under-storm graph is only believable on DynamoDB.
- **Frontend moment:** A dark-mode ops console with a horizontal **timeline scrubber** — drag it and every gauge, line chart, and machine-state badge snaps to that exact historical instant reconstructed from the append-only event collection, while a live anomaly feed pulses as Streams-driven Lambda flags outliers and a throughput meter shows writes/sec.
- **Demo moment:** Fire a load generator pushing tens of thousands of events/sec; a CloudWatch `ConsumedWriteCapacity` graph climbs steeply while the on-screen p99-latency badge stays pinned at single-digit ms. Then a judge grabs the scrubber and rewinds to the millisecond a synthetic turbine spiked, watching the entire dashboard reconstruct that past moment from the event stream, with the single-Query trace shown.
- **Why it wins:** Two unforgettable beats in one app — the flat-latency-under-write-storm chart (the literal thesis of "designed for scale") and a time-travel scrubber that could only exist over an append-only event model. Streams-as-product, not Streams-as-afterthought, on a clearly industrial B2B workload.
- **Why it could fail:** Time-travel reconstruction gets slow if you replay too many events per drag → mitigate with periodic **snapshot items** so any timestamp is at most a small delta-replay from a checkpoint. Risks overlapping with [G4 Provenance](#g4--provenance-dynamodb--top-5) — keep the industrial-telemetry + load-storm framing distinct.
- **What competitors build:** A Grafana-looking dashboard polling a single table every few seconds, calling itself real-time, with a dozen seeded rows.
- **10x sharper:** Pair an actual load-test graph (flat p99 under storm) with a scrubbable event-sourced timeline; expose the single-Query item-collection trace; use Streams to drive both the live anomaly view and the websocket push.
- **Why a judge remembers it:** *They scrubbed to the exact millisecond a turbine failed and the whole dashboard rebuilt the past — while a write-storm graph stayed dead flat.*

---

## G9 · Hivemind (DynamoDB)

- **Pitch:** A real-time **prediction-market order book** where tens of thousands of traders hammer the SAME hot contract per second, and conditional writes guarantee the book never oversells a share or double-fills an order.
- **User:** Event-driven communities and live-ops product teams building viral, spiky, high-write trading or live-betting surfaces.
- **DB · why load-bearing:** Unbounded spiky writes concentrated on a FEW hot contracts during a live event — the textbook hot-partition + high-concurrency problem. **Conditional writes** and **`TransactWriteItems`** give exactly-one-fill correctness without row locks; **write sharding** spreads the hot key; **Streams** drive the live order-book materialized view and price tape. Aurora or DSQL would deadlock or throttle under thousands of concurrent writes to one contract row; only DynamoDB keeps p99 flat while WCU climbs 100x. The access patterns (place order, fill, read book depth) are key + conditional ops, not relational joins.
- **Frontend moment:** A glowing real-time order book and price tape that ticks every few hundred ms as fills land, a live ops/sec badge, and a depth chart that "breathes," driven by Streams→SSE so two browser tabs update in lockstep within a second.
- **Demo moment:** Unleash a 5,000-virtual-trader storm onto ONE contract on stage (QR lets the room join the storm from their phones). A CloudWatch panel shows `ConsumedWriteCapacity` rocketing to thousands/sec while a p99 badge stays pinned at single-digit ms, and a reconciliation counter proves **zero oversells and zero double-fills**, with the hot-key write-sharding visualized as partitions lighting up.
- **Why it wins:** Makes DynamoDB's signature property (flat latency at any write volume with conditional-write correctness) literally watchable — the storm graph beside the unmoving p99 badge IS the "designed for scale" thesis, and it shows hot-key thinking, idempotency, and Streams-driven views — the exact engineering judges reward over claims.
- **Why it could fail:** With 12 seeded contracts and no real load test it's just another "scales to millions" claim, and it drifts toward a Polymarket clone unless the hot-contract no-oversell correctness story is the visible centerpiece rather than the betting UI. Must stay distinct from [G6 Strikezone](#g6--strikezone-dynamodb) by foregrounding **order-book correctness**, not crowd voting.
- **What competitors build:** A Twitter / social-feed clone on DynamoDB with no hot-key plan, or a prediction-market UI with seed rows and no load evidence.
- **10x sharper:** Let the audience BE the load via QR tap-to-trade; spike the ops/sec needle from their phones while p99 stays flat; keep the oversell/double-fill counter frozen at zero — real concurrency on one hot key, not a synthetic script.
- **Why a judge remembers it:** *The whole room traded one contract from their phones at once and the order book never oversold a single share.*

---

## G10 · HourBank — Second Brain Market (Aurora PostgreSQL) ★ TOP 5

> ★ **TOP 5 — overall #4, composite 8.51.** Full build plan: [deep-dives/04-hourbank.md](./deep-dives/04-hourbank.md). Reference: [aws-databases.md](./reference/aws-databases.md).

- **Pitch:** A self-balancing **skills-and-favors exchange** for large communities where free-text requests match people by semantic need, and a **time-banked hours currency** provably never lets anyone spend hours they don't have.
- **User:** University communities, alumni networks, professional cohorts, and mutual-aid co-ops running internal favor and skill economies.
- **DB · why load-bearing:** Two hard properties must live in ONE engine: (1) **semantic matching** of a free-text request (*"need someone who can review a Rust async bug"*) to member skill profiles via **pgvector HNSW ANN**, JOINed against availability, reputation, and proximity filters in a single query; and (2) a **double-entry time-bank ledger** where every transfer is a **SERIALIZABLE** transaction with **`CHECK(balance>=0)`** so balances can't go negative and the books sum to zero. pgvector + relational JOIN + transactional financial correctness in one engine is uniquely Aurora PG. **DynamoDB** has no vector search and no ad-hoc match query; **DSQL** has neither pgvector nor the constraint/transaction ecosystem to enforce non-negative double-entry.
- **Frontend moment:** A command palette where you type a need in plain language and **ranked human matches** stream in with similarity-score badges and live availability — beside a **double-entry ledger panel** showing your hours debiting and the helper's crediting in real time, balances animating, total always reconciling to zero.
- **Demo moment:** A judge types a fuzzy request; pgvector returns ranked matches with scores and the SQL + EXPLAIN showing the HNSW index hit JOINed to availability. Then they try to book 5 hours while holding only 2: the SERIALIZABLE transaction **rejects it on a CHECK constraint**, the ledger stays balanced, and a correct 2-hour transfer commits and reconciles on screen.
- **Why it wins:** Fuses the two Aurora superpowers judges most want to see (pgvector relevance + provable financial correctness) into one coherent product, and the "I can see the books reconcile and the match scores" UI is exactly the courtroom-evidence frontend the core insight demands.
- **Why it could fail:** Could drift toward "just another marketplace" → anchor every screen to a visible DB artifact (similarity scores, EXPLAIN plan, balancing ledger) so the database stays the protagonist. Must avoid overlap with [G5 Encore](#g5--encore--talent-casting-aurora-postgresql) by foregrounding the constraint-enforced ledger as **co-equal** to the vector match.
- **What competitors build:** A RAG "chat with member profiles" bot using pgvector as a dumb embedding store, with no ledger and no transactional correctness.
- **10x sharper:** Co-locate the vector match and the double-entry transaction so one product demonstrates **both** pgvector ANN and a constraint-enforced double-spend rejection, with SQL and EXPLAIN visible — instead of treating embeddings as a chatbot side-feature.
- **Why a judge remembers it:** *They matched a human by meaning, then watched the database refuse to let someone spend hours they didn't have — books reconciling to zero on screen.*

---

## Read next

- **[02 — Idea universe (22 serious concepts)](./02-idea-universe.md)** — the safe-but-sharp half of the menu, including Sky Claim (#3 overall, the fifth Top-5 seat).
- **[04 — Scoring matrix](./04-scoring-matrix.md)** — full 32-concept ranking, per-dimension scores, methodology, and the harsh kill notes (why G3/G8/G9 sit lower as siblings of higher-ranked ideas).
- **[01 — Judging model](./01-judging-model.md)** — what wins, the two failure modes that sink ~70% of the field, track odds.
- **[05 — Recommendation](./05-recommendation.md)** — the decision tree and the call.
- **Top-5 deep dives:** [Recall (G1)](./deep-dives/01-recall.md) · [Provenance (G4)](./deep-dives/02-provenance.md) · [Sky Claim](./deep-dives/03-sky-claim.md) · [HourBank (G10)](./deep-dives/04-hourbank.md) · [Settlement Floor (G2)](./deep-dives/05-settlement-floor.md)
- **Reference:** [AWS databases (DynamoDB vs DSQL vs Aurora PG)](./reference/aws-databases.md) · [Vercel/v0 playbook](./reference/vercel-v0-playbook.md) · [Submission checklist](./reference/submission-checklist.md)
