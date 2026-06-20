# Phase 06 — The Query Inspector

**Outcome:** A collapsible `components/console/QueryInspector.tsx` panel that shows (a) the **actual hero SQL string** imported from `lib/db/queries/trace.ts` and (b) the **live `EXPLAIN (ANALYZE, BUFFERS)` plan** fetched from `POST /api/explain` — with the **Recursive Union** node, the **HNSW Index Scan** (`idx_incidents_hnsw`), and the **GiST spatial path** (`idx_stores_geom`) parsed out of the plan text and visually highlighted + annotated. Nothing is hardcoded; the plan is fetched server-side from the live database every time it opens.

**Depends on / Unblocks**
- **Depends on:** [`PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) (exports `TRACE_SQL` + `runTrace`), [`PHASE-04-api-layer.md`](./PHASE-04-api-layer.md) (`POST /api/explain` returning `{ plan, nodes }`), [`PHASE-05-outbreak-console.md`](./PHASE-05-outbreak-console.md) (the console shell + `TopBar` toggle slot + shadcn/ui present).
- **Unblocks:** [`PHASE-11-demo-and-submission.md`](./PHASE-11-demo-and-submission.md) — this panel **is** the single highest-leverage screenshot/video beat (`1:08–1:28` in the storyboard). Once it works, the "DB is the protagonist" proof is on camera.

**Effort:** ~0.5 day (M4 in [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) §11). This is **cheap to build and high-leverage** — treat it as the best ROI in the project.

---

> **Why this phase matters more than its size suggests.** Most of the ~6,000-entrant field hides the SQL. Recall does the opposite: it puts the *live query plan* on screen and says **"the database is doing the work — the graph IS the recursion, the map IS the geo JOIN, the rail IS the vector search."** That sentence only lands if the judge is staring at a **real** `EXPLAIN (ANALYZE, BUFFERS)` with the three key nodes annotated. A fabricated or pretty-printed-but-fake plan is the fastest way to *lose* the credibility this whole thesis is built on. **Never hardcode the plan. Never fake the timings.** (See [`./CONVENTIONS.md`](./CONVENTIONS.md) §12 anti-fake rules.)

---

## 1. Objectives

1. Build `components/console/QueryInspector.tsx` — a **collapsible** panel (closed by default, toggled from the `TopBar`) that occupies a bottom drawer / docked panel in the Outbreak Console.
2. **Top half = the SQL.** Render the exact `TRACE_SQL` string imported from `lib/db/queries/trace.ts` in a monospace block. It must be the *same* string the hero endpoint executes — imported, not copy-pasted — so the "this is the real query" claim is literally true.
3. **Bottom half = the live plan.** On open (and on a manual "Re-run EXPLAIN" button), fetch `POST /api/explain { tlc }` → `{ plan, nodes }`, where `plan` is the raw `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` output of the hero query and `nodes` is the parsed tag list.
4. **Annotate three nodes.** Parse the plan text (helper `lib/explain/annotate.ts`, mirrored server-side in `lib/db/explain.ts`) to find and visually highlight:
   - the **Recursive Union** node (proves graph recursion happens in the engine),
   - the **HNSW Index Scan** on `idx_incidents_hnsw` (proves the pgvector path),
   - the **GiST / spatial path** for `idx_stores_geom` (proves the PostGIS path).
   Each gets a colored left-border, an inline badge, and a one-line plain-English caption.
5. **Toggle works during a live trace.** Opening/closing the inspector mid-trace never blocks the trace and never throws; the panel reflects the **current** `tlc` in the console.
6. End the phase **GREEN** ([`./CONVENTIONS.md`](./CONVENTIONS.md) §12): `pnpm typecheck && pnpm lint && pnpm test` pass, the app runs, the inspector shows a real plan with the three nodes annotated, and a `BUILD_LOG.md` entry is appended.

---

## 2. Prerequisites (checklist)

- [ ] Local DB up with **real seed volume** (`pnpm db:up && pnpm db:migrate && pnpm db:seed`) — `EXPLAIN ANALYZE` over 12 rows proves nothing; you need the ~250k-edge graph from [`PHASE-02-seed-data.md`](./PHASE-02-seed-data.md).
- [ ] `lib/db/queries/trace.ts` exports a **named** `TRACE_SQL` string and `runTrace` (from [`PHASE-03-hero-query.md`](./PHASE-03-hero-query.md)). If it's currently a local `const`, export it now.
- [ ] `POST /api/explain` exists (from [`PHASE-04-api-layer.md`](./PHASE-04-api-layer.md)) and returns `{ plan: string, nodes: { type, detail }[] }` per [`./CONVENTIONS.md`](./CONVENTIONS.md) §10. This phase **hardens** it (BUFFERS + parsing); if it's a stub, the step-by-step replaces it.
- [ ] `lib/embeddings/index.ts` `embed()` works locally (`EMBED_PROVIDER=local`, `EMBED_DIM=384`) so `/api/explain` can build the `$2::vector` param exactly like the hero path.
- [ ] The console (`app/page.tsx` + `components/console/*`) renders and knows the **current `tlc`** (lifted to a client state / store in [`PHASE-05-outbreak-console.md`](./PHASE-05-outbreak-console.md)); `TopBar` has a slot/handler for the inspector toggle.
- [ ] shadcn/ui present with at least `button` and `collapsible` (or `sheet`) installed: `pnpm dlx shadcn@latest add button collapsible badge scroll-area`.
- [ ] `DEMO_TLC=PRD-OUTBREAK-0001` set in `.env` so the default plan is the dramatic ~1,400-store one.

> **Cold-cache warning (read before recording):** the **first** `EXPLAIN ANALYZE` after a DB restart runs over cold shared buffers and can be several×slower than steady-state. Always fire one warm-up trace (or open the inspector once) before the on-camera run. See §6.

---

## 3. Step-by-step

> All paths are repo-root relative ([`./CONVENTIONS.md`](./CONVENTIONS.md) §5). The Next.js app lives at the repository root.

### 3.1 Export the SQL string from the hero query module

The inspector must show the **same** string the hero endpoint runs. Confirm `lib/db/queries/trace.ts` exports it by name (added in Phase 03). If it does not yet, make it a top-level `export const`:

```ts
// lib/db/queries/trace.ts  (excerpt — the string MUST be exported, verbatim from CONVENTIONS §7)
/**
 * The hero forward-trace query. ONE statement, executed inside
 * BEGIN ISOLATION LEVEL SERIALIZABLE. Params:
 *   $1 = tlc (text)
 *   $2 = query_embedding (::vector)
 *   $3 = as_of (timestamptz) or NULL
 * This exact string is surfaced to the Query Inspector — do not duplicate it elsewhere.
 */
export const TRACE_SQL = `
WITH RECURSIVE contaminated AS (
  SELECT l.lot_id, 0 AS depth, ARRAY[l.lot_id] AS path
  FROM lots l WHERE l.tlc = $1
  UNION ALL
  SELECT ll.child_lot_id, c.depth + 1, c.path || ll.child_lot_id
  FROM contaminated c JOIN lot_links ll ON ll.parent_lot_id = c.lot_id
  WHERE c.depth < 12 AND ll.child_lot_id <> ALL(c.path)        -- depth guard + cycle guard
),
edges AS (
  SELECT DISTINCT ll.parent_lot_id, ll.child_lot_id, ll.transform_event
  FROM lot_links ll JOIN contaminated p ON p.lot_id = ll.parent_lot_id JOIN contaminated c ON c.lot_id = ll.child_lot_id
),
affected AS (
  SELECT s.store_id, s.name, s.chain, s.address, ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lng, SUM(sh.units) AS units
  FROM shipments sh JOIN contaminated c ON c.lot_id = sh.lot_id JOIN stores s ON s.store_id = sh.store_id
  WHERE ($3::timestamptz IS NULL OR sh.shipped_at <= $3)
  GROUP BY s.store_id, s.name, s.chain, s.address, s.geom
),
similar AS (
  SELECT i.incident_id, i.raw_text, i.pathogen, 1 - (i.embedding <=> $2::vector) AS score
  FROM incidents i WHERE i.suspected_lot_id IN (SELECT lot_id FROM contaminated) OR i.suspected_lot_id IS NULL
  ORDER BY i.embedding <=> $2::vector LIMIT 5
)
SELECT (SELECT count(*) FROM contaminated) AS lot_count, (SELECT json_agg(edges) FROM edges) AS edges,
       (SELECT json_agg(affected ORDER BY units DESC) FROM affected) AS stores, (SELECT coalesce(sum(units),0) FROM affected) AS total_units,
       (SELECT count(*) FROM affected) AS store_count, (SELECT json_agg(similar) FROM similar) AS incidents;
`.trim();
```

> Whatever the precise text, **import it** — never re-type it in the component. The single source of truth is `trace.ts`.

### 3.2 The plan-parsing helper (the load-bearing logic)

Create `lib/explain/annotate.ts`. It takes raw `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` output and returns the same lines plus a tag list. We use **`FORMAT TEXT`** (not JSON) because the text plan is what reads as authentic on camera — but text parsing must be tolerant of indentation, the leading `->` arrows, and PG version wording differences.

The three nodes we tag, and the substrings that identify each (case-insensitive, matched per line):

| Tag | Identifying signal in the TEXT plan | What it proves |
|---|---|---|
| `recursive-union` | a line containing `Recursive Union` | graph recursion runs **in the engine**, not app code |
| `hnsw` | a line naming `idx_incidents_hnsw` **or** an `Index Scan` whose following `Order By:` mentions `<=>` (cosine) | the pgvector **HNSW** path is used |
| `gist` | a line naming `idx_stores_geom`, **or** a `Bitmap`/`Index Scan` on `stores` paired with a spatial operator (`ST_`, `&&`, `@>`) | the **PostGIS GiST** spatial path is used |

```ts
// lib/explain/annotate.ts
// Pure, dependency-free, runs identically on server and client.
// Parses EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) output and tags the three hero nodes.

export type ExplainTag = "recursive-union" | "hnsw" | "gist";

export interface AnnotatedLine {
  /** zero-based line index in the original plan text */
  index: number;
  /** the original, untouched plan line (preserve whitespace for fidelity) */
  text: string;
  /** indentation depth, derived from leading spaces / arrow nesting (for optional tree rendering) */
  depth: number;
  /** the tag this line anchors, if any */
  tag: ExplainTag | null;
}

export interface ExplainNode {
  type: string; // human label, e.g. "Recursive Union"
  detail: string; // the trimmed plan line that matched
  tag: ExplainTag;
  line: number; // index into AnnotatedLine[]
}

export interface AnnotatedPlan {
  lines: AnnotatedLine[];
  nodes: ExplainNode[]; // one per tag found (first match wins); 0..3 entries
  /** which of the three hero tags were present — drives the "3/3 nodes proven" chip */
  found: Record<ExplainTag, boolean>;
}

const HERO_LABEL: Record<ExplainTag, string> = {
  "recursive-union": "Recursive Union",
  hnsw: "HNSW Index Scan",
  gist: "GiST Spatial Path",
};

// Each matcher tests ONE trimmed plan line. Order of evaluation per line: first hit tags the line.
const MATCHERS: { tag: ExplainTag; test: (line: string) => boolean }[] = [
  {
    tag: "recursive-union",
    // PG prints "Recursive Union  (cost=...)" as its own node line
    test: (l) => /recursive union/i.test(l),
  },
  {
    tag: "hnsw",
    // Most reliable: the index name appears in the Index Scan line.
    // Fallback: an index scan whose ordering uses the cosine operator (<=>) implies the HNSW path.
    test: (l) =>
      /idx_incidents_hnsw/i.test(l) ||
      (/index scan/i.test(l) && /incidents/i.test(l)) ||
      (/order by/i.test(l) && /<=>/.test(l)),
  },
  {
    tag: "gist",
    // The GiST index by name, or a spatial scan on stores using a PostGIS operator/function.
    test: (l) =>
      /idx_stores_geom/i.test(l) ||
      ((/index scan|bitmap (index|heap) scan/i.test(l) && /stores/i.test(l)) &&
        /(st_|geom|&&|@>|<->)/i.test(l)),
  },
];

/** Derive a rough nesting depth from leading whitespace + the `->` child marker. */
function lineDepth(raw: string): number {
  const leading = raw.length - raw.trimStart().length;
  // PG indents children by ~6 spaces and prefixes with "->"; approximate depth by /3.
  return Math.floor(leading / 3);
}

export function annotateExplain(planText: string): AnnotatedPlan {
  const rawLines = planText.replace(/\r\n/g, "\n").split("\n");
  const found: Record<ExplainTag, boolean> = {
    "recursive-union": false,
    hnsw: false,
    gist: false,
  };
  const nodes: ExplainNode[] = [];

  const lines: AnnotatedLine[] = rawLines.map((text, index) => {
    const trimmed = text.trim();
    let tag: ExplainTag | null = null;

    for (const m of MATCHERS) {
      // only the FIRST occurrence of each tag anchors a node (the node line, not its child detail lines)
      if (!found[m.tag] && m.test(trimmed)) {
        tag = m.tag;
        found[m.tag] = true;
        nodes.push({
          type: HERO_LABEL[m.tag],
          detail: trimmed,
          tag: m.tag,
          line: index,
        });
        break;
      }
    }

    return { index, text, depth: lineDepth(text), tag };
  });

  return { lines, nodes, found };
}

/** Convenience for the API route: the {type, detail}[] shape from CONVENTIONS §10. */
export function explainNodes(planText: string): { type: string; detail: string }[] {
  return annotateExplain(planText).nodes.map((n) => ({ type: n.type, detail: n.detail }));
}
```

> **Why first-match-per-tag:** a TEXT plan repeats keywords across a node's child lines (`Index Cond:`, `Buffers:`, `Order By:`). We only want the **node header** highlighted, so each tag is claimed once by the first line that matches it, top-down. The `nodes[]` list is therefore 0–3 entries, one per hero capability proven.

### 3.3 The server side: harden `lib/db/explain.ts` and the route

`lib/db/explain.ts` runs the real `EXPLAIN` against the pool. It must build the **same three params** the hero query uses (so the plan reflects the real execution), and must **not** wrap `EXPLAIN ANALYZE` in `BEGIN SERIALIZABLE ... COMMIT` for the purposes of the panel — running it plain is fine and avoids holding a serializable txn open. We do `ANALYZE` (real timings) + `BUFFERS` (cache evidence).

```ts
// lib/db/explain.ts
import { getPool } from "@/lib/db/pool";
import { TRACE_SQL } from "@/lib/db/queries/trace";
import { embed } from "@/lib/embeddings";

/**
 * Runs EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) on the EXACT hero query, with the
 * same params the trace uses, against the live DB. Returns the raw plan text.
 * NOT cached, NOT hardcoded — every call hits Postgres.
 */
export async function explainTrace(
  tlc: string,
  asOf: string | null = null,
): Promise<{ plan: string; tlc: string }> {
  const pool = getPool();
  // Embed the lot string exactly like the hero path so $2::vector is realistic.
  const vec = await embed(tlc);
  const vectorLiteral = `[${vec.join(",")}]`;

  const sql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${TRACE_SQL}`;

  const client = await pool.connect();
  try {
    const res = await client.query<{ "QUERY PLAN": string }>(sql, [
      tlc,
      vectorLiteral,
      asOf,
    ]);
    const plan = res.rows.map((r) => r["QUERY PLAN"]).join("\n");
    return { plan, tlc };
  } finally {
    client.release(); // return to pool — never close in serverless (CONVENTIONS §3)
  }
}
```

```ts
// app/api/explain/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { explainTrace } from "@/lib/db/explain";
import { explainNodes } from "@/lib/explain/annotate";

export const dynamic = "force-dynamic"; // never cache the plan (CONVENTIONS §12 anti-fake)

const Body = z.object({
  tlc: z.string().min(1).max(128),
  asOf: z.string().datetime().nullish(),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "invalid body", detail: String(e) }, { status: 400 });
  }

  try {
    const { plan } = await explainTrace(parsed.tlc, parsed.asOf ?? null);
    // CONVENTIONS §10: { plan: string, nodes: {type, detail}[] }
    return NextResponse.json({ plan, nodes: explainNodes(plan) });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "explain failed", detail }, { status: 500 });
  }
}
```

> **`force-dynamic` is non-negotiable here.** A cached plan is a *fake* plan. The whole point is that it is re-measured live on camera.

### 3.4 The component: `components/console/QueryInspector.tsx`

A `"use client"` component. It (1) shows `TRACE_SQL`, (2) fetches `/api/explain` on open and on demand, (3) renders the annotated plan with the three nodes highlighted, and (4) shows a "3/3 nodes proven" chip + per-node legend. It is collapsible and controlled from the parent so the `TopBar` toggle and an internal header chevron both work.

```tsx
// components/console/QueryInspector.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TRACE_SQL } from "@/lib/db/queries/trace";
import {
  annotateExplain,
  type AnnotatedPlan,
  type ExplainTag,
} from "@/lib/explain/annotate";
import { Button } from "@/components/ui/button";

type ExplainResponse = { plan: string; nodes: { type: string; detail: string }[] };

interface QueryInspectorProps {
  /** current TLC in the console; the plan is re-fetched for this lot */
  tlc: string;
  /** open state is controlled by the parent so the TopBar toggle works */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** optional asOf from the time slider */
  asOf?: string | null;
}

const TAG_META: Record<
  ExplainTag,
  { label: string; caption: string; color: string; chip: string }
> = {
  "recursive-union": {
    label: "Recursive Union",
    caption: "The supply-DAG graph traversal — recursion runs IN the engine.",
    color: "border-l-rose-500 bg-rose-500/10",
    chip: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
  },
  hnsw: {
    label: "HNSW Index Scan",
    caption: "pgvector similarity — the 'similar incidents' rail.",
    color: "border-l-violet-500 bg-violet-500/10",
    chip: "bg-violet-500/15 text-violet-300 ring-violet-500/40",
  },
  gist: {
    label: "GiST Spatial Path",
    caption: "PostGIS store geography — the map pins.",
    color: "border-l-emerald-500 bg-emerald-500/10",
    chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  },
};

const ALL_TAGS: ExplainTag[] = ["recursive-union", "hnsw", "gist"];

export function QueryInspector({
  tlc,
  open,
  onOpenChange,
  asOf = null,
}: QueryInspectorProps) {
  const [plan, setPlan] = useState<AnnotatedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  // guard against a stale fetch overwriting a newer one (rapid re-traces)
  const reqId = useRef(0);

  const runExplain = useCallback(async () => {
    if (!tlc) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tlc, asOf }),
        cache: "no-store",
      });
      if (id !== reqId.current) return; // a newer request superseded this one
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ExplainResponse;
      setPlan(annotateExplain(data.plan));
      setElapsedMs(Math.round(performance.now() - t0));
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [tlc, asOf]);

  // Fetch when the panel opens or the lot changes while open.
  useEffect(() => {
    if (open) void runExplain();
  }, [open, runExplain]);

  return (
    <section
      aria-label="Query Inspector"
      className="border-t border-zinc-800 bg-zinc-950/95 text-zinc-200"
    >
      {/* Header / toggle bar */}
      <header className="flex items-center gap-3 px-4 py-2">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="flex items-center gap-2 text-sm font-medium text-zinc-100 hover:text-white"
        >
          <span
            className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          Query Inspector
        </button>

        {open && (
          <>
            <NodeProofChip plan={plan} />
            <div className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
              {elapsedMs != null && !loading && (
                <span title="round-trip to fetch the live plan">
                  EXPLAIN fetched in {elapsedMs} ms
                </span>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void runExplain()}
                disabled={loading}
              >
                {loading ? "Running EXPLAIN…" : "Re-run EXPLAIN"}
              </Button>
            </div>
          </>
        )}
      </header>

      {open && (
        <div className="grid max-h-[42vh] grid-cols-1 gap-4 overflow-auto px-4 pb-4 lg:grid-cols-2">
          {/* Left: the exact hero SQL */}
          <div className="min-w-0">
            <h3 className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
              The hero query — one SERIALIZABLE statement
            </h3>
            <pre className="overflow-auto rounded-md border border-zinc-800 bg-black/60 p-3 text-[11px] leading-relaxed text-zinc-300">
              <code>{TRACE_SQL}</code>
            </pre>
          </div>

          {/* Right: the live, annotated plan */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wide text-zinc-500">
                Live EXPLAIN (ANALYZE, BUFFERS) — lot {tlc}
              </h3>
              <Legend />
            </div>

            {error ? (
              <div className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">
                EXPLAIN failed — {error}{" "}
                <button className="underline" onClick={() => void runExplain()}>
                  retry
                </button>
              </div>
            ) : loading && !plan ? (
              <PlanSkeleton />
            ) : plan ? (
              <PlanView plan={plan} />
            ) : (
              <p className="text-xs text-zinc-500">Open to fetch the live plan.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** "3/3 hero nodes proven" chip — turns amber if any node is missing. */
function NodeProofChip({ plan }: { plan: AnnotatedPlan | null }) {
  if (!plan) return null;
  const count = ALL_TAGS.filter((t) => plan.found[t]).length;
  const ok = count === 3;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
        ok
          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
          : "bg-amber-500/15 text-amber-300 ring-amber-500/40"
      }`}
      title="Recursive Union · HNSW Index Scan · GiST spatial path"
    >
      {count}/3 hero nodes in plan
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ALL_TAGS.map((t) => (
        <span
          key={t}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${TAG_META[t].chip}`}
        >
          {TAG_META[t].label}
        </span>
      ))}
    </div>
  );
}

function PlanView({ plan }: { plan: AnnotatedPlan }) {
  return (
    <div className="overflow-auto rounded-md border border-zinc-800 bg-black/60 text-[11px] leading-relaxed">
      {plan.lines.map((line) => {
        const meta = line.tag ? TAG_META[line.tag] : null;
        return (
          <div
            key={line.index}
            className={
              meta
                ? `border-l-2 ${meta.color} px-3 py-0.5 font-mono`
                : "border-l-2 border-l-transparent px-3 py-0.5 font-mono text-zinc-400"
            }
          >
            <span className="whitespace-pre">{line.text || " "}</span>
            {meta && (
              <span className="ml-2 align-middle text-[10px] italic text-zinc-400">
                ← {meta.label}: {meta.caption}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div className="space-y-1 rounded-md border border-zinc-800 bg-black/60 p-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-zinc-800"
          style={{ width: `${60 + ((i * 7) % 35)}%` }}
        />
      ))}
    </div>
  );
}
```

### 3.5 Wire the toggle into the console

Lift the `open` state into the console page (or the same client store that holds the current `tlc`), pass a toggle handler to `TopBar`, and dock the inspector at the bottom of the console.

```tsx
// app/page.tsx  (or the console client wrapper from PHASE-05) — excerpt
"use client";
import { useState } from "react";
import { TopBar } from "@/components/console/TopBar";
import { QueryInspector } from "@/components/console/QueryInspector";
// ... GraphPane, MapPane, IncidentRail imports

export default function ConsolePage(/* props from RSC first paint */) {
  const [tlc, setTlc] = useState(process.env.NEXT_PUBLIC_DEMO_TLC ?? "PRD-OUTBREAK-0001");
  const [inspectorOpen, setInspectorOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <TopBar
        tlc={tlc}
        onTrace={setTlc}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
        inspectorOpen={inspectorOpen}
      />
      <main className="flex min-h-0 flex-1">
        {/* GraphPane / MapPane / IncidentRail ... */}
      </main>
      <QueryInspector tlc={tlc} open={inspectorOpen} onOpenChange={setInspectorOpen} />
    </div>
  );
}
```

```tsx
// components/console/TopBar.tsx — add the toggle button (excerpt)
<button
  type="button"
  onClick={onToggleInspector}
  aria-pressed={inspectorOpen}
  className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
>
  {inspectorOpen ? "Hide" : "Show"} Query Inspector
</button>
```

> The `TopBar` props (`onToggleInspector`, `inspectorOpen`) are added here; everything else in `TopBar` (latency chip, row count, SLA timer) comes from [`PHASE-05-outbreak-console.md`](./PHASE-05-outbreak-console.md).

### 3.6 A small unit test for the parser

The parser is the only logic with edge cases, so test it against a captured real plan fragment (paste a real one from §6 once you have it; the fixture below is representative TEXT-format output).

```ts
// test/explain-annotate.test.ts
import { describe, expect, it } from "vitest";
import { annotateExplain } from "@/lib/explain/annotate";

const SAMPLE = `
Subquery Scan  (cost=... rows=... width=...) (actual time=812.4..812.5 rows=1 loops=1)
  CTE contaminated
    ->  Recursive Union  (cost=... rows=...) (actual time=0.1..40.2 rows=4211 loops=1)
          ->  Index Scan using lots_tlc_key on lots l  (actual time=0.05..0.06 rows=1 loops=1)
          ->  Nested Loop  (actual time=...)
                ->  Index Scan using idx_lot_links_parent on lot_links ll  (actual time=...)
  CTE similar
    ->  Limit  (actual time=...)
          ->  Index Scan using idx_incidents_hnsw on incidents i  (actual time=2.1..3.4 rows=5 loops=1)
                Order By: (embedding <=> '[...]'::vector)
  ->  Bitmap Heap Scan on stores s  (actual time=...)
        ->  Bitmap Index Scan on idx_stores_geom  (actual time=...)
Planning Time: 1.2 ms
Execution Time: 814.0 ms
`.trim();

describe("annotateExplain", () => {
  it("finds all three hero nodes", () => {
    const { found, nodes } = annotateExplain(SAMPLE);
    expect(found["recursive-union"]).toBe(true);
    expect(found.hnsw).toBe(true);
    expect(found.gist).toBe(true);
    expect(nodes).toHaveLength(3);
  });

  it("anchors each tag exactly once (node header, not child detail lines)", () => {
    const tagged = annotateExplain(SAMPLE).lines.filter((l) => l.tag);
    expect(tagged.filter((l) => l.tag === "recursive-union")).toHaveLength(1);
    expect(tagged.filter((l) => l.tag === "hnsw")).toHaveLength(1);
    expect(tagged.filter((l) => l.tag === "gist")).toHaveLength(1);
  });

  it("preserves every original line", () => {
    expect(annotateExplain(SAMPLE).lines).toHaveLength(SAMPLE.split("\n").length);
  });

  it("reports missing nodes without throwing (empty-plan robustness)", () => {
    const { found } = annotateExplain("Seq Scan on lots  (actual time=...)");
    expect(found["recursive-union"]).toBe(false);
    expect(found.hnsw).toBe(false);
    expect(found.gist).toBe(false);
  });
});
```

### 3.7 Run it and verify against the live DB

```bash
# 1) Ensure real seed volume is loaded (idempotent if already done)
pnpm db:up && pnpm db:migrate && pnpm db:seed

# 2) Sanity-check the route returns a REAL plan with all three nodes
pnpm dev   # in another shell
curl -s -X POST http://localhost:3000/api/explain \
  -H 'Content-Type: application/json' \
  -d '{"tlc":"PRD-OUTBREAK-0001"}' | python3 -m json.tool | head -60
# Expect: a long "plan" string and a "nodes" array of length 3 with
#         types "Recursive Union", "HNSW Index Scan", "GiST Spatial Path".

# 3) Open the app, click "Show Query Inspector", confirm the panel + annotations.
```

---

## 4. Key files

| Path | Purpose |
|---|---|
| `lib/explain/annotate.ts` | **New.** Pure parser: tags Recursive Union / HNSW / GiST lines in a TEXT plan; exports `annotateExplain` + `explainNodes`. Shared by route and component. |
| `lib/db/explain.ts` | **Harden.** Runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` on the exact `TRACE_SQL` with real params; returns raw plan text. Never cached. |
| `app/api/explain/route.ts` | **Harden.** zod-validated `POST` → `{ plan, nodes }` per CONVENTIONS §10; `force-dynamic`. |
| `components/console/QueryInspector.tsx` | **New (this phase's deliverable).** Collapsible panel: hero SQL (imported) + live annotated plan + "3/3 nodes" chip + Re-run button. |
| `components/console/TopBar.tsx` | **Edit.** Add the inspector toggle button + `onToggleInspector`/`inspectorOpen` props. |
| `app/page.tsx` (console wrapper) | **Edit.** Lift `inspectorOpen` state; render `<QueryInspector tlc … open … />` docked at bottom. |
| `lib/db/queries/trace.ts` | **Confirm export.** `TRACE_SQL` must be an exported named const (single source of truth). |
| `test/explain-annotate.test.ts` | **New.** vitest for the parser (all-three-found, single-anchor, line-preservation, empty-plan). |

---

## 5. Definition of Done

Run each command; the expected result is stated. The phase is done only when **all** pass and the visual checks hold.

- [ ] **Parser tests green.**
  ```bash
  pnpm test test/explain-annotate.test.ts
  ```
  Expected: all cases pass (3 nodes found, each anchored once, lines preserved, empty plan safe).
- [ ] **Whole suite + types + lint green** ([`./CONVENTIONS.md`](./CONVENTIONS.md) §12).
  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  ```
  Expected: no type errors, no lint errors, all tests pass.
- [ ] **Route returns a REAL plan with three parsed nodes** (not hardcoded — re-run twice, timings differ).
  ```bash
  curl -s -X POST http://localhost:3000/api/explain -H 'Content-Type: application/json' \
    -d '{"tlc":"PRD-OUTBREAK-0001"}' | python3 -c \
    'import sys,json;d=json.load(sys.stdin);print("plan_chars",len(d["plan"]));print("node_types",[n["type"] for n in d["nodes"]])'
  ```
  Expected: `plan_chars` in the thousands; `node_types` == `['Recursive Union', 'HNSW Index Scan', 'GiST Spatial Path']`.
- [ ] **The plan text actually contains the proof substrings.**
  ```bash
  curl -s -X POST http://localhost:3000/api/explain -H 'Content-Type: application/json' \
    -d '{"tlc":"PRD-OUTBREAK-0001"}' | python3 -c \
    'import sys,json;p=json.load(sys.stdin)["plan"].lower();
print("recursive_union", "recursive union" in p);
print("hnsw_index", "idx_incidents_hnsw" in p);
print("gist_index", "idx_stores_geom" in p);
print("execution_time", "execution time" in p)'
  ```
  Expected: all four `True`. (If `idx_incidents_hnsw` is absent, see §6 — the planner may have skipped the HNSW scan; the fallback matcher still tags it, but you want the index used.)
- [ ] **Live app, on screen:** open the running app, click **Show Query Inspector**, and confirm:
  - the **left** pane shows the same SQL as `lib/db/queries/trace.ts` (imported, not retyped),
  - the **right** pane shows real `EXPLAIN (ANALYZE, BUFFERS)` text with an `Execution Time:` line,
  - the **Recursive Union**, **HNSW Index Scan**, and **GiST Spatial Path** lines each have a colored left-border + inline caption,
  - the header shows **"3/3 hero nodes in plan"** in green.
- [ ] **Toggle works during a live trace:** start a trace, open/close the inspector while it runs — no crash, no blocked trace; closing then re-opening re-fetches for the **current** lot.
- [ ] **Nothing hardcoded:** clicking **Re-run EXPLAIN** produces a fresh plan with **different** `actual time=` numbers from the previous run (proves it's live).
- [ ] **BUILD_LOG.md** entry appended (§8).

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **Cold cache on the first EXPLAIN** | First on-camera plan shows 3–10× the steady-state `Execution Time:` and lots of `read=` buffers | Fire one warm-up trace (or open the inspector once) **before** recording; on Aurora keep a sane ACU floor warm ([`../deep-dives/01-recall.md`](./../deep-dives/01-recall.md) §13). The `BUFFERS` line will then show `hit=` >> `read=`. |
| **Planner skips the HNSW index** (chooses a seq/sort over `incidents`) | `idx_incidents_hnsw` absent from the plan; the `hnsw` tag relies on the `<=>` fallback | Ensure HNSW index exists ([`PHASE-01`](./PHASE-01-database-schema.md) `idx_incidents_hnsw`) and was built **after** embeddings were seeded; `SET hnsw.ef_search` reasonably; confirm enough incident rows. Do **not** force the index dishonestly — fix the data, not the matcher. |
| **GiST not used over the JOIN** | `idx_stores_geom` absent; `gist` tag falls back to the store-scan heuristic | The hero query JOINs `stores` by `store_id` (B-tree), so GiST may not appear unless a spatial predicate is present. Tag the spatial proof honestly: keep the matcher tolerant, and in the demo narrate the GiST index as **available for bounds queries** (access pattern #4 in [`../deep-dives/01-recall.md`](./../deep-dives/01-recall.md) §5.3). If you want it in *this* plan, add the bbox/`ST_DWithin` map-bounds variant. |
| **Hardcoding the plan "to be safe"** | Plan never changes between runs; timings identical | **Forbidden** ([`./CONVENTIONS.md`](./CONVENTIONS.md) §12). `force-dynamic` + live fetch. The DoD checks that re-runs differ. |
| **Showing a different SQL than the engine runs** | Inspector SQL ≠ executed query | Import `TRACE_SQL`; the route runs `EXPLAIN ... ${TRACE_SQL}`. One source of truth in `trace.ts`. |
| **Plan formatting mangled** (collapsed whitespace / wrapped lines) | Tree indentation lost, unreadable | Render in `<pre>`/`whitespace-pre`, monospace, preserve original lines; never `.trim()` interior lines or join with spaces. |
| **`EXPLAIN ANALYZE` actually runs the query each time** | Opening the panel adds real DB load mid-demo | Expected and fine at this volume (sub-second). Don't auto-poll; fetch on open + manual re-run only. Debounce rapid re-opens via the `reqId` guard (already in the component). |
| **`FORMAT JSON` chosen for "easier parsing"** | Plan looks like a blob of JSON on camera | Use `FORMAT TEXT` — the text plan is what reads as authentic. Parse text; it's only three substring matchers. |
| **Embedding mismatch dimension** | `EXPLAIN` errors with vector dim mismatch | `embed()` must produce `EMBED_DIM` (384 local) and `incidents.embedding` is `vector(EMBED_DIM)` ([`./CONVENTIONS.md`](./CONVENTIONS.md) §3/§6). Same `embed()` as the hero path. |
| **Stale fetch overwrites newer plan** | Rapid lot changes show the wrong lot's plan | The `reqId` ref discards superseded responses (already in the component). |

---

## 7. Cut-if-scope-bites

If time is tight, cut **in this order** — but the inspector **as a whole is on the NEVER-CUT list**, so cut *within* it, never the panel itself:

1. **The two-column layout** → stack SQL above plan (single column). The plan is the star; the SQL can scroll.
2. **The `depth`/tree-indentation rendering** → render flat monospace lines; keep the three highlighted nodes. (`depth` is cosmetic.)
3. **The "EXPLAIN fetched in N ms" round-trip chip** → drop it; keep the real `Execution Time:` from the plan itself.
4. **The skeleton loader** → a plain "Running EXPLAIN…" text is fine.

> **NEVER cut** ([`./CONVENTIONS.md`](./CONVENTIONS.md) §12): the **live `EXPLAIN (ANALYZE, BUFFERS)`** itself, fetched server-side and **not hardcoded**, with the **Recursive Union + HNSW + GiST nodes legible**. This panel is the storyboard's single most memorable beat (`1:08–1:28`, [`../deep-dives/01-recall.md`](./../deep-dives/01-recall.md) §10). If everything else in the project is at risk, this stays.

---

## 8. BUILD_LOG entry to append

```markdown
## Phase 06 — Query Inspector (the 10x credibility moment)

**Status:** GREEN · `pnpm typecheck && pnpm lint && pnpm test` pass · verified live.

**What shipped**
- `components/console/QueryInspector.tsx`: collapsible panel — left = the exact `TRACE_SQL`
  imported from `lib/db/queries/trace.ts`; right = the live `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`
  fetched from `POST /api/explain`, with the **Recursive Union**, **HNSW Index Scan** (`idx_incidents_hnsw`),
  and **GiST spatial path** (`idx_stores_geom`) parsed out and highlighted with captions.
- `lib/explain/annotate.ts`: pure, server/client-shared parser (`annotateExplain` / `explainNodes`);
  first-match-per-tag so only node headers are anchored. Unit-tested in `test/explain-annotate.test.ts`.
- `lib/db/explain.ts` + `app/api/explain/route.ts`: `force-dynamic`, zod-validated, runs EXPLAIN on the
  EXACT hero query with the same params — never cached, never hardcoded.
- `TopBar` toggle + lifted `inspectorOpen` state in the console wrapper.

**Proof captured**
- `curl POST /api/explain` returns a multi-thousand-char plan; `nodes` = ['Recursive Union','HNSW Index Scan','GiST Spatial Path'].
- Re-running EXPLAIN yields different `actual time=` values → demonstrably live, not hardcoded.
- Header chip shows "3/3 hero nodes in plan".

**Notes / decisions**
- Used `FORMAT TEXT` (not JSON) because the text plan reads as authentic on camera.
- Cold-cache caveat noted for the demo: warm the query once before recording so BUFFERS shows hit >> read.
- (If applicable) GiST appears via the map-bounds variant / honest narration — recorded the exact plan we used.

**Build-in-public angle:** "We put the query plan ON the screen. Most dashboards hide the SQL —
ours makes the `EXPLAIN ANALYZE` the hero. The graph IS the recursion, the map IS the geo JOIN, the rail IS the vector search."
```

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract (esp. §7 hero query, §10 `/api/explain` shape, §12 anti-fake rules)
- [`./README.md`](./README.md) — build index & navigation
- [`./PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) — exports `TRACE_SQL` + `runTrace` (the SQL this panel shows)
- [`./PHASE-04-api-layer.md`](./PHASE-04-api-layer.md) — the `POST /api/explain` route this phase hardens
- [`./PHASE-05-outbreak-console.md`](./PHASE-05-outbreak-console.md) — the console shell, `TopBar`, and current-`tlc` state the toggle hooks into
- [`./PHASE-07-supporting-screens.md`](./PHASE-07-supporting-screens.md) — next phase (lineage drawer, inbox, scope export)
- [`./PHASE-11-demo-and-submission.md`](./PHASE-11-demo-and-submission.md) — where this panel becomes the `1:08–1:28` demo beat + the highest-leverage screenshot
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — flagship spec (§4.2 Query Inspector, §10 storyboard, §15 polish checklist, §13 risks)
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — RSC/Route Handlers, `force-dynamic`, no-store
- [`../reference/submission-checklist.md`](../reference/submission-checklist.md) — the EXPLAIN plan as a required screenshot artifact
