# CODEX EXECUTION PROMPT — "Make Recall a Guaranteed H0 Winner"

You are a senior engineer being handed a flagship hackathon entry to finish. The build is real and strong. Your job is to close the gap between "great engine" and "submitted, judged, and won" — with zero regressions. Cook generationally: every change is small, reversible, verified, and load-bearing.

---

## 0. CURRENT EXECUTION STATUS — 2026-06-24

This handoff has been substantially executed. Treat the sections below as the original scope, but
use the current readiness artifacts as authoritative for what remains.

**Fresh readiness command:** `pnpm submission:check`.

Current passing evidence:

- Local gates pass: `pnpm verify`, `pnpm build`, `BASE_URL=https://recall-h0.vercel.app pnpm test:smoke`, and `git diff --check`.
- `pnpm submission:check` validates the staged README, LICENSE, H0/v0 proof docs, warm-cron config, owner handoff, Devpost manifest, completion audit, Devpost field-copy sheet, demo checklist, AWS artifact shot list, architecture image, live console screenshot, demo title cards, live EXPLAIN still, live home page, live trace numbers, and live EXPLAIN nodes. After the repo is public, it also validates the public default branch for README, LICENSE, package scripts, warm cron config, and current health/ready route sources.
- Live `PRD-OUTBREAK-0001` numbers are verified by the checker: `1,400` stores, `674,285` units, `81` lots, `80` edges.

Current blockers:

- The Vercel production deployment does not include the local `/api/health` and `/api/ready` routes yet; live `/api/health` returns 404 and live `/api/ready` returns 404.
- A production deploy attempt on 2026-06-24 failed before build because the current Vercel Hobby plan blocks the `*/4 * * * *` judging warm cron. The owner must upgrade the Vercel team/project to a plan that supports sub-daily Cron Jobs, then run `pnpm submission:preflight:prod` and `pnpm submission:deploy:prod`, or consciously remove the cron and accept the weaker cold-start fallback. The preflight checks Vercel CLI auth, the local project link, and cron config without deploying or verifying plan entitlement.
- GitHub repo visibility is still owner-confirmed; push this source, run `pnpm submission:print-public-repo-command`, then the printed `gh repo edit ... --visibility public` command after confirmation.
- The owner still needs to record/export `docs/submission/demo.mp4`, upload it, write the real hosted HTTPS URL to `docs/submission/demo-link.txt`, and paste that same URL into `docs/submission/submission.md`.
- The owner still needs AWS console captures `docs/submission/db-proof-rds.png` and `docs/submission/db-proof-acu.png`, then `pnpm submission:compose-db-proof` to produce `docs/submission/db-proof.png`.
- `docs/submission/submission.md` still intentionally contains `visibility flip pending owner confirmation` until the repo is public.

Key current handoff files:

- `docs/submission/OWNER_FINAL_STEPS.md` — exact owner action sequence.
- `docs/submission/MANIFEST.md` — Devpost artifact map.
- `docs/submission/COMPLETION_AUDIT.md` — P0/P1/P2 evidence and blocker map.
- `docs/submission/DEVPOST_FIELDS.md` — final copy/paste sheet for Devpost.
- `scripts/check-submission.ts` — machine-readable readiness contract.

Do not run `pnpm db:migrate`, `pnpm db:seed`, or secret-fetch commands. Do not flip repo
visibility without owner confirmation.

---

## 1. MISSION

**Recall — The Outbreak Console** is the flagship entry for the **H0 hackathon** ("Hack the Zero Stack with Vercel v0 and AWS Databases", $80k cash + $80k AWS credits). **Deadline: 2026-06-30.** You have ~7 days.

**What it is:** A food-safety outbreak console. Paste a Traceability Lot Code (TLC) → **ONE serializable Aurora PostgreSQL query** fuses a recursive CTE (supply-chain DAG over `lot_links`), PostGIS GiST geospatial, and pgvector HNSW semantic similarity to trace contamination to every affected store in ~150–300ms over ~580k rows.

- **Live URL:** https://recall-h0.vercel.app
- **Repo:** github.com/eklavyagoyal/recall-h0 (currently PRIVATE — a P0 blocker)
- **Local repo:** `/Users/eklavyagoyal/Projects/hackathons/etc/3.7-aws-vercel-h0`
- **Stack:** Next.js 16 (App Router, React 19, TS strict), Tailwind v4, motion, maplibre, react-force-graph. Vercel Fluid Compute (iad1). **Package manager is `pnpm`** (v10.32.1, Node ≥24). Tests run on **vitest** + **Playwright**.
- **DB:** Aurora PostgreSQL Serverless v2 (MinACU=0 scale-to-zero, pgvector + PostGIS).
- **Auth:** Keyless — Vercel OIDC → AWS STS → IAM role (`bedrock:InvokeModel` for Titan embeddings). **No long-lived AWS keys.**

**The verdict you are executing against:** the engine and live URL are winner-grade, but the entry is **NOT submittable today** — no demo video, repo is private with a boilerplate README, the writeup numbers contradict the live app, and the Aurora cold-start path can present as a frozen app on a judge's first click. None of the fixes require a re-seed. All are fixable in 7 days.

---

## 2. HARD CONSTRAINTS (these bind every change — violating one fails the task)

### 2.1 The Bash hook — DB-secret/migrate/seed steps are the HUMAN's, not yours
A `PreToolUse` Bash hook **blocks any command that touches DB secrets** (migrate, seed, secret-fetch). These steps are **human-gated**. When a task needs one, **STOP and hand it back to the user with the exact command to run** — do not attempt it, do not work around it. The relevant scripts are:
- `pnpm db:migrate` (`tsx scripts/migrate.ts`)
- `pnpm db:seed` (`tsx db/seed/load.ts`)
- any `AURORA_HOST`/`PGPASSWORD`/`DATABASE_URL`/secret-fetch command

**Re-seeding Aurora is expensive and human-gated. The entire plan is deliberately NO-RE-SEED. Never propose "just re-seed to match the numbers" — reconcile the docs to the live data instead.**

### 2.2 Keyless OIDC only
No AWS access keys in the app, ever. Any new feature (warm-ping, readiness probe, cost readout) rides the existing **Vercel OIDC → STS → IAM** path. Do not introduce `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`.

### 2.3 AWS managed-services preference
Prefer S3 / SQS / SNS / Secrets Manager / KMS / Aurora. If you deviate, write down the operational tradeoff rationale in the PR/commit body.

### 2.4 Org engineering rules — "No hidden failures" (a strict reviewer WILL probe these)
- Sanitize all untrusted input; handle unhappy paths (timeouts, partial failures, dependency outages).
- Readiness must FAIL on critical-dependency breakage unless a degraded mode is explicitly defined.
- Distinct liveness/readiness/startup semantics — do not conflate them.
- Bounded timeouts/deadlines on every remote call. Bounded, idempotent-safe retries with **exponential backoff + jitter**.
- Protect against cascading failure: backpressure / load-shedding / rate-limit / circuit-breaker.
- Rollout safety: kill switch / feature flag for risky changes; reversible commits; rollback path.
- Explicit error handling — no swallowed errors; include actionable context (dependency name, upstream status, retry count, failure class).
- **Observability (Datadog-first):** metrics for high-frequency events, logs for rare/high-entropy events; structured telemetry with correlation/trace IDs.
- **Tests** for 5xx / timeout / degraded-mode / retry / rollback behavior.

### 2.5 "No fuckups" — the commit gate
**Before EVERY commit, all of these must pass:**
```
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm build          # next build
pnpm test           # vitest run  (unit + contract; see P1 split below)
pnpm test:smoke     # playwright test
```
If a gate is red, fix or revert before committing. Preserve **all `data-testid`s** and the **`TraceResult` / `traceAction` contract** exactly so the Playwright smoke and any judge-pasted TLC keep working. Use `pnpm bench` (`tsx scripts/trace-bench.ts`) to confirm no trace-latency regression after engine-adjacent changes.

### 2.6 DO NOT TOUCH (the verified differentiators — any addition must be purely additive)
- The one-query fusion in `TRACE_SQL` (`lib/db/queries/trace.ts`) — recursive supply-DAG CTE + PostGIS `ST_DWithin`/GiST + pgvector HNSW in one SERIALIZABLE txn. This is the load-bearing 10/10 awsDbFit; do not regress it.
- The live `/api/explain` endpoint returning a real `EXPLAIN(ANALYZE, BUFFERS)` plan (Recursive Union + Index Scan + real Buffers). Never replace with a mocked/cached plan.
- The precise kill-shot framing in `submission.md` (PostGIS + pgvector + FK-enforced DAG integrity) that deliberately does NOT over-claim that DSQL lacks recursive CTEs. Preserve the precision.
- The keyless OIDC→STS→IAM→Bedrock plumbing.
- Input sanitization (`tlcSchema` regex + 128 cap + parameterized `$1/$2/$3` binds) and the sql-guard test forbidding interpolation.
- The recursive CTE cycle protection (`path` visited-set + `depth < TRACE_MAX_DEPTH`, currently 12) and its A→B→A termination test.
- The `/pitch` LiveDemo baked-then-upgrade-to-live with 30s AbortController; the a11y/reduced-motion foundation.
- The `TraceResult` / `traceAction` contract and all `data-testid`s.

---

## 3. THE WORK (P0 → P1 → P2)

Work top-to-bottom. Commit each item separately. Self-verify each against its acceptance criteria before moving on.

### ── P0 — BLOCKS SUBMISSION ──

#### P0-1 — Bound the Aurora cold-start path AND give it a "warming" UX
**Goal:** A cold (paused-DB) trace must return a **bounded typed timeout**, not a silent hang, and the UI must show an explicit "Aurora is scaling from zero" state that turns the wait into the $0-idle-cost narrative.
**Files:** `lib/db/pool.ts`, `app/api/trace/route.ts`, `components/console/Console.tsx`, `app/loading.tsx` (optional), `test/pool.test.ts` (new).
**Concrete work:**
- In `lib/db/pool.ts`, the `aurora` branch `base` object (`{ max: 5, idleTimeoutMillis: 10_000, ssl: auroraSsl() }`) **omits** `connectionTimeoutMillis` and `statement_timeout` — the LOCAL branch has both. Add `connectionTimeoutMillis: 12_000` and `statement_timeout: 18_000` to the aurora `base`. (Production is currently the *less* protected path — this is the bug.)
- Add `export const maxDuration = 30` to `app/api/trace/route.ts`.
- In `Console.tsx` (currently only `idle | loading | error` with a shimmer), add a `warming` state: after ~1.5s with no response, show **"Aurora is scaling from zero ACU (~10–15s) — you're watching $0-idle-cost infrastructure wake up."** Add a client `AbortController` aligned to `maxDuration`.
**Acceptance:** With the DB paused, a trace returns a bounded typed timeout within the deadline (no hang). `test/pool.test.ts` asserts BOTH `connectionTimeoutMillis` and `statement_timeout` keys exist on the aurora `PoolConfig`. Config + UI only — no re-seed.
**Judging rationale:** Combined demo-killer + the #1 reliability rule a strict reviewer probes. A cold first click that hangs reads as "broken app."

#### P0-2 — Keep Aurora warm during the judging window (Vercel Cron)
**Goal:** Prevent the cold path from hitting the judge by warm-pinging the DB on a schedule.
**Files:** `vercel.json` (currently only `{ "regions": ["iad1"] }`), `app/api/ready/route.ts` (new — doubles as the P1 readiness probe).
**Concrete work:** Add a Vercel Cron hitting a cheap warm endpoint running `SELECT 1` (with the short bounded `statement_timeout`) every ~4 min. Make it reversible (documented kill switch / removable cron entry). Keyless — no AWS keys.
**Acceptance:** Cron entry present in `vercel.json`; a cold incognito open of the live URL resolves sub-second on the demo lot during a simulated judging window. Documented and reversible. No re-seed.
**Judging rationale:** Scale-to-zero means the cold path hits exactly when a judge first clicks. Pairs prevention with the P0-1 bounded-timeout safety net. Aligns with org rollout-safety/degraded-mode rules.
**HAND-BACK if needed:** if wiring the cron requires a `CRON_SECRET` or env value via a blocked secret command, STOP and hand the exact `vercel env add` command to the user.

#### P0-3 — Reconcile submission numbers to deployed reality (no re-seed)
**Goal:** Every number a judge can reproduce by pasting **PRD-OUTBREAK-0001** must match the docs verbatim.
**Files:** `docs/submission/submission.md`, `docs/submission/build-in-public.md`, `docs/submission/demo-script.md`.
**Concrete work:** Replace the stale headline (`2,583,144 units / 83 lots / 82 edges`) with the **live** figures: **1400 stores / 674,285 units / 81 lots / 80 edges**. Reconcile the depth guard to `depth < 12` everywhere (fix `build-in-public.md`'s `depth < 64`). First re-run a live trace to confirm the current numbers before editing — do not trust the figures above blindly; capture them fresh.
**Acceptance:** Docs, build-in-public, and demo narration all match the live trace verbatim. No re-seed.
**Judging rationale:** A judge who pastes the demo TLC and sees different numbers than the writeup is the fastest credibility killer.

#### P0-4 — Make the GitHub repo public with a real README + LICENSE
**Goal:** The repo link in `submission.md` must open to a non-embarrassing, thesis-selling page for an anonymous judge.
**Files:** `README.md` (currently verbatim create-next-app boilerplate), `LICENSE` (new), repo settings.
**Concrete work:**
- First **confirm the official H0/Devpost rules do not bar a public repo** (document the confirmation in `docs/proof/`). If public is forbidden, instead add the organizers as collaborators and state so in `submission.md`.
- Rewrite `README.md`: one-line thesis, live URL, the hero SQL (the fused one-query), architecture diagram embed, **verified numbers** (matching P0-3), and a link to https://recall-h0.vercel.app.
- Add a root `LICENSE` (MIT or Apache-2.0).
- Set repo description = one-line thesis; set `homepageUrl` = live URL; set visibility public (via `gh repo edit`).
**Acceptance:** An incognito session opens the repo, sees the real README + live URL + hero SQL + diagrams + verified numbers, and a LICENSE at root.
**Judging rationale:** A 404 on the code link forfeits all Technological-Implementation credit. Cheapest large point swing.
**HAND-BACK:** flipping visibility public is a `gh repo edit --visibility public` you may run; but confirm with the user first that they want it public (account-level action).

#### P0-5 — Capture required artifact images: `architecture.png` and `db-proof.png`
**Goal:** Produce the two required uploadable artifacts.
**Files:** `docs/submission/architecture.png` (new), `docs/submission/db-proof.png` (new), `docs/submission/architecture.md` (export recipe).
**Concrete work:**
- `architecture.png` — export the mermaid diagram per the recipe in `architecture.md`.
- `db-proof.png` — composite of: RDS console for the named cluster + a live `EXPLAIN ANALYZE` showing Recursive Union / GiST / HNSW nodes + a CloudWatch `ServerlessDatabaseCapacity` 0.0→2.0 ACU graph.
- **Do this AFTER P0-2 cron is warming the cluster** so the ACU graph and live EXPLAIN capture cleanly.
**Acceptance:** Both PNGs exist, are Devpost-uploadable, each showing the named resource with real activity.
**Judging rationale:** A7 (architecture) and A8 (AWS-DB-usage screenshot) are required artifacts; a missing required artifact auto-deflates.
**HAND-BACK:** the RDS/CloudWatch console screenshots require the user's AWS console session — generate the architecture.png and the live EXPLAIN capture yourself, then **hand the user an exact shot list** for the RDS + CloudWatch captures and composite them when returned.

#### P0-6 — Record and host the <3min demo video (the single biggest carrier of every dimension)
**Goal:** A hosted, verified, <3:00 demo video, linked in `submission.md`.
**Files:** `docs/submission/demo-script.md` (existing 175s script), `docs/submission/demo-link.txt` (new).
**Pre-reqs:** P0-1 (cold-start UX), P0-2 (Aurora warm), P0-3 (numbers reconciled) must be true first.
**Shot-by-shot outline (target 165–175s, hard cap 3:00):**
1. **0:00–0:20 — Hook.** Address bar showing `recall-h0.vercel.app`. One line: "When a foodborne outbreak hits, every hour of tracing is lives. Recall does it in one query."
2. **0:20–0:50 — The kill shot.** Paste **PRD-OUTBREAK-0001**. Trace resolves; call out the **verified numbers** (1400 stores / 674,285 units / 81 lots / 80 edges). Map + force-graph populate.
3. **0:50–1:30 — Why only Aurora (Originality middle beat).** Open the **Query Inspector** → live `EXPLAIN(ANALYZE,BUFFERS)` showing Recursive Union + GiST + HNSW. State the thesis: recursive CTE + PostGIS + pgvector + FK-enforced DAG integrity **in one serializable transaction** — what the data model uniquely enables.
4. **1:30–2:05 — Outbreak Time-Travel replay.** Scrub the timeline; "a what-if that re-runs the recursive trace at any point in shipment history — impossible without the FK-DAG + temporal filter in one query."
5. **2:05–2:40 — The zero-stack story.** Keyless OIDC (no AWS keys), Aurora scale-to-zero ($0 idle), Vercel Fluid Compute. Mention the cold-start "warming" UX as a feature, not a bug.
6. **2:40–3:00 — Close.** FDA export / impact line. Live URL on screen.
**Acceptance:** `docs/submission/demo.mp4` exists and is verified **<3:00 by actual duration** (e.g. `ffprobe`, not editor estimate); the EXPLAIN/why-only-Aurora beat lands in the first ~30–90s; address bar shows `recall-h0.vercel.app` (never localhost); a live PRD-OUTBREAK-0001 trace is performed on camera; uploaded unlisted and re-verified playing in a fresh incognito window; hosted URL saved to `docs/submission/demo-link.txt` and pasted into `submission.md`. Aurora warmed ~30s before recording.
**Judging rationale:** Hard-required artifact; where Design + Tech + Originality + Impact are actually scored.
**HAND-BACK:** **You cannot record the screen or speak the narration.** Polish the script in `demo-script.md` to match the outline + verified numbers, then hand the user the exact recording checklist (warm DB first, incognito, address bar visible, <3:00, the 6 beats above). After they record + upload, you verify duration and incognito playback and write `demo-link.txt`.

---

### ── P1 — RELIABILITY & CREDIBILITY (what a technical judge probes) ──

#### P1-1 — Add `/api/health` (liveness) and `/api/ready` (readiness) with correct degraded semantics
**Files:** `app/api/health/route.ts` (new), `app/api/ready/route.ts` (new — same endpoint the P0-2 cron pings).
**Work:** `/api/health` = 200 if the process is up (no DB touch). `/api/ready` = bounded `SELECT 1` with a short statement_timeout: 200 when warm, **503 `{db:'down'}` when DB is paused**.
**Acceptance:** DB paused → health 200, ready 503; warm → ready 200. Documented degraded-mode semantics.
**Rationale:** Org rule "readiness must fail on critical-dependency breakage" + "distinct liveness/readiness/startup probes." Currently no health route exists; the home RSC trace conflates page-render with dependency health.

#### P1-2 — Bound the Bedrock embedding call (timeout + bounded retry + degraded path)
**Files:** `lib/embeddings/bedrock.ts`, `lib/db/queries/trace.ts`.
**Work:** Bedrock client gets a bounded `requestHandler` socket/connect timeout (~5s) and adaptive `maxAttempts` retry (exp backoff + jitter; embed is idempotent). Wrap `embed()` with an overall deadline and a typed "embedding unavailable" **degraded path** (do not let a slow STS/Bedrock hop stall the whole request — embedding runs FIRST in `runTrace`). Add a test exercising the timeout path failing fast within the deadline.
**Acceptance:** Test proves fast-fail within deadline; degraded path is typed and explicit.
**Rationale:** Most cascade-prone dependency is currently the least protected.

#### P1-3 — Exponential backoff + jitter on the SERIALIZABLE 40001 retry loop
**Files:** `lib/db/queries/trace.ts`.
**Work:** The 40001 retry currently `continue`s immediately (zero delay) up to 3×, re-running the heavy fused query instantly — a mini retry-storm. Add bounded backoff (base ~25–50ms, exp by attempt + random jitter) before each retry. Trace is read-only → already idempotent-safe; just pace it.
**Acceptance:** Unit test mocks `pool.connect` to throw 40001 twice then succeed, asserting increasing delay + eventual success; plus a retry-exhaustion test that throws.
**Rationale:** Org rule "bounded idempotent retries with exponential backoff + jitter."

#### P1-4 — Pool-mocked unit suite for 5xx/timeout/retry/degraded (CI-green without Aurora) + split test scripts
**Files:** `test/` (new api-error/retry/timeout suite), `package.json` (split `test:unit` vs `test:integration`).
**Work:** Currently `pnpm test` shows failures purely because Postgres on `:5433` is down (ECONNREFUSED) and `/api/metrics` 500s. Add a **pool-mocked** suite (no live DB) covering: `runTrace` retries on 40001 then succeeds; `runTrace` throws after maxRetries; `traceAction`/route returns the 500 shape with sqlstate on pool error; `page.tsx` renders `bootError` when `runTrace` rejects. Move DB-integration tests into a separate gated script so `pnpm verify` / CI is **green without Aurora**.
**Acceptance:** `pnpm verify` is green with no live DB. Integration tests live behind `pnpm test:integration`.
**Rationale:** Org rule "tests for 5xx/timeout/degraded-mode/retry/rollback"; the "no fuckups / passes before commit" gate is undermined by red CI.

#### P1-5 — Resolve the metrics dead-path: own the in-memory ring honestly
**Files:** `lib/db/queries/metrics.ts`, plus any pitch/Console copy that over-claims.
**Work:** `getMetrics` reads `trace_metrics` if the table exists, but there is **zero** `INSERT INTO trace_metrics` anywhere and live `/api/metrics` returns `lastRowCount:0` — dead code serving a never-populated table. Remove the dead DB read branch; make the per-instance in-memory ring the single source of truth. Fix any copy implying durable cross-instance telemetry. **No migration, no re-seed.**
**Acceptance:** Single source of truth; dead branch gone; copy honest.
**Rationale:** Hidden-failure / dead-code smell a reviewer catches immediately.

#### P1-6 — Per-route rate limiting / concurrency cap on `/api/trace` + `/api/explain`
**Files:** `app/api/trace/route.ts`, `app/api/explain/route.ts`, `lib/api/` (rate-limit helper, new).
**Work:** Pool `max:5`, no admission control. A burst (judge mashing scenarios) queues `pg.connect()` promises. Add an in-memory token bucket capping per-IP concurrency; return bounded **429/503** instead of hanging. `/api/explain` runs full `EXPLAIN ANALYZE` (same cost as trace) and is unauthenticated — cap it too. Relies on the P0-1 `connectionTimeoutMillis` to time-bound waiters.
**Acceptance:** Under a burst the app returns bounded 429/503, not a hang.
**Rationale:** Org rule "protect against cascading failure (backpressure/load-shedding/rate-limit)."

#### P1-7 — Promote the originality interactions into the writeup + demo middle beat
**Files:** `docs/submission/submission.md`, `docs/submission/demo-script.md`.
**Work:** `OutbreakTimeline.tsx` time-travel + `QueryInspector.tsx` live EXPLAIN already exist (trace API accepts `asOf`) but the time-travel replay is unmentioned in `submission.md`. Name it: "a what-if that re-runs the recursive trace at any point in shipment history — impossible without the FK-DAG + temporal filter in one query." Give both an explicit on-camera beat (Originality lands in the demo middle, per P0-6 beats 3–4).
**Acceptance:** `submission.md` names the replay; both get on-camera beats.
**Rationale:** Originality is an explicit dimension; the build already earned the points, the writeup buries them.

#### P1-8 — Confirm v0 requirement status; cite one v0 artifact only if required
**Files:** `docs/proof/` (rules confirmation or v0 link), `docs/submission/submission.md`.
**Work:** The hackathon is co-branded "Vercel v0 and AWS Databases" but there is zero v0 evidence. **Either** confirm the rules do NOT require v0 (document in `docs/proof/`), **or** regenerate ONE non-critical surface (the `/pitch` hero or a standalone marketing page) in v0.app, cite the published project link, and add a "Built with Vercel Fluid Compute + v0" line to `submission.md`. **Do NOT rebuild the working console in v0** — regression risk violates "no fuckups."
**Acceptance:** Either documented confirmation or a cited v0 link on a non-critical surface. Verified console unchanged.
**Rationale:** Soft vercelFit scoring gap; minimize risk.

---

### ── P2 — POLISH (do after P0/P1 are green) ──

- **P2-1 — Stage the `/submission` manifest:** `live-url.txt`, `team-id.txt` (= `team_vr98mdXQJyxKN5yAtBuO48T8`), `demo-link.txt`, `architecture.png`, `db-proof.png`. Each Devpost field maps to one staged file.
- **P2-2 — Anchor the FDA 24h SLA countdown** (`TopBar.tsx` `SlaCountdown`) to incident `reportedAt + 24h`, not page-load (it currently resets to a fresh 24:00:00 every reload — reads as decorative).
- **P2-3 — Throttle map pin-pulse:** `MapPane` animates `box-shadow` on all 1400 markers unconditionally. Pulse only recently-arrived/newest pins; leave the rest as static glowing dots.
- **P2-4 — Fix mobile console layout:** `Console.tsx` mobile grid is `min-h-[1720px]` with the maplibre canvas trapping vertical touch-scroll. Collapse to tabs/accordion or gate `dragPan` behind a tap-to-interact overlay.
- **P2-5 — `/api/explain` embedding parity:** `explain.ts` embeds the raw TLC while trace embeds the lot's `product_name` — the "live EXPLAIN of the exact hero query" uses a different pgvector operand. Factor out a shared `embeddingFor()`; let explain inherit the P0-1 `statement_timeout` and the P1-3 retry helper.
- **P2-6 — Structured JSON logs** with correlation/trace ID, dependency name, upstream status, retry count, failure class (+ a documented failure-class enum). Full Datadog wiring is out of scope in 7 days; ship the structured logs + enum so the observability story is credible.
- **P2-7 — Verify `QueryInspector`** wraps `/api/explain` in a bounded timeout + skeleton + error fallback (match the `LineageDrawer`/`IncidentInbox` AbortController pattern) so a cold EXPLAIN never shows a stuck blank panel.
- **P2-8 — Hero screenshots** of the live console for the README/Devpost gallery (cheap visual credibility once the repo is public).

---

## 4. WRITEUP SKELETON (`submission.md` — keep the verified precision, fix the numbers)

```
# Recall — The Outbreak Console
One-line thesis: One serializable Aurora query traces a foodborne outbreak to every affected store.

## The problem & impact
## The one-query kill shot   ← hero SQL; recursive CTE + PostGIS GiST + pgvector HNSW in ONE serializable txn
## Verified numbers          ← PRD-OUTBREAK-0001: 1400 stores / 674,285 units / 81 lots / 80 edges (reconcile to live!)
## Why only Aurora           ← keep the precise framing; do NOT over-claim DSQL lacks recursive CTEs
## Originality: Outbreak Time-Travel replay + live EXPLAIN inspector   ← P1-7
## The zero stack            ← keyless OIDC (no AWS keys), Aurora scale-to-zero ($0 idle), Vercel Fluid Compute
## Reliability               ← bounded timeouts, health/ready probes, backoff+jitter, rate limiting (P0-1, P1-1/3/6)
## Links                     ← live URL, public repo, demo video (demo-link.txt), architecture.png, db-proof.png
## Built with Vercel ...     ← v0 line only if P1-8 requires it
```

---

## 5. WORKING PROTOCOL

1. **Read first.** Open `AGENTS.md` + `CLAUDE.md`, then the relevant guide in `node_modules/next/dist/docs/` **before writing any Next.js code** — this Next 16 has breaking changes vs. training data (App Router conventions, `route.ts` exports, `loading.tsx`, `maxDuration`). Heed deprecation notices.
2. **Small reversible commits.** One P-item per commit. Each commit message ends with the Co-Authored-By line per repo convention. Branch off `main`; do not push unless the user asks.
3. **Self-verify every item** against its acceptance criteria, and run the full gate (§2.5) before each commit. Run `pnpm bench` after any engine-adjacent change to confirm no latency regression.
4. **Report progress** after each P-item: what changed, which files, gate result, what's left.
5. **Hand back to the human — explicitly, with exact commands — for:**
   - Any **DB-secret / migrate / seed / secret-fetch** step (the Bash hook blocks these). E.g. if a task ever needed `pnpm db:migrate` or `pnpm db:seed`, STOP and hand the exact command. (The plan is no-re-seed, so this should rarely trigger.)
   - **Recording the demo video** and **speaking the narration** (P0-6) — you polish the script and verify the result; you cannot record.
   - **RDS console + CloudWatch screenshots** (P0-5) — you produce the shot list and composite; the user captures from their AWS console.
   - **Flipping repo visibility public** and any **Vercel env/secret** writes (P0-2/P0-4) — propose the exact `gh`/`vercel` command and let the user confirm.
   - **The final Devpost form submission** itself.

---

## 6. DEFINITION OF DONE (mapped to judging dimensions)

- **Technological Implementation** — repo public with real README + LICENSE (P0-4); `pnpm verify` green without Aurora (P1-4); bounded timeouts, health/ready probes, backoff+jitter, rate limiting all shipped + tested (P0-1, P1-1/2/3/6); metrics dead-path removed (P1-5). The `TRACE_SQL` fusion and live `/api/explain` untouched.
- **awsDbFit / Database usage** — `db-proof.png` shows the named cluster + live EXPLAIN (Recursive Union/GiST/HNSW) + ACU 0→2 graph (P0-5); Aurora kept warm via cron (P0-2); keyless OIDC preserved.
- **Design / Demo clarity** — hosted <3:00 demo video, address bar on live URL, kill shot early, cold-start "warming" state as narrative (P0-6, P0-1); mobile layout + map perf fixed (P2-3/4).
- **Originality** — Outbreak Time-Travel replay + live EXPLAIN inspector promoted in writeup and demo middle beat (P1-7).
- **Impact / Credibility** — every reproducible number matches live (P0-3); architecture.png present (P0-5); FDA export + impact narration land.
- **vercelFit** — v0 status resolved (P1-8); Fluid Compute + cron documented.
- **Submittable** — `/submission` manifest staged (P2-1); every Devpost field verified in a fresh incognito window on the day; submitted with margin before **2026-06-30**.

**The whole plan is no-re-seed. If you ever find yourself wanting to re-seed Aurora to make a number match — stop, and reconcile the docs instead.**
