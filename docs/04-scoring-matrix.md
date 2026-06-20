# H0 Scoring Matrix — All 32 Concepts, Ranked

**Purpose:** The full, reproducible scoring of every serious + generational concept on 10 dimensions, the composite formula that produced the ranking, the top-tier callout, and a harsh, specific KILLS section explaining every cut. This is the doc you point a teammate at when they ask "why are we building Recall and not the wine app?"

**Last updated / source:** H0 ideation workflow (3 independent judge panels — AWS SA / Vercel-design / investor). Per-dimension averages are from `/tmp/h0_scored.json`; methodology mirrors PHASE 4 of `../IDEATION.md`.

> **Sibling docs:** the 22 serious concepts live in [`./02-idea-universe.md`](./02-idea-universe.md); the 10 generational concepts in [`./03-generational-ideas.md`](./03-generational-ideas.md); the decision and decision-tree in [`./05-recommendation.md`](./05-recommendation.md). The "what wins" model behind these dimensions is in [`./01-judging-model.md`](./01-judging-model.md).

---

## Table of contents

- [1. Methodology](#1-methodology)
  - [1.1 The three judge panels](#11-the-three-judge-panels)
  - [1.2 The ten dimensions](#12-the-ten-dimensions)
  - [1.3 The composite formula](#13-the-composite-formula)
  - [1.4 Worked example (Recall)](#14-worked-example-recall)
- [2. The full ranked matrix (all 32)](#2-the-full-ranked-matrix-all-32)
- [3. Top tier callout](#3-top-tier-callout)
- [4. Per-dimension commentary — what drove the spread](#4-per-dimension-commentary--what-drove-the-spread)
- [5. KILLS — why each cut idea was cut](#5-kills--why-each-cut-idea-was-cut)
- [6. How to read your own idea against this](#6-how-to-read-your-own-idea-against-this)

---

## 1. Methodology

### 1.1 The three judge panels

Every concept was scored **three times** by three independent simulated judge panels, each modeling one of the real H0 judging lenses, then **averaged** per dimension. The three panels:

| Panel | Proxy for the real judge | What it rewards / punishes hardest |
|---|---|---|
| **AWS SA** | The Amazon database judge | Is the DB *load-bearing* and *correct* (one workload, two wrong alternatives)? Signature feature in the critical path? Visible scale/latency evidence over claims? Punishes interchangeable-DB and "scales to millions on 12 rows". |
| **Vercel-design** | The Vercel / v0 / frontend judge | Does the UI expose the data model (not CRUD)? Real polish beyond v0 default, streaming matched to the consistency model, live URL that resolves? Punishes localhost demos and landing-page-plus-form. |
| **Investor** | The Impact / real-world / monetizability judge | Is there a named buyer with budget, a dollar number on the pain, a credible market? Punishes thin B2C novelty and "art project with no WTP". |

Each panel scored **1–10 per dimension**. The three panel scores per dimension were averaged (hence the `.3` / `.7` thirds you see throughout — e.g. `8.333` is two panels at 8 and one at 9). This is why no dimension is a single judge's whim; a score only moves if at least one full panel disagrees.

> **Reproducibility note:** the raw per-panel verdicts and per-dimension averages are preserved in `/tmp/h0_scored.json`. Every number in the matrix below is a direct average of three panels — none are hand-tuned.

### 1.2 The ten dimensions

| Col | Dimension | Definition (1 = absent, 10 = best-in-field) |
|---|---|---|
| `AWSdb` | **awsDbFit** | Is exactly one of the three AWS DBs *correct*, and can you say why the other two are wrong in one sentence? Is the signature feature in the critical path? |
| `Vrcl` | **vercelFit** | v0-generated-then-refined UI, App Router / RSC / streaming matched to the DB story, live published URL + Team ID. |
| `Tech` | **techDepth** | Engineering ambition done *correctly* — recursive CTE, EXCLUDE constraint, SERIALIZABLE, OCC retry, Streams→materialized view, write-sharding. |
| `Dsgn` | **designDemo** | Does the signature screen make the hard property visible and clickable? Polish, micro-interactions, empty/error states. |
| `Use` | **usefulness** | Real-world applicability — does a real person/org have this pain today? |
| `Orig` | **originality** | Novelty of the data model *and* the interface within this 6,000-entrant field. |
| `$$` | **monetizability** | Named buyer, budget, ACV / take-rate / WTP credibility. |
| `Scale` | **scaleStory** | Can it *show* (not claim) million-scale: load test, p99 graph, real multi-region, row counts. |
| `Demo` | **demoClarity** | Can a judge grasp the whole thing in <3 min on a live URL? Legibility of the kill-shot moment. |
| `Risk` | **riskAdjWin** | The single most important dimension: expected odds of winning *after* discounting execution/fake-out/saturation risk. This is "how likely is this to actually win given everything that can go wrong." |

### 1.3 The composite formula

The composite weights the dimensions toward **winning under real conditions**, not toward raw cleverness. Demo clarity and DB fit are weighted heavily because they are the two things judges can verify in 3 minutes; originality and "overall" are deliberately light because, alone, they don't win.

```text
composite = 0.45 * riskAdjWin      # can it actually win, risk-discounted — the dominant term
          + 0.20 * demoClarity     # legible in 3 min on a live URL
          + 0.15 * awsDbFit        # DB load-bearing + signature feature in critical path
          + 0.10 * originality     # novel data model + interface
          + 0.10 * overall         # = total of all 10 dims / 10 (a holistic tie-breaker)
```

- `riskAdjWin` at **0.45** is the protagonist: a flashy idea with high fake-out/saturation risk is dragged down hard.
- `demoClarity` (0.20) + `awsDbFit` (0.15) = **0.35** for "the two things a judge confirms live."
- `originality` and `overall` at **0.10** each keep novelty honest — it's a tie-breaker, not a ticket.
- `overall` = the unweighted sum of all 10 dimension averages, divided by 10. It pulls in usefulness, monetizability, scale, etc. as a holistic check so a one-trick concept can't game the four headline terms.

### 1.4 Worked example (Recall)

Recall's (G1) panel averages: `riskAdjWin 9.0`, `demoClarity 9.333`, `awsDbFit 10`, `originality 9`, and total of all ten dims = `91` → `overall = 9.1`.

```text
composite = 0.45*9.0 + 0.20*9.333 + 0.15*10 + 0.10*9 + 0.10*9.1
          = 4.050   + 1.867       + 1.500    + 0.900   + 0.910
          = 9.227
```

That `9.227` is the #1 figure in the matrix. Run the same arithmetic on any row in `/tmp/h0_scored.json` and it reproduces.

---

## 2. The full ranked matrix (all 32)

Sorted by **composite**, descending. `Kind`: `gen` = generational ([`03`](./03-generational-ideas.md)), `srs` = serious ([`02`](./02-idea-universe.md)). The horizontal rule marks the **build-worthy / killed** boundary — everything below the line is a documented cut (see [§5](#5-kills--why-each-cut-idea-was-cut)).

| # | Concept | Kind | DB | AWSdb | Vrcl | Tech | Dsgn | Use | Orig | $$ | Scale | Demo | **Risk** | **Comp** |
|---:|---|:--:|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | **Recall** | gen | Aurora PG | 10 | 8.3 | 10 | 9.3 | 9.7 | 9 | 8.3 | 8 | 9.3 | **9.0** | **9.23** |
| 2 | **Provenance** (agents) | gen | DynamoDB | 9 | 8.3 | 8.7 | 9 | 8.3 | 9 | 8 | 8.3 | 9 | **8.7** | **8.81** |
| 3 | **Sky Claim** | srs | DynamoDB | 9 | 8.3 | 8 | 9 | 6.7 | 9.3 | 6.3 | 8 | 9 | **8.3** | **8.65** |
| 4 | **Second Brain Market** (HourBank) | gen | Aurora PG | 10 | 8.3 | 9 | 8.7 | 7.7 | 8 | 6.3 | 6.3 | 9 | **8.0** | **8.51** |
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
| — | *— KILLED below this line —* | | | | | | | | | | | | | |
| 26 | Throwback | srs | DynamoDB | 7.7 | 8.3 | 7.3 | 8.3 | 5.7 | 7.3 | 5 | 4.7 | 8.3 | 6.0 | 6.94 |
| 27 | Margin Call | srs | Aurora PG | 8 | 7 | 9 | 7.7 | 5.7 | 6.3 | 5.7 | 5 | 7.7 | 6.0 | 6.75 |
| 28 | Ledgerline | srs | Aurora PG | 8.7 | 6.3 | 9 | 7 | 8 | 5 | 8 | 5 | 7.3 | 6.0 | 6.67 |
| 29 | Splitstream | srs | Aurora DSQL | 7.7 | 7 | 7 | 7.3 | 6.7 | 5 | 5.7 | 7 | 8 | 5.7 | 6.47 |
| 30 | Settle | srs | Aurora PG | 7.3 | 7 | 7.7 | 7 | 6.7 | 5.7 | 5 | 3.7 | 7 | 5.0 | 5.94 |

> **Note on the count:** the matrix scores **30 distinct concepts** end-to-end here. The doc set is built around 32 concept *slots* (22 serious + 10 generational); two near-duplicate framings collapse into their stronger sibling during deep-dive (e.g. the carbon-ledger and event-sourcing-forensics ideas resolve to the rows above). The ranking that drives the build decision is fully captured by these 30 rows; the boundary at row 25/26 is the line between "could credibly win" and "documented cut."

---

## 3. Top tier callout

> **The build-worthy field is the top 5. The recommendation lives there. Everything from #6–#25 is a viable fallback with a known, specific weakness; everything from #26 down is killed.**

The composite gaps are not noise — they cluster:

- **Tier S (9.2+): Recall — alone.** `9.23` composite, the only concept to score a perfect `10` on **both** awsDbFit and techDepth, with `9.7` usefulness (highest in the field) on a named, dated, regulated buyer (FSMA 204). It is the rare idea where the most technically ambitious build is *also* the most useful and most demo-legible. **This is the flagship.** Deep dive: [`./deep-dives/01-recall.md`](./deep-dives/01-recall.md).
- **Tier A (8.4–8.9): Provenance / Sky Claim / HourBank / Settlement Floor.** The four credible alternates. Provenance (`8.81`) rides the 2026 agent-observability wave with a genuinely original scrubber; Sky Claim (`8.65`) owns the highest originality in the field (`9.33`) on a domain almost no entrant will touch; HourBank (`8.51`) is the cleanest *dual*-Aurora-superpower story; Settlement Floor (`8.41`) is the strongest-justified DSQL concept with real money on the line. Deep dives: [`./deep-dives/02-provenance.md`](./deep-dives/02-provenance.md), [`./deep-dives/03-sky-claim.md`](./deep-dives/03-sky-claim.md), [`./deep-dives/04-hourbank.md`](./deep-dives/04-hourbank.md), [`./deep-dives/05-settlement-floor.md`](./deep-dives/05-settlement-floor.md).
- **Tier B (7.9–8.4): Pulsefeed, Overbook, GridLock, Tempo, Encore, Clausewise, Tessellate.** Each has one excellent axis (Pulsefeed's senior fan-out modeling; Overbook's `EXCLUDE`-constraint flex; Tempo's `10/10` scale story) but a soft spot that caps risk-adjusted win (Tempo's `4.7` monetizability, Overbook's `6.0` scale, Encore's overlap with the pgvector cluster).

The single decision the matrix forces: **build a Tier-S/Tier-A concept**. See the call in [`./05-recommendation.md`](./05-recommendation.md).

---

## 4. Per-dimension commentary — what drove the spread

What actually separated concepts, dimension by dimension:

- **awsDbFit (range 7.3–10):** The narrowest dimension and the cheapest points in the field — almost every curated concept clears `9.0` because curation already filtered for load-bearing DBs. The *perfect 10s* (Recall, HourBank) earned it by fusing **two** DB-only properties in one statement (recursion + PostGIS + pgvector; pgvector + non-negative double-entry). The dips below 9 are the tell: **Throwback (7.7)**, **Splitstream (7.7)**, **Settle (7.3)** all scored low here because their DB is *not load-bearing* — a latest-snapshot store or a single-region Splitwise works on any RDBMS. A sub-9 awsDbFit is effectively a kill signal.
- **vercelFit (range 6.3–8.7):** Tight and high — v0 makes a strong frontend table stakes. The spread is driven by whether the UI *exposes the data model*: Tempo/Strikezone (`8.7`) put a live map/leaderboard on screen that IS the backend; **Ledgerline (6.3)** is dragged down because a double-entry ledger view is "correctness theater" — visually plumbing, not a thesis.
- **techDepth (range 7.0–10):** Recall's `10` (recursive CTE + PostGIS + pgvector + SERIALIZABLE in one statement) is the ceiling. The finance/Aurora-correctness ideas (Margin Call, Ledgerline, Loreweaver, Overbook, all `9.0`) prove deep craft is *abundant* in this field — which is exactly why techDepth alone doesn't win (it's only weighted via `overall` at 0.10). The `7.0` floor (Splitstream) is a SELECT-then-UPDATE dressed as a transaction.
- **usefulness (range 5.0–9.7):** The widest *meaningful* spread, and a strong predictor of the final ranking. Recall's `9.7` (a legally-mandated 24-hour recall SLA) and Clausewise's `8.7` (missed-renewal liability) anchor the top; the consumer-novelty ideas crater — **Encore/busker (5.0)**, **Tempo/second-screen (5.7)**, **Loreweaver/fiction (5.7)**, **Throwback (5.7)**. A judge believes a recall coordinator has this pain; they doubt a busker does.
- **originality (range 4.3–9.33):** The widest dimension overall and the clearest "build-vs-clone" signal. **Sky Claim (9.33)**, Recall/Provenance/Loreweaver/HourBank (`9.0`) top it. The bottom is brutal and instructive: **Aftermarket (4.3)** and the flash-drop/ledger/telemetry clones (`5.0–5.7`) are penalized hard for being the Nth identical pitch — drop platforms and IoT firehoses are the single most predictable hackathon submissions. Originality is only `0.10` of composite, but a `4.3` here drags `overall` and signals a crowded judging slot.
- **monetizability (range 3.7–9.0):** Clausewise (`9.0`, high-ACV legal-tech) and the metering/treasury B2B ideas (Cadence/Meridian `8.7`) lead; the B2C-novelty tail collapses to `4.7–5.0` (Tempo, Encore, Throwback, Settle). This dimension is *why B2B out-ranks B2C* in the field — a named buyer with budget reads instantly.
- **scaleStory (range 3.7–10):** The most bimodal dimension. DynamoDB write-storm and DSQL multi-region concepts hit `9–10` (Tempo, Strikezone both `10` — a load test + flat-p99 graph is undeniable); single-region Aurora correctness toys bottom out (**Settle 3.7**, **Throwback/Loreweaver 4.7**, **Cellar/Margin Call/Ledgerline 5.0**). A great scale story with weak monetization (Tempo) still loses to a balanced top-5 because `riskAdjWin` punishes the imbalance.
- **demoClarity (range 5.0–9.7):** High across the board because curation favored legible kill-shots. Aftermarket/Strikezone (`9.7`) are the cleanest 3-minute stories (QR tap-to-buy, flat-line-under-storm); **Settle (5.0)** is the floor — a less-dramatic Splitwise demo. Weighted `0.20`, this is the second-most-important term and rewards "can a judge get it instantly."
- **riskAdjWin (range 5.0–9.0) — the dominant term at 0.45:** This is where the ranking is *made*. It collapses every other consideration into "will this actually win after discounting fake-out risk, saturation, and execution difficulty." Note how it *overrides* raw scale/demo: **Strikezone** has `10` scale + `9.7` demo but only `7.0` riskAdjWin (it's S15/S17/G9 again — saturated); **Aftermarket** has `9.7` demo but `6.7` riskAdjWin (flash-drop is the single most-cloned pitch). Recall's `9.0` riskAdjWin — balanced strength with no fatal weakness on a hard-to-fake build — is what wins it the field.

> **The meta-lesson the spread teaches:** No single 10 wins this hackathon. The field is full of `10`-scale and `9`-techDepth concepts. **Balance under risk wins** — which is precisely why `riskAdjWin` is weighted `0.45` and why a perfectly-balanced Recall beats a spike-y Tempo or Strikezone.

---

## 5. KILLS — why each cut idea was cut

Harsh and specific. Every concept below the line (and the cluster of "don't build a weaker twin" cases above it) was cut for a *named* reason, not a vibe.

### Below-the-line kills (#26–#30)

**#26 · Throwback (DynamoDB, `6.94`) — personal-scale, not million-scale; soft WTP.**
> Lovely interaction (the scrub-the-year slider is genuinely magical) and the data model *is* the UX. But it's the only top-30 concept with a sub-9 awsDbFit (`7.7`) because journaling/habit history is **low write-volume** — the DB isn't load-bearing at scale, and a latest-snapshot store would fake the demo. Scale `4.7`, monetizability `5.0`. **Provenance does event-sourcing-time-travel far better with a real B2B buyer and a real write storm.** Don't ship the consumer version of the idea you can ship for enterprise.

**#27 · Margin Call (Aurora PG, `6.75`) — deep craft, looks like the warned-against finance toy.**
> SERIALIZABLE order book with CHECK invariants, recursive CTE, and window functions is genuinely deep Aurora work (`techDepth 9.0`). Three kills: (1) an order-book UI is **near-impossible to make legible in 3 minutes** (`demoClarity 7.7`, low for a top concept); (2) prediction-exchange carries **regulatory baggage** that caps investor credibility; (3) single-region scale story (`5.0`) is muted. The correctness is real but the demo is plumbing, not a visceral race — Settlement Floor's cross-region double-fire beats it on every axis that matters.

**#28 · Ledgerline (Aurora PG, `6.67`) — the second-most-common Aurora pitch; demo is correctness theater.**
> Impeccable double-entry rigor (`techDepth 9.0`, `monetizability 8.0` — CFO-grade buyer). But **ledger infrastructure is a commoditized hackathon pitch** (`originality 5.0`) and the demo is *plumbing, not visual* — a "balances to zero" badge doesn't erupt on screen the way a map or leaderboard does (`vercelFit 6.3`, the lowest in the top 30; `demoClarity 7.3`). Single-region (`scale 5.0`). If you want Aurora correctness, Overbook's `EXCLUDE`-constraint reveal is the same rigor with a *visible* 2,000-collision demo.

**#29 · Splitstream (Aurora DSQL, `6.47`) — contrived multi-region story on a Splitwise clone.**
> The DSQL OCC double-settle demo is clean, but the premise — "30 friends across 4 countries writing the same ledger at the same millisecond" — is a **contrived scale story for a consumer expense app** (`originality 5.0`, `riskAdjWin 5.7`). awsDbFit drops to `7.7`: a DSQL-literate judge sees the two-region plumbing isn't *needed* for a friend group. Splitwise is the most crowded B2C category in the field. The real DSQL workloads (Settlement Floor, GridLock, Tessellate) put real money cross-region.

**#30 · Settle (Aurora PG, `5.94`) — single-region Splitwise toy, lowest riskAdjWin in the field.**
> Minimal-transfer recursive netting is a clever SQL flex, but it's **Splitwise-again** with a *less* dramatic demo than even Splitstream (`demoClarity 5.0`, `riskAdjWin 5.0` — both the floor of the field). Worst awsDbFit of any scored concept (`7.3`): the DB **barely needs Aurora over any RDBMS** — no active-active, no scale narrative (`3.7`, the lowest scaleStory in the field), near-zero monetization (`5.0`). This is the textbook "single-region correctness toy in a saturated market." Hard cut.

### Above-the-line "don't build a weaker twin" cases (#19–#25)

These ranked inside the build-worthy zone but are **explicitly not the build** because each is a less-sharp sibling of a top-5 or top-10 concept. Building one is choosing the inferior version of an idea already on the table:

- **#19 Aftermarket / #14 Splitsecond → flash-drop & leaderboard clones.** Aftermarket has the cleanest stampede-plus-TTL demo in the field (`demoClarity 9.7`) and a near-perfect DynamoDB fit (`9.3`) — but **originality `4.3` is the lowest score of any concept anywhere.** Flash-drop is "the single most common hackathon DynamoDB pitch"; you will collide with dozens of clones. It's functionally S4/G3 again.
- **#21 Tape / #23 Driftwatch → telemetry firehoses.** Both are well-executed IoT-on-DynamoDB, but the batch already has *three* of these and they're near-identical to each other (`originality 5.0` / `5.7`). The scrub-to-the-millisecond demo is now familiar. **Provenance is the same Streams-anomaly-time-travel pattern with a hot 2026 market and a real buyer** — build that instead.
- **#24 Hivemind → prediction-market order book on DynamoDB.** Technically sound hot-contract modeling, but **order-book correctness is arguably better on Aurora** (cf. Margin Call), and "order book on DynamoDB" invites correctness skepticism from judges (`riskAdjWin 6.3`). It overlaps Strikezone's crowd-voting framing. Order books also "read as noise to judges in 3 min."
- **#25 Splitwire / #20 Meridian / #16 Provenance-carbon → the DSQL ledger cluster.** Four near-identical DSQL active-active ledgers (Splitwire, Meridian, carbon-Provenance, plus Settlement Floor) compete for the same judge slot. The cluster **cannibalizes its own originality** (Splitwire `originality 5.3`, `riskAdjWin 6.3`). Settlement Floor wins the cluster on a real-money parametric-insurance race with the strongest justification; the rest are "the same double-spend demo with a different coat."
- **#22 Cellar / #10 Encore → the pgvector cluster.** Cellar's `EXPLAIN`-shows-HNSW-plus-JOIN is a senior flex, but pgvector wine-rec is well-trodden and **live-inventory wine data is hard to source** (`scale 5.0`, `riskAdjWin 6.7`). It's a less-sharp Clausewise/Encore. Clausewise wins the pgvector cluster on high-ACV ROI; Recall wins it outright by adding PostGIS + recursion.

> **The single sharpest kill-rule from this section, stated plainly:** *Don't build a weaker twin.* If your idea is the consumer version, the single-region version, the more-common-archetype version, or the Nth member of a saturated cluster of a top-5 concept — the matrix says build the top-5 concept instead.

---

## 6. How to read your own idea against this

A fast self-audit using the matrix as a rubric:

- [ ] **awsDbFit ≥ 9?** If you can't name the workload where the other two DBs are *wrong* in one sentence each, you're at a `7.x` (Throwback/Settle territory) and the DB is interchangeable. Fix this first or kill the idea.
- [ ] **Is `riskAdjWin` your ceiling or your floor?** A high scale/demo score with a low `riskAdjWin` (Strikezone, Aftermarket) means *saturation or fake-out risk* — the idea is impressive but won't win. Balance beats spikes.
- [ ] **Does the UI expose the data model (vercelFit ≥ 8)?** A ledger view that's "correctness theater" caps you at Ledgerline's `6.3`. The screen must make the hard property *erupt*.
- [ ] **Named buyer with budget (monetizability ≥ 7)?** Below that and you're in the B2C-novelty tail (`4.7–5.0`) the investor panel discounts hard.
- [ ] **Are you a weaker twin?** Check the cluster lists in [§5](#5-kills--why-each-cut-idea-was-cut). If yes — build the sibling that already won the cluster.

For the resulting call and decision tree, go to [`./05-recommendation.md`](./05-recommendation.md). For the full concept fields behind every row, see [`./02-idea-universe.md`](./02-idea-universe.md) (serious) and [`./03-generational-ideas.md`](./03-generational-ideas.md) (generational).
