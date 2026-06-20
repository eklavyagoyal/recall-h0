# H0: Hack the Zero Stack — Ideation Master Doc

*Hackathon: H0 (Vercel/v0 + AWS Databases). Theme: "Front-end in minutes. Back-end designed for scale." Deadline: 2026-06-30, 02:00 GMT+2. Prizes: $80k cash + $80k AWS credits. 6,000+ entrants.*

**Method:** Generated via a 22-agent orchestration — grounded the judging model + AWS DB load-bearing patterns + Vercel/v0 leverage, fanned out 7 idea generators across tracks/DB-lenses + 2 generational generators (~47 raw ideas), curated to 22 serious + 10 generational, scored every concept with 3 independent judge panels (AWS SA / Vercel-design / investor) on 10 dimensions, then deep-dived the top 5.

---

## PHASE 1 — THE JUDGING MODEL

### The one thesis that wins this hackathon
> **Make the database the protagonist and the frontend its courtroom evidence.** The 6,000-entrant field splits into two failure modes — (1) pretty v0 apps with interchangeable backends, and (2) "scales to millions" claims with no proof. You win by picking ONE workload where exactly one of the three AWS databases is *correct* (and you can say in a single sentence why the other two are wrong), then building one signature screen that makes that DB's hard property **visible and clickable on the live URL**, with real volume and a measured latency number on screen. Don't pitch features; pitch a data model, and let the UI prove it.

### What the AWS-database judges reward
- **Access-pattern-first design.** A DynamoDB entry that shows its single-table design with named GSIs and a literal `access-pattern → PK/SK/GSI` table reads as someone who understands the engine, not someone who picked it from a dropdown.
- **Choosing the DB for the property only it has — and proving you needed it.** Aurora PG for JOINs + transactional correctness + pgvector in one query; DSQL for multi-region active-active strong consistency with no failover; DynamoDB for predictable single-digit-ms at high spiky write volume.
- **Visible scale/latency evidence over claims.** p50/p99, a k6/Artillery load-test screenshot, CloudWatch RCU/WCU or ACU graphs, row counts in the millions. They've seen "scales to millions" a thousand times; they reward the team that shows the graph.
- **Correct use of the engine's signature feature** in the demo's critical path: a recursive CTE / window function / HNSW ANN / SERIALIZABLE transaction (Aurora); a cross-region write + OCC conflict (DSQL); Streams→materialized view + conditional writes + TTL (DynamoDB).
- **Honest modeling of the hard part:** idempotency keys, optimistic locking / conditional writes, hot-partition avoidance (write-sharding), eventual-vs-strong consistency tradeoffs named out loud.
- **A schema/data-model artifact.** The required architecture diagram is a gift: most teams draw boxes; the winner draws the data model (ER diagram / single-table item-collection diagram / region topology).
- **Cost/operational reasoning tied to the workload** (Serverless v2 scale-to-fit, on-demand for spiky writes, DSQL to avoid running your own failover) — signals an engineering decision, not a sponsor checkbox.
- **Clean AWS plumbing:** OIDC keyless auth, RDS Proxy, Secrets Manager, Streams→Lambda. A coherent data path beats an isolated clever trick.

### What the Vercel/v0 judges reward
- **A genuinely v0-generated UI, then refined** (App Router, Server Components/Actions, streaming/Suspense), with a **published project link + Team ID that actually resolves.** On-theme = "front-end in minutes."
- **A UI that exposes the data model, not generic CRUD** — the screen makes the backend's hard problem legible (a reconciling ledger, a relevance-ranked search, a live leaderboard that's obviously real-time).
- **Real product polish:** consistent design system (shadcn/Tailwind), empty/loading/error states, optimistic UI, dark mode done with taste, micro-interactions — refined *beyond* the v0 default.
- **Demonstrated streaming/real-time behavior matched to the DB story** (SSE off Streams, read-your-writes for strong consistency, optimistic+reconcile for eventual).
- **Server-side data fetching** (no leaked creds), caching that mirrors the consistency model (`no-store` for strong reads, `revalidateTag` after writes).
- **A crisp demo on the LIVE URL — never localhost** — judges click the deployed link and it works with real data.
- **An interaction only this data model enables** (time-travel slider over event history, drill-down from aggregate to rows). Originality points come from interfaces that are a *thesis about the schema*.

### The two failure modes that sink ~70% of the field
**Common/weak (don't resemble these):**
- AI "chat with your docs" RAG where pgvector is just an embedding store — *the single most common submission, near-impossible to win because the DB is interchangeable.*
- Generic SaaS dashboard / admin CRUD / todo / notes — DB is "where users live." Fails the load-bearing test outright.
- v0 landing-page-plus-form with a thin backend; pretty for 10 seconds, evaporates when a judge clicks around.
- E-commerce/marketplace MVP claiming "scales to millions" on 12 seed rows.
- Twitter/social-feed clone on DynamoDB "because a blog said so" with no fan-out / hot-key thought.
- Finance/expense tracker on Aurora that never runs a transaction, constraint, or isolation level that matters.
- "Real-time" app that's actually polling one table every few seconds.

**Looks fake / over-scoped (instant credibility killers):**
- "Scales to millions" with a dozen seed rows and no load test.
- Multi-region/active-active claims with a single-region deployment and no cross-region write shown.
- Sub-ms latency claims with no measurement, no p99, no CloudWatch graph.
- "OS for X / replaces Stripe+Plaid+Salesforce" backed by one CRUD screen.
- Demo video that never shows the deployed URL, real data, or the database.
- Architecture diagram with Kafka/Redis/5 microservices that appear nowhere in the repo.
- Missing required artifacts (Team ID, dual-tier diagram, AWS-DB screenshot) — auto-deflate regardless of code quality.

### How to make the DB choice obviously intentional
1. **State access patterns first, derive the schema, put the derivation in the submission** (Dynamo: pattern→key table; Aurora: ER diagram with the JOINs your queries run).
2. **Pick the workload so the other two DBs are wrong, and say why in one sentence each.**
3. **Use the signature feature in the demo's critical path, visibly.**
4. **Show data at volume** (seed 1M+ rows; put row count + query latency on screen).
5. **Design around the named hard problem and surface it** (idempotency, write-sharding, OCC retry, TTL) with a one-line caption when it fires.
6. **Wire the right AWS plumbing and screenshot real activity** (item counts, query metrics, EXPLAIN plan), not an empty table.
7. **Let the consistency model show up in the product** (read-your-writes for strong; optimistic+reconcile for eventual).

### Track odds
| Track | Odds | Why |
|---|---|---|
| **Monetizable B2B** | **Best** | B2B workloads naturally make the DB load-bearing (multi-tenant, audit/event history, billing/metering, reporting with real JOINs). Real-world applicability + monetization read instantly. **Less crowded** because B2B is "less fun" to build — a serious one stands out. |
| **Million-scale global** | High ceiling / high risk | The track that most rewards DSQL multi-region + DynamoDB latency-at-scale. Can win overall *if you SHOW scale* (load test, latency graphs, real multi-region). Easiest track to fake → most entrants get deflated. Win condition is strict. |
| **Open innovation** | Wildcard / originality magnet | Highest variance. A novel data model can top the leaderboard; also where vague art-projects pile up. Strong for a technically sharp, conceptually distinct entry; weak as a hiding place for an unfinished idea. |
| **Monetizable B2C** | Most crowded / lowest odds | Largest volume + highest concentration of weak archetypes. v0 polish is table stakes. Winnable only with a novel consumer mechanic whose data model is the product AND real backend rigor. |

### Bonus strategy (optional public build content)
Treat it as **near-free points top contenders will claim** — skipping it is a relative penalty. Produce ONE substantive, evidence-rich artifact (annotated architecture/data-model post titled around the load-bearing decision), include the access-pattern table / ER diagram / load-test graph / code snippet, echo the "front-end in minutes, back-end for scale" tagline, add a 60–90s clip of the signature screen. **Only after** the working core + DB proof + required artifacts are solid — polished content on a hollow app reads as marketing and hurts.

---

## PHASE 2 — THE IDEA UNIVERSE (22 serious concepts)

*Format per idea: Pitch / User / DB + why load-bearing / Frontend moment / Demo moment / Why win / Why fail / What competitors build / 10x sharper.*

### Track 1 — Monetizable B2C

**S1 · Encore (Live Tipping Wall)** — *DynamoDB*
- **Pitch:** A live-tipping wall for street performers where 800 people tap-to-tip at the song's peak and every coin lands on a shared screen in single-digit ms.
- **User:** Buskers/open-mic performers + live crowds who want cashless tipping that lands instantly.
- **DB why:** Hot-partition write-storm. Write-shard the hot key (`PERF#id#SHARD#0..N`/`EVT#ts`), Streams→Lambda fans taps into an aggregate materialized view, conditional writes make taps idempotent. Aurora deadlocks on the hot total row; DSQL's OCC rejects every concurrent increment.
- **Frontend:** Full-screen tip wall: coins arc up, reactions burst, running total via SSE, fixed p99 badge.
- **Demo:** 2,000-tap/sec load gen; CloudWatch WCU climbs into thousands, p99 stays single-digit, zero lost/doubled tips.
- **Win:** "Designed for scale" literally visible — throughput explodes while latency stays flat, and it's shareable consumer fun.
- **Fail:** 12 seed taps kills the scale claim; must run a real load gen.
- **Competitors:** Venmo-style tip-jar CRUD, no concurrency design.
- **10x:** Explicit write-sharding with labeled shard count, Streams aggregate, idempotency token visibly deduping a double-tap, live storm graph.

**S2 · Splitstream** — *Aurora DSQL*
- **Pitch:** Group-travel money where 30 friends across 4 countries log expenses simultaneously and balances stay strongly consistent, so two people can't double-settle from two continents.
- **User:** Friend groups on international trips, destination weddings, group houses.
- **DB why:** Genuinely multi-region active-active — friends in Tokyo/London/NYC write the same ledger; settlement must be strongly consistent cross-region. DSQL's OCC rejects the conflicting double-settle at commit. Dynamo isn't relational + eventual; single-writer Aurora can't make both regions strongly consistent + low-latency.
- **Frontend:** Two-phones-two-regions split screen; reconciling balance graph summing to zero; region badge per pane.
- **Demo:** Both regions tap "settle the $200 debt" simultaneously — one commits, the other gets a clean OCC error + one-tap retry. Then kill a region; keep adding expenses with no failover wait.
- **Win:** The only B2C idea where multi-region strong consistency *is* the feature; the double-settle-rejected shot is unique to DSQL.
- **Fail:** Single-region deploy → thesis evaporates under a DSQL-literate judge.
- **Competitors:** Splitwise clone on Aurora, single table, no transaction, single region.
- **10x:** Model the actual failure (concurrent cross-region double-settle), show OCC rejection + retry, demonstrate region-kill, keep balances-sum-to-zero as live evidence.

**S3 · Cellar** — *Aurora PostgreSQL*
- **Pitch:** A taste-graph app recommending your next bottle by semantically matching flavor notes from real tasting reviews, filtered by in-stock-near-you and budget, in one query.
- **User:** Wine/whisky enthusiasts overwhelmed by choice who want "like this but cheaper and available now."
- **DB why:** Irreducibly semantic-AND-relational in ONE statement — pgvector HNSW ANN over flavor embeddings `ORDER BY similarity`, JOINed against live inventory + price band + owned-cellar exclusion. Dynamo has no vectors/JOINs; DSQL has no pgvector.
- **Frontend:** Search bar — "smoky like an Islay but smoother under $60" streams ranked cards with similarity badges, in-stock pills, "why this" panel.
- **Demo:** Live `EXPLAIN (ANALYZE, BUFFERS)` showing the HNSW node AND inventory/price/cellar JOINs in one sub-100ms plan over tens of thousands of bottles.
- **Win:** Dodges the RAG-chatbot trap — pgvector load-bearing inside a JOIN no other DB can do.
- **Fail:** Embeddings for a handful of bottles + keyword "search" = the pgvector-as-fake-AI failure.
- **Competitors:** "Chat with your wine docs" RAG bot.
- **10x:** Fuse vector + inventory + budget + cellar-exclusion into one ranked SQL with EXPLAIN on screen, real review-derived embeddings at scale.

**S5 · Throwback** — *DynamoDB*
- **Pitch:** A time machine for your own life — a scrubbable timeline replaying the full edit history of your habits, journals, finances.
- **User:** Quantified-self/journaling users, people in therapy/recovery.
- **DB why:** Event-sourcing as the product. Item collections (`USER#id`/`ENTITY#id#EVT#ts`) return full history in one Query; Streams fan writes into per-day snapshot items so the scrubber loads any date instantly; conditional writes make appends idempotent. Aurora needs a bolted-on events table + triggers; DSQL lacks Streams.
- **Frontend:** Time-travel slider — scrub and cards morph to your exact state on that date.
- **Demo:** Scrub across a year (instant re-render per date), make a live edit, show the event append to the immutable log + snapshot rebuild via Streams within ~1s.
- **Win:** Emotionally original interface that could only exist on an event-sourced model; textbook Streams→snapshot.
- **Fail:** Faking history with a latest-snapshot store → scrub reveals nothing.
- **Competitors:** Journaling/habit CRUD that overwrites state and calls a list "a timeline."
- **10x:** Make append-only event sourcing the literal interface; show the one-Query history fetch + immutable log; prove edits never rewrite the past.

**S6 · Margin Call** — *Aurora PostgreSQL*
- **Pitch:** A real-time peer-to-peer prediction exchange with a true double-entry order book where balances reconcile to zero on every trade and no one can spend money they don't have.
- **User:** Prediction-market/fantasy/esports operators wanting fair, auditable order-matching (not a house-edge book).
- **DB why:** SERIALIZABLE transactions + `CHECK(balance>=0)`, double-entry netting to zero, window function for last-traded price, recursive CTE walking the book, multi-table JOIN in one query. Dynamo can't express the book/invariants; DSQL lacks constraint/window machinery and you don't need active-active.
- **Frontend:** Trading terminal — live order book with depth bars, streaming price chart, ledger-integrity panel showing debits=credits=0 recomputing after every fill.
- **Demo:** Two concurrent buys exceeding balance — SERIALIZABLE commits one, rejects the other with a visible serialization error; double-click is idempotent; no phantom money.
- **Win:** Aurora financial-correctness as a real exchange, not a toy tracker.
- **Fail:** If "transaction" is SELECT-then-UPDATE without SERIALIZABLE/idempotency/CHECK, it's the warned-against finance toy.
- **Competitors:** Sportsbook UI with a bets table, no transaction, double-click double-spends.
- **10x:** Live concurrent over-spend rejected on camera, always-balanced ledger, idempotency surviving a double-click, EXPLAIN on the recursive-CTE book + window-function price feed.

**S7 · Settle** — *Aurora PostgreSQL*
- **Pitch:** A group-expense ledger that computes the provably minimal set of transfers to settle a tangled debt graph, as one recursive SQL settlement.
- **User:** Roommates, travel groups, supper clubs, small partnerships.
- **DB why:** Relational + graph-reduction — splits fan out via weighted edges, net positions via window functions/CTEs, reduced to minimal transfers inside a transaction; zero-sum invariant enforced; serializable to avoid double-settling. Dynamo can't express the aggregation; DSQL's active-active buys nothing single-region.
- **Frontend:** Force-directed debt graph that animates from 30 tangled IOUs into 4 settlement arrows on "optimize"; running zero-sum tally always $0.00.
- **Demo:** Add a messy multi-currency expense — graph re-nets live, zero-sum holds; two people settle the same debt in two tabs → serializable rejects the duplicate.
- **Win:** Turns Splitwise into a database thesis (minimal-settlement netting + always-zero invariant as visible correctness).
- **Fail:** Minimal-settlement + multi-currency rounding must be exactly right or the invariant breaks on camera.
- **Competitors:** Splitwise clone with naive pairwise "you owe Bob $5."
- **10x:** Minimal-transfer graph reduction in SQL + provable zero-sum under concurrent settlement, with the CTE + rejected duplicate on screen.

### Track 2 — Monetizable B2B

**S8 · Meridian** — *Aurora DSQL*
- **Pitch:** A multinational's regional entities settle intercompany cash positions across regions in real time, and a double-pay is rejected at commit, not reconciled next morning.
- **User:** Corporate treasury/FP&A at multinationals; buyer = VP Treasury with budget already on Kyriba/FIS.
- **DB why:** Two regional treasurers write the same balances concurrently with strong consistency; DSQL's OCC detects the conflict at commit, no 2PC, no failover. Single-writer Aurora goes stale cross-region; Dynamo Global Tables (eventual) silently allow the double-spend.
- **Frontend:** Split-screen two live deployments (us-east-1 / eu-west-1); globally-consistent committed-tx counter; ledger reconciling to zero; region kill-switch.
- **Demo:** Two treasurers draw $4M from a $5M entity simultaneously — one commits, the other returns an OCC error + auto-retry; then kill a region, writes continue.
- **Win:** Hardest thing to fake; the one demo no other DB can produce, with a real B2B buyer.
- **Fail:** One-region demo → "Postgres with extra steps."
- **Competitors:** Single-region finance dashboard claiming multi-region in copy.
- **10x:** Clickable OCC conflict ("fire two concurrent transfers" button), live commit-latency-per-region widget, region kill switch.

**S9 · Cadence** — *DynamoDB*
- **Pitch:** Every metered API call lands as an idempotent event at storm scale, materializes into a live billing balance via Streams, and a double-clicked retry never bills twice.
- **User:** Finance/RevOps/platform teams at usage-based SaaS + AI-API companies (vs Metronome/Orb/Amberflo).
- **DB why:** Unbounded high-write telemetry where per-event latency stays flat; conditional write keyed on idempotency token; running balance is a Streams-driven materialized view. Aurora falls over on the storm; DSQL is throughput-bounded with no native Streams.
- **Frontend:** Ops dashboard — write-storm meter past millions, p99 badge pinned, per-customer billing ledger updating instantly.
- **Demo:** 50k events/sec, latency flat ~5ms; double-fire the SAME event with one idempotency key → balance increments exactly once.
- **Win:** Two signature features on screen at once (flat latency + conditional-write idempotency) tied to a dollar problem.
- **Fail:** No real load gen / CloudWatch graph → "scales to millions" with 12 rows.
- **Competitors:** Stripe-clone billing CRUD on Aurora.
- **10x:** Show the idempotency token + single-table item-collection design as a labeled access-pattern table; let a judge press "simulate a retry storm."

**S10 · Clausewise** — *Aurora PostgreSQL*
- **Pitch:** Ask "which active vendor contracts auto-renew in 90 days, with uncapped liability, in EMEA?" and one SQL query runs pgvector semantic match JOINed against structured obligation/jurisdiction/renewal data.
- **User:** In-house legal ops, procurement, GCs (vs Ironclad/Evisort); pain = missed renewals + unseen liability.
- **DB why:** Semantic similarity AND hard relational filters in ONE statement — HNSW ANN over clause embeddings JOINed to extracted obligation rows with WHERE filters + aggregation. Dynamo has no vectors; DSQL has no pgvector.
- **Frontend:** Faceted search — NL clause query returns ranked results with similarity badges beside hard filters; click opens a drawer with matched clause text + JOINed obligations.
- **Demo:** Fuzzy query ("liability we can't cap") → ranked clauses; live `EXPLAIN (ANALYZE)` showing the vector index node AND the JOIN/filter executing in one sub-100ms plan over thousands of clauses.
- **Win:** The pgvector idea that defeats "chat-with-your-docs" — value is the JOIN against legal metadata, with a concrete ROI story.
- **Fail:** Embeddings for 5 contracts + LIKE-in-disguise.
- **Competitors:** RAG "chat with your contracts."
- **10x:** Lead with the EXPLAIN plan as hero artifact; seed thousands of real-shaped clauses; "one query, semantic + 4 tables" annotation.

**S11 · Ledgerline** — *Aurora PostgreSQL*
- **Pitch:** Every marketplace payout splits across seller, fee, tax, escrow in one serializable transaction that provably balances to zero; a constraint violation rejects an unbalanced write before it lands.
- **User:** Finance/payments eng at marketplaces/platforms (vs Modern Treasury + internal builds).
- **DB why:** Double-entry needs SERIALIZABLE, NUMERIC, `CHECK(debits=credits)`, FKs, window functions for running balances, materialized views for reconciliation. Dynamo can't enforce cross-row balance; DSQL lacks CHECK/FK/triggers/views.
- **Frontend:** Double-entry ledger view; each payout expands to its entries; running-balance column; "balances to zero" badge that turns red on tamper.
- **Demo:** Two concurrent payouts + an intentionally unbalanced transfer — serialization conflict + CHECK rejection at the DB layer; correct double-entry commits and reconciles to zero.
- **Win:** Uses the transaction/constraint/isolation level most entrants skip; CFO-grade pain with budget.
- **Fail:** Happy-path inserts claiming correctness without proving rejection.
- **Competitors:** Expense tracker that never uses a transaction that matters.
- **10x:** CHECK + SERIALIZABLE on screen; let a judge press "double-spend the escrow" and "post an unbalanced entry" and watch the DB reject both; materialized-view reconciliation report as closer.

**S12 · Overbook** — *Aurora PostgreSQL*
- **Pitch:** A reservation engine for scarce time-slot inventory that provably never double-books overlapping reservations, enforced by Postgres range-exclusion constraints under concurrent load.
- **User:** Clinics, studios, equipment-rental, co-working operators.
- **DB why:** Postgres `EXCLUDE` constraint with a GiST index over `tstzrange` — the DB itself guarantees no overlapping confirmed bookings; serializable for the hold-then-confirm flow; JOINs across resources/customers/pricing. Dynamo can't express range-overlap exclusion; DSQL lacks exclusion constraints + GiST.
- **Frontend:** Availability grid (resources × time); optimistic holds turn green on confirm, red-flash-then-revert on collision; "collisions prevented" counter.
- **Demo:** 2,000 concurrent attempts at the same hot slot — exactly one confirmed, the rest cleanly rejected by the EXCLUDE constraint; show the one-line constraint definition.
- **Win:** A Postgres superpower 99% of entrants don't know exists, turning correctness-under-contention into a one-line declarative guarantee with load evidence.
- **Fail:** Hold-expiry/payment state machine adds complexity; weak load test kills the scale claim.
- **Competitors:** Booking app with SELECT-then-INSERT that races into double-bookings.
- **10x:** Make the `EXCLUDE`-over-`tstzrange` constraint the protagonist, rejecting thousands of concurrent collisions with a measured throughput graph.

**S13 · Tribunal** — *Aurora PostgreSQL*
- **Pitch:** A duplicate-and-conflict detector for any knowledge base that finds near-identical and contradictory entries via a pgvector self-join against authorship and version lineage.
- **User:** Support/ops leaders + legal/compliance drowning in redundant, conflicting docs/macros/clauses.
- **DB why:** A self-JOIN on a vector column — find all pairs within a similarity threshold, JOINed to version/author/team metadata + recursive CTE over edit history; window functions cluster near-dupes into equivalence classes. Dynamo can't do similarity/self-joins; DSQL has no pgvector.
- **Frontend:** Conflict board clustering near-dupes into visual groups + similarity heatmap; side-by-side diff drawer with similarity score + date/author lineage.
- **Demo:** Run over a seeded 200k-clause corpus — surfaces 5 near-identical refund policies disagreeing on the window; shows the similarity matrix + EXPLAIN HNSW hit; merges them in a transaction updating all references atomically.
- **Win:** pgvector for something other than RAG — similarity as a dedup/conflict primitive joined to lineage; dodges the chatbot trap.
- **Fail:** "Contradictory" vs "similar" is fuzzy; arbitrary clusters feel like a gimmick.
- **Competitors:** Another RAG "search your docs" chatbot.
- **10x:** Vector index for a self-join clustering + contradiction query (not top-k), JOINed to temporal lineage, over a 200k-row corpus.

**S14 · Splitwire** — *Aurora DSQL*
- **Pitch:** A globally-distributed treasury ledger for cross-border creator/affiliate payouts where the same wallet is debited from whichever region the processor lands in, and a double-payout is physically impossible.
- **User:** Payment ops at marketplaces/affiliate networks/creator platforms paying out from multiple regional rails (ACH/SEPA/APAC).
- **DB why:** One wallet, N regional payout workers, balance never negative, payout exactly once even when two regions race in the same ms. DSQL gives ACID + strong consistency across regions; conflicts detected at commit. Dynamo eventual would double-pay; single-region Aurora can't accept active-active.
- **Frontend:** Double-entry ledger split into two region tabs; each row reconciles to zero; idempotency-key column + "committed in X, conflicted in Y" badge.
- **Demo:** One button fires two payouts against the same wallet from two regions — one commits, the other gets a serialization error + auto-retry; balance never negative; then kill a region, payouts keep flowing.
- **Win:** Canonical DSQL hero shot applied to real B2B pain; architecture diagram doubles as data model.
- **Fail:** Looks like "just a finance tracker" if the cross-region race isn't dramatized first.
- **Competitors:** Single-region expense tracker that never opens a transaction.
- **10x:** Attack your own ledger live with a concurrent cross-region double-spend; show DB reject at commit; idempotency key + OCC retry visible.

### Track 3 — Million-scale global

**S15 · Tempo** — *DynamoDB*
- **Pitch:** A planet-scale second screen that turns 50M fans tapping reactions during a World Cup match into a live sub-second emotional heatmap of the world.
- **User:** Broadcasters, sports rights-holders, fans across every continent.
- **DB why:** Known access patterns at unbounded spiky write volume where per-item latency must stay flat. Reactions sharded across `MATCH#id#SHARD#n`; Streams fan taps into per-minute/per-region aggregate items (the heatmap); TTL expires raw taps; Global Tables put ingestion near each region. Aurora deadlocks on the spike; DSQL's OCC conflicts on hot counters.
- **Frontend:** Live world map where regions pulse/bloom as reactions land; reactions/sec ticking past millions; fixed p99 badge; SSE off Streams aggregates.
- **Demo:** Load gen simulating a goal — ops/sec rockets 2k→80k writes/sec, map erupts in synchronized pulses, p99 does NOT move; CloudWatch WCU graph beside it.
- **Win:** DynamoDB's signature property literally visible/clickable on a live map, backed by a CloudWatch graph + k6.
- **Fail:** Under-powered load gen or seeded counts → looks staged.
- **Competitors:** Polling live-poll widget hitting one table every few seconds.
- **10x:** Single-table item-collection diagram + 7-access-pattern table on screen, explicit hot-partition write-sharding, X-Ray trace of one Streams record → aggregate.

**S16 · Driftwatch** — *DynamoDB*
- **Pitch:** Ingest 1M sensor readings/sec from a global device fleet and surface the anomalous ones on a live time-scrubbable timeline within the same second they arrive.
- **User:** Industrial IoT, EV charging networks, connected-fleet operators.
- **DB why:** Append-only, write-dominated, unbounded, fixed query pattern. `DEVICE#id`/`TS#iso` → one Query for a device's history; Streams drive a Lambda computing rolling z-score anomalies into a materialized `ANOMALY#` collection; TTL ages out raw readings; Global Tables for regional locality. Aurora chokes on 1M writes/sec; DSQL's transaction limits are wrong for firehose ingest.
- **Frontend:** Ops console — device-fleet map, scrubbable time-travel slider replaying the last hour of anomalies, live anomaly feed (SSE) with severity badges.
- **Demo:** Crank to 1M readings/sec; writes/sec + CloudWatch climb while p99 stays flat; an injected fault appears as a red anomaly within ~1s; scrub backward to replay the exact drift moment.
- **Win:** Time-travel over a Streams-built anomaly history could only exist on this model; flat-latency-under-firehose is the most legible scale evidence.
- **Fail:** Pretty timeline with 50 seeded readings.
- **Competitors:** Generic IoT dashboard over a few hundred rows.
- **10x:** Single-table diagram, write-shard hottest devices/time-buckets, X-Ray of Streams→Lambda→materialized-anomaly, p50/p99 + millions-of-rows on screen.

**S17 · Splitsecond** — *DynamoDB*
- **Pitch:** A live-ops control room for game studios where a global leaderboard, kill feed, and per-player profile all update in single-digit ms under a real write storm you can trigger on stage.
- **User:** Indie/mid-size game studios running live-ops events; event-platform teams needing real-time ranking infra.
- **DB why:** Streams-driven materialized leaderboard — raw score events (`MATCH#id`/`EVENT#ts`), Stream→Lambda atomically increments per-player aggregates + rank buckets; reads are one Query on a GSI (`SEASON#id`/`SCORE#zero-padded`) returning pre-sorted top-N. Aurora hot-UPDATEs a ranking row that serializes; DSQL's OCC conflicts on the hot aggregate.
- **Frontend:** Split dashboard — raw event firehose, leaderboard rows animating/reordering live, fat p50/p99 badge, ConsumedWriteCapacity sparkline.
- **Demo:** "Unleash storm" (k6 the audience can tap into) — WriteCapacity rockets to thousands/sec, leaderboard keeps reordering, p99 never leaves single digits.
- **Win:** Directly satisfies the AWS judges' top reward (visible scale evidence) + Streams materialized view as the product.
- **Fail:** Faked/under-powered storm; too-generic game theme reads as a toy.
- **Competitors:** Static leaderboard polling one table every 3s.
- **10x:** Live audience-driven load test, p50/p99 + WCU on the actual UI, X-Ray of one Query serving the leaderboard, write-shard the rank counter.

**S18 · Pulsefeed** — *DynamoDB*
- **Pitch:** A creator-platform activity/notification fabric where every follow/like/post fans out into millions of personalized timelines each rendering from a single Query, with the fan-out strategy visible as the product.
- **User:** Social/creator platforms needing a feed system that survives a mega-creator viral spike.
- **DB why:** Item-collection feed materialization with deliberate fan-out-on-write vs fan-out-on-read. Timeline = `USER#id`/`FEED#ts` (one paginated Query). Normal creators → Streams fan-out-on-write; mega-creators above a follower threshold → fan-out-on-read (merged at query time) to avoid a write-amplification storm; write-sharding for the celebrity's hot key. Aurora/DSQL can't fan out natively.
- **Frontend:** Two-pane — live notification inbox + home feed; toggle exposing engine internals (which posts came via write vs read); partition-activity heatmap that lights up when a celebrity posts.
- **Demo:** Normal creator posts → instant fan-out into a follower's live feed; a 1M-follower celebrity posts → heatmap shows the switch to fan-out-on-read instead of a million writes, while the feed still assembles in one Query.
- **Win:** Refuses the lazy "Twitter clone" trap by making the fan-out decision + hot-key avoidance the visualized thesis.
- **Fail:** A feed that polls one table = the named anti-pattern.
- **Competitors:** Twitter clone with naive fan-out-on-write only, polling for "real-time."
- **10x:** Implement BOTH strategies with a real follower-threshold switch, partition heatmap, per-post assembly provenance, X-Ray single-Query feed read.

**S19 · Tessellate** — *Aurora DSQL*
- **Pitch:** A worldwide live-event seat engine where audiences in every region claim the same scarce seats at once, and strongly-consistent distributed SQL guarantees zero oversells with no single bottleneck region.
- **User:** Global ticketing platforms, conference organizers, flash-sale commerce.
- **DB why:** Finite scarce inventory claimed concurrently by buyers nearest different regional writers, sold exactly once globally, each buyer writing to their nearest endpoint. Dynamo Global Tables (eventual) would oversell; single-region Aurora makes APAC pay a cross-ocean RTT and dies if that region degrades. DSQL multi-region strong consistency + OCC at commit is the only fit.
- **Frontend:** Seat-map grid (green/amber/red); global seats-remaining counter identical across two region tabs; HOLD shows a TTL countdown, flips to SOLD across both regions at once on commit.
- **Demo:** 5,000 concurrent buyers from two regions at the same 200 seats — exactly 200 SOLD, zero oversells, "claims: 5000, seats: 200, oversells: 0," remaining counter strongly consistent across both tabs; then drop a region mid-sale.
- **Win:** Fuses two judge-rewarded moments (exactly-one-winner + cross-region strong-consistency read) into one visceral artifact.
- **Fail:** Mistaken for an e-commerce clone if it doesn't open with the storm + a real second region.
- **Competitors:** DynamoDB flash sale on 12 seed SKUs that silently oversells.
- **10x:** Sell from multiple regions at once, prove global inventory strongly consistent during the storm, survive a region drop, render hold/commit/TTL on the seat itself.

### Track 4 — Open innovation

**S20 · Sky Claim** — *DynamoDB* *(TOP 5 — see deep dive)*
- **Pitch:** Live air-traffic control for the sub-400ft drone economy where every flight atomically claims 3D airspace voxels before entering them, and double-bookings are physically impossible.
- **DB why:** Conditional write to claim a `(geohash-voxel, time-bucket)` item with `attribute_not_exists` → exactly-one-winner deconfliction at flat single-digit-ms; Streams → live skymap; TTL auto-expires reservations on exit. Aurora deadlocks on hot spatial rows; DSQL retry-storms contended voxels; no cross-region needed for one city.

**S21 · Provenance (Carbon Retirement Ledger)** — *Aurora DSQL*
- **Pitch:** A global retirement ledger for carbon credits where the same tonne of CO₂ is retired exactly once across every regional registry, with strongly-consistent active-active writes.
- **User:** Carbon registries, corporate ESG buyers, auditors.
- **DB why:** Multi-region active-active strong consistency on relational data — a retirement in the EU is strongly consistent to US/APAC so no second buyer can retire the same serial; OCC rejects the loser at commit, no failover. Dynamo eventual double-retires; single-region Aurora can't retire during a region outage.
- **Frontend:** "Two registries, one truth" split-screen; EU + US panes reconciling the same project inventory; globally-consistent "tonnes retired" counter; per-region commit-latency widget proving sub-100ms JOINs.
- **Demo:** Two buyers retire serial `#EU-2024-0042` simultaneously — one burns it globally, the other gets "already retired in us-east-1 12ms ago"; disconnect a region mid-demo, retirements keep committing.
- **Win:** Canonical DSQL hero shot on a domain judges find important + original; double-entry retirement ledger gives real JOINs.
- **Fail:** DSQL's >10k-rows / >10MiB-per-txn limits bite if over-modeled; faking the second region.
- **Competitors:** Single-region Postgres offset marketplace with a status column.
- **10x:** Script the failure: live concurrent-retirement race, literal endpoint disconnect on camera, region-topology diagram, OCC error-then-retry.

**S22 · Loreweaver** — *Aurora PostgreSQL*
- **Pitch:** A living-canon engine for collaborative fiction that semantically checks every new chapter against thousands of canon facts so a character can't die twice or contradict their backstory.
- **User:** TTRPG game masters, serial-fiction writing rooms, franchise continuity editors.
- **DB why:** One query JOINs pgvector HNSW search ("canon facts similar to this sentence") against a relational entity graph with hard constraints (CHECK that a deceased entity can't later "speak", FK event→character→world, window function over timeline). Only Aurora + pgvector. Dynamo has no vectors/joins; DSQL has neither pgvector nor FK/CHECK.
- **Frontend:** Split-pane writer's room — type a chapter on the left, right pane streams live continuity flags: ranked pgvector matches with similarity badges + hard red "constraint violation" cards over an entity-timeline graph.
- **Demo:** Type "Lyra smiled and drew her sword" → EXPLAIN-visible vector hit to her death scene (0.91) AND a relational constraint card citing the exact FK/timeline row.
- **Win:** Rare AI-era app where pgvector is load-bearing because it's JOINed to constraints + a timeline; live query plan as the hero shot.
- **Fail:** Drifts into "chat with your lore" if constraints aren't real/enforced.
- **Competitors:** "Chat with your worldbuilding wiki" RAG.
- **10x:** One statement doing vector ANN + 3-table JOIN + window function, live `EXPLAIN (ANALYZE)` HNSW hit, a SERIALIZABLE-enforced constraint visibly rejecting a continuity violation.

---

## PHASE 3 — GENERATIONAL / UNREASONABLE IDEAS (10)

*Ambitious, strange, memorable — but still shippable as a working app.*

**G1 · Recall — The Outbreak Console** — *Aurora PostgreSQL* *(TOP 5 — deep dive below)*
- A live dispatch console for product recalls that traces a contaminated lot backward to source and forward to every affected store shelf, **in one query**, the instant a report lands. Recursive CTE over a FK-constrained supply DAG + PostGIS geography + pgvector incident clustering — all in one SERIALIZABLE statement. The DB *is* the recall.

**G2 · Settlement Floor** — *Aurora DSQL* *(TOP 5 — deep dive below)*
- A global parametric microinsurance exchange where 50,000 flight-delay/weather micropolicies pay out the instant an oracle fires, every payout a strongly-consistent cross-region ledger write that can never double-pay or read stale. OCC rejects the duplicate webhook at commit (SQLSTATE 40001); survives a region kill with zero failover.

**G3 · Aftermarket** — *DynamoDB*
- A flash-drop resale floor where 10,000 buyers stampede the SAME last unit, conditional writes crown exactly one winner with zero oversells, and unpaid holds auto-release on a TTL countdown. Streams drive a live sold/held/available view. **Demo:** stampede the last unit with 10k concurrent buyers (or QR tap-to-buy), one winner, 9,999 clean rejections, oversell counter frozen at zero, p99 flat while WCU spikes, then a TTL hold expires on camera and the unit re-enters the market.

**G4 · Provenance** — *DynamoDB* *(TOP 5 — deep dive below)*
- A time-travel debugger for AI agent fleets: every tool call, state mutation, and dollar spent is an immutable append, and you scrub a slider backward through an agent's entire decision history to replay exactly why it went rogue. State is reconstructed *client-side* by folding the raw event log — true event sourcing; Streams build the live anomaly view. Hot category (agent observability), UI that can only exist on an append-only item-collection.

**G5 · Encore (Talent Casting)** — *Aurora PostgreSQL*
- Describe a vibe in plain English ("gravelly indie voice like rain on a tin roof, free next week, under $400") and get a ranked talent shortlist where pgvector similarity, availability, budget, rights, and location all resolve in ONE SQL query. **Demo:** type a weird vibe → ranked cards with similarity badges; flip a filter ("available Friday, under $400") and the ranking re-sorts live while preserving relevance; drop the EXPLAIN plan showing the HNSW node fused with a 4-table join, sub-100ms.

**G6 · Strikezone** — *DynamoDB*
- A live mass-participation game-show backend where tens of thousands of viewers tap predictions in the same second, a Streams-driven leaderboard reshuffles instantly, and a flat-latency graph proves the DB never flinches as the crowd 100x's. Write-sharded `GAME#id` key, TTL per round. **Demo:** load gen (or QR) spikes 200→50,000 taps/sec at the climactic moment; CloudWatch WCU rockets while p99 stays flat; point at the write-sharding scheme.

**G7 · GridLock** — *Aurora DSQL*
- A real-time carbon-aware energy exchange matching surplus rooftop/battery power to demand across a metro grid, settling thousands of micro-trades/sec so no kWh is ever sold twice across regional nodes. **Demo:** two regional nodes sell the same battery's last kWh at once — DSQL commits one, rejects the other (OCC); grid balance reconciles to zero; sever a region, dispatch keeps clearing. Carbon-intensity heat overlay shifts as clean energy dispatches first.

**G8 · Tape** — *DynamoDB*
- A time-travel forensics console for industrial sensor fleets: millions of telemetry events stream in flat at single-digit ms, and you scrub a slider to reconstruct any machine's exact state at any millisecond as anomalies materialize live. Periodic snapshot items keep the scrub a small delta-replay. (Distinct from G4 by industrial-firehose + load-storm framing.)

**G9 · Hivemind** — *DynamoDB*
- A real-time prediction-market order book where tens of thousands of traders hammer the SAME hot contract per second, and conditional writes + `TransactWriteItems` guarantee the book never oversells a share or double-fills. Write-sharding spreads the hot key; Streams drive the live book + price tape. **Demo:** QR lets the room BE the load — spike ops/sec from their phones while p99 stays flat and the oversell/double-fill counter stays frozen at zero. (Foregrounds order-book correctness vs Strikezone's crowd voting.)

**G10 · HourBank (Second Brain Market)** — *Aurora PostgreSQL* *(TOP 5 — deep dive below)*
- A self-balancing skills-and-favors exchange for large communities where free-text requests match people by semantic need (pgvector HNSW + relational filters in one query), and a time-banked hours currency provably never lets anyone spend hours they don't have (SERIALIZABLE double-entry + `CHECK(balance>=0)`). Fuses Aurora's two superpowers — relevance + provable correctness — into one product.

---

## PHASE 4 — SCORING MATRIX

*3 independent judge panels, 1–10 per dimension, averaged. Composite weights risk-adjusted-win (0.45) + demo-clarity (0.20) + AWS-DB-fit (0.15) + originality (0.10) + overall (0.10). Ranked.*

| # | Concept | Kind | DB | AWSdb | Vrcl | Tech | Dsgn | Use | Orig | $$ | Scale | Demo | **Risk** | **Comp** |
|---|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | **Recall** | gen | Aurora PG | 10 | 8.3 | 10 | 9.3 | 9.7 | 9 | 8.3 | 8 | 9.3 | **9.0** | **9.23** |
| 2 | **Provenance** (agents) | gen | DynamoDB | 9 | 8.3 | 8.7 | 9 | 8.3 | 9 | 8 | 8.3 | 9 | **8.7** | **8.81** |
| 3 | **Sky Claim** | srs | DynamoDB | 9 | 8.3 | 8 | 9 | 6.7 | 9.3 | 6.3 | 8 | 9 | **8.3** | **8.65** |
| 4 | **HourBank** | gen | Aurora PG | 10 | 8.3 | 9 | 8.7 | 7.7 | 8 | 6.3 | 6.3 | 9 | **8.0** | **8.51** |
| 5 | **Settlement Floor** | gen | Aurora DSQL | 9.3 | 7.7 | 9 | 8.7 | 8 | 7.7 | 8.3 | 9 | 9 | **8.0** | **8.41** |
| 6 | Pulsefeed | srs | DynamoDB | 9.7 | 8.3 | 9.3 | 8.3 | 7 | 7.7 | 6 | 9 | 8.7 | 8.0 | 8.37 |
| 7 | Overbook | srs | Aurora PG | 9 | 7.7 | 9 | 8.7 | 7.7 | 7.7 | 7 | 6 | 9 | 8.0 | 8.31 |
| 8 | GridLock | gen | Aurora DSQL | 9 | 7.7 | 9 | 8.7 | 8.3 | 8 | 8 | 9 | 8.7 | 7.7 | 8.17 |
| 9 | Tempo | srs | DynamoDB | 9 | 8.7 | 8 | 9.3 | 5.7 | 6.3 | 4.7 | 10 | 9.3 | 7.7 | 8.09 |
| 10 | Encore (casting) | gen | Aurora PG | 9 | 8.3 | 8 | 9 | 7.3 | 7 | 7.3 | 6 | 9 | 7.7 | 8.09 |
| 11 | Clausewise | srs | Aurora PG | 9 | 7.7 | 8.7 | 8.3 | 8.7 | 6.3 | 9 | 6 | 8.3 | 7.7 | 7.90 |
| 12 | Tessellate | srs | Aurora DSQL | 9 | 8 | 8 | 9 | 7.3 | 6.3 | 7.7 | 9 | 9 | 7.3 | 7.89 |
| 13 | Loreweaver | srs | Aurora PG | 9 | 8 | 9 | 8.7 | 5.7 | 9 | 5 | 4.7 | 8.7 | 7.0 | 7.88 |
| 14 | Splitsecond | srs | DynamoDB | 9 | 8 | 8 | 9 | 6.7 | 6 | 7 | 9 | 9 | 7.3 | 7.84 |
| 15 | Strikezone | gen | DynamoDB | 9 | 8.7 | 8 | 9 | 6 | 5.7 | 6 | 10 | 9.7 | 7.0 | 7.79 |
| 16 | Provenance (carbon) | srs | Aurora DSQL | 9 | 7 | 8 | 7.7 | 7.7 | 8 | 6.7 | 8.3 | 8 | 7.0 | 7.67 |
| 17 | Cadence | srs | DynamoDB | 9 | 7 | 8 | 7.7 | 7.7 | 5.7 | 8.7 | 9 | 8.3 | 7.3 | 7.67 |
| 18 | Tribunal | srs | Aurora PG | 9 | 7.3 | 9 | 8 | 7 | 8 | 6 | 6 | 8 | 7.0 | 7.65 |
| 19 | Aftermarket | gen | DynamoDB | 9.3 | 8 | 8 | 9 | 6.3 | 4.3 | 7.3 | 9 | 9.7 | 6.7 | 7.54 |
| 20 | Meridian | srs | Aurora DSQL | 9 | 7 | 8 | 7.7 | 7.7 | 6 | 8.7 | 8.3 | 8 | 7.0 | 7.47 |
| 21 | Tape | gen | DynamoDB | 9 | 8 | 8 | 9 | 7 | 5 | 7 | 9 | 9 | 6.7 | 7.43 |
| 22 | Cellar | srs | Aurora PG | 9 | 7.3 | 8 | 8 | 6.7 | 6.3 | 6.7 | 5 | 8 | 6.7 | 7.30 |
| 23 | Driftwatch | srs | DynamoDB | 9 | 7 | 8 | 8 | 7 | 5.7 | 6 | 9 | 8 | 6.7 | 7.26 |
| 24 | Hivemind | gen | DynamoDB | 9 | 8 | 8 | 8.7 | 6 | 5.3 | 7 | 9 | 8.7 | 6.3 | 7.23 |
| 25 | Splitwire | srs | Aurora DSQL | 9 | 7 | 8 | 7.7 | 7.7 | 5.3 | 7.7 | 8.3 | 8 | 6.3 | 7.08 |
| — | *KILLED below this line* | | | | | | | | | | | | | |
| 26 | Throwback | srs | DynamoDB | 7.7 | 8.3 | 7.3 | 8.3 | 5.7 | 7.3 | 5 | 4.7 | 8.3 | 6.0 | 6.94 |
| 27 | Margin Call | srs | Aurora PG | 8 | 7 | 9 | 7.7 | 5.7 | 6.3 | 5.7 | 5 | 7.7 | 6.0 | 6.75 |
| 28 | Ledgerline | srs | Aurora PG | 8.7 | 6.3 | 9 | 7 | 8 | 5 | 8 | 5 | 7.3 | 6.0 | 6.67 |
| 29 | Splitstream | srs | Aurora DSQL | 7.7 | 7 | 7 | 7.3 | 6.7 | 5 | 5.7 | 7 | 8 | 5.7 | 6.47 |
| 30 | Settle | srs | Aurora PG | 7.3 | 7 | 7.7 | 7 | 6.7 | 5.7 | 5 | 3.7 | 7 | 5.0 | 5.94 |

**Kills & why (be harsh):**
- **Settle / Splitstream** — Splitwise variants. The category screams "clone"; even with a clever invariant, the demo reads B2C-crowded and the DB is hard to make feel non-interchangeable on camera. Settle's single-region kills its DSQL angle; Splitstream's two-region plumbing isn't worth it for a consumer expense app.
- **Margin Call / Ledgerline** — strong DB craft, but "betting exchange" and "marketplace payout ledger" are visually similar to the warned-against finance toys, and monetizability/originality scored low. Ledgerline's correctness story is real but the demo is less visceral than Settlement Floor's cross-region race.
- **Throwback** — lovely interaction, but weak scale story + low monetizability; Provenance does event-sourcing-time-travel far better with a real buyer.
- **Cellar / Driftwatch / Hivemind / Splitwire / Tape** — all solid, but each is a less-sharp sibling of a top-5 or top-10 idea (Cellar→Clausewise/Encore; Driftwatch/Tape→Provenance; Hivemind→Strikezone; Splitwire→Settlement Floor). Don't build a weaker twin.

---

## PHASE 5 — TOP 5 DEEP DIVES

### #1 — RECALL: The Outbreak Console *(Aurora PostgreSQL · Monetizable B2B)*

1. **Final name:** Recall — The Outbreak Console
2. **Track:** Monetizable B2B (per-facility to grocery chains / distributors / CPG manufacturers as FSMA-204 traceability). Secondary tag: Open Innovation (public-good). **Lead B2B** — judges reward a real, expensive category with a dated regulatory tailwind over a vague public-good pitch.
3. **Prize strategy:** Win on **Technological Implementation + Originality** (a recursive-CTE + PostGIS + pgvector single-statement trace is genuinely rare). Make Aurora the protagonist and the UI its courtroom evidence — every pixel is a query result, so it can't be mistaken for CRUD or a chatbot. Put the live `EXPLAIN ANALYZE` on screen (most hide SQL; you make it the hero). Anchor to **FSMA 204** (real FDA rule, 24-hour records SLA, enforcement July 2028) so Impact has a named, dated, budgeted buyer.
4. **DB choice:** Aurora PostgreSQL Serverless v2, pgvector 0.8.0 (HNSW) + PostGIS.
5. **DB load-bearing (the kill-shot, say verbatim):** A recall is graph-traversal correctness over an FK-constrained supply DAG — a recursive CTE walking a `lot_links` edge table, JOINed to PostGIS store geography and a pgvector incident cluster, inside a SERIALIZABLE transaction so scope can't shift mid-trace. *"DynamoDB can't do recursive traversal or ad-hoc joins; Aurora DSQL has no PostGIS and no extensions, so no geo and no pgvector — only Aurora PostgreSQL fuses graph recursion + geospatial + vector similarity in one statement."* (Precision note: DSQL *does* support basic CTEs — do NOT claim it lacks recursive CTEs; the unimpeachable kill-shots are PostGIS + pgvector + FK-enforced DAG integrity.)
6. **Core loop:** Report lands → operator pastes a Traceability Lot Code → one SERIALIZABLE recursive-CTE traces backward to suppliers + forward to every affected store, JOINing PostGIS geo + a pgvector cluster of similar incidents → console ignites (graph propagates red, map drops store pins with unit counts, "similar incidents" rail) → click a node/pin to drill into exact lineage → export an FDA-ready recall scope. Report in → outbreak scope out, in under a second.
7. **Persona:** Food-Safety/QA Director or Recall Coordinator at a 400-store chain or a CPG manufacturer. Today: hours-to-days of frantic spreadsheet/EDI reconciliation while contaminated product stays on shelves. FSMA 204 legally requires traceability records to the FDA within 24 hours. Pays per-facility (every facility is a traceable node).
8. **Key screens:** (a) **The Outbreak Console** (signature): split layout — left a force-directed supply graph igniting red as the recursive trace propagates; right a synchronized US map (PostGIS) dropping pins with unit counts; right-edge "Similar Past Incidents" rail (pgvector relevance badges); top bar with live row count, query latency, 24h SLA countdown. (b) **Lot Lineage Drawer** — one JOIN, four tables, as a parent/child trail. (c) **Query Inspector** (the 10x) — the actual recursive CTE SQL + live `EXPLAIN (ANALYZE, BUFFERS)` with the recursive-union node, HNSW scan, GiST spatial join visible. (d) **Incident Inbox** — pgvector "possible cluster" badges. (e) **Recall Scope Export.**
9. **Data model (FK-constrained — the property DSQL can't give):**
   ```
   suppliers(supplier_id PK, name, region, geom geography(Point,4326))
   facilities(facility_id PK, type CHECK in('farm','processor','distributor','warehouse'), supplier_id FK)
   lots(lot_id PK, tlc UNIQUE NOT NULL, product_name, lot_type CHECK in('ingredient','intermediate','finished'), facility_id FK)
   lot_links(parent_lot_id FK, child_lot_id FK, transform_event, PK(parent,child))   -- the DAG edge table
   stores(store_id PK, chain, geom geography(Point,4326), address)
   shipments(shipment_id PK, lot_id FK, store_id FK, units int CHECK(units>0), shipped_at, received_at)
   store_inventory(store_id FK, lot_id FK, units_on_hand, PK(store,lot))
   incidents(incident_id PK, reported_at, raw_text, embedding vector(1536), suspected_lot_id FK NULL, pathogen NULL)
   ```
   Indexes: `lot_links(parent_lot_id)` + `(child_lot_id)` (both directions), `shipments(lot_id)`+`(store_id)`, `hnsw(embedding vector_cosine_ops)`, `gist(stores.geom)`. **Seed for credibility:** ~80k lots, ~250k lot_links edges, ~250k shipments, ~1,400 stores across 38 states, ~2,000 embedded incidents — row counts shown on screen.
10. **Architecture:** Next.js App Router on Vercel (v0-generated, refined). RSC runs the recursive-CTE trace server-side for first paint (no loading flash); Server Actions re-run on new TLC / time-scrub / node click; graph + map animate client-side off returned rows. Vercel Function (Fluid Compute) holds a module-scope `pg Pool` with `attachDatabasePool()` → **RDS Proxy** → Aurora Serverless v2. **OIDC keyless AWS auth** (`@vercel/oidc-aws-credentials-provider`, STS AssumeRoleWithWebIdentity, trust keyed to `oidc.vercel.com/[TEAM_SLUG]`). Secrets Manager for creds. Embeddings via Bedrock (precomputed). The trace is NOT cached (a stale recall scope is dangerous — itself a talking point); inbox uses `revalidateTag`.
11. **Vercel plan:** v0 generates the split map+graph console (shadcn/Tailwind, dark control-room aesthetic), then hand-refine graph/map interactivity + Query Inspector. RSC first paint, Server Actions for re-runs, `<Suspense>` streaming for the vector rail. Vercel Cron trickles synthetic shipments so the live row counter climbs during judging. Capture published URL + Team ID. Demo on the live URL, low TTFB.
12. **AWS DB plan:** Aurora PG Serverless v2 (PG 16+), `CREATE EXTENSION vector; postgis;`, real FKs + CHECKs, HNSW + GiST indexes, seed at scale via a generator. RDS Proxy + Secrets Manager + IAM role for OIDC. **Submission screenshot:** RDS console (Serverless v2 cluster) + the `EXPLAIN (ANALYZE, BUFFERS)` plan showing the recursive-union node, HNSW scan, GiST spatial join + a CloudWatch ACU-scaling graph during the trace burst. Put a real p50/p99 latency number on screen.
13. **Demo script (170s, live URL):**
    - `0:00–0:18` Cold open over a real FDA recall headline: *"When a contaminated lot ships, the question is always — which shelves, right now? Today: hours of spreadsheets. FSMA 204 gives them 24 hours by law. We do it in under a second."*
    - `0:18–0:33` Incident Inbox — three differently-worded complaints; *"pgvector already clustered these as one pathogen signature."*
    - `0:33–0:48` Paste the TLC, hit Trace; *"One recursive query, inside a serializable transaction, over 250,000 shipment edges."* Graph ignites; map drops pins.
    - `0:48–1:08` Payoff: *"1,400 affected stores across 38 states."* Latency ("847ms") + row count on the top bar.
    - `1:08–1:28` Query Inspector (the 10x): the recursive CTE + live EXPLAIN; point at the recursive-union node, HNSW scan, PostGIS join.
    - `1:28–1:43` Drill-down: click a pin → lineage drawer ("240 units of lot PRD-8841, derived from ING-2207, Verde Farms, shipped June 9").
    - `1:43–1:56` Why only Aurora (split-card kill-shot).
    - `1:56–2:10` Proof + close: RDS console + CloudWatch ACU graph scaling for the burst. End on live URL + 24h SLA timer. (~10s buffer for the Team ID / "Amazon Aurora PostgreSQL" title card.)
14. **Build first (spine = non-negotiable):** (1) Schema + seed generator producing the 250k-edge DAG + 1,400 geo stores + 2,000 embedded incidents. (2) The single hero recursive-CTE forward-trace query (PostGIS JOIN + pgvector LEFT JOIN, SERIALIZABLE) returning the exact row shape the three panes need — correct and sub-second *before* any UI. (3) The Outbreak Console wired via RSC first-paint + Server Action re-run. Then: Query Inspector, Lineage drawer, Incident Inbox, OIDC+RDS Proxy+Fluid pooling, CloudWatch screenshot.
15. **Cut if scope bites (protect the spine):** Cut the backward/upstream trace first (forward is the dramatic direction; backward is the same pattern, narrate it). Then the Cron synthetic-ingest counter, the Scope Export action, the full Incident Inbox (keep one inline pre-clustered example), live Bedrock embedding (precompute offline). **Never cut:** the recursive CTE, PostGIS map JOIN, pgvector rail, live EXPLAIN, real seed volume, live-URL deploy.
16. **Beats competitors:** Non-interchangeable DB (one verified sentence on why Dynamo + DSQL each fail) + evidence (EXPLAIN, 250k-edge row count, measured latency, CloudWatch ACU) over claims. vs. the #1 RAG submission: pgvector is JOINed to relational + geospatial data, filtered to the implicated supply path — not a standalone similarity lookup. The UI is a thesis about the data (the graph IS the recursion, the map IS the spatial join). Regulatory tailwind = a named, mandated, budgeted buyer.
17. **Biggest failure mode:** The recursive CTE goes quadratic/cycles → the "sub-second" trace hangs on camera. Mitigations (done in build step 2, before UI): generate a true acyclic DAG + depth guard/visited-set; index both directions of `lot_links`; verify EXPLAIN uses index scans at every iteration; cap fan-out depth (~4–7 hops); keep ACU floor warm so the on-camera query isn't a cold scale-up; pre-validate the exact demo lot to return ~1,400 stores in <1s. Secondary: serverless connection exhaustion → RDS Proxy + Fluid module-scope pool + `attachDatabasePool`, load-tested before recording.
18. **Production-grade:** Show the latency number + row count on the top bar (real measurement). The live-EXPLAIN Query Inspector is the highest-leverage 30 minutes in the project. Dark control-room aesthetic + animated counters + badge pulses. Real empty/error states (a judge WILL type a random lot → "clean lot — no shelves at risk"). Cosine-distance score on each incident badge. Architecture diagram = the DATA MODEL (ER + DAG edge table + annotated hero query). Mention OIDC keyless + Serverless v2 scale-to-fit as the cost/security reasoning.

---

### #2 — PROVENANCE *(DynamoDB · B2B / Open Innovation)* — agent observability time-travel

1. **Final name:** Provenance
2. **Track:** Monetizable B2B (primary), cross-entered Open Innovation. *"Agent observability that pays for itself the first time an agent loops and burns $4,000 of tokens overnight."*
3. **Prize strategy:** Target the **AWS-database-craft lane + Originality**, not the prettiness arms race. Three judge-bait artifacts: (1) Tech Implementation — CloudWatch `ConsumedWriteCapacity` past several thousand writes/sec while a p99 badge stays single-digit-ms, + the X-Ray single-Query trace for a full timeline. (2) Originality — the time-travel scrubber reconstructing state purely from the raw log. (3) Architecture diagram = the single-table item-collection diagram + the 7-access-pattern→key-condition table. Kill-shot on camera: *"Aurora chokes on the write rate and needs bolted-on logical replication to fan out; DSQL gives me SQL I don't need and no Streams; one agent's timeline is a pure key-condition Query — DynamoDB is the only correct engine."*
4. **DB choice:** DynamoDB (single-table + Streams→Lambda materialized views + TTL), on-demand capacity (spiky/viral writes).
5. **DB load-bearing:** The product IS the event log. (1) Item-collection — `AGENT#id`(PK)/`EVENT#<zeroPadSeq>`(SK) returns one agent's full ordered history in ONE Query, no joins/scan — powers the scrubber. (2) Per-partition strict ordering + exactly-once stream delivery → "replay the log and you reconstruct true state" is correct, not aspirational. (3) Streams→Lambda builds `CURRENT#STATE` + anomaly aggregates as events land. Aurora's joins buy nothing (core read is one key) and it buckles at the write rate; DSQL gives unused active-active + has no Streams + a 10k-row/txn ceiling.
6. **Core loop:** Agent emits ordered immutable events (TOOL_CALL/STATE_MUTATION/SPEND/DECISION/ERROR) → engineer opens the timeline, anomaly heatmap (Streams aggregate) flags the fork → grab the slider, scrub back; client folds the raw log up to that timestamp into reconstructed state frame-by-frame → land on the exact fork event → export a permalinked, tamper-evident post-mortem. Ingest → detect → replay → diagnose → share.
7. **Persona:** Platform/ML "AI reliability" on-call running fleets of production LLM agents. Incumbents (LangSmith/AgentOps/Langfuse) show a trace tree but no scrubbing back through reconstructed state. Already pays for observability → a line-item swap (B2B monetization). Secondary: the eng manager who must explain a $4k overnight burn.
8. **Key screens:** (a) **Fleet overview** (RSC first paint, pulsing anomaly badges, global events-ingested counter + flat p50 badge). (b) **Agent Time-Travel Theater** (hero) — horizontal scrubber rewinds three synced panes (reconstructed STATE inspector, TOOL_CALL card stack, animated SPEND meter counting down), with the raw immutable event-stream lane below + the Streams-built anomaly heatmap overlaid. (c) **Incident permalink post-mortem** (frozen frame, OLD/NEW diff, hash-chain). (d) **Live ingest / write-storm console** (CloudWatch chart + p99 badge + X-Ray single-Query trace toggle). (e) **Access-pattern panel** (the data-model-as-thesis screen).
9. **Data model:** Single table `provenance` (on-demand, Streams=`NEW_AND_OLD_IMAGES`, TTL=`ttl`).
   - Event (spine): `PK=AGENT#<id>`, `SK=EVENT#<zeroPadSeq:016d>` (zero-pad so lexical order == chronological). Attrs: type, tsMillis, payload, tokenDelta, **costUsdMicros (integer micro-dollars — never floats)**, stateDelta, idempotencyKey, hashPrev/hashSelf. Written with `attribute_not_exists(SK)` (idempotent).
   - Materialized state (Streams→Lambda): `SK=CURRENT#STATE` (lastSeq, folded latestState, `ADD` cumCostUsdMicros, anomalyScore) — O(1) fleet read.
   - Anomaly aggregate: `SK=AGG#ANOMALY` (or per-bucket).
   - Ephemeral traces: `ttl` ~24h.
   - GSI1 (fleet): `FLEET#<tenant>`/`<status>#<lastTs>`. GSI2 (anomaly inbox): `ANOMALY#<tenant>`/`<severity>#<ts>`.
   - **7 access patterns→key conditions** shown on screen (full timeline = Query `PK=AGENT#id, SK begins_with EVENT#`; scrub window = `SK between`; current state = GetItem; fleet = GSI1; anomaly inbox = GSI2; cumulative spend = fold or CURRENT#STATE; idempotent append = `attribute_not_exists`). Hot-partition note: a chatty agent is a hot partition → SK write-sharding if needed; natural fan-out across thousands of AGENT# PKs spreads writes.
10. **Architecture:** Next.js App Router on Vercel; RSC first paint reads DynamoDB server-side; mutations/scrub-range via Route Handlers/Server Actions; SDK v3 `DynamoDBDocumentClient` over OIDC keyless. Write path: conditional `PutItem`. Fan-out: Streams (`NEW_AND_OLD_IMAGES`)→Lambda writes `CURRENT#STATE` (fold + `ADD` cost) + `AGG#ANOMALY`, and pushes to a Vercel SSE Route Handler. **Replay/fold runs CLIENT-SIDE** over the raw events from the single Query — true event sourcing (the server doesn't pre-render frames). Single-region by design (it's trace ingestion). X-Ray on the timeline Query; CloudWatch for the storm.
11. **Vercel plan:** v0 generates the fleet dashboard + scrubber + event-lane table + recharts/tremor meters, then hand-refine the time-travel interaction. RSC first paint; Server Actions with `revalidateTag` mirroring the eventually-consistent view; SSE Route Handler for the live anomaly lane; Fluid Compute (`fluid:true`) so streaming functions stay warm. OIDC env vars only — no AWS secret keys. Dark mode (it's a debugger).
12. **AWS DB plan:** On-demand, Streams, TTL, two GSIs. One stream Lambda (batched, `reportBatchItemFailures`, event-type filter): fold STATE_MUTATION, `ADD` on SPEND, increment `AGG#ANOMALY`, push SSE. Idempotent ingest via `attribute_not_exists(SK)`. IAM role scoped to Query/GetItem/PutItem via OIDC. **Seed real volume** (hundreds of thousands → low millions of events across thousands of AGENT# partitions). Screenshot: DynamoDB console (table + item count + a sample AGENT# item collection) + CloudWatch capacity during the storm + X-Ray timeline trace.
13. **Demo script (175s):** `0–15` live fleet grid, header showing millions of events + flat p50. `15–35` an agent pulses red → Time-Travel Theater; *"the anomaly heatmap was built by DynamoDB Streams as events landed — no batch job."* `35–75` scrub back; state rewinds, tool-call cards pop, spend meter counts DOWN; *"state is reconstructed on the fly by folding the raw event log — true event sourcing; the log is the source of truth."* `75–95` land on the fork event + OLD/NEW diff + hash-chain; X-Ray overlay — *"one Query, one key-condition round trip, no joins, no scan."* `95–125` write-storm: CloudWatch past thousands/sec, p99 flat, a NEW anomaly appears live via SSE. `125–150` single-table diagram + 7-access-pattern table + the kill-shot. `150–165` share → incident permalink (tamper-evident). `165–175` architecture overlay + Team ID.
14. **Build first:** (1) Single table + ingest endpoint + event generator seeding real volume. (2) One-Query timeline fetch + **client-side fold-to-state reducer + slider** (the hero + only truly novel thing). (3) Streams→Lambda materialized view + fleet grid. (4) OIDC keyless auth **early in parallel** (prove one OIDC-authed Query on day one). (5) write-storm console + screenshots. (6) share/permalink + access-pattern panel + polish.
15. **Cut if scope bites (hero stays last):** Cut live SSE → poll `CURRENT#STATE` (still honest). Cut hash-chain. Cut GSI2 anomaly inbox. Cut share/permalink. Cut live write-storm → pre-captured CloudWatch graph narrated over. **Never cut:** single-Query timeline, client-side fold/scrub, Streams-built `CURRENT#STATE`.
16. **Beats competitors:** The scrubber literally cannot exist without an append-only ordered item collection (you show the one-Query trace), and you seed real volume + show the capacity-vs-flat-p99 graph. vs. incumbents (LangSmith/AgentOps): theirs is checkpoint-based rollback inside their own runtime; you reconstruct from a raw immutable log, vendor-neutral.
17. **Biggest failure mode:** The fold silently degrading into "pre-compute every frame on the server and stream pictures" → just another trace viewer; the entire thesis dies. The fold MUST run client-side over the Query results, and you must say so + show the reducer. Second: OIDC auth not wired in time → panic-revert to long-lived keys (a security judge notices). Third: claiming scale without the seed/screenshots.
18. **Production-grade:** Integer micro-dollars everywhere (a debugger with a wrong total is dead on arrival). The spend meter is an animated counting number (the count-down is the most visceral "real event sourcing" moment). Zero-pad the SK seq (write a test asserting Query order == insertion order). Dark mode + one restrained accent. Real empty/loading/error/live-edge states. Verify the published URL + Team ID in a fresh incognito window. Ship the public build thread narrating the single-table design.

---

### #3 — SKY CLAIM *(DynamoDB · Open Innovation w/ Million-scale flavor)*

1. **Final name:** Sky Claim
2. **Track:** Open Innovation (lead the copy), demo/architecture argues the Million-scale case (flat single-digit-ms under a 5,000-flight storm). Double-positioning → competes for Originality while borrowing scale-track credibility.
3. **Prize strategy:** Spear at **Originality + Technological Implementation**, Design as the multiplier. (1) Originality — UTM/drone-airspace has zero hackathon precedent and reads as senior systems thinking. (2) Tech — make the conditional write the protagonist: a head-to-head race for one voxel with a visible winner/loser + a published k6 screenshot at thousands of claims/sec + CloudWatch WCU with p99 flat. (3) Design — the 3D voxel skymap makes an invisible distributed-systems property (exactly-one-winner) something a non-technical judge can SEE. Don't chase the cash tracks head-on (monetization is a one-line mention).
4. **DB choice:** DynamoDB (single-table, on-demand, Streams, TTL).
5. **DB load-bearing:** Claiming airspace IS a DynamoDB primitive — a conditional `PutItem` on a `(geohash-voxel, time-bucket)` item with `attribute_not_exists` → exactly-one-winner deconfliction at flat single-digit-ms as flight count 100x's. Kill-shot: *"Aurora would serialize on the hot spatial rows and deadlock the moment 5,000 flights hit one corridor; DSQL's OCC would retry-storm those same contended voxels; and you don't need cross-region for one city's airspace."* Streams fan each claim into a live skymap; TTL auto-expires a reservation the instant its time-bucket passes (no sweeper). Swap the DB → the product breaks.
6. **Core loop:** Operator/autopilot plans a flight as ordered `(geohash7, altBand, 15s-bucket)` voxels → for each, fire `TransactWriteItems`/conditional `PutItem` with `attribute_not_exists` → success = green claim, `ConditionalCheckFailed` = red (reroute) → successful claims emit Stream records → Lambda updates the skymap aggregate + SSE → as each bucket elapses, TTL deletes the reservation (sky frees up behind the drone). Double-booking is physically impossible because the DB refuses the second writer — that refusal, made visible, IS the product.
7. **Persona:** A commercial drone-fleet ops dispatcher (Zipline/Wing/Flytrex-style) or city UTM coordinator managing dozens–hundreds of simultaneous sub-400ft BVLOS flights. Job-defining fear: a mid-air conflict or a regulator asking "prove these two drones could never occupy the same airspace." Needs correctness under burst load + auditability. FAA UTM is real and actively standardizing.
8. **Key screens:** (a) **Live Skymap** (hero) — dark 3D voxel grid over a city basemap (deck.gl), corridors as light-trails, claimed voxels as translucent cubes; pinned HUD (flat p99 badge, flights/sec, total-claims odometer); red voxel flash on rejection. (b) **Conflict Arena** (money shot) — two operators, two "CLAIM 10:42:15" buttons; tap both → one green ("CLAIMED"), one red ("HELD — rerouting") in <1s; an "oversells: 0" counter that never moves. (c) **Load Storm panel** — "Run 5,000-flight storm" + embedded CloudWatch WCU sparkline climbing with p99 flat. (d) **My Corridor drawer** — one Query (`FLIGHT#id`/`VOXEL#…`) returns the whole corridor. (e) **Airspace Time-Travel / Audit** scrubber over the Streams log. (f) **Architecture & Access-Patterns page.**
9. **Data model:** Single table `SkyClaim` (on-demand, Streams=`NEW_AND_OLD_IMAGES`, TTL=`ttlEpoch`).
   - VOXEL reservation (hot, contended): `PK=VOXEL#{geohash7}#{altBand}`, `SK=TIME#{epochBucket15s}`; write = `PutItem ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)` → exactly-one-winner.
   - FLIGHT corridor membership: `PK=FLIGHT#{id}`, `SK=VOXEL#{geohash7}#{altBand}#{bucket}` (written in the SAME `TransactWriteItems` so corridor + reservation commit atomically).
   - LIVE SKYMAP aggregate (Streams→Lambda): `PK=MAP#{cityId}#{bucket}`, `SK=AGG`.
   - OPERATOR/FLIGHT metadata: `PK=OPERATOR#{id}`, `SK=FLIGHT#{id}`.
   - GSI1 "byTimeBucket" (`TIME#{bucket}`/`VOXEL#…`) → "what's claimed in this 15s slice"; GSI2 "byOperator". **Hot-partition mitigation:** time-bucket in the SK spreads writes; write-shard the AGG/skymap aggregate across N suffixes; the voxel reservation is *intentionally* single-key (single-keyness is what makes deconfliction correct). **Seed/replay ~1–3M historical claim items** (a week of synthetic city traffic).
10. **Architecture:** Vercel/Next.js App Router (v0, refined); RSC first paint of the skymap + console server-side; 3D map is a client component hydrated then SSE-subscribed; claims via Server Actions/Route Handlers. `/api/claim` runs `TransactWriteItems` with the condition → 200 green / 409 red. OIDC keyless. Streams→Lambda updates the write-sharded MAP aggregate + POSTs to a Vercel SSE broadcast endpoint → the two-tab red-flash moment. TTL on `ttlEpoch`. `/api/storm` drives the write storm; `/api/metrics` reads CloudWatch `GetMetricData` (WCU, p99). **Single-region by design** (one city's airspace) — explicitly NOT multi-region (the honest reason DSQL/Global Tables aren't used).
11. **Vercel plan:** v0 generates the dark dashboard shell + Load Storm/Conflict Arena layouts; hand-refine the deck.gl 3D layer + SSE + optimistic green/red. Fluid Compute. RSC fetches initial skymap from DynamoDB. Live updates via SSE Route Handler. Published URL + Team ID; demo on the deployed URL.
12. **AWS DB plan:** Single table `SkyClaim`, on-demand (*"on-demand because airspace traffic is spiky, not provisioned"*), Streams + TTL at creation, GSI1+GSI2, Streams→Lambda for the aggregate + SSE. Least-privilege IAM via OIDC. Seed 1–3M synthetic items. **k6** firing thousands of conditional claims/sec incl. a deliberately contended corridor → capture the k6 summary + a CloudWatch screenshot (WCU climbing, p99 flat) — these two are the credibility core. Signature-feature checklist: conditional writes (exactly-one-winner), Streams materialized view, TTL expiry — all on screen.
13. **Demo script (150s):** `0:00–0:18` cold open on the live URL: dark 3D skymap, ~1.2M-claims odometer, p99 "6ms"; *"live air-traffic control for the sub-400ft drone economy."* `0:18–0:33` hover a voxel; *"airspace is a finite, time-sliced resource — double-booking it is physically impossible, and the database is the reason."* `0:33–1:03` **money shot** — Conflict Arena, two operators, same voxel, tap both → green/red in <1s; *"one conditional write with attribute_not_exists; exactly one winner, rejected at the database, not by app logic that could race."* Point at "oversells: 0." `1:03–1:38` Load Storm — CloudWatch WCU into the thousands, p99 flat; cut to k6 summary; *"Aurora would deadlock on these rows; DSQL would retry-storm them."* `1:38–2:08` corridor drawer (one Query, no joins) + time-travel scrubber. `2:08–2:30` architecture + access-pattern page; *"we didn't pick DynamoDB from a dropdown — it's the only one of the three that makes this correct AND flat under load."* End card: URL + Team ID.
14. **Build first:** (1) DynamoDB table + `/api/claim` conditional-write path (200/409) — prove exactly-one-winner with two curl calls before any UI. (2) Conflict Arena (two buttons, green/red) — the money shot, plain shadcn before the 3D map. (3) k6 + CloudWatch screenshots + zero-oversell — capture early. (4) Streams→Lambda→SSE + basic map. (5) deck.gl 3D + scrubber + architecture page. Seed 1–3M rows in parallel.
15. **Cut if scope bites:** Cut 3D deck.gl → 2D top-down geohash grid with altitude tabs (conflict + flatness survive). Cut the time-travel scrubber. Cut live CloudWatch streaming → captured screenshot + k6 summary. Cut SSE fan-out → 1s poll (but NOT the conflict moment — keep it instant via the direct 200/409). **Never cut:** the conditional-write path, the green/red Arena, the zero-oversell counter, the k6+CloudWatch evidence, the single-table/7-access-pattern diagram, URL + Team ID.
16. **Beats competitors:** Swap DynamoDB out and the product literally can't guarantee deconfliction (vs. RAG's interchangeable embedding store). You show the k6 storm + CloudWatch + millions of real rows + zero oversells (vs. "scales to millions" on 12 rows). You draw the data model + name the hot-partition failure you designed around. A domain nobody else will touch → owns Originality.
17. **Biggest failure mode:** The load test under-delivers or the conflict looks faked. Mitigation: keep the claim path thin/isolated and **measure DynamoDB's own CloudWatch `SuccessfulRequestLatency`, NOT end-to-end time that includes SSE overhead** (so the flat line is the DB's honest number); run k6 externally so it can't starve the demo; show the actual 409 in the network panel and let a judge tap the buttons. Secondary: cold starts → Fluid Compute + (no connection pool to exhaust, unlike Aurora). Tertiary: the 1–3M seed not finishing → start it day one.
18. **Production-grade:** Instant tactile green/red (optimistic fire → reconcile to 200/409 + a "HELD by FLIGHT#A3 — rerouting" toast). Pinned evidence HUD (mono font for p99, animated odometer). Intentional empty states ("airspace clear"). Dark ops-console aesthetic (Flightradar24/NASA cues). Show the real single Query trace in the corridor drawer. Put the access-pattern table in the product. Domain-fluent copy ("voxel", "deconfliction", "BVLOS").

---

### #4 — HOURBANK *(Aurora PostgreSQL · Monetizable B2C / Open Innovation)*

1. **Final name:** HourBank (concept: "Second Brain Market")
2. **Track:** Monetizable B2C (primary; persona is an individual community member, monetization = premium matching / org subscription), Open Innovation as the "novel currency" tag.
3. **Prize strategy:** Cash via **Technological Implementation + Originality**, credible on the AWS axis by making Aurora the protagonist. Sidestep both field failure modes by picking the ONE workload where exactly Aurora PG is correct (pgvector ANN + relational JOIN + SERIALIZABLE double-entry in one engine) and putting the DB's two hardest properties on screen as clickable evidence. Lead with the kill-shot; architecture diagram = the DATA MODEL; AWS screenshot = a real `EXPLAIN ANALYZE` with the HNSW node + a CHECK-constraint rejection in pg logs (not just an RDS console shot). Avoid RAG entirely.
4. **DB choice:** Aurora PostgreSQL Serverless v2, pgvector 0.8.0 (HNSW), via RDS Proxy + OIDC-keyless STS.
5. **DB load-bearing:** Two hard properties in ONE engine. (1) MATCHING — a free-text need becomes a query embedding running a pgvector HNSW ANN (`ORDER BY embedding <=> :q`) JOINed in the SAME SQL against availability + reputation + timezone filters. (2) MONEY — every accepted favor is a double-entry transfer as a SERIALIZABLE transaction with `CHECK(balance >= 0)` so you provably can't spend hours you don't have, even under double-click or concurrent bookings. Dynamo: no vectors, no ad-hoc match, can't enforce non-negative double-entry. DSQL: no pgvector, no constraint/trigger ecosystem, and single-region correctness means its one unique property buys nothing.
6. **Core loop:** Type a need in plain English → server embeds + runs ONE Aurora SQL (HNSW ANN + 3-table JOIN + filters) → ranked human matches stream with a similarity badge + availability chip → propose N hours → on accept, a SERIALIZABLE transaction debits requester + credits helper (balanced double-entry, gated by `CHECK(balance>=0)`); the Ledger panel animates both balances, system total pinned at zero → both confirm completion → reputation event feeds future ranking. Every turn touches BOTH superpowers.
7. **Persona:** A member of a bounded community (5,000-person alumni network, big OSS org, city mutual-aid, internal company skills marketplace). "Maya," a backend engineer with 6 banked hours, needs 2 hours of Rust help; wants to type a need, see ranked people who can actually help and are free, spend earned hours, and trust she can't overdraft. Community admin = the buyer; Maya's surface = the lovable demo.
8. **Key screens:** (a) **Command Palette / Match** (hero) — cmdk input; ranked human cards with similarity badge (0.91), availability chip, rep stars, timezone; a "Show the query" drawer revealing the actual pgvector+JOIN SQL + `EXPLAIN ANALYZE` with the HNSW node highlighted. (b) **Ledger panel** — double-entry T-account, running system total pinned at 0.00h with a green "reconciled" check, animated counters. (c) **Booking/Offer modal** — projected balance; an overdraft attempt flips Confirm into a hard rejection surfacing the actual `CHECK` error. (d) **Profile/Skills** (the NL bio that becomes the embedding). (e) **Activity/Audit timeline** (append-only, each row → its debit/credit pair).
9. **Data model (Postgres, pgvector 0.8.0):**
   ```
   members(id, name, timezone, reputation)
   accounts(id, member_id FK UNIQUE, balance_minutes int NOT NULL DEFAULT 0, CHECK(balance_minutes>=0))  -- minutes for exact integer math
   skill_profiles(id, member_id FK, bio, embedding vector(1536))  -- hnsw(embedding vector_cosine_ops) m=16 ef_construction=64
   availability(id, member_id FK, starts_at, ends_at, is_open)
   favors(id, requester_id FK, helper_id FK, requested_minutes, status CHECK in('proposed','accepted','completed','cancelled'))
   ledger_entries(id bigint identity, favor_id FK, account_id FK, delta_minutes int NOT NULL, kind CHECK in('debit','credit'), idempotency_key UNIQUE)
   reputation_events(id, member_id FK, favor_id FK, points)
   ```
   Engine-enforced invariants: `balance_minutes>=0` (CHECK), transfer runs SERIALIZABLE (concurrent bookings can't both pass the CHECK), `idempotency_key UNIQUE` (exactly-once). The match query: `SELECT m.name, sp.bio, (1 - (sp.embedding <=> $1)) AS score, a.starts_at, m.reputation FROM skill_profiles sp JOIN members m … JOIN accounts acc … LEFT JOIN availability a … WHERE m.timezone = ANY($2) ORDER BY sp.embedding <=> $1 LIMIT 10` — one query: ANN + 3-table JOIN + filter.
10. **Architecture:** Vercel/Next.js App Router (v0, refined); RSC first paint of match/ledger with real Aurora data; Command Palette Route Handler embeds the need (AI Gateway / Bedrock Titan) then runs the pgvector+JOIN, streaming cards via Suspense; mutations are Server Actions opening a single SERIALIZABLE transaction. OIDC keyless → RDS Proxy → Aurora Serverless v2; module-scope `pg Pool` + `attachDatabasePool` + `fluid:true` (kills "too many connections"). Reads uncached (fresh); ledger writes `revalidateTag('ledger')`; optimistic UI reconciles to the committed transaction. Single region (us-east-1).
11. **Vercel plan:** v0 generates the cmdk palette + streaming cards + the double-entry ledger panel with animated counters + "∑ = 0 reconciled" assertion; refine tokens/dark mode/skeletons/optimistic accept. RSC first paint; streamed Route Handler for matches; Server Actions wrapping the SERIALIZABLE transaction. Fluid Compute + `attachDatabasePool`. The "Show the query" drawer renders the REAL SQL + EXPLAIN fetched server-side — the frontend literally exposes the data model.
12. **AWS DB plan:** Aurora PG Serverless v2 (us-east-1), pgvector enabled; cluster + RDS Proxy + OIDC IAM role (`rds-db:connect`). HNSW index. **Seed ~50,000 synthetic member profiles** with realistic bios + precomputed embeddings (batch-embed offline, `COPY`) so EXPLAIN shows a real index scan, plus availability + balances. Evidence: (1) `EXPLAIN (ANALYZE, BUFFERS)` proving the HNSW Index Scan + sub-50ms match JOINed across 3 tables; (2) the pg `CHECK(balance>=0)` violation error on overdraft; (3) `SELECT SUM(delta_minutes) FROM ledger_entries = 0` (books reconcile globally). Serverless v2 ACUs scale up to build the HNSW index then down. Idempotency via `idempotency_key UNIQUE` + SERIALIZABLE; demo a concurrent double-book where one serialization-fails and retries cleanly.
13. **Demo script (155s):** `0:00–0:18` *"In a 4,000-person community, HourBank lets you spend hours you've earned — and the database makes it impossible to cheat the books or fake a match."* Live URL, Maya's 6h balance. `0:18–0:48` Command Palette: "review a Rust async lifetime bug, free this week, my timezone" → ranked cards with similarity badges; "Show the query" drawer → pgvector + 3-table JOIN + EXPLAIN, "9ms over 50,000 profiles." `0:48–1:25` overdraft rejection: Maya holds 2h, tries 5h → hard rejection surfacing the actual `CHECK(balance>=0)` error; *"a SERIALIZABLE transaction with a CHECK — the engine, not my code, refuses the overdraft."* Then book 2h correctly: ledger animates 2→0 / 4→6, system total pinned at 0.00h. `1:25–1:55` concurrency + audit: two concurrent bookings → one commits, one serialization-fails + retries; click an Activity row → the debit/credit pair; flash `SUM(delta_minutes)=0`. `1:55–2:20` architecture + why-Aurora kill-shot. `2:20–2:35` close + URL + Team ID.
14. **Build first:** The SERIALIZABLE double-entry transaction + `CHECK(balance>=0)` + `idempotency_key` FIRST (riskiest correctness claim + most defensible moment, pure SQL/Server Action). Order: (1) schema + balanced-pair transfer; prove overdraft rejection + SUM=0 in psql. (2) pgvector + HNSW + match query (seed a few hundred, then 50k). (3) v0 hero screens + RSC/Actions. (4) OIDC → RDS Proxy → Aurora with Fluid pooling. (5) the EXPLAIN drawer + concurrency double-book.
15. **Cut if scope bites:** Cut the completion/reversal + reputation loop (stub static rep). Cut the editable availability calendar (keep a chip filter). Cut the cross-community audit timeline to one clickable pair. Cut the live concurrency demo → a recorded terminal showing the serialization error. **Never cut:** the SERIALIZABLE+CHECK overdraft rejection, the pgvector+JOIN match with the EXPLAIN drawer, 50k real seed, live URL, OIDC keyless.
16. **Beats competitors:** Backend is NOT swappable (remove Aurora and both signature screens can't be expressed — proven by showing the SQL/EXPLAIN + the engine-level CHECK rejection). Don't claim user-scale we can't show — claim CORRECTNESS we can prove + 50k real embedded profiles. vs. RAG: embeddings drive a ranked human-matching query JOINed to filters, not a chat side-feature. vs. finance-tracker-that-never-transacts: the transaction IS the demo.
17. **Biggest failure mode:** The "provable" claims not actually engine-enforced — a judge double-clicks and an overdraft slips through because it was an app-code `if`, not a DB CHECK. Mitigation: non-negative balance MUST be a Postgres CHECK; transfer MUST be SERIALIZABLE with `idempotency_key UNIQUE`. Test adversarially (two parallel transfers against a 2h balance → exactly one commits, SUM=0 holds). Secondary: serverless connection exhaustion → RDS Proxy + Fluid + `attachDatabasePool`. Tertiary: embedding latency → precompute profiles offline, embed only the query string at request time.
18. **Production-grade:** Integer minutes, never floats (render as hours). The "Show the query" drawer shows REAL SQL + REAL EXPLAIN captured server-side. Pin the system total to 0.00h via a live `SUM` assertion. Seed 50k via `COPY` so EXPLAIN shows a true HNSW Index Scan; tune `ef_search`, put latency on screen. The overdraft REJECTION is a designed state, not a stack trace. Optimistic accept + `revalidateTag`. Keep all SDK/pg calls server-side. For the AWS screenshot, use the EXPLAIN-with-HNSW-node + the CHECK-violation error.

---

### #5 — SETTLEMENT FLOOR *(Aurora DSQL · Monetizable B2B / Million-scale global)*

1. **Final name:** Settlement Floor
2. **Track:** Monetizable B2B + Million-scale global (**lead B2B**; the global active-active story makes it million-scale). Parametric microinsurance is an obviously-fundable exchange, and active-active resilience doubles as the scale evidence without faking load.
3. **Prize strategy:** **Win the Aurora DSQL lane outright** rather than competing in crowded pgvector/RAG or DynamoDB-leaderboard lanes. The only submission that puts DSQL's single non-fakeable capability on screen: a strongly-consistent cross-region relational money write that rejects a double-pay at commit (SQLSTATE 40001) and survives a region kill with zero failover. Lead with the kill-shot; architecture diagram = a REGION TOPOLOGY (us-east-1 + us-west-2 peered, both writers, OCC conflict box); put a measured commit-latency number + a live "globally-consistent settlements committed" counter on screen. Earn the bonus with a build-log on the hot-row sharding redesign. **Do NOT add an AI chatbot** — it dilutes the one thing you're unbeatable at.
4. **DB choice:** Aurora DSQL (multi-region peered cluster: us-east-1 + us-west-2, both active writers, single logical database).
5. **DB load-bearing:** A parametric payout must settle EXACTLY ONCE even when two regional endpoints + a retrying oracle webhook observe the same event simultaneously and both attempt to debit one shared capital pool. DSQL's snapshot-isolation OCC runs lock-free against its region's snapshot and detects conflicts AT COMMIT — the second debit loses with SQLSTATE 40001 and retries idempotently, no 2PC stall, no failover. Kill-shot: *"DynamoDB Global Tables' last-writer-wins can double-pay a shared capital pool across regions; single-region Aurora PG cannot accept writes in two regions at once; only DSQL gives strongly-consistent active-active relational money movement."* (Honest constraint designed around: DSQL has no FK/triggers/sequences/serializable and punishes a single hot balance row — hence write-sharding.)
6. **Core loop:** A signed oracle webhook (flight delay > threshold, weather/quake) fires into the nearest regional endpoint → a Server Action opens one DSQL transaction: (1) idempotency-guard on `oracle_event_id` (lose at commit if a peer already claimed it), (2) JOIN policy→coverage_pool for matching ACTIVE policies + payout amount, (3) debit a randomly-chosen pool SHARD row (write-sharding so OCC doesn't thrash), (4) flip policy to PAID + append a ledger entry → commit succeeds in one region, strongly consistent in the peer; the duplicate hits 40001, sees the settlement exists, returns idempotently. Two tabs bound to two regions show the policy flip + capital gauge tick down in lockstep within ~1s.
7. **Persona:** Capital/treasury manager or head of claims at an MGA/reinsurer running parametric microinsurance (flight-delay, crop/weather, event-cancellation). Sells millions of low-value policies globally; nightmare = settlement integrity at scale (a retrying oracle or regional failover that double-pays or stalls). Buys provable, regulator-defensible exactly-once settlement that keeps paying through a regional outage.
8. **Key screens:** (a) **Settlement Floor** (hero, split-screen) — left us-east-1, right us-west-2, both bound to the SAME pooled capital; oracle-event ticker; policy cards flip ACTIVE→PAID; a Capital Adequacy gauge decrementing in lockstep on BOTH panes; p50/p99 commit-latency badge + a "globally-consistent settlements committed" counter. (b) **Double-Pay Courtroom** (the exhibit) — a "Fire same event into BOTH regions" button → one COMMITTED (green), one REJECTED with the literal `SQLSTATE 40001 serialization_failure (OC000)` in a code chip + a "pool never went negative" assertion. (c) **Region Kill / Resilience** — sever us-east-1 mid-storm; us-west-2 keeps settling; on reconnect us-east-1 instantly reflects everything it missed (no replay UI). (d) **Pool & Ledger drawer** — a real multi-table read proving relational work. (e) **Pool Shard heatmap** (senior-intent) — shards lighting up; an "unshard" toggle that visibly spikes the OCC 40001 retry-rate meter.
9. **Data model (DSQL — no FK/triggers/sequences/serializable; integrity in the Server Action, app-generated ULIDs):**
   ```
   coverage_pool(pool_id PK, name, total_capital numeric(18,2), reserved_exposure numeric(18,2))  -- NOT debited directly (would be the hot row)
   pool_shard(shard_id PK, pool_id, shard_index int, balance numeric(18,2))  -- WRITE-SHARDING: each pool split across N=16 shards; payout debits ONE random shard (CHECK balance>=0); solvency = SUM(balance)
   policy(policy_id PK, pool_id, trigger_type, trigger_threshold, payout_amount, region_origin, status CHECK in('ACTIVE','PAID','EXPIRED'), version)
   oracle_event(oracle_event_id PK -- the idempotency key, source, trigger_type, observed_value, fired_at)
   settlement(settlement_id PK, oracle_event_id UNIQUE -- enforces exactly-once, policy_id, pool_id, shard_id, amount, committed_region, committed_at)
   ledger_entry(entry_id PK, settlement_id, account CHECK in('POOL','PAYOUT'), direction CHECK in('DEBIT','CREDIT'), amount)  -- balanced pair nets to zero
   ```
   Retry: catch SQLSTATE 40001 → if `settlement(oracle_event_id)` exists, return it (exactly-once); else exponential-backoff retry. **Seed:** 50,000 policies across a few pools, sharded balances, an oracle_event backlog; millions of ledger rows if time allows.
10. **Architecture:** Vercel/Next.js App Router (v0, refined); two deployments/tabs each pinned to a region via env-selected DSQL endpoint; RSC first paint; mutations via Server Actions. Vercel Functions (Fluid Compute) hold a module-scope `node-postgres Pool` + `attachDatabasePool()`. OIDC-keyless STS + the DSQL auth token via `DsqlSigner` per connection — no long-lived keys. Data path: Server Action → pg Pool → DSQL regional endpoint (`BEGIN`; idempotency INSERT; policy/pool JOIN; pool_shard debit w/ CHECK; policy UPDATE; ledger INSERT; `COMMIT`) with a 40001 retry wrapper. **ONE peered DSQL cluster**, both active writers, strong consistency at commit. Real-time UI: each region pane subscribes to an SSE Route Handler (`revalidateTag` after each commit) so the peer reflects the cross-region write within ~1s. Oracle simulator: a "fire event" Route Handler (also the load generator). Screenshot: DSQL console showing two peered regions + a CloudWatch commit-latency panel.
11. **Vercel plan:** v0 generates the split-screen Settlement Floor + KPI gauge + event ticker + 40001 code-chip + heatmap grid in the first hour, then refine the dual-region binding + SSE. Fluid Compute. RSC first paint, Server Actions for the settle mutation, `<Suspense>` for the ledger drawer, `revalidateTag('settlements')` after each commit. **Two real Vercel URLs** (or one app with a region switch) — not a mocked div. Capture Team ID. Demo on the live URL.
12. **AWS DB plan:** ONE Aurora DSQL multi-region peered cluster (us-east-1 + us-west-2, both active writers, strong consistency). Schema with no FK/triggers/sequences (app-generated ULIDs, CHECK + `UNIQUE(settlement.oracle_event_id)` for exactly-once, ~16 write-sharded `pool_shard` rows/pool). Seed 50,000 policies + sharded balances + an oracle backlog (+ millions of ledger rows if time). IAM role assumable via OIDC with `dsql:DbConnect/DbConnectAdmin`; tokens via `DsqlSigner`. CloudWatch for commit latency + a custom `settlements_committed` metric. The settle wrapper MUST catch 40001 → idempotent return or backoff retry. Screenshot: DSQL console both peered regions ACTIVE + CloudWatch latency panel.
13. **Demo script (180s):** `0–15` live split-screen, two real region tabs bound to one pool; *"pays 50,000 flight-delay/weather micropolicies the instant an oracle fires — every payout a strongly-consistent cross-region ledger write that can never double-pay or read stale."* `15–45` "Start oracle storm": events rain, cards flip ACTIVE→PAID, the capital gauge decrements **in lockstep on both panes within ~1s**; p50/p99 badge + committed counter climbing; *"50,000 live policies, real capital."* `45–95` **the exhibit**: "Fire same event into BOTH regions" → one COMMITTED green, one REJECTED with the literal `SQLSTATE 40001` code chip; "pool never went negative" stays green; *"DSQL's optimistic concurrency rejects the duplicate at commit — exactly once."* `95–135` **the kill**: sever us-east-1 → that pane "endpoint unreachable", us-west-2 KEEPS paying, counter keeps climbing; reconnect → us-east-1 instantly shows every missed settlement; *"no failover, no data loss, no stale read."* `135–165` cut to the DSQL console (two peered regions ACTIVE + CloudWatch) + the pool-shard heatmap with the "unshard" toggle spiking the retry meter. `165–180` region-topology diagram + kill-shot.
14. **Build first:** The exactly-once settle transaction against a real two-region DSQL cluster FIRST — nothing else matters if this doesn't work. (1) Provision the peered cluster + schema with `UNIQUE(oracle_event_id)` + write-sharded `pool_shard`. (2) The settle Server Action (idempotency INSERT, JOIN, shard debit w/ CHECK, policy UPDATE, ledger INSERT, COMMIT, 40001 catch-and-idempotent-return). (3) **Prove the double-pay race in a script** (fire same `oracle_event_id` at both endpoints concurrently → one commits, one 40001, pool solvent). THAT proof is the submission's spine. Only then: the v0 split-screen, SSE sync, gauge, 40001 chip.
15. **Cut if scope bites:** Cut the pool-shard heatmap interactive grid (keep sharding in the backend; narrate over the architecture slide). Cut the cron oracle simulator → a manual "fire event" button. Cut two deployments → one app with a region-toggle opening two panes against two endpoints. Cut the streaming ledger drawer's Suspense → a static JOIN read on click. **Never cut:** the live two-region split-screen, the 40001 double-pay rejection, the region-kill continuity, the on-screen latency/committed counter, the DSQL console screenshot.
16. **Beats competitors:** vs. the dominant field (RAG, leaderboards, CRUD): their DB is interchangeable and their hard problem invisible; here the DB is non-substitutable and the hard problem (exactly-once cross-region settlement) is the on-screen exhibit. vs. other DSQL teams: most deploy ONE region and claim active-active with no cross-region write, or claim sub-ms latency with no measurement; you stage the real double-pay race (40001) AND a live region kill — the two things you cannot fake without a genuine peered cluster — plus a measured latency badge. The judge-memory hook: *"the app where you watched a double-pay get rejected and a region die without missing a payment."*
17. **Biggest failure mode:** The hot-row OCC death spiral — AWS's own docs warn DSQL punishes "high-frequency account balance updates." A single shared `coverage_pool` balance row every payout decrements is exactly that anti-pattern; under a storm every settlement conflicts on that row → a blizzard of 40001 retries → collapsed throughput (a knowledgeable judge WILL ask). The design defeats it by **write-sharding the pool into N balance rows** (each payout debits one random shard; solvency = SUM). Turn the failure into a feature: the heatmap + "unshard to watch the retry meter spike." Secondary: serverless connection storms → Fluid + `attachDatabasePool`; missing FK/serializable → integrity in the Server Action + `UNIQUE(oracle_event_id)` + 40001 idempotency + ULIDs; the 10k-row/3k-mod/10MiB txn limit → each settlement touches a handful of rows (don't batch thousands into one txn).
18. **Production-grade:** Put the literal `SQLSTATE 40001 serialization_failure` in a monospace code chip + the measured p50/p99 commit latency as a live badge. Dual-region must be REAL (two genuine endpoints, region labels, gauge moving in lockstep within ~1s — never a `setInterval`). Polish the v0 states (optimistic card flip, skeletons, "pool never went negative" assertion, relative timestamps, dark mode, animated counters). Seed real volume. Ship the required artifacts (region-topology diagram, DSQL console + CloudWatch screenshot, Vercel URL + Team ID — missing any auto-deflates). Demo only on the live URL; keep functions warm.

---

## PHASE 6 — RECOMMENDATION

**No hedging. Here's the call.**

### The single best route → BUILD RECALL
**Recall — The Outbreak Console (Aurora PostgreSQL, Monetizable B2B).** It topped every panel (composite 9.23; AWS-DB-fit 10, Tech 10, Usefulness 9.7). It is the rare idea that is simultaneously highest-ceiling AND lower-risk than its rivals:
- **The DB is genuinely non-interchangeable** and you can prove it in one verified sentence (no recursion/joins in Dynamo; no PostGIS/extensions in DSQL). It fuses recursion + geospatial + vector in one statement — a thing no other entrant's stack can do.
- **It dodges both field failure modes at once:** the UI is a thesis about the data (graph = recursion, map = spatial join, rail = vector), and you show evidence (live EXPLAIN, 250k-edge row count, measured latency, CloudWatch ACU) instead of claims.
- **Single-region** → it avoids the #1 execution risk that haunts the DSQL ideas (standing up a real peered two-region cluster + OCC retry path under deadline pressure).
- **A named, dated, mandated, budgeted buyer** (FSMA 204, 24-hour FDA SLA, enforcement July 2028) — Impact & Applicability has a real number, not a hypothetical.
- The only real risk (a quadratic/cycling recursive CTE) is fully mitigable in build step 2, before any UI.

### The safest backup → PROVENANCE
**Provenance (DynamoDB, B2B/Open Innovation).** If Aurora connection/plumbing fights you, or you want a second submission, this is the most robust build in the set: DynamoDB has **no connection pool to exhaust** (the single most common Vercel+Aurora demo-killer), it's single-region, the hot category (agent observability) gives it instant relevance, and the demo (scrub an agent's life, watch it rewind from a raw log) is unforgettable and hard to fake. It shares almost zero infrastructure with Recall and targets a different DB + different judge rubric — making it the ideal *second* entry if you go multi-submission.

### The highest-ceiling risky route → SETTLEMENT FLOOR
**Settlement Floor (Aurora DSQL, B2B/global).** The most viscerally unforgettable demo in the entire set — *"watch a double-pay get rejected and a region die without missing a payment."* DSQL is the least-contested lane (most DSQL entrants will fake active-active with one region), so a real peered cluster + the 40001 rejection + the region-kill is near-uncontestable. **But** it's all-or-nothing: the entire submission rests on standing up two genuine peered regions, the OCC retry wrapper, and the write-sharded hot-row redesign. If those land, it can win the global track outright. Only attempt as a flagship with dedicated DSQL plumbing time — never as a side project.

### The verdicts you asked for
- **Best track to target:** **Monetizable B2B.** Best odds (DB is naturally load-bearing, less crowded, instant real-world + monetization read), and all three of Recall/Provenance/Settlement Floor are B2B-primary with strong cross-tags. Avoid B2C as a primary (most crowded, lowest odds).
- **Which segment has the best odds:** **B2B**, with **Open Innovation as the cross-tag/safety-net** (Originality is an explicit criterion and a UTM/recall/agent-forensics domain owns it). Million-scale is the highest ceiling but the strictest win condition (you must SHOW scale).
- **One submission or multiple:** **Build ONE flagship (Recall) to absolute production-grade.** *If and only if* credits land in time and you have a second builder, ship a SECOND in a different track + different DB — **Provenance (DynamoDB, Open Innovation)** — because they share no infra and hit different rubrics, multiplying prize surface without diluting quality. Do **not** attempt 3+, and do **not** make the DSQL idea your "easy second."
- **Which database to use, and why:** **Aurora PostgreSQL** for the flagship — it is the most load-bearing-able engine here (recursion + geo + vector + transactional correctness in one query), it lets the UI BE the query, and it sidesteps the RAG-chatbot trap that will swallow the field. **DynamoDB** is the strong #2 (event-sourcing/scale demos are the most legible "designed for scale" evidence and the most demo-robust). **DSQL** only if you commit to the two-region plumbing — its payoff is the highest but so is its failure surface.

**Bottom line:** Build **Recall** as the flagship (Aurora PostgreSQL, B2B). Hold **Provenance** (DynamoDB) as the robust second submission if resources allow. Treat **Settlement Floor** (DSQL) as the swing-for-the-fences option only if you have dedicated DSQL setup time.

---

## PHASE 7 — QUESTIONS FOR YOU

*(Strong assumptions made and labeled below; the deliverable does not depend on answers.)*

### Must-answer (materially changes the route)
1. **Team size & DSQL appetite.** How many builders, and is anyone comfortable standing up a real two-region Aurora DSQL peered cluster + OCC retry plumbing? *If yes and you want the highest ceiling → Settlement Floor becomes viable as flagship. If solo/uncertain → Recall, no question.*
2. **One submission or two?** Are multiple project submissions allowed/desired, and do you have a second builder? *This decides whether we also build Provenance. (Assumption: rules allow multiple; we default to ONE flagship unless you confirm bandwidth for two.)*
3. **Credit/timing reality.** When do AWS + v0 credits actually land, and is the 2026-06-30 deadline firm for you? *Recall needs Aurora Serverless v2 + Bedrock embeddings; Settlement Floor needs two DSQL regions. If credits are very late, we bias toward the DB with the least setup (DynamoDB → Provenance) as flagship.*

### Nice-to-answer (sharpens execution, not direction)
4. **Domain access/credibility:** any connection to food-safety/grocery (Recall), insurance/treasury (Settlement Floor), or AI-agent-ops (Provenance)? A real design partner or realistic data shape strengthens Impact and the demo.
5. **Build-in-public bandwidth** for the bonus points (one annotated data-model post + a 60–90s clip)? Cheap points top contenders will claim.
6. **Aesthetic preference** for the flagship: data-dense control-room (Recall/Sky Claim/Settlement Floor) vs. cleaner consumer product (HourBank)? Affects the v0 prompt direction.
7. **AI usage stance:** comfortable using Bedrock/AI Gateway for embeddings (Recall/HourBank need real embeddings)? Assumed yes.

### Assumptions I'm running with (override any of these)
- **A1:** We optimize for *winning a prize*, not shipping a startup — so demo legibility + DB-as-protagonist beat feature breadth.
- **A2:** Time and building ability are not constraints (per your brief); the binding constraint is credits/setup risk, which is why single-region Aurora (Recall) is favored over two-region DSQL.
- **A3:** Multiple submissions are permitted; quality-per-submission still dominates, so we cap at two.
- **A4:** "Production-grade feel" (real volume, live URL, measured latency, required artifacts) is worth more than any extra feature.
- **A5:** B2B is the target segment; Open Innovation is the cross-tag for Originality.
