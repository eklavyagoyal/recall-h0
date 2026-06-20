# Phase 05 — The Outbreak Console

**Outcome:** `app/page.tsx` is a React Server Component that runs `runTrace(DEMO_TLC)` server-side for first paint (zero loading flash) and renders the signature split console — a `TopBar` (live `latencyMs` / `lotCount` / `storeCount` / `totalUnits` + a 24-hour FDA SLA countdown, all read from `meta`), a `GraphPane` whose force graph **ignites red** along contaminated edges, a `MapPane` (maplibre dark) that drops a unit-counted pin per affected store and fits bounds, and an `IncidentRail` of pgvector matches with cosine-score badges. A TLC input re-runs the trace (Server Action, `POST /api/trace` fallback) and re-renders all three panes. Empty/clean, loading, and error states are all explicitly designed.

**Depends on / Unblocks:** Depends on **[PHASE-03](./PHASE-03-hero-query.md)** (`runTrace` + the hero query) and **[PHASE-04](./PHASE-04-api-layer.md)** (`POST /api/trace`, `lib/types.ts`, the response contract). Unblocks **[PHASE-06](./PHASE-06-query-inspector.md)** (the Query Inspector toggles off this TopBar) and **[PHASE-07](./PHASE-07-supporting-screens.md)** (Lineage Drawer / Inbox / Scope Export hang off the panes built here).

**Effort:** ~1.5 days (this is **M3** in the spine — see [`../deep-dives/01-recall.md` §11](../deep-dives/01-recall.md#11-build-plan--milestones)). Treat connection pooling as part of this phase if connections flake.

---

## 1. Objectives

This phase turns the hero query into the **signature screen** — the one the demo opens on, the one the judge stares at. Per [`../deep-dives/01-recall.md` §4.3](../deep-dives/01-recall.md#43-hero-screen--the-outbreak-console--states--micro-interactions) and the [CONVENTIONS contract §10](./CONVENTIONS.md#10-api-response-contract):

1. **RSC first paint, no loading flash.** `app/page.tsx` is an `async` Server Component that calls `runTrace(DEMO_TLC)` and passes the real `TraceResult` down as typed props. Credentials and SQL stay 100% server-side. The console renders fully-populated on first byte.
2. **`TopBar`** — three KPI chips + a 24h SLA countdown, every number sourced from `meta` (`latencyMs`, `lotCount`, `storeCount`, `totalUnits`). **No hardcoded latency** — the number on screen is the measurement from `runTrace`.
3. **`GraphPane`** — `react-force-graph-2d` renders `edges` as a force graph and **animates red propagation** outward from the seed lot (the recursion unfolding), driven entirely off the returned edge rows. SSR-safe via `dynamic(..., { ssr: false })`.
4. **`MapPane`** — `react-map-gl` + `maplibre-gl` dark basemap; one marker per affected store at its `lat`/`lng` with a unit-count tooltip; `fitBounds` to the affected set. CSS + worker handled.
5. **`IncidentRail`** — the `incidents` array as cards, each with a **cosine-score badge** so the vector search is visibly relevance-ranked.
6. **Re-run wiring** — a TLC `<input>` + **Trace** button re-runs via a **Server Action** (`app/actions/trace.ts`), with `POST /api/trace` as the documented fallback. The three panes re-animate off the new `TraceResult`.
7. **Three states explicit** — **empty/clean** ("clean lot — no shelves at risk"), **loading** (skeletons / pending), **error** (inline banner with the SQLSTATE, never a blank screen).

> **The thesis, made visible:** the graph **IS** the recursion, the map **IS** the geo JOIN, the rail **IS** the vector search. Do not let any pane render mock data — every pixel is a row from the hero query.

---

## 2. Prerequisites (checklist)

- [ ] **Phase 03 done:** `lib/db/queries/trace.ts` exports `runTrace(tlc, asOf?)` returning the `TraceResult` shape; `pnpm bench` shows `DEMO_TLC` tracing to ~1,400 stores in <1s.
- [ ] **Phase 04 done:** `POST /api/trace` returns the canonical `TraceResponse`; `lib/types.ts` exports `TraceResult`, `Edge`, `AffectedStore`, `SimilarIncident`.
- [ ] **`lib/config.ts`** exports `DEMO_TLC` and `DEMO_TLC` resolves to a seeded lot.
- [ ] **Local DB up + seeded:** `pnpm db:up && pnpm db:migrate && pnpm db:seed` (actual counts printed; ~250k edges).
- [ ] **shadcn/ui initialized** (Phase 00) with at least `button`, `input`, `card`, `badge`, `skeleton`. If missing, add them in [step 3.1](#31-install-dependencies--shadcn-primitives).
- [ ] **Dark mode is the default** (`<html class="dark">` in `app/layout.tsx`) — control-room aesthetic.
- [ ] Node.js **24 LTS**, **pnpm**, dev server runnable via `pnpm dev`.

Confirm the upstream contract is real before building UI on top of it:

```bash
# from repo root — prove the trace returns the shape this phase consumes
pnpm tsx -e "import('./lib/db/queries/trace.ts').then(async m => { const r = await m.runTrace(process.env.DEMO_TLC ?? 'PRD-OUTBREAK-0001'); console.log(JSON.stringify(r.meta, null, 2)); console.log('edges', r.edges.length, 'stores', r.stores.length, 'incidents', r.incidents.length); })"
# Expect: meta.storeCount ≈ 1400, meta.latencyMs < 1000, edges/stores/incidents non-empty arrays
```

---

## 3. Step-by-step

### 3.1 Install dependencies + shadcn primitives

```bash
# Graph + map (pinned in CONVENTIONS §3). react-map-gl v8 no longer bundles a renderer,
# so install maplibre-gl explicitly and import Map from 'react-map-gl/maplibre'.
pnpm add react-force-graph-2d react-map-gl maplibre-gl

# shadcn primitives used by the panes (skip any already present)
pnpm dlx shadcn@latest add button input card badge skeleton tooltip
```

> **Why these exact packages.** `react-force-graph-2d` is the canonical graph lib in the contract (d3-force under the hood). `react-map-gl@8` is renderer-agnostic — the MapLibre entry point is `react-map-gl/maplibre`, and `maplibre-gl` ships the actual GL renderer + the CSS. Verified against the visgl react-map-gl v8 docs and the `react-force-graph-2d` type defs (June 2026).

### 3.2 Types the panes consume (re-confirm from Phase 04)

These already exist in `lib/types.ts` (Phase 04). They are reproduced here so this doc is followable standalone — **do not redefine them**, just confirm they match. They mirror [CONVENTIONS §10](./CONVENTIONS.md#10-api-response-contract).

```ts
// lib/types.ts  (defined in Phase 04 — shown for reference only)
export type Edge = { parent: number; child: number; transform: string };

export type AffectedStore = {
  storeId: number; name: string; chain: string; address: string;
  lat: number; lng: number; units: number;
};

export type SimilarIncident = {
  incidentId: number; text: string; pathogen: string | null; score: number; // cosine similarity 0..1
};

export type TraceMeta = {
  latencyMs: number;   // REAL measurement — never hardcoded
  lotCount: number;
  edgeCount: number;
  storeCount: number;
  totalUnits: number;
  asOf: string | null;
};

export type TraceResult = {
  meta: TraceMeta;
  edges: Edge[];
  stores: AffectedStore[];
  incidents: SimilarIncident[];
  sql: string;         // surfaced to the Query Inspector in Phase 06
};
```

### 3.3 The Server Action (`app/actions/trace.ts`) — the re-run path

The TLC input re-runs the trace through this Server Action. It is the primary path; `POST /api/trace` ([Phase 04](./PHASE-04-api-layer.md)) is the documented fallback for non-action callers (and what the demo can curl). Both wrap the **same** `runTrace` so there is one source of truth.

```ts
// app/actions/trace.ts
"use server";

import { z } from "zod";
import { runTrace } from "@/lib/db/queries/trace";
import type { TraceResult } from "@/lib/types";

// Same zod shape as POST /api/trace (Phase 04). Validate on the server boundary.
const TraceInput = z.object({
  tlc: z.string().trim().min(1).max(64),
  asOf: z.string().datetime().optional(),
});

export type TraceActionResult =
  | { ok: true; data: TraceResult }
  | { ok: false; error: string; code?: string };

export async function traceAction(input: { tlc: string; asOf?: string }): Promise<TraceActionResult> {
  const parsed = TraceInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid Traceability Lot Code." };
  }
  try {
    const data = await runTrace(parsed.data.tlc, parsed.data.asOf ?? null);
    return { ok: true, data };
  } catch (e: unknown) {
    // Surface SQLSTATE for the error banner's dev detail; never leak a stack to the client.
    const err = e as { code?: string; message?: string };
    return { ok: false, error: "Trace failed — retry.", code: err?.code };
  }
}
```

> **Why a Server Action and not client fetch.** The contract forbids client-side DB access (creds are server-only, OIDC keyless). The action runs `runTrace` server-side and returns the plain `TraceResult` object; the client component re-animates off it. The trace is **never cached** — a stale recall scope is dangerous ([`../deep-dives/01-recall.md` §6.4](../deep-dives/01-recall.md#64-real-time--caching-matched-to-the-consistency-model)).

### 3.4 `app/page.tsx` — RSC first paint (the home / Outbreak Console)

Server Component. Runs the trace for `DEMO_TLC` **before** rendering, so the console paints fully populated. `force-dynamic` guarantees we never serve a cached recall scope.

```tsx
// app/page.tsx
import { runTrace } from "@/lib/db/queries/trace";
import { DEMO_TLC } from "@/lib/config";
import { Console } from "@/components/console/Console";
import type { TraceResult } from "@/lib/types";

export const dynamic = "force-dynamic"; // never cache the trace — freshness IS the product

export default async function Page() {
  let initial: TraceResult | null = null;
  let bootError: string | null = null;

  try {
    initial = await runTrace(DEMO_TLC, null); // first paint = real rows, no loading flash
  } catch (e) {
    const err = e as { message?: string };
    bootError = err?.message ?? "Could not reach the database.";
  }

  return <Console initial={initial} initialTlc={DEMO_TLC} bootError={bootError} />;
}
```

> `Console` is a thin client wrapper (state machine for re-runs). `app/page.tsx` stays a Server Component so the SDK/SQL never enter the bundle and the first paint is server-rendered with real data — the [Pattern D first-paint move](../reference/vercel-v0-playbook.md#6-pattern-d--server-components-for-first-paint).

### 3.5 `components/console/Console.tsx` — the client orchestrator + 3-state machine

This is the **only** stateful client component. It owns the current `TraceResult`, the `status` (`idle` | `loading` | `error`), and the re-run wiring; it lays out the TopBar, the split GraphPane/MapPane, and the IncidentRail; and it routes the three explicit states. It is wrapped here (not in `page.tsx`) so `page.tsx` can stay a pure RSC.

```tsx
// components/console/Console.tsx
"use client";

import { useCallback, useState, useTransition } from "react";
import { traceAction } from "@/app/actions/trace";
import type { TraceResult } from "@/lib/types";
import { TopBar } from "./TopBar";
import { GraphPane } from "./GraphPane";
import { MapPane } from "./MapPane";
import { IncidentRail } from "./IncidentRail";

type Status = "idle" | "loading" | "error";

export function Console({
  initial,
  initialTlc,
  bootError,
}: {
  initial: TraceResult | null;
  initialTlc: string;
  bootError: string | null;
}) {
  const [result, setResult] = useState<TraceResult | null>(initial);
  const [tlc, setTlc] = useState(initialTlc);
  const [status, setStatus] = useState<Status>(bootError ? "error" : "idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(bootError);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const runTrace = useCallback((nextTlc: string) => {
    const value = nextTlc.trim();
    if (!value) return;
    setStatus("loading");
    setErrorMsg(null);
    startTransition(async () => {
      const res = await traceAction({ tlc: value });
      if (res.ok) {
        setResult(res.data);
        setStatus("idle");
      } else {
        setErrorMsg(res.error);
        setErrorCode(res.code);
        setStatus("error");
      }
    });
  }, []);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      runTrace(tlc);
    },
    [runTrace, tlc],
  );

  const loading = status === "loading" || isPending;
  // "clean lot" = the trace succeeded but no shelves are at risk
  const isClean = !!result && result.meta.storeCount === 0 && status !== "loading";

  return (
    <main className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <TopBar
        meta={result?.meta ?? null}
        tlc={tlc}
        onTlcChange={setTlc}
        onSubmit={onSubmit}
        loading={loading}
      />

      {/* ERROR state — inline banner, never a blank screen */}
      {status === "error" && (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-md border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-200"
        >
          <div className="flex items-center justify-between gap-4">
            <span>{errorMsg ?? "Trace failed."}</span>
            <button
              onClick={() => runTrace(tlc)}
              className="rounded border border-red-700 px-3 py-1 text-xs font-medium text-red-100 hover:bg-red-900/50"
            >
              Retry
            </button>
          </div>
          {errorCode && (
            <p className="mt-1 font-mono text-xs text-red-400/80">SQLSTATE {errorCode}</p>
          )}
        </div>
      )}

      {/* CLEAN/EMPTY state — the trace ran, zero shelves at risk */}
      {isClean && status !== "error" && (
        <div className="m-4 flex flex-1 items-center justify-center rounded-lg border border-emerald-900/50 bg-emerald-950/20">
          <div className="text-center">
            <div className="text-5xl">🟢</div>
            <h2 className="mt-3 text-xl font-semibold text-emerald-300">Clean lot — no shelves at risk</h2>
            <p className="mt-1 text-sm text-neutral-400">
              <span className="font-mono">{tlc}</span> traced {result?.meta.lotCount ?? 0} lots and reached 0 affected stores.
            </p>
          </div>
        </div>
      )}

      {/* SUCCESS / LOADING — the split console. Panes own their own skeletons while loading. */}
      {status !== "error" && !isClean && (
        <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-neutral-800 lg:grid-cols-[1fr_1fr_320px]">
          <GraphPane edges={result?.edges ?? []} seedTlc={tlc} loading={loading} />
          <MapPane stores={result?.stores ?? []} loading={loading} />
          <IncidentRail incidents={result?.incidents ?? []} loading={loading} />
        </div>
      )}
    </main>
  );
}
```

> **State coverage.** `error` → red banner + retry (SQLSTATE in a dev detail). `clean` (`storeCount === 0`) → the explicit "clean lot" success-empty. Otherwise the split console renders; while `loading`, each pane shows its own skeleton (below) so the layout never collapses. The `initial === null && bootError` path from `page.tsx` lands in `error` on first paint — covered.

### 3.6 `components/console/TopBar.tsx` — KPIs + SLA countdown + TLC input

Every KPI reads from `meta`. The latency chip shows `meta.latencyMs` verbatim — **the real measurement**. The SLA countdown is a 24h timer (FSMA-204's 24-hour FDA window) seeded from a stable mount time so it isn't faked per render.

```tsx
// components/console/TopBar.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { TraceMeta } from "@/lib/types";

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
      <span className={`font-mono text-lg leading-tight ${accent ? "text-red-400" : "text-neutral-100"}`}>
        {value}
      </span>
    </div>
  );
}

// 24-hour FDA SLA countdown. Seeded once from a deadline computed on mount so it
// counts down honestly (it is a clock, not a hardcoded badge).
function SlaCountdown() {
  const deadlineRef = useRef<number>(Date.now() + 24 * 60 * 60 * 1000);
  const [remaining, setRemaining] = useState(24 * 60 * 60 * 1000);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, deadlineRef.current - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const urgent = remaining < 3_600_000;

  return (
    <div className="flex flex-col rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-amber-500/80">FDA 24h SLA</span>
      <span className={`font-mono text-lg leading-tight ${urgent ? "text-red-400" : "text-amber-300"}`}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}

const fmt = new Intl.NumberFormat("en-US");

export function TopBar({
  meta,
  tlc,
  onTlcChange,
  onSubmit,
  loading,
}: {
  meta: TraceMeta | null;
  tlc: string;
  onTlcChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-4 py-3">
      <div className="mr-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" />
        <h1 className="text-sm font-semibold tracking-tight text-neutral-200">Recall · Outbreak Console</h1>
      </div>

      {/* TLC input — the re-run trigger */}
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          value={tlc}
          onChange={(e) => onTlcChange(e.target.value)}
          placeholder="Paste a Traceability Lot Code"
          aria-label="Traceability Lot Code"
          className="w-64 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-red-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {loading ? "Tracing…" : "Trace"}
        </button>
      </form>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Kpi label="Latency" value={meta ? `${fmt.format(meta.latencyMs)} ms` : "—"} />
        <Kpi label="Lots" value={meta ? fmt.format(meta.lotCount) : "—"} />
        <Kpi label="Stores" value={meta ? fmt.format(meta.storeCount) : "—"} accent />
        <Kpi label="Units" value={meta ? fmt.format(meta.totalUnits) : "—"} accent />
        <SlaCountdown />
      </div>
    </header>
  );
}
```

> **Anti-fake guarantee.** The Latency chip is `meta.latencyMs` straight from `runTrace`'s `performance.now()` delta — never a constant. If `meta` is null (boot error) the chips show `—`, not a fabricated number.

### 3.7 `components/console/GraphPane.tsx` — the igniting supply graph

`react-force-graph-2d` is a canvas component and **must not** render during SSR (it touches `window`). Load it with `next/dynamic` and `ssr: false`. The pane derives `{ nodes, links }` from the `edges` rows, then **animates red propagation** by computing each node's BFS depth from the seed and revealing/coloring links in depth waves over time — so the red spreading outward *is* the recursion unfolding, driven off real edge rows.

```tsx
// components/console/GraphPane.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ForceGraphMethods, NodeObject, LinkObject } from "react-force-graph-2d";
import type { Edge } from "@/lib/types";

// SSR-safe: the canvas component only loads in the browser.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <GraphSkeleton />,
});

type GNode = NodeObject & { id: number; depth: number };
type GLink = LinkObject & { source: number; target: number; transform: string; depth: number };

function GraphSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-950">
      <div className="h-40 w-40 animate-pulse rounded-full border-2 border-dashed border-neutral-800" />
    </div>
  );
}

// BFS from the seed (depth 0) over the directed parent→child edge set.
function buildGraph(edges: Edge[]): { nodes: GNode[]; links: GLink[]; maxDepth: number } {
  if (edges.length === 0) return { nodes: [], links: [], maxDepth: 0 };
  const adj = new Map<number, number[]>();
  const ids = new Set<number>();
  let seed = edges[0].parent;
  let minParent = Infinity;
  for (const e of edges) {
    ids.add(e.parent);
    ids.add(e.child);
    (adj.get(e.parent) ?? adj.set(e.parent, []).get(e.parent)!).push(e.child);
    if (e.parent < minParent) { minParent = e.parent; seed = e.parent; } // lowest parent ≈ seed lot
  }
  const depth = new Map<number, number>([[seed, 0]]);
  const queue = [seed];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    for (const nxt of adj.get(cur) ?? []) {
      if (!depth.has(nxt)) { depth.set(nxt, d + 1); queue.push(nxt); }
    }
  }
  let maxDepth = 0;
  const nodes: GNode[] = [...ids].map((id) => {
    const dep = depth.get(id) ?? 1;
    if (dep > maxDepth) maxDepth = dep;
    return { id, depth: dep };
  });
  const links: GLink[] = edges.map((e) => ({
    source: e.parent,
    target: e.child,
    transform: e.transform,
    depth: Math.max(depth.get(e.parent) ?? 0, depth.get(e.child) ?? 1),
  }));
  return { nodes, links, maxDepth };
}

export function GraphPane({ edges, seedTlc, loading }: { edges: Edge[]; seedTlc: string; loading: boolean }) {
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [wave, setWave] = useState(0); // current ignition depth — animates the red propagation

  const { nodes, links, maxDepth } = useMemo(() => buildGraph(edges), [edges]);

  // Responsive sizing for the canvas.
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Ignition animation: walk the wave from 0 → maxDepth, one hop every 220ms.
  useEffect(() => {
    setWave(0);
    if (maxDepth === 0) return;
    let d = 0;
    const id = setInterval(() => {
      d += 1;
      setWave(d);
      if (d >= maxDepth) clearInterval(id);
    }, 220);
    return () => clearInterval(id);
  }, [maxDepth, edges]);

  // Fit to graph once the simulation has settled.
  useEffect(() => {
    if (nodes.length === 0) return;
    const t = setTimeout(() => fgRef.current?.zoomToFit(600, 40), 400);
    return () => clearTimeout(t);
  }, [nodes.length]);

  if (loading && nodes.length === 0) return <PaneShell title="Supply graph"><GraphSkeleton /></PaneShell>;

  if (nodes.length === 0) {
    return (
      <PaneShell title="Supply graph">
        <div className="flex h-full items-center justify-center text-sm text-neutral-600">
          Paste a Traceability Lot Code to begin.
        </div>
      </PaneShell>
    );
  }

  return (
    <PaneShell title="Supply graph" subtitle={`${nodes.length} lots · ${links.length} edges`}>
      <div ref={wrapRef} className="relative h-full w-full">
        {size.w > 0 && (
          <ForceGraph2D
            ref={fgRef}
            width={size.w}
            height={size.h}
            graphData={{ nodes, links }}
            backgroundColor="#0a0a0a"
            cooldownTicks={80}
            d3VelocityDecay={0.3}
            nodeRelSize={4}
            nodeLabel={(n) => `Lot #${(n as GNode).id} · depth ${(n as GNode).depth}`}
            nodeColor={(n) => ((n as GNode).depth <= wave ? "#ef4444" : "#3f3f46")}
            linkColor={(l) => ((l as GLink).depth <= wave ? "rgba(239,68,68,0.85)" : "rgba(82,82,91,0.35)")}
            linkWidth={(l) => ((l as GLink).depth <= wave ? 1.6 : 0.5)}
            linkDirectionalParticles={(l) => ((l as GLink).depth <= wave ? 2 : 0)}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => "#fca5a5"}
          />
        )}
        <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-red-400">
          igniting from {seedTlc}
        </span>
      </div>
    </PaneShell>
  );
}

function PaneShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">{title}</span>
        {subtitle && <span className="font-mono text-[10px] text-neutral-600">{subtitle}</span>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
```

> **The red propagation is real, not theatrical.** Node/link color is gated on `depth <= wave`, where `depth` is each row's BFS distance from the seed lot computed from the actual `edges` array, and `wave` advances one hop at a time. The animation tracks the *shape of the recursion the database returned* — there is no synthetic edge set. `nodeRelSize`, `linkDirectionalParticle*`, and `zoomToFit` are all real `react-force-graph-2d` props/ref methods (verified against the v1.23 type defs).

### 3.8 `components/console/MapPane.tsx` — PostGIS pins on a dark map

`react-map-gl` v8 imports `Map` from `react-map-gl/maplibre`; the GL renderer + CSS come from `maplibre-gl`. The CSS import is mandatory (markers/popups are invisible without it). One `<Marker>` per affected store at its `lat`/`lng`; a `<Popup>`/tooltip shows the unit count; `fitBounds` frames the affected set on load and whenever the store set changes.

```tsx
// components/console/MapPane.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AffectedStore } from "@/lib/types";

// Free dark basemap (CARTO dark matter, no token). Swappable for any MapLibre style JSON.
const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const fmt = new Intl.NumberFormat("en-US");

function bounds(stores: AffectedStore[]): [[number, number], [number, number]] | null {
  if (stores.length === 0) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const s of stores) {
    minLng = Math.min(minLng, s.lng); maxLng = Math.max(maxLng, s.lng);
    minLat = Math.min(minLat, s.lat); maxLat = Math.max(maxLat, s.lat);
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

export function MapPane({ stores, loading }: { stores: AffectedStore[]; loading: boolean }) {
  const mapRef = useRef<MapRef>(null);
  const [hover, setHover] = useState<AffectedStore | null>(null);
  const [ready, setReady] = useState(false);

  const bb = useMemo(() => bounds(stores), [stores]);

  // Fit bounds whenever the affected set changes (after the map is loaded).
  useEffect(() => {
    if (!ready || !bb) return;
    mapRef.current?.fitBounds(bb, { padding: 48, duration: 700, maxZoom: 9 });
  }, [ready, bb]);

  return (
    <PaneShell title="Affected stores" subtitle={`${fmt.format(stores.length)} pins`}>
      <div className="relative h-full w-full">
        {loading && stores.length === 0 && (
          <div className="absolute inset-0 z-10 animate-pulse bg-neutral-900/60" />
        )}
        <Map
          ref={mapRef}
          initialViewState={{ longitude: -98.5, latitude: 39.8, zoom: 3.2 }} // CONUS
          mapStyle={DARK_STYLE}
          style={{ width: "100%", height: "100%" }}
          onLoad={() => setReady(true)}
          attributionControl={false}
        >
          <NavigationControl position="top-right" showCompass={false} />
          {stores.map((s) => (
            <Marker key={s.storeId} longitude={s.lng} latitude={s.lat} anchor="center">
              <button
                aria-label={`${s.name}: ${s.units} units`}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-500/30 transition-transform hover:scale-150"
                style={{ boxShadow: "0 0 6px 1px rgba(239,68,68,0.7)" }}
              />
            </Marker>
          ))}
          {hover && (
            <Popup
              longitude={hover.lng}
              latitude={hover.lat}
              anchor="bottom"
              closeButton={false}
              closeOnClick={false}
              offset={12}
            >
              <div className="text-xs text-neutral-900">
                <div className="font-semibold">{hover.name}</div>
                <div className="text-neutral-600">{hover.chain}</div>
                <div className="mt-0.5 font-mono text-red-600">{fmt.format(hover.units)} units recalled</div>
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </PaneShell>
  );
}

function PaneShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">{title}</span>
        {subtitle && <span className="font-mono text-[10px] text-neutral-600">{subtitle}</span>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
```

> **PostGIS, made visible.** Each marker's `lng`/`lat` is `ST_X`/`ST_Y` of `stores.geom` straight from the hero query's `affected` CTE; the popup's unit count is `SUM(sh.units)`. `fitBounds` frames exactly the affected set — the spatial join *is* the map. With ~1,400 markers the plain DOM-marker approach is fine for the demo; if frame rate dips, see the pitfall on clustering in [§6](#6-common-pitfalls--fixes).
>
> **Shared `PaneShell`.** `GraphPane`, `MapPane`, and `IncidentRail` each declare a local `PaneShell` for self-containment in this doc. When implementing, lift `PaneShell` into `components/console/PaneShell.tsx` and import it in all three — do not keep three copies.

### 3.9 `components/console/IncidentRail.tsx` — pgvector matches with cosine badges

The right-edge rail renders the `incidents` array. Each card shows a **cosine-score badge** (`score`, where `1 - cosine_distance` from the hero query, higher = more similar) so the vector search is visibly relevance-ranked — not a `LIKE` in disguise. Skeleton cards while loading (the rail is the streamed surface per the spec).

```tsx
// components/console/IncidentRail.tsx
"use client";

import type { SimilarIncident } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 0.85) return "bg-red-500/20 text-red-300 border-red-700";
  if (score >= 0.7) return "bg-amber-500/20 text-amber-300 border-amber-700";
  return "bg-neutral-700/30 text-neutral-300 border-neutral-600";
}

function RailSkeleton() {
  return (
    <div className="space-y-3 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-md border border-neutral-800 bg-neutral-900" />
      ))}
    </div>
  );
}

export function IncidentRail({ incidents, loading }: { incidents: SimilarIncident[]; loading: boolean }) {
  return (
    <aside className="flex min-h-0 flex-col bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Similar past incidents</span>
        <span className="font-mono text-[10px] text-neutral-600">pgvector · HNSW</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && incidents.length === 0 ? (
          <RailSkeleton />
        ) : incidents.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-600">
            No similar incidents for this lot.
          </div>
        ) : (
          <ul className="space-y-3 p-3">
            {incidents.map((inc) => (
              <li
                key={inc.incidentId}
                className="rounded-md border border-neutral-800 bg-neutral-900 p-3 transition-colors hover:border-neutral-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-300">
                    {inc.pathogen ?? "Unclassified report"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] ${scoreColor(inc.score)}`}
                    title="Cosine similarity to the query embedding"
                  >
                    {inc.score.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-neutral-400">{inc.text}</p>
                <span className="mt-1.5 block font-mono text-[10px] text-neutral-600">#{inc.incidentId}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
```

> **Relevance-ranked, on screen.** The `score` badge is `1 - (embedding <=> query)` from the hero query's `similar` CTE — a real cosine similarity, color-graded so the strongest matches read red. The rail order is the HNSW scan order. This is the [§2.3 differentiator](../deep-dives/01-recall.md#23-why-this-is-not-the-1-rag-chatbot-submission): vector search as *evidence inside the trace*.

### 3.10 Run it and verify the three states

```bash
pnpm dev   # http://localhost:3000
```

1. **First paint (success):** the page loads already populated with `DEMO_TLC` — graph ignites red, ~1,400 pins on the map, rail full of cosine-badged incidents, TopBar shows real `latencyMs` / `lotCount` / `storeCount` / `totalUnits`. No spinner flashed.
2. **Re-run:** paste another seeded TLC → **Trace** → panes re-animate; latency chip updates with the new measurement.
3. **Clean lot:** paste a syntactically-valid but unshipped TLC (or a random `PRD-ZZZZ-9999`) → the green "Clean lot — no shelves at risk" panel.
4. **Loading:** throttle the network (DevTools) or watch the `Tracing…` button + pane skeletons during a re-run.
5. **Error:** stop the DB (`pnpm db:down`) and re-run a trace → the red banner with **Retry** and the SQLSTATE detail; `pnpm db:up` and retry recovers.

---

## 4. Key files

| Path | Purpose |
|---|---|
| `app/page.tsx` | RSC home; runs `runTrace(DEMO_TLC)` server-side for first paint, passes `TraceResult` to `Console`. `force-dynamic`. |
| `app/actions/trace.ts` | `"use server"` `traceAction` — zod-validated re-run wrapping `runTrace`; returns `TraceActionResult`. |
| `components/console/Console.tsx` | Client orchestrator: holds `TraceResult` + `status`, routes empty/clean/loading/error, lays out the split console. |
| `components/console/TopBar.tsx` | KPI chips (latency/lots/stores/units from `meta`) + 24h FDA SLA countdown + TLC input/Trace button. |
| `components/console/GraphPane.tsx` | `react-force-graph-2d` (dynamic, `ssr:false`); BFS-depth red ignition off `edges`; `zoomToFit`. |
| `components/console/MapPane.tsx` | `react-map-gl/maplibre` dark map; one marker per `AffectedStore`; unit-count popup; `fitBounds`. |
| `components/console/IncidentRail.tsx` | pgvector matches as cards with cosine-score badges; skeleton + empty states. |
| `components/console/PaneShell.tsx` | (Implementation step) shared pane header/frame lifted out of the three panes. |

---

## 5. Definition of Done

Each box has a verification command + expected output. The phase ends **GREEN** ([CONVENTIONS §12](./CONVENTIONS.md#12-global-rules-every-phase)).

- [ ] **Green gate passes.**
  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  ```
  Expected: `tsc --noEmit` → 0 errors; `next lint` → clean; vitest → existing trace tests still green.
- [ ] **RSC first paint with real numbers, no loading flash.**
  ```bash
  pnpm dev   # then open http://localhost:3000
  ```
  Expected: the console renders already populated for `DEMO_TLC`; TopBar shows a real `latencyMs` (< 1000), `storeCount` ≈ 1400, non-zero `totalUnits`; no spinner appeared before content.
- [ ] **Three panes light up sub-second on re-run.** Paste `DEMO_TLC`, click **Trace**. Expected: graph ignites red L→R, ~1,400 pins fit-bounded on the dark map, rail shows ≤5 cosine-badged incidents; the latency chip updates to the new measurement.
- [ ] **Latency is not hardcoded.** `grep -rn "latencyMs" components/ app/` shows it only ever read from `meta`/props — never assigned a literal. Re-running yields a *different* ms value.
- [ ] **Clean-lot state reachable.** Paste an unshipped TLC → "Clean lot — no shelves at risk" green panel (not a crash, not a blank screen).
- [ ] **Loading state reachable.** During a re-run the **Trace** button reads `Tracing…` and panes show skeletons.
- [ ] **Error state reachable.**
  ```bash
  pnpm db:down   # then re-run a trace in the UI
  ```
  Expected: red banner "Trace failed — retry" + a **Retry** button + SQLSTATE in a dev detail; `pnpm db:up` + Retry recovers.
- [ ] **No client-side DB access / no leaked creds.** `grep -rn "from \"pg\"\|runTrace\|pool" components/` returns nothing — all DB access stays in `app/` server code. `grep -rn "AWS_SECRET" .` returns nothing.
- [ ] **SSR-safe graph.** `grep -n "ssr: false" components/console/GraphPane.tsx` matches; a fresh `pnpm dev` load shows no `window is not defined` / hydration error in the terminal or console.
- [ ] **Dark control-room aesthetic.** Background is near-black, red is the only loud accent, the layout is the three-region split. (Visual check.)
- [ ] **BUILD_LOG appended** ([§8](#8-build_log-entry-to-append)).

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **`react-force-graph-2d` SSR crash** | `ReferenceError: window is not defined` or hydration mismatch on first load | Load it via `next/dynamic(() => import("react-force-graph-2d"), { ssr: false })` ([§3.7](#37-componentsconsolegraphpanetsx--the-igniting-supply-graph)). Never import it at module top-level in a server-reachable file. |
| **MapLibre markers/popups invisible** | Pins render with no styling / wrong position | Import `"maplibre-gl/dist/maplibre-gl.css"` in `MapPane.tsx` — it is mandatory for `Marker`/`Popup`/controls. |
| **Wrong react-map-gl entry point** | `Map is not a function` / Mapbox token demanded | Import from `react-map-gl/maplibre` (v8 is renderer-agnostic), not `react-map-gl`; use a token-free style (CARTO dark-matter). |
| **maplibre-gl worker bundling under Turbopack/webpack** | `Failed to construct 'Worker'` in the deployed build | maplibre-gl ships its worker; keep the package external/un-transpiled. If a bundler mangles it, add `transpilePackages`/`serverExternalPackages` tuning in `next.config` and verify on the **deployed** URL, not just dev. |
| **Hydration mismatch from server data** | "Text content did not match" around the console | Pass the server `TraceResult` as a plain serializable prop (it is — numbers/strings/arrays). Do not compute `Date.now()`/`Math.random()` during render; the SLA deadline is seeded in a `useRef` inside `useEffect` ([§3.6](#36-componentsconsoletopbartsx--kpis--sla-countdown--tlc-input)). |
| **Canvas has zero size** | Graph renders blank | The `ForceGraph2D` needs explicit `width`/`height`; we feed them from a `ResizeObserver`. Guard render on `size.w > 0`. |
| **`fitBounds` before map load** | Map ignores the bounds / throws | Gate `fitBounds` on the `onLoad` (`ready`) flag ([§3.8](#38-componentsconsolemappanetsx--postgis-pins-on-a-dark-map)). |
| **1,400 markers janky** | Pan/zoom stutters | DOM markers are OK for the demo; if needed, swap to a maplibre GeoJSON `Source`+circle `Layer` (GPU-rendered) — same `lat`/`lng` rows, far cheaper. |
| **Stale recall scope** | Re-trace shows old data | Never cache the trace: `export const dynamic = "force-dynamic"` on `app/page.tsx`; the action calls `runTrace` directly (no `fetch` cache). |
| **`ForceGraphMethods` typing** | `ref` type errors | Type the ref as `ForceGraphMethods<GNode, GLink> | undefined` and call `zoomToFit(ms, padding)` (verified against the v1.23 type defs). |

---

## 7. Cut-if-scope-bites

Cut in this order (the console must still demo the spine):

1. **`linkDirectionalParticles`** on the graph — the moving red dots are pure polish; the depth-gated red color already shows ignition.
2. **The map `<Popup>` tooltip** — keep the markers; a static legend ("red = affected store, hover for units") survives if hover wiring fights you.
3. **The SLA countdown animation** — show a static "FDA 24h SLA" chip if the timer flickers; the *number* is narrative, the tick is garnish.
4. **The wave-by-wave ignition timer** — fall back to coloring all contaminated edges red at once (still real, off the edge rows), if the interval animation misbehaves on a big graph.

> **NEVER cut** ([CONVENTIONS §12](./CONVENTIONS.md#12-global-rules-every-phase)): the **graph rendered off real `edges`**, the **PostGIS map with a pin per real affected store**, the **pgvector rail with real cosine scores**, the **real `meta.latencyMs` on the TopBar**, the **three explicit states**, and **server-side-only data fetching**. The minimum winning console is: paste a lot → graph + map + rail light up off real rows with a real latency number. Everything above is on top of that.

---

## 8. BUILD_LOG entry to append

Append to `BUILD_LOG.md`:

```markdown
## Phase 05 — The Outbreak Console

**What shipped.** `app/page.tsx` is now an RSC that runs `runTrace(DEMO_TLC)` server-side for first paint — the
console renders fully populated with zero loading flash. Built `components/console/`: `TopBar` (live latency /
lots / stores / units from `meta` + a 24h FDA SLA countdown), `GraphPane` (`react-force-graph-2d`, dynamic
`ssr:false`, red BFS-depth ignition off the real edge rows), `MapPane` (`react-map-gl/maplibre` dark basemap, one
unit-count pin per affected store, `fitBounds`), and `IncidentRail` (pgvector matches with cosine-score badges).
A TLC input re-runs the trace via the `traceAction` Server Action (`POST /api/trace` is the documented fallback)
and re-animates all three panes. Empty/clean, loading, and error states are all explicit.

**The thesis, on screen.** The graph IS the recursion (red spreads outward hop-by-hop), the map IS the geo JOIN
(a pin per `ST_X/ST_Y` store row), the rail IS the vector search (cosine-ranked, color-graded). Every pixel is a
hero-query row; the latency chip is the real `performance.now()` measurement from `runTrace`, never hardcoded.

**Verified.** `pnpm typecheck && pnpm lint && pnpm test` green. Manually walked all three states: DEMO_TLC paints
~1,400 pins sub-second on first byte; an unshipped TLC shows "clean lot — no shelves at risk"; `pnpm db:down` →
re-trace shows the error banner + SQLSTATE + Retry, and recovers after `pnpm db:up`.

**Pitfalls hit.** <fill in: e.g. maplibre CSS import was the missing-marker culprit; graph needed an explicit
width/height via ResizeObserver; …>

**Next.** Phase 06 — surface the live `EXPLAIN (ANALYZE, BUFFERS)` plan in a Query Inspector toggled from this TopBar.
```

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract (overrides everything): [§5 directory tree](./CONVENTIONS.md#5-canonical-directory-tree), [§10 API response contract](./CONVENTIONS.md#10-api-response-contract), [§12 global rules](./CONVENTIONS.md#12-global-rules-every-phase).
- [`./README.md`](./README.md) — build index & phase dependency graph.
- [`./PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) — `runTrace` + the hero query this phase renders.
- [`./PHASE-04-api-layer.md`](./PHASE-04-api-layer.md) — `POST /api/trace`, `lib/types.ts`, the response contract.
- [`./PHASE-06-query-inspector.md`](./PHASE-06-query-inspector.md) — the live `EXPLAIN` panel toggled off this TopBar (next).
- [`./PHASE-07-supporting-screens.md`](./PHASE-07-supporting-screens.md) — Lineage Drawer / Inbox / Scope Export built on these panes.
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — product spec: [§4.3 hero screen states](../deep-dives/01-recall.md#43-hero-screen--the-outbreak-console--states--micro-interactions), [§6.2 request path](../deep-dives/01-recall.md#62-the-requestdata-path), [§8.5 code sketches](../deep-dives/01-recall.md#85-critical-path-code-sketches).
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — [Pattern D RSC first paint](../reference/vercel-v0-playbook.md#6-pattern-d--server-components-for-first-paint), [Pattern E Server Actions](../reference/vercel-v0-playbook.md#7-pattern-e--server-actions--serializable-transactions--revalidatetag).
- [`../reference/submission-checklist.md`](../reference/submission-checklist.md) — required artifacts the console feeds.
