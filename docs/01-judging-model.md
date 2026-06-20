# 01 · The Judging Model — What Actually Wins H0

**Purpose:** Decode how H0 ("Hack the Zero Stack") is really judged so every build decision — idea, database, signature screen, demo, bonus — is made against the criteria that move the needle, not the ones that just look busy.

> **Last updated / source:** Built from the H0 ideation workflow (22-agent orchestration: judging-model grounding → 47 raw ideas → 32 curated → 3 independent judge panels × 10 dimensions → top-5 deep dives). Canonical master: [`../IDEATION.md`](../IDEATION.md), Phase 1. Supplementary grounding: `/tmp/h0_judging.json`.

---

## Table of contents

- [The hackathon in one paragraph](#the-hackathon-in-one-paragraph)
- [The one thesis that wins](#the-one-thesis-that-wins)
- [What the AWS-database judges reward](#what-the-aws-database-judges-reward)
- [What the Vercel / v0 judges reward](#what-the-vercel--v0-judges-reward)
- [The two failure modes that sink ~70% of the field](#the-two-failure-modes-that-sink-70-of-the-field)
- [How to make the database obviously intentional (7 tactics)](#how-to-make-the-database-obviously-intentional-7-tactics)
- [How to make the frontend feel designed around the backend](#how-to-make-the-frontend-feel-designed-around-the-backend)
- [Track odds](#track-odds)
- [Bonus strategy](#bonus-strategy)
- [The single sharpest insight](#the-single-sharpest-insight)
- [How to use this when choosing](#how-to-use-this-when-choosing)

---

## The hackathon in one paragraph

Four official judging criteria, all weighted equally on paper: **Technological Implementation, Design, Impact & Real-world Applicability, Originality.** The core requirement is binary and load-bearing: a full-stack app on **Vercel / v0.app** for the frontend, plus **exactly one** of **Amazon Aurora PostgreSQL · Amazon Aurora DSQL · DynamoDB** for data. The theme — *"Front-end in minutes. Back-end designed for scale."* — is not decoration; it is the rubric. The judges are split into two implicit panels: AWS solutions-architect-minded reviewers who score whether the database is *correct and load-bearing*, and Vercel/design-minded reviewers who score whether the frontend *visibly used v0/Vercel and exposes the data model*. With 6,000+ entrants and $160k on the line, the realistic competition is the top ~1% — and almost everyone in that 1% will have a working app. You separate by being the one team whose database is obviously the protagonist and whose UI is its proof.

---

## The one thesis that wins

> **Make the database the protagonist and the frontend its courtroom evidence.** The 6,000-entrant field splits into two failure modes — (1) pretty v0 apps with interchangeable backends, and (2) "scales to millions" claims with no proof. You win by picking ONE workload where exactly one of the three AWS databases is *correct* (and you can say in a single sentence why the other two are wrong), then building one signature screen that makes that DB's hard property **visible and clickable on the live URL**, with real volume and a measured latency number on screen. Don't pitch features; pitch a data model, and let the UI prove it.

Everything below is a corollary of this thesis. If a build decision doesn't make the database more obviously the protagonist or the UI more obviously its evidence, it is probably not worth the deadline-hours.

---

## What the AWS-database judges reward

These judges have read "scales to millions" a thousand times. They reward signals that you understand the *engine*, not that you found it in a dropdown.

- **Access-pattern-first design.** A DynamoDB entry that shows its single-table design with named GSIs and a literal `access-pattern → PK/SK/GSI` table reads as someone who designed for the engine. For Aurora, the equivalent is an ER diagram annotated with the exact JOINs your queries run.
- **Choosing the DB for the property only it has — and proving you needed it.** Aurora PG for real JOINs + transactional correctness + pgvector in *one* query; DSQL for multi-region active-active strong consistency with *no failover*; DynamoDB for predictable single-digit-ms at high, spiky write volume. The win is when the workload genuinely *breaks* the other two options.
- **Visible scale/latency evidence over claims.** p50/p99 numbers, a k6/Artillery load-test screenshot, CloudWatch RCU/WCU or ACU graphs, row counts in the millions. They reward the team that *shows the graph*. (Numbers you state are **targets to measure**, not facts to assert.)
- **Correct use of the engine's signature feature in the demo's critical path, visibly:**
  - Aurora — a recursive CTE, a window function, an HNSW pgvector ANN search, or a `SERIALIZABLE` transaction blocking a real double-spend.
  - DSQL — a cross-region write that appears consistently in a second region, plus an OCC conflict (`SQLSTATE 40001`) rejected at commit.
  - DynamoDB — Streams driving a materialized view, a conditional write rejecting a duplicate, TTL expiring ephemeral state.
- **Honest modeling of the hard part.** Idempotency keys, optimistic locking / conditional writes, hot-partition avoidance (write-sharding), eventual-vs-strong consistency tradeoffs — named out loud. Naming the failure mode you designed around signals senior intent.
- **A schema/data-model artifact.** The required architecture diagram is a *gift*: most teams draw boxes, the winner draws the data model — an ER diagram (Aurora), a single-table item-collection diagram (DynamoDB), or a region topology (DSQL).
- **Cost/operational reasoning tied to the workload.** "DSQL so we get multi-region strong consistency without running our own Postgres failover." "DynamoDB on-demand because writes are spiky." "Aurora Serverless v2 scaling to fit between bursts." Signals an engineering decision, not a sponsor checkbox.
- **Clean AWS plumbing.** OIDC keyless auth, RDS Proxy (Aurora), Secrets Manager, Streams→Lambda, IAM-scoped SDK access (DSQL/Dynamo). A coherent end-to-end data path beats an isolated clever trick.

> See [`reference/aws-databases.md`](./reference/aws-databases.md) for per-engine superpowers, the "which DB is wrong and why" one-liners, and the exact console screenshots to capture as proof.

---

## What the Vercel / v0 judges reward

These judges score whether you used the platform *as intended* and whether the interface is a thesis about the data.

- **A genuinely v0-generated UI, then refined.** App Router, Server Components / Server Actions, streaming/Suspense — with a **published project link + Team ID that actually resolves.** On-theme = "front-end in minutes."
- **A UI that exposes the data model, not generic CRUD.** The screen makes the backend's hard problem *legible*: a reconciling ledger, a relevance-ranked semantic search, a live leaderboard that is obviously real-time, a multi-region status panel. Design judges reward "I can see what the database is doing."
- **Real product polish refined beyond the v0 default.** Consistent design system (shadcn/Tailwind), empty/loading/error/success states, optimistic UI on mutations, responsive layout, tasteful dark mode, micro-interactions. The bar above the v0 baseline is high.
- **Streaming / real-time behavior matched to the DB story.** SSE off Streams, read-your-writes for strong consistency, optimistic + reconcile for eventual. The frontend should make the latency/consistency claims *tangible*.
- **Server-side data fetching that respects the backend.** Fetch in Server Components / Route Handlers (no leaked DB creds), AWS creds in env vars, caching that mirrors the consistency model — `no-store` for strongly-consistent reads, `revalidateTag` after writes. Judges notice when the rendering strategy matches the data freshness need.
- **A crisp demo on the LIVE URL — never localhost.** Judges click the deployed Vercel link and it works with real data, not a mocked screen or a heavily-cut video hiding that it doesn't run end-to-end.
- **Originality of the interface itself.** An interaction only this data model enables — a time-travel slider over event history, a drill-down from aggregate to underlying rows, a partition-activity heatmap, a what-if that re-runs a query live. Originality points come from interfaces that are *a thesis about the schema*.

> See [`reference/vercel-v0-playbook.md`](./reference/vercel-v0-playbook.md) for the OIDC keyless setup, Fluid Compute pooling, RSC/Server-Action patterns, and the pitfalls that get demos disqualified.

---

## The two failure modes that sink ~70% of the field

Roughly seven in ten serious-looking submissions die to one of these. Building *away* from them is half the battle.

### Failure Mode 1 — Common / weak (interchangeable backend)

The DB is "where rows live"; swap it for any of the other two (or for SQLite) and nothing changes. Do not resemble these:

- **AI "chat with your docs" RAG** where pgvector is just an embedding store. *The single most common submission, near-impossible to win — the DB is interchangeable and the access pattern is trivial.*
- **Generic SaaS dashboard / admin CRUD / todo / notes / task tracker.** DB is "where users live." Fails the load-bearing test outright.
- **v0 landing-page-plus-form** with a thin backend; pretty for 10 seconds, evaporates the moment a judge clicks around.
- **E-commerce / marketplace MVP** with a products table, claiming "scales to millions" on 12 seed rows.
- **Twitter / social-feed clone on DynamoDB** "because a blog said so," with no fan-out, hot-key, or timeline-materialization thought.
- **Finance / expense tracker on Aurora** that never runs a transaction, constraint, JOIN, or isolation level that matters — just `SELECT * FROM expenses`.
- **"Real-time" app that is actually polling one table** every few seconds, with no consistency or concurrency design.

> **Kill-shot test:** If you can't say in one sentence why the *other two* AWS databases are the wrong tool, you are in Failure Mode 1 — even if your app works perfectly.

### Failure Mode 2 — Looks fake / over-scoped (instant credibility killers)

The claim outruns the evidence. A DB-literate judge asks one question and you have nothing:

- **"Scales to millions"** with a dozen seed rows and no load test. The gap between claim and evidence is the fastest credibility killer.
- **Multi-region / active-active claims** (DSQL) with a single-region deployment and no cross-region write or region-failure scenario shown.
- **Sub-ms / single-digit-ms latency claims** with no measurement, no p99, no CloudWatch graph — marketing copy lifted from AWS docs.
- **"The OS for X" / "replaces Stripe + Plaid + Salesforce"** backed by one CRUD screen and a half-working demo.
- **Demo video that never shows the deployed URL, real data, or the database** — heavy cuts hiding that it doesn't run end to end.
- **Architecture diagram with Kafka / Redis / 5 microservices / an ML pipeline** that appear nowhere in the repo or demo. Diagram-driven fiction.
- **"pgvector-powered semantic AI"** where embeddings are precomputed for 5 docs and search is a `LIKE` query in disguise.
- **Financial-correctness claims** with no transactions, no idempotency, no reconciliation — a ledger that can't survive a double-click.
- **Feature list far exceeding two people by the deadline,** most features non-functional behind disabled buttons. Breadth over a working core.
- **Missing required artifacts** (Team ID, dual-tier architecture diagram, AWS-DB-usage screenshot) — **auto-deflated regardless of code quality.** See [`reference/submission-checklist.md`](./reference/submission-checklist.md).

---

## How to make the database obviously intentional (7 tactics)

These convert "I used DynamoDB" into "I chose DynamoDB and here is why nothing else works." Apply all seven; each is cheap and each one is a point.

1. **State access patterns first, derive the schema, and put the derivation in the submission.** DynamoDB: a literal `(access pattern → PK/SK or GSI)` table. Aurora: an ER diagram annotated with the JOINs your queries actually run. This makes the choice look *reasoned*, not assigned.
2. **Pick the workload so the other two DBs are wrong — and say why in one sentence each.**
   - *Aurora PG:* "needs multi-row ACID + JOINs + pgvector in one query — Dynamo can't JOIN, DSQL has no pgvector/extensions."
   - *DSQL:* "needs strongly-consistent writes in 2+ regions with no failover ops — Aurora needs a primary, Dynamo Global Tables are eventually consistent and would double-write."
   - *DynamoDB:* "needs predictable single-digit-ms at high spiky write volume — Aurora's connection limits and DSQL's OCC retries hurt here."
3. **Use the signature feature in the demo's critical path, visibly.** An HNSW pgvector ANN query returning ranked results on screen; a `SERIALIZABLE` transaction blocking a double-spend you trigger live; a Dynamo conditional write rejecting a duplicate; a DSQL write appearing consistently in a second region.
4. **Show data at volume.** Seed 1M+ rows (cheap to generate) so queries are non-trivial, and put the **row count + a query latency** on screen. Volume converts "toy" into "real."
5. **Design around the named hard problem and surface it.** Idempotency keys (payments), write-sharding (hot partitions), OCC retry (DSQL), TTL (ephemeral state). Add a **one-line caption in the demo when it fires** ("double-tap deduped by idempotency key").
6. **Wire the right AWS plumbing and screenshot real activity.** RDS Proxy + Secrets Manager + IAM/OIDC (Aurora); IAM-scoped SDK (DSQL/Dynamo); Streams→Lambda for derived views. The required DB-usage screenshot should show the console with **real activity** (item counts in the millions, query metrics, an `EXPLAIN` plan, a CloudWatch graph) — never an empty table.
7. **Let the consistency model show up in the product.** Strong consistency → demonstrate read-your-writes immediately after a mutation. Eventual → an honest UI (optimistic update + visible reconcile). Matching UX to the consistency story is the clearest proof the choice was intentional.

---

## How to make the frontend feel designed around the backend

The interface should be *unintelligible without the backend*. Generic CRUD would look identical on any DB; a signature screen would be impossible on the wrong one.

- **Build at least one signature screen whose entire reason to exist is to render the DB's hard property.** A live-reconciling ledger (Aurora transactions), a relevance-ranked semantic search panel (pgvector), a real-time leaderboard/feed that updates as writes land (DynamoDB throughput), or a multi-region write/echo panel (DSQL). Strip the backend and the screen makes no sense.
- **Make freshness visible and matched to the consistency model.** Timestamps, "updated just now," optimistic-then-reconcile for eventual consistency, instant read-your-writes for strong. The UI should *teach the judge* which consistency guarantee they're looking at.
- **Render the relationships, not just the rows.** If you chose Aurora for JOINs, show joined/aggregated data (a customer with their orders and computed lifetime value) — not three separate tables. The screen *is* the proof the JOIN matters.
- **Expose volume and performance in the interface.** A row/item counter ("searching 2.3M records"), a query-latency badge ("p99 18ms"), pagination/infinite scroll obviously hitting real data. This turns backend claims into frontend evidence.
- **Use Server Components / Server Actions / Route Handlers so rendering mirrors the data.** Streaming for long queries, cached+revalidated for read-heavy pages, `no-store` for strongly-consistent reads. The rendering choices should *echo* the DB design.
- **Add one interaction only this data model enables.** A time-travel slider over event history, a drill-down from aggregate to underlying rows, a what-if that re-runs the query live. This is where the Originality criterion is won.
- **Keep the design system tight and ship real states** (loading skeletons, empty, error, success) so the polish reads as deliberate product work refined beyond v0's default — not a raw generation.

> See [`reference/vercel-v0-playbook.md`](./reference/vercel-v0-playbook.md) for the concrete RSC/Server-Action/SSE patterns that implement each of these.

---

## Track odds

Track choice is a positioning decision, not a category label. Pick the track where your data model is *naturally* load-bearing and the field is *thinnest*.

| Track | Odds | Reasoning |
|---|---|---|
| **Monetizable B2B** | **Best — recommended target** | B2B workloads make the DB load-bearing almost by default: multi-tenant isolation, audit/event history, billing & usage metering with financial correctness, RBAC, reporting that needs real JOINs or high-write event ingestion. Aurora (transactional + reporting + pgvector doc search) and DynamoDB (high-write usage/event streams) have obvious, defensible roles. Impact & monetization read *instantly*. And the field is **less crowded** — B2B is "less fun" to build, so a serious one stands out. |
| **Million-scale global** | High ceiling / high risk | The only track that *directly* rewards DSQL multi-region strong consistency and DynamoDB latency-at-scale, so the DB story is most naturally load-bearing here. Can win overall **if you SHOW scale** (load test, latency graphs, real multi-region). But it is the easiest track to fake — most entrants assert scale with no evidence and get deflated. Win condition is strict: show it, don't claim it. |
| **Open innovation** | Wildcard / originality magnet | Highest variance. Originality is an explicit criterion and a novel data model (event-sourcing with time travel, a recursive-CTE relationship graph) can top the leaderboard without needing a business model. But it is also where vague art-projects pile up. Strong for a technically sharp, conceptually distinct entry; weak as a hiding place for an unfinished idea. |
| **Monetizable B2C** | Most crowded / lowest odds | Largest submission volume + highest concentration of weak archetypes (AI chatbots, social clones, e-commerce MVPs, finance trackers) where the DB is interchangeable. v0 polish is *table stakes*, so it won't carry you. Winnable only with a genuinely novel consumer mechanic whose data model **is** the product, plus real backend rigor — a high bar against a flood of lookalikes. |

> **Recommended target:** Lead **Monetizable B2B**, cross-tag a second track where eligible (e.g. Open Innovation for a public-good angle). The flagship recommendation — Recall, the Outbreak Console on Aurora PostgreSQL — leads B2B precisely because a named, dated, budgeted buyer (FSMA-204) reads as Impact instantly while the recursive-CTE + PostGIS + pgvector single statement reads as Tech + Originality. See [`05-recommendation.md`](./05-recommendation.md).

---

## Bonus strategy

The optional public build content is **near-free points that top contenders will claim**, so skipping it is a *relative* penalty against the 1% you're competing with. Treat it as a tiebreaker amplifier, not a foundation.

- **Produce ONE substantive, evidence-rich artifact**, not five shallow posts. An annotated architecture / data-model post titled around the load-bearing decision — e.g. *"Why we modeled our usage-metering on DynamoDB single-table design"* or *"Read-your-writes across regions with Aurora DSQL."*
- **Make the content double as judge evidence.** Embed the access-pattern table, the ER / single-table diagram, the load-test graph, and the pgvector/transaction code snippet. Judges often read the linked content, so this *also* reinforces the Technological Implementation score.
- **Lead with the v0 + AWS angle and echo the tagline** — *"front-end in minutes, back-end designed for scale."* On-theme, sponsor-friendly content is more likely to be amplified, which compounds visibility.
- **Cheapest high-value formats:** one annotated architecture/data-model post + one 60–90s clip of the signature screen hitting its latency/consistency moment + the public Vercel link itself.
- **Sequence it last.** Invest only **after** the working core, the load-bearing DB proof, and the required artifacts (Team ID, dual-tier diagram, DB screenshot, sub-3-min demo) are solid. Polished build content on a hollow app reads as marketing and *hurts* credibility.

---

## The single sharpest insight

> **Win by making the database the protagonist and the frontend its courtroom evidence.** The entire field splits into two failure modes — pretty v0 apps with interchangeable backends, and "scales to millions" claims with no proof. So victory comes from picking ONE workload where exactly one of the three AWS databases is *correct* (and you can say in a sentence why the other two fail), then building a single signature screen that makes that database's hard property **visible and clickable on the live URL** — a transaction blocking a double-spend, a pgvector relevance ranking, a real-time write landing, a strongly-consistent cross-region read — with real volume and a measured latency number on screen. **Don't pitch features; pitch a data model, and let the UI prove it.**

---

## How to use this when choosing

Run every candidate idea through this model *before* you fall in love with it:

1. **The kill-shot test (Failure Mode 1):** Can you name, in one sentence each, why the other two DBs are wrong? No → cut it.
2. **The evidence test (Failure Mode 2):** Can you *show* — at volume, with a measured number and a console screenshot — every claim you'll make? No → narrow the claim until you can.
3. **The signature-screen test:** Is there one screen that is impossible on the wrong DB? No → it's CRUD.
4. **The track test:** Is the DB naturally load-bearing in this track, and is the field thin? Prefer B2B; treat Million-scale as high-risk and B2C as a flood.

Then take the survivors to the scoring matrix and the recommendation:

- **[`04-scoring-matrix.md`](./04-scoring-matrix.md)** — the full 32-concept matrix, the composite-weighting methodology (risk-adjusted-win 0.45 / demo-clarity 0.20 / AWS-DB-fit 0.15 / originality 0.10 / overall 0.10), and the harsh kill rationales for everything below the line.
- **[`05-recommendation.md`](./05-recommendation.md)** — the decision tree, the per-scenario calls (team strength, time budget, risk appetite), and the single flagship pick.
