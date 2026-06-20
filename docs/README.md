# H0 Ideation & Build Docs — Index & Navigation

**Purpose:** The single entry point to the full H0 ideation/build doc set — what to build, why it wins, and where every supporting artifact lives. Start here, then follow a reading order below.

*Last updated: 2026-06-18 · Source: the H0 ideation workflow (22-agent ideation + 15-agent docs build) over [`../IDEATION.md`](../IDEATION.md), the authoritative master doc.*

---

## Table of Contents

- [TL;DR — the recommendation](#tldr--the-recommendation)
- [The winning thesis (one paragraph)](#the-winning-thesis-one-paragraph)
- [The doc array (every file + link)](#the-doc-array-every-file--link)
- [Reading orders](#reading-orders)
- [Hackathon facts box](#hackathon-facts-box)
- [How this set was produced](#how-this-set-was-produced)

---

## TL;DR — the recommendation

> **Build Recall on Aurora PostgreSQL as the flagship.** It topped every judge panel (composite **9.23**; AWS-DB-fit 10, Tech 10, Usefulness 9.7), is genuinely highest-ceiling *and* lower-risk than its rivals, and dodges both field failure modes at once.

- **Flagship → Recall (Aurora PostgreSQL, Monetizable B2B).** A live recall-tracing console: one SERIALIZABLE recursive-CTE walks an FK-constrained supply DAG, JOINs PostGIS store geography + a pgvector incident cluster, and lights a graph + map in under a second. The DB is non-interchangeable (no recursion/joins in Dynamo; no PostGIS/extensions in DSQL), it's single-region (avoids the #1 execution risk), and FSMA 204 gives it a named, dated, mandated, budgeted buyer (24h FDA SLA, enforcement July 2028).
- **Robust second → Provenance (DynamoDB, B2B / Open Innovation).** The most demo-robust build in the set: DynamoDB has **no connection pool to exhaust** (the #1 Vercel+Aurora demo-killer), it's single-region, the hot category (agent observability) gives instant relevance, and scrubbing an agent's life back through a raw immutable log is unforgettable and hard to fake. Shares ~zero infra with Recall → the ideal *second* submission if and only if credits + a second builder land.
- **The swing → Settlement Floor (Aurora DSQL, B2B / global).** The most viscerally unforgettable demo — *"watch a double-pay get rejected (SQLSTATE 40001) and a region die without missing a payment."* DSQL is the least-contested lane, so a real peered two-region cluster is near-uncontestable. But it's all-or-nothing: only attempt as a flagship with dedicated DSQL plumbing time, **never** as an easy second.

**Bottom line:** Recall is the call. Provenance is the safe backup / second entry. Settlement Floor is the swing-for-the-fences. Target track: **Monetizable B2B**, with **Open Innovation as the cross-tag** for Originality. Build **ONE** flagship to absolute production-grade; cap at two.

---

## The winning thesis (one paragraph)

> **Make the database the protagonist and the frontend its courtroom evidence.** The 6,000-entrant field splits into two failure modes — pretty v0 apps with interchangeable backends, and "scales to millions" claims with no proof. You win by picking ONE workload where exactly one of the three AWS databases is *correct* (and you can say in a single sentence why the other two are wrong), then building one signature screen that makes that DB's hard property **visible and clickable on the live URL**, with real volume and a measured latency number on screen. Don't pitch features; pitch a data model, and let the UI prove it — every pixel a query result, the architecture diagram an ER/single-table/region-topology diagram rather than a box-and-arrow cartoon.

---

## The doc array (every file + link)

Links are **relative to this file** (`docs/README.md`). Each doc cross-links to its siblings the same way.

| Doc | What's in it |
|---|---|
| [`./README.md`](./README.md) | **This file** — index, TL;DR, thesis, reading orders, facts box. |
| [`./01-judging-model.md`](./01-judging-model.md) | What wins; what AWS-DB and Vercel/v0 judges reward; the two failure modes that sink ~70% of the field; track odds; bonus strategy. |
| [`./02-idea-universe.md`](./02-idea-universe.md) | All 22 serious concepts (full fields: pitch / user / DB-why / frontend / demo / win / fail / competitors / 10x) + comparison table. |
| [`./03-generational-ideas.md`](./03-generational-ideas.md) | The 10 generational / "unreasonable but shippable" concepts, full fields. |
| [`./04-scoring-matrix.md`](./04-scoring-matrix.md) | The full 32-concept scored matrix, methodology (3 panels × 10 dims), composite weights, and the kills with reasons. |
| [`./05-recommendation.md`](./05-recommendation.md) | The decisive call, the decision tree, and scenarios (solo vs. team, one vs. two submissions, credit timing). |
| [`./06-open-questions.md`](./06-open-questions.md) | Must-answer questions, nice-to-answer questions, and the assumption register (A1–A5). |
| [`./deep-dives/01-recall.md`](./deep-dives/01-recall.md) | **FLAGSHIP** — Recall (Aurora PostgreSQL, B2B): schema, hero query, architecture, demo script, build order, failure modes. |
| [`./deep-dives/02-provenance.md`](./deep-dives/02-provenance.md) | Provenance (DynamoDB, B2B/Open): single-table design, 7 access patterns, client-side fold/scrub, Streams view, demo script. |
| [`./deep-dives/03-sky-claim.md`](./deep-dives/03-sky-claim.md) | Sky Claim (DynamoDB, Open Innovation): voxel conditional-write deconfliction, Conflict Arena, k6 storm, demo script. |
| [`./deep-dives/04-hourbank.md`](./deep-dives/04-hourbank.md) | HourBank (Aurora PostgreSQL, B2C/Open): pgvector match + SERIALIZABLE double-entry with `CHECK(balance>=0)`, demo script. |
| [`./deep-dives/05-settlement-floor.md`](./deep-dives/05-settlement-floor.md) | Settlement Floor (Aurora DSQL, B2B/global): peered two-region cluster, OCC 40001 double-pay rejection, region kill, write-sharding. |
| [`./reference/aws-databases.md`](./reference/aws-databases.md) | DynamoDB vs. Aurora DSQL vs. Aurora PG: each engine's superpower, how to choose, and the screenshot proofs judges reward. |
| [`./reference/vercel-v0-playbook.md`](./reference/vercel-v0-playbook.md) | v0/Vercel integration patterns: OIDC keyless AWS auth, Fluid Compute, RDS Proxy pooling, RSC/Server Actions, pitfalls. |
| [`./reference/submission-checklist.md`](./reference/submission-checklist.md) | Required artifacts, demo rules, the bonus play, and the pre-flight checklist. |

---

## Reading orders

### (a) Decision-maker — "what should we build and why?" (~15 min)
1. [TL;DR](#tldr--the-recommendation) + [winning thesis](#the-winning-thesis-one-paragraph) (this page).
2. [`./05-recommendation.md`](./05-recommendation.md) — the call, decision tree, scenarios.
3. [`./04-scoring-matrix.md`](./04-scoring-matrix.md) — skim the ranked table + the kills.
4. [`./01-judging-model.md`](./01-judging-model.md) — track odds + failure modes (confirm the bet).
5. [`./deep-dives/01-recall.md`](./deep-dives/01-recall.md) — read the prize strategy + DB-load-bearing kill-shot to feel the ceiling.
6. [`./06-open-questions.md`](./06-open-questions.md) — answer the 3 must-answer questions before committing.

### (b) Builder starting Recall — "what do I stand up first?" (read in order)
1. [`./deep-dives/01-recall.md`](./deep-dives/01-recall.md) — the whole doc; live by "Build first (the spine)" and "Cut if scope bites."
2. [`./reference/aws-databases.md`](./reference/aws-databases.md) — the Aurora PG section: extensions, indexes, EXPLAIN screenshot proof.
3. [`./reference/vercel-v0-playbook.md`](./reference/vercel-v0-playbook.md) — OIDC keyless auth + RDS Proxy + Fluid module-scope `pg Pool` (do this early; connection exhaustion is the secondary failure mode).
4. [`./01-judging-model.md`](./01-judging-model.md) — re-read "how to make the DB choice obviously intentional" while wording the kill-shot.
5. [`./reference/submission-checklist.md`](./reference/submission-checklist.md) — keep open; capture artifacts as you build, not at the end.

### (c) Submission preparer — "ship it cleanly" (read in order)
1. [`./reference/submission-checklist.md`](./reference/submission-checklist.md) — the required-artifacts list + pre-flight.
2. The chosen deep dive's **demo script** section (e.g. [`./deep-dives/01-recall.md`](./deep-dives/01-recall.md)) — timecodes, voiceover, on-screen text.
3. [`./reference/aws-databases.md`](./reference/aws-databases.md) — exactly which DB screenshot to capture (RDS console + EXPLAIN + CloudWatch ACU for Recall).
4. [`./reference/vercel-v0-playbook.md`](./reference/vercel-v0-playbook.md) — verify the published project link + Team ID resolve in a fresh incognito window.
5. [`./01-judging-model.md`](./01-judging-model.md) — the bonus strategy (one annotated data-model post + 60–90s clip), only after the core + proof + required artifacts are solid.

---

## Hackathon facts box

| | |
|---|---|
| **Event** | H0: Hack the Zero Stack with Vercel v0 and AWS Databases |
| **Theme** | "Front-end in minutes. Back-end designed for scale." |
| **Deadline** | 2026-06-30, 02:00 GMT+2 |
| **Prizes** | $80,000 cash + $80,000 AWS credits |
| **Field** | 6,000+ entrants |
| **Core requirement** | Full-stack app using **(a)** Vercel or v0.app for frontend/deploy, **and (b) ONE of:** Amazon Aurora PostgreSQL · Amazon Aurora DSQL · DynamoDB |
| **Tracks** | 1) Monetizable B2C · 2) Monetizable B2B · 3) Million-scale global · 4) Open innovation |
| **Judging criteria** | Technological Implementation · Design · Impact & Real-world Applicability · Originality |

**Submission must include:** text description naming the AWS DB · demo video < 3 min · working-app footage · explanation of AWS DB usage · published Vercel project link **+ Vercel Team ID** · architecture diagram (frontend + backend) · screenshot proving AWS DB usage · *(optional)* public build content for bonus.

> Missing any required artifact (Team ID, dual-tier diagram, AWS-DB screenshot) auto-deflates the score regardless of code quality. See [`./reference/submission-checklist.md`](./reference/submission-checklist.md).

---

## How this set was produced

This doc set is the output of two chained agent workflows over the brief and grounding research:

- **A 22-agent ideation workflow** — grounded the judging model + the AWS-DB load-bearing patterns + Vercel/v0 leverage, fanned out 7 idea generators across tracks/DB-lenses plus 2 generational generators (~47 raw ideas), curated to 22 serious + 10 generational concepts, scored every concept with 3 independent judge panels (AWS SA / Vercel-design / investor) across 10 dimensions, then deep-dived the top 5. The consolidated result is [`../IDEATION.md`](../IDEATION.md), the authoritative master doc.
- **A 15-agent docs workflow** — split [`../IDEATION.md`](../IDEATION.md) into this navigable, build-ready set (overviews, deep dives, reference playbooks), each doc cross-linked and tuned for a real team building under deadline.

When in doubt, [`../IDEATION.md`](../IDEATION.md) is canonical; these docs are its organized, expanded form.
