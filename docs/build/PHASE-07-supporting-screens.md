# Phase 07 — Supporting Screens + Polish

**Outcome:** Three depth screens are wired to the live API and the console feels finished — `LineageDrawer` (click a graph node or map pin → `GET /api/lineage` → a parent/child trail "store received N units of lot X, derived from ingredient lot Y, Supplier Z, shipped DATE"), `IncidentInbox` (the triage list with pgvector "possible cluster" badges grouping differently-worded reports), and `ScopeExport` (N stores across M states, exact lot codes, total units, a working "Export FDA traceability record" download, and a "Notify affected stores" stub) — plus a global polish pass (animated counters, badge pulses as pins land, skeleton loaders on the streaming rail, refined dark tokens, consistent shadcn spacing, keyboard-accessible drawers).

**Depends on / Unblocks:** Depends on [`PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) (the trace + `runTrace`), [`PHASE-04-api-layer.md`](./PHASE-04-api-layer.md) (`/api/lineage`, `/api/incidents`, `/api/trace`), [`PHASE-05-outbreak-console.md`](./PHASE-05-outbreak-console.md) (`GraphPane`, `MapPane`, `TopBar`, `IncidentRail` and their selection/state plumbing), and [`PHASE-06-query-inspector.md`](./PHASE-06-query-inspector.md). **Unblocks** [`PHASE-08-testing.md`](./PHASE-08-testing.md) (drill-down + inbox + export get smoke/unit coverage) and the demo beats `1:08–1:43` in [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) §10.

**Effort:** ~0.5–1 day (M5 + part of M8 in the deep-dive milestone map). The three components are ~1 day of work; the polish pass is the "rides on top of a working spine" half-day. Do **not** start this phase until the spine (Phases 00–06) demos on a real trace.

---

## 1. Objectives

1. **Lot Lineage Drawer** — clicking a graph node or a map pin opens a slide-in sheet that calls `GET /api/lineage?storeId=` (or `?lotId=`) and renders the exact lineage as a parent/child trail. One JOIN, four tables, made legible: *"this store got 240 units of lot PRD-8841, derived from ingredient lot ING-2207, Verde Farms, shipped June 9th."* Keyboard-accessible (Esc to close, focus trap, focus return).
2. **Incident Inbox** — the landing triage list. Calls `GET /api/incidents`, renders inbound reports, and shows pgvector **"possible cluster"** badges that group differently-worded reports sharing a pathogen/lot signature *before anyone connected them*. Each clustered incident has a **Trace** deep-link that fires the hero query with that incident's suspected TLC.
3. **Recall Scope Export** — a summary card bound to the current `TraceResult`: **N stores across M states**, exact lot codes, total units, the 24-hour SLA timer context. An **"Export FDA traceability record"** button produces a **real** JSON **and** CSV download (a Blob built from the live trace rows — not a stub). A **"Notify affected stores"** button is an honest stub (toast + disabled-state copy "queued — integration pending"), narrated as the next step.
4. **Global polish pass** — animated number counters on `TopBar`, badge pulses as pins land, skeleton loaders on the streaming rail, refined dark theme tokens, consistent shadcn spacing scale, keyboard-accessible drawers/dialogs. Every state (empty / loading / error / clean-lot) looks intentional.
5. **Stay anti-fake.** The lineage trail, the cluster groupings, and the export artifact are all **derived from real query results**. No hardcoded trails, no fake clusters, no placeholder CSV. The export reflects the exact rows on screen.

> **Thesis check:** these screens are still *the database made clickable*. The lineage drawer is one more JOIN; the inbox cluster badge is pgvector self-similarity surfaced; the export is the trace result serialized into the FDA artifact. If a screen would look identical on any database, redesign it ([`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) §4.2).

---

## 2. Prerequisites (checklist)

- [ ] Phases 00–06 are GREEN: `pnpm typecheck && pnpm lint && pnpm test` pass, and a real trace lights up the console locally (`pnpm dev`, paste `DEMO_TLC`).
- [ ] `GET /api/lineage?storeId=<id>` and `?lotId=<id>` return the `LineageResponse` shape (`{ trail: [{ lot, facility, supplier, shipment, units, shippedAt }] }`) — see [`CONVENTIONS.md`](./CONVENTIONS.md) §10 and [`PHASE-04-api-layer.md`](./PHASE-04-api-layer.md).
- [ ] `GET /api/incidents` returns `IncidentsResponse` (`{ clusters: [{ label, incidentIds, size }], incidents: SimilarIncident[] }`).
- [ ] `POST /api/trace` returns `TraceResponse` and the console holds the current `TraceResult` in client state (set in Phase 05). This phase **reads** that state; it does not refire the trace except via the inbox "Trace" deep-link.
- [ ] `lib/types.ts` exports `TraceResult`, `Edge`, `AffectedStore`, `SimilarIncident` (Phase 00/03). This phase **adds** `LineageStep` and `IncidentCluster` to that file (Step 1 below).
- [ ] shadcn/ui is installed (Phase 00). This phase needs the `sheet`, `dialog`, `badge`, `button`, `skeleton`, `scroll-area`, `separator`, and `tooltip` primitives. Add any missing ones in Step 0.
- [ ] The console exposes a **selection** mechanism: `GraphPane`/`MapPane` call an `onSelect({ kind: 'store' | 'lot', id })` callback when a pin/node is clicked. If Phase 05 did not wire this, add it now (Step 8 documents the minimal contract).
- [ ] `sonner` (toast) is available for the "Notify affected stores" stub feedback. If not installed, add it in Step 0.

---

## 3. Step-by-step

> All paths are relative to the repository root (the Next.js app lives at root per [`CONVENTIONS.md`](./CONVENTIONS.md) §5). Components use `"use client"` because they own interactive state, selection, downloads, and focus management. Data comes from the API routes (already server-side, creds never leak).

### Step 0 — Install the shadcn primitives + toaster (if missing)

```bash
# shadcn primitives used in this phase
pnpm dlx shadcn@latest add sheet dialog badge button skeleton scroll-area separator tooltip

# toast for the "Notify affected stores" stub feedback
pnpm add sonner
```

Mount the toaster once in the root layout (idempotent — skip if Phase 05 already did it):

```tsx
// app/layout.tsx (excerpt — add inside <body>, after {children})
import { Toaster } from "sonner";
// ...
        {children}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
```

### Step 1 — Extend `lib/types.ts` with the lineage + cluster shapes

These mirror the API response contract in [`CONVENTIONS.md`](./CONVENTIONS.md) §10. Add to the existing file; do not redefine `TraceResult` / `AffectedStore` / `SimilarIncident`.

```ts
// lib/types.ts (append — keep the existing TraceResult/Edge/AffectedStore/SimilarIncident)

/** One row of the lineage trail returned by GET /api/lineage. Mirrors LineageResponse.trail[]. */
export type LineageStep = {
  lot: string;          // child TLC (the lot this store/derived product carries)
  facility: string;     // facility that produced `lot`
  supplier: string;     // supplier that owns the facility
  shipment: number;     // shipment_id
  units: number;        // units on this shipment
  shippedAt: string;    // ISO timestamptz
};

export type LineageResult = { trail: LineageStep[] };

/** A pgvector "possible cluster" of differently-worded reports. Mirrors IncidentsResponse.clusters[]. */
export type IncidentCluster = {
  label: string;        // e.g. "Listeria · leafy greens"
  incidentIds: number[];
  size: number;
};

export type IncidentsResult = {
  clusters: IncidentCluster[];
  incidents: SimilarIncident[];
};

/** What a graph node / map pin emits when clicked, consumed by LineageDrawer. */
export type ConsoleSelection =
  | { kind: "store"; id: number; label?: string }
  | { kind: "lot"; id: number; label?: string };
```

> `SimilarIncident` (already in `lib/types.ts` from Phase 03) is `{ incidentId: number; text: string; pathogen: string | null; score: number }`. The inbox additionally needs each incident's `suspectedTlc` so its **Trace** button can fire the hero query. If Phase 04's `/api/incidents` does not yet return `suspectedTlc` on each incident, add it there (one extra column in the SELECT — `lots.tlc` joined via `incidents.suspected_lot_id`) and extend the type:

```ts
// lib/types.ts — extend SimilarIncident used by the inbox (additive, optional field)
export type InboxIncident = SimilarIncident & {
  reportedAt: string;          // ISO — for the "X min ago" line
  suspectedTlc: string | null; // drives the inbox "Trace" deep-link
  clusterLabel?: string | null;
};
```

### Step 2 — Refined dark theme tokens (`app/globals.css`)

The control-room palette: cool/neutral everything, **red is the only accent** (contamination). This locks the shadcn CSS variables so spacing, borders, and the danger accent are consistent across all three new components. Edit the `:root` / `.dark` token block created in Phase 00.

```css
/* app/globals.css — control-room dark tokens (Tailwind v4 + shadcn) */
/* Keep dark as the default (the <html> tag has class="dark" from Phase 00). */
.dark {
  --background: oklch(0.16 0.01 250);          /* near-black, cool */
  --foreground: oklch(0.95 0.005 250);
  --card: oklch(0.19 0.012 250);
  --card-foreground: oklch(0.95 0.005 250);
  --popover: oklch(0.17 0.012 250);
  --popover-foreground: oklch(0.95 0.005 250);
  --primary: oklch(0.72 0.14 235);             /* cool cyan-blue = neutral actions */
  --primary-foreground: oklch(0.16 0.01 250);
  --secondary: oklch(0.24 0.012 250);
  --secondary-foreground: oklch(0.92 0.005 250);
  --muted: oklch(0.24 0.012 250);
  --muted-foreground: oklch(0.62 0.01 250);
  --accent: oklch(0.26 0.014 250);
  --accent-foreground: oklch(0.95 0.005 250);
  --destructive: oklch(0.58 0.21 25);          /* THE red — contamination, used sparingly */
  --destructive-foreground: oklch(0.98 0.01 25);
  --border: oklch(0.27 0.012 250 / 0.6);
  --input: oklch(0.27 0.012 250 / 0.7);
  --ring: oklch(0.72 0.14 235 / 0.6);
  --radius: 0.625rem;

  /* Domain tokens used by the new components (consistent contamination accent). */
  --contam: var(--destructive);
  --contam-glow: oklch(0.58 0.21 25 / 0.35);
  --mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace;
}

/* Polish utilities (animations live here so every component shares them). */
@keyframes pin-pulse {
  0%   { box-shadow: 0 0 0 0 var(--contam-glow); }
  70%  { box-shadow: 0 0 0 10px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.animate-pin-pulse { animation: pin-pulse 900ms ease-out; }

@keyframes count-flash {
  0% { color: var(--contam); }
  100% { color: inherit; }
}
.animate-count-flash { animation: count-flash 600ms ease-out; }

@media (prefers-reduced-motion: reduce) {
  .animate-pin-pulse,
  .animate-count-flash { animation: none !important; }
}
```

### Step 3 — Shared polish primitives (`components/console/polish.tsx`)

A tiny client module the three components (and `TopBar`) reuse: an animated count-up number, a US-state-abbreviation helper, and a date formatter. Centralizing keeps spacing/formatting consistent and prevents three slightly-different counters.

```tsx
// components/console/polish.tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-up animation that respects prefers-reduced-motion and lands EXACTLY on `value`.
 * Used by TopBar KPI chips and the ScopeExport summary. The final number is always the
 * real measured value — the animation only affects how it is revealed, never the value.
 */
export function useCountUp(value: number, durationMs = 700) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === fromRef.current) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return display;
}

export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const display = useCountUp(value);
  return (
    <span className={className} aria-live="polite">
      {display.toLocaleString("en-US")}
    </span>
  );
}

/** Distinct US states from a set of affected-store records (for "across M states"). */
export function distinctStates(addresses: string[]): string[] {
  const re = /\b([A-Z]{2})\b(?=\s+\d{5}(?:-\d{4})?\s*$)/; // 2-letter state before a ZIP at end
  const set = new Set<string>();
  for (const a of addresses) {
    const m = a.match(re);
    if (m) set.add(m[1]);
  }
  return [...set].sort();
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
```

### Step 4 — `LineageDrawer.tsx` (complete)

Slide-in sheet. Driven by a `ConsoleSelection | null` prop the console sets when a node/pin is clicked. Fetches `/api/lineage`, shows skeletons while loading, renders the parent/child trail as a vertical timeline, and is keyboard-accessible (shadcn `Sheet` provides focus trap + Esc; we add focus return and an explicit close).

```tsx
// components/console/LineageDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { fmtDate } from "./polish";
import type { ConsoleSelection, LineageResult, LineageStep } from "@/lib/types";

export function LineageDrawer({
  selection,
  onClose,
  onTraceLot,
}: {
  selection: ConsoleSelection | null;
  onClose: () => void;
  /** Optional: jump from a lineage step into a fresh trace of an upstream lot. */
  onTraceLot?: (tlc: string) => void;
}) {
  const open = selection !== null;
  const [trail, setTrail] = useState<LineageStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selection) return;
    let alive = true;
    const ctrl = new AbortController();
    setTrail(null);
    setError(null);
    setLoading(true);

    const qs =
      selection.kind === "store"
        ? `storeId=${selection.id}`
        : `lotId=${selection.id}`;

    fetch(`/api/lineage?${qs}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Lineage failed (${r.status})`);
        return (await r.json()) as LineageResult;
      })
      .then((data) => {
        if (!alive) return;
        setTrail(data.trail ?? []);
      })
      .catch((e: unknown) => {
        if (!alive || (e instanceof DOMException && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Lineage failed");
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [selection]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-border bg-card p-0 sm:max-w-md"
        aria-label="Lot lineage"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-base font-semibold tracking-tight">
            Lot lineage
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {selection?.kind === "store"
              ? `Store ${selection.label ?? `#${selection.id}`} — one JOIN, four tables.`
              : `Lot ${selection?.label ?? `#${selection?.id}`} — upstream derivation.`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100dvh-5rem)] px-5 py-4">
          {loading && <TrailSkeleton />}

          {!loading && error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive-foreground"
            >
              {error}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          )}

          {!loading && !error && trail && trail.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No lineage on record for this node.
            </p>
          )}

          {!loading && !error && trail && trail.length > 0 && (
            <ol className="relative space-y-0" aria-label="Lineage trail, child to source">
              {trail.map((step, i) => (
                <li key={`${step.shipment}-${step.lot}-${i}`} className="relative pb-6 pl-7">
                  {/* connector line */}
                  {i < trail.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[7px] top-3 h-full w-px bg-border"
                    />
                  )}
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 size-3.5 rounded-full border-2 border-destructive bg-background"
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {step.lot}
                    </span>
                    <Badge variant="outline" className="shrink-0 font-mono text-[11px]">
                      {step.units.toLocaleString("en-US")} units
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.facility} · {step.supplier}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/80">
                    Shipment #{step.shipment} · shipped {fmtDate(step.shippedAt)}
                  </p>
                  {onTraceLot && i > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs text-primary hover:text-primary"
                      onClick={() => onTraceLot(step.lot)}
                    >
                      Trace from this lot →
                    </Button>
                  )}
                  {i < trail.length - 1 && <Separator className="mt-4" />}
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function TrailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 pl-7">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}
```

> **Reading the trail:** the API returns the trail ordered **child → source** (the store's lot first, then each upstream ingredient lot / facility / supplier). That matches the demo narration "*240 units of lot PRD-8841, derived from ingredient lot ING-2207, Verde Farms, shipped June 9th*." Confirm the order matches Phase 04's `lineage.ts` ORDER BY; if Phase 04 emits source→child, reverse with `trail.toReversed()` in the fetch handler (do it in one place, not in the render).

### Step 5 — `IncidentInbox.tsx` (complete)

The landing triage list. Fetches `/api/incidents` once, groups incidents under their pgvector cluster, and renders a **"possible cluster"** badge per group. Each incident row has a **Trace** button that fires the hero query (via the `onTrace` callback the console passes down — typically the Server Action `runTrace` from Phase 03/05).

```tsx
// components/console/IncidentInbox.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtRelative } from "./polish";
import type {
  IncidentCluster,
  IncidentsResult,
  InboxIncident,
} from "@/lib/types";

export function IncidentInbox({
  onTrace,
  tracingTlc,
}: {
  /** Fire the hero query for this incident's suspected lot. */
  onTrace: (tlc: string) => void;
  /** The TLC currently tracing, so the row can show a spinner/disabled state. */
  tracingTlc?: string | null;
}) {
  const [data, setData] = useState<IncidentsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    fetch("/api/incidents", { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Inbox failed (${r.status})`);
        return (await r.json()) as IncidentsResult;
      })
      .then((d) => alive && setData(d))
      .catch((e: unknown) => {
        if (!alive || (e instanceof DOMException && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Inbox failed");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, []);

  // Group incidents under their cluster; ungrouped incidents fall into a "Unclustered" tail.
  const groups = useMemo(() => groupByCluster(data), [data]);

  return (
    <section
      aria-label="Incident inbox"
      className="flex h-full flex-col rounded-lg border border-border bg-card"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Incident Inbox</h2>
        {data && (
          <span className="font-mono text-xs text-muted-foreground">
            {data.incidents.length} reports · {data.clusters.length} clusters
          </span>
        )}
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {loading && <InboxSkeleton />}

          {!loading && error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive-foreground"
            >
              {error}
            </p>
          )}

          {!loading &&
            !error &&
            groups.map((g) => (
              <div key={g.key} className="space-y-2">
                {g.cluster && (
                  <div className="flex items-center gap-2 px-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="cursor-help gap-1 border-destructive/40 bg-destructive/15 text-destructive-foreground">
                          <span className="size-1.5 rounded-full bg-destructive animate-pin-pulse" />
                          possible cluster · {g.cluster.size}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        pgvector grouped {g.cluster.size} differently-worded reports as
                        one signature — before anyone connected them.
                      </TooltipContent>
                    </Tooltip>
                    <span className="truncate text-xs text-muted-foreground">
                      {g.cluster.label}
                    </span>
                  </div>
                )}

                <ul className="space-y-2">
                  {g.incidents.map((inc) => (
                    <IncidentRow
                      key={inc.incidentId}
                      incident={inc}
                      onTrace={onTrace}
                      tracing={!!inc.suspectedTlc && inc.suspectedTlc === tracingTlc}
                    />
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </ScrollArea>
    </section>
  );
}

function IncidentRow({
  incident,
  onTrace,
  tracing,
}: {
  incident: InboxIncident;
  onTrace: (tlc: string) => void;
  tracing: boolean;
}) {
  const traceable = !!incident.suspectedTlc;
  return (
    <li
      className={[
        "group rounded-md border border-border/70 bg-background/40 p-3 transition-colors",
        traceable ? "hover:border-destructive/50" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm text-foreground">{incident.text}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {incident.pathogen && (
              <Badge variant="outline" className="text-[10px]">
                {incident.pathogen}
              </Badge>
            )}
            {incident.suspectedTlc && (
              <span className="font-mono">{incident.suspectedTlc}</span>
            )}
            <span>{fmtRelative(incident.reportedAt)}</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={!traceable || tracing}
          aria-label={
            traceable
              ? `Trace lot ${incident.suspectedTlc}`
              : "No suspected lot to trace"
          }
          onClick={() => incident.suspectedTlc && onTrace(incident.suspectedTlc)}
          className="shrink-0"
        >
          {tracing ? "Tracing…" : "Trace"}
        </Button>
      </div>
    </li>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border/60 p-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

type Group = { key: string; cluster: IncidentCluster | null; incidents: InboxIncident[] };

/** Build display groups: clustered first (size desc), unclustered last. */
function groupByCluster(data: IncidentsResult | null): Group[] {
  if (!data) return [];
  const byId = new Map<number, InboxIncident>(
    (data.incidents as InboxIncident[]).map((i) => [i.incidentId, i]),
  );
  const claimed = new Set<number>();
  const groups: Group[] = [];

  for (const c of [...data.clusters].sort((a, b) => b.size - a.size)) {
    const incs = c.incidentIds
      .map((id) => byId.get(id))
      .filter((x): x is InboxIncident => !!x);
    if (incs.length === 0) continue;
    incs.forEach((i) => claimed.add(i.incidentId));
    groups.push({ key: `cluster:${c.label}`, cluster: c, incidents: incs });
  }

  const rest = (data.incidents as InboxIncident[]).filter(
    (i) => !claimed.has(i.incidentId),
  );
  if (rest.length) groups.push({ key: "unclustered", cluster: null, incidents: rest });
  return groups;
}
```

> **Cut-down mode (see §7):** if scope bites, render the **first cluster only** inline on the console (keep the pgvector "possible cluster" *moment*) by slicing `groups.slice(0, 1)` and dropping the full scroll list. The cluster badge is the load-bearing beat (demo `0:18–0:33`); the long list is garnish.

### Step 6 — `ScopeExport.tsx` (complete)

Bound to the current `TraceResult` (passed down from the console — no extra fetch). Summarizes **N stores across M states · exact lot codes · total units**, and produces a **real** download. The artifact is built client-side from the live trace rows so it always matches what's on screen.

```tsx
// components/console/ScopeExport.tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AnimatedNumber, distinctStates } from "./polish";
import type { TraceResult } from "@/lib/types";

export function ScopeExport({ trace }: { trace: TraceResult | null }) {
  const summary = useMemo(() => summarize(trace), [trace]);
  const [notified, setNotified] = useState(false);

  if (!trace || summary.storeCount === 0) {
    return (
      <section
        aria-label="Recall scope export"
        className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
      >
        Run a trace to compute an exportable recall scope.
      </section>
    );
  }

  const exportRecord = (format: "json" | "csv") => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "json") {
      const record = buildFdaJson(trace, summary);
      download(
        `recall-scope-${ts}.json`,
        JSON.stringify(record, null, 2),
        "application/json",
      );
    } else {
      download(`recall-scope-${ts}.csv`, buildCsv(trace), "text/csv");
    }
    toast.success(`FDA traceability record exported (${format.toUpperCase()})`, {
      description: `${summary.storeCount} stores · ${summary.totalUnits.toLocaleString("en-US")} units`,
    });
  };

  return (
    <section
      aria-label="Recall scope export"
      className="space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Recall Scope</h2>
        <Badge variant="outline" className="font-mono text-[11px]">
          FSMA-204
        </Badge>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Stores" value={summary.storeCount} />
        <Kpi label="States" value={summary.stateCount} />
        <Kpi label="Units" value={summary.totalUnits} />
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Implicated lot codes</p>
        <div className="flex flex-wrap gap-1.5">
          {summary.lotCodes.slice(0, 8).map((code) => (
            <Badge key={code} variant="secondary" className="font-mono text-[11px]">
              {code}
            </Badge>
          ))}
          {summary.lotCodes.length > 8 && (
            <Badge variant="outline" className="text-[11px]">
              +{summary.lotCodes.length - 8} more
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="flex-1">Export FDA traceability record</Button>
          </DialogTrigger>
          <DialogContent aria-label="Export FDA traceability record">
            <DialogHeader>
              <DialogTitle>Export FDA traceability record</DialogTitle>
              <DialogDescription>
                {summary.storeCount.toLocaleString("en-US")} affected stores across{" "}
                {summary.stateCount} states · {summary.totalUnits.toLocaleString("en-US")}{" "}
                units. Choose a format — the file is built from the live trace rows.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button onClick={() => exportRecord("json")}>Download JSON</Button>
              <Button variant="secondary" onClick={() => exportRecord("csv")}>
                Download CSV
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Honest stub — narrated as the next step, never faked as wired. */}
        <Button
          variant="outline"
          className="flex-1"
          disabled={notified}
          onClick={() => {
            setNotified(true);
            toast("Shelf-pull notifications queued", {
              description: `Integration pending — ${summary.storeCount} stores would be paged.`,
            });
          }}
        >
          {notified ? "Notifications queued" : "Notify affected stores"}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Notify is a stub — production wires a paging/EDI integration per chain. The export
        above is a real artifact derived from this trace.
      </p>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/40 p-3">
      <div className="font-mono text-lg font-semibold">
        <AnimatedNumber value={value} />
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

type ScopeSummary = {
  storeCount: number;
  stateCount: number;
  states: string[];
  totalUnits: number;
  lotCodes: string[];
};

function summarize(trace: TraceResult | null): ScopeSummary {
  if (!trace) return { storeCount: 0, stateCount: 0, states: [], totalUnits: 0, lotCodes: [] };
  const states = distinctStates(trace.stores.map((s) => s.address));
  const lotCodes = [
    ...new Set(trace.edges.flatMap((e) => [String(e.parent), String(e.child)])),
  ];
  return {
    storeCount: trace.meta.storeCount,
    stateCount: states.length,
    states,
    totalUnits: trace.meta.totalUnits,
    lotCodes,
  };
}

/** FDA-shaped JSON record — the demo's "export the recall scope" artifact. */
function buildFdaJson(trace: TraceResult, summary: ScopeSummary) {
  return {
    record_type: "FSMA-204 Traceability / Recall Scope",
    generated_at: new Date().toISOString(),
    sla_hours: 24,
    summary: {
      affected_stores: summary.storeCount,
      states: summary.states,
      total_recalled_units: summary.totalUnits,
      implicated_lot_count: trace.meta.lotCount,
      edge_count: trace.meta.edgeCount,
      query_latency_ms: trace.meta.latencyMs, // real measurement, carried through
    },
    affected_stores: trace.stores.map((s) => ({
      store_id: s.storeId,
      name: s.name,
      chain: s.chain,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      recalled_units: s.units,
    })),
    similar_incidents: trace.incidents.map((i) => ({
      incident_id: i.incidentId,
      pathogen: i.pathogen,
      cosine_score: i.score,
      text: i.text,
    })),
  };
}

function buildCsv(trace: TraceResult): string {
  const header = ["store_id", "name", "chain", "address", "lat", "lng", "recalled_units"];
  const rows = trace.stores.map((s) =>
    [s.storeId, s.name, s.chain, s.address, s.lat, s.lng, s.units]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\r\n");
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click is processed so the download isn't cancelled.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

> **Lot-code note:** `TraceResult.edges` carries `parent`/`child` as lot **ids**. If the demo needs human TLC strings on the export, have Phase 04's `/api/trace` include a `lotCodes: string[]` field (a cheap `array_agg(DISTINCT lo.tlc)` in the hero query's outer select), and read `trace.meta` for it. The code above degrades gracefully to ids; wire the TLC strings if the budget allows — it makes the artifact more legible on camera.

### Step 7 — Console integration (selection → drawer, inbox → trace, scope from trace)

Wire the three components into the existing console page/shell from Phase 05. The console already holds `trace` (current `TraceResult | null`), `runTrace(tlc)`, and a `tracingTlc` flag. Add a `selection` state and pass the callbacks down.

```tsx
// components/console/ConsoleShell.tsx (excerpt — integrate into the Phase 05 shell)
"use client";

import { useState } from "react";
import { GraphPane } from "./GraphPane";
import { MapPane } from "./MapPane";
import { IncidentRail } from "./IncidentRail";
import { IncidentInbox } from "./IncidentInbox";
import { ScopeExport } from "./ScopeExport";
import { LineageDrawer } from "./LineageDrawer";
import type { ConsoleSelection, TraceResult } from "@/lib/types";

export function ConsoleShell(/* props from Phase 05: initial RSC trace, runTrace action */) {
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [tracingTlc, setTracingTlc] = useState<string | null>(null);
  const [selection, setSelection] = useState<ConsoleSelection | null>(null);

  async function runTrace(tlc: string) {
    setTracingTlc(tlc);
    try {
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tlc }),
        cache: "no-store",
      });
      if (res.ok) setTrace((await res.json()) as TraceResult);
    } finally {
      setTracingTlc(null);
    }
  }

  return (
    <>
      {/* ...TopBar, time slider... */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-3">
          <IncidentInbox onTrace={runTrace} tracingTlc={tracingTlc} />
        </div>
        <div className="col-span-6 space-y-3">
          <GraphPane
            edges={trace?.edges ?? []}
            onSelect={(sel) => setSelection(sel)}   /* graph node click */
          />
          <MapPane
            stores={trace?.stores ?? []}
            onSelect={(sel) => setSelection(sel)}   /* map pin click */
          />
        </div>
        <div className="col-span-3 space-y-3">
          <IncidentRail incidents={trace?.incidents ?? []} />
          <ScopeExport trace={trace} />
        </div>
      </div>

      <LineageDrawer
        selection={selection}
        onClose={() => setSelection(null)}
        onTraceLot={(tlc) => {
          setSelection(null);
          runTrace(tlc);
        }}
      />
    </>
  );
}
```

### Step 8 — `onSelect` contract for `GraphPane` / `MapPane` (if Phase 05 didn't add it)

Each pane emits a `ConsoleSelection` on click. Minimal additions:

```tsx
// components/console/MapPane.tsx (excerpt) — emit a selection when a pin is clicked
// props: { stores: AffectedStore[]; onSelect: (s: ConsoleSelection) => void }
//   <Marker ... onClick={() => onSelect({ kind: "store", id: store.storeId, label: store.name })} />

// components/console/GraphPane.tsx (excerpt) — react-force-graph-2d onNodeClick
//   onNodeClick={(node) => onSelect({ kind: "lot", id: Number(node.id), label: String(node.tlc ?? node.id) })}
```

### Step 9 — Polish pass wiring (TopBar counters + pin pulses)

Apply the shared polish primitives to the existing `TopBar` and `MapPane`:

```tsx
// components/console/TopBar.tsx (excerpt) — animated KPI chips
import { AnimatedNumber } from "./polish";
// <span className="font-mono">{latencyMs}<span className="text-muted-foreground">ms</span></span>
// <AnimatedNumber value={storeCount} className="font-mono" />   // affected stores
// <AnimatedNumber value={edgeCount} className="font-mono" />    // edges traced

// components/console/MapPane.tsx (excerpt) — pulse a pin as it lands
// Give each freshly-rendered marker the `animate-pin-pulse` class for one cycle:
//   className={isNew ? "animate-pin-pulse rounded-full" : "rounded-full"}
// (track "new" pins via a useEffect diff on the incoming stores array)
```

### Step 10 — Verify GREEN, run the app, append BUILD_LOG

```bash
pnpm typecheck     # tsc --noEmit → 0 errors
pnpm lint          # next lint → clean
pnpm test          # vitest → green (Phase 08 adds the drill-down/inbox/export tests)
pnpm dev           # http://localhost:3000
```

Manual verification loop (do all four before declaring done):

1. Paste `DEMO_TLC`, trace fires, console lights up.
2. Click a map pin **and** a graph node → `LineageDrawer` slides in, shows a real trail, Esc closes it and focus returns to the trigger.
3. Inbox shows reports with at least one **"possible cluster"** badge; clicking **Trace** on a clustered incident re-fires the hero query for its TLC.
4. Open **Export FDA traceability record** → Download JSON and Download CSV each save a file whose contents match the on-screen store count/units. Click **Notify affected stores** → toast appears, button goes to the queued state.

Then append the BUILD_LOG entry from §8.

---

## 4. Key files

| Path | Purpose |
|---|---|
| `lib/types.ts` | **Extend** with `LineageStep`, `LineageResult`, `IncidentCluster`, `IncidentsResult`, `InboxIncident`, `ConsoleSelection` (Step 1). |
| `app/globals.css` | Refined control-room dark tokens + `pin-pulse`/`count-flash` keyframes + reduced-motion guard (Step 2). |
| `components/console/polish.tsx` | Shared `useCountUp` / `AnimatedNumber` / `distinctStates` / `fmtDate` / `fmtRelative` (Step 3). |
| `components/console/LineageDrawer.tsx` | Slide-in lineage trail; fetches `/api/lineage`; skeletons; keyboard-accessible (Step 4). |
| `components/console/IncidentInbox.tsx` | Triage list; `/api/incidents`; pgvector cluster badges; per-incident **Trace** deep-link (Step 5). |
| `components/console/ScopeExport.tsx` | Scope summary + real JSON/CSV download + Notify stub, bound to the current `TraceResult` (Step 6). |
| `components/console/ConsoleShell.tsx` | Integrate selection → drawer, inbox → trace, scope ← trace (Step 7). |
| `components/console/MapPane.tsx` / `GraphPane.tsx` | Add `onSelect(ConsoleSelection)` + pin-pulse class (Steps 8–9). |
| `components/console/TopBar.tsx` | Swap KPI numbers for `AnimatedNumber` (Step 9). |
| `app/layout.tsx` | Mount the `sonner` `<Toaster>` once (Step 0). |
| `components/ui/{sheet,dialog,badge,button,skeleton,scroll-area,separator,tooltip}.tsx` | shadcn primitives (Step 0). |

---

## 5. Definition of Done

Each box has its exact verification.

- [ ] **Types compile.** `pnpm typecheck` → `0 errors`. (`LineageStep`/`IncidentCluster`/`ConsoleSelection` exist and `LineageDrawer`/`IncidentInbox`/`ScopeExport` import them with no `any`.)
- [ ] **Lint clean.** `pnpm lint` → no errors (no unused imports, exhaustive `useEffect` deps for the fetchers).
- [ ] **Tests green.** `pnpm test` → all pass. Phase 08 adds: `summarize()` computes the right `stateCount`/`totalUnits` from a fixture `TraceResult`; `buildCsv()` escapes commas/quotes; `groupByCluster()` claims clustered ids once and tails the rest.
- [ ] **Drill-down works end to end.** With the app running (`pnpm dev`), click a map pin → drawer opens → a non-empty trail renders with `lot · facility · supplier · shipment · shipped date`. Verify the network tab shows `GET /api/lineage?storeId=…` returning a 200 with `trail.length > 0`. Repeat for a graph node (`?lotId=…`).
- [ ] **Drawer is keyboard-accessible.** Open the drawer, press **Esc** → it closes and focus returns to the element that opened it. Tab cycles **inside** the sheet while open (shadcn focus trap). `aria-label="Lot lineage"` present.
- [ ] **Inbox clusters render.** Inbox shows ≥1 **"possible cluster · N"** badge grouping differently-worded reports; hovering the badge shows the pgvector explanation tooltip. Verify `GET /api/incidents` returns `clusters.length ≥ 1`.
- [ ] **Inbox Trace deep-link fires the query.** Click **Trace** on a clustered incident → `POST /api/trace` fires with that incident's `suspectedTlc` and the console re-lights. The row shows `Tracing…` while in flight.
- [ ] **Export downloads a real artifact.** Click **Export FDA traceability record → Download JSON**: a `recall-scope-*.json` file saves; open it and confirm `summary.affected_stores` equals the on-screen store count and `affected_stores[].recalled_units` are real numbers. **Download CSV**: a `recall-scope-*.csv` opens in a spreadsheet with one row per affected store. The Notify button toasts and disables.
- [ ] **Polish checklist complete** (the entire §6 table is ticked).
- [ ] **No fakery.** Grep confirms no hardcoded trails/clusters/latency: `rg -n "hardcoded|TODO fake|lorem|847ms" components/console` returns nothing load-bearing; the export reflects live rows.
- [ ] **BUILD_LOG appended** (§8) and committed on a branch with a conventional message (e.g. `feat: lineage drawer, incident inbox, scope export + polish pass`).

---

## 6. Polish checklist (the deliverable polish pass)

Mirrors [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) §15. Every box must be true on the running app.

- [ ] **Animated number counters** on the `TopBar` (`AnimatedNumber`/`useCountUp`) — store count and edges count up to the **real** value; latency stays a raw mono readout (count-up the count, not the measured ms).
- [ ] **Badge pulse as pins land** — new map markers get `animate-pin-pulse` for one cycle; the inbox cluster dot pulses once.
- [ ] **Skeleton loaders on the streaming rail** — `IncidentRail` (Phase 05) and the inbox/drawer use `<Skeleton>` while fetching; no raw spinners on the data panes.
- [ ] **Refined dark theme tokens** — control-room palette in `globals.css`; **red is the only accent** (`--destructive`/`--contam`), everything else cool/neutral.
- [ ] **Consistent shadcn spacing** — cards use `p-4`, list rows `p-3`, section gaps `gap-3`/`space-y-3`; one radius (`--radius`) and one border token across all three components.
- [ ] **Keyboard-accessible drawers/dialogs** — Sheet + Dialog trap focus, close on **Esc**, return focus to the trigger; every interactive control has an `aria-label`; Trace/Export buttons reachable by Tab.
- [ ] **Reduced-motion respected** — `prefers-reduced-motion: reduce` disables `pin-pulse`/`count-flash` and the count-up lands instantly (verified in Step 3).
- [ ] **Cosine-distance score** still visible on every incident card (Phase 05 rail) — relevance legible, not a `LIKE` in disguise.
- [ ] **Empty / loading / error / clean-lot** states designed in all three new components (drawer empty trail, inbox empty/error, scope "run a trace" empty state).
- [ ] **`aria-live`** on the animated count so screen readers hear the final value, not every frame.

---

## 7. Cut-if-scope-bites

Cut in **this** order if time runs out — but the deep-dive cut list ([`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) §12) governs, and **the spine is never cut**.

1. **`ScopeExport` export action first.** Keep the summary card (N stores / M states / units — it's free, it reads off `TraceResult`), but drop the JSON/CSV download + Notify if the Blob plumbing fights you. Narrate export as "the next step."
2. **`IncidentInbox` full list next.** Collapse to a **single inline cluster** on the console (`groups.slice(0, 1)`) — keep the pgvector "possible cluster" *moment* (it's the `0:18–0:33` demo beat), drop the scroll list and ungrouped tail.
3. **`LineageDrawer` last.** It's the `1:28–1:43` demo beat; only cut if the spine itself is at risk.

> **NEVER cut** (regardless of how this phase goes): the **recursive CTE**, the **PostGIS map JOIN**, the **pgvector rail**, the **live `EXPLAIN` inspector**, **real seed volume**, the **live-URL deploy**. These three screens ride *on top of* a working spine and never before it. If any spine element is at risk, cut everything in this phase before touching it. The minimum winning demo is paste-a-lot → one query → graph + map + rail + EXPLAIN over 250k real edges.

---

## 8. BUILD_LOG entry to append

```markdown
## Phase 07 — Supporting screens + polish (YYYY-MM-DD)

**Shipped:** `LineageDrawer`, `IncidentInbox`, `ScopeExport`, and a global polish pass.

- **LineageDrawer** — clicking a map pin or graph node fires `GET /api/lineage?storeId=|lotId=`
  and slides in a child→source trail ("240 units of PRD-8841, derived from ING-2207, Verde Farms,
  shipped Jun 9"). One JOIN, four tables, made clickable. Keyboard-accessible (shadcn Sheet:
  focus trap + Esc + focus return); skeletons while loading; empty/error states designed.
- **IncidentInbox** — the triage landing list off `GET /api/incidents`. pgvector "possible cluster"
  badges group differently-worded reports under one pathogen/lot signature *before anyone connected
  them* (the demo's 0:18–0:33 beat). Each incident's **Trace** button deep-links into the hero query
  via its suspected TLC. Cut-down mode = one inline cluster.
- **ScopeExport** — bound to the live `TraceResult`: N stores across M states, implicated lot codes,
  total units. **Export FDA traceability record** builds a REAL JSON and CSV download from the live
  trace rows (Blob, not a stub) — `summary.affected_stores` matches the on-screen count. **Notify
  affected stores** is an honest stub (toast + queued state), narrated as the next step.
- **Polish** — animated count-up KPIs on the TopBar (lands on the real value; `aria-live`), pin-pulse
  as markers land, skeletons on streaming panes, refined control-room dark tokens (red = the only
  accent), consistent shadcn spacing, reduced-motion respected.

**Anti-fake:** the lineage trail, the cluster groupings, and the export artifact are all derived from
real query results — no hardcoded trails, no fake clusters, no placeholder CSV.

**Decision:** export is built client-side from the `TraceResult` already in state (no extra round
trip, and it provably matches what's on screen). The "Notify" integration is deliberately a stub —
faking a wired paging integration would be exactly the kind of fakery the rules forbid.

**Green:** `pnpm typecheck` (0 errors) · `pnpm lint` (clean) · `pnpm test` (green) · verified live:
drill-down, inbox clusters, JSON+CSV download, Notify toast.
```

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract (API shapes §10, component paths §5, polish/anti-fake rules §12). **Overrides this doc on any conflict.**
- [`./README.md`](./README.md) — build index, phase dependency graph, spine-vs-polish priority.
- [`./PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) — `runTrace`, the `TraceResult` shape this phase consumes.
- [`./PHASE-04-api-layer.md`](./PHASE-04-api-layer.md) — `/api/lineage`, `/api/incidents`, `/api/trace` route handlers + zod.
- [`./PHASE-05-outbreak-console.md`](./PHASE-05-outbreak-console.md) — the console shell, `GraphPane`/`MapPane`/`TopBar`/`IncidentRail`, selection plumbing.
- [`./PHASE-06-query-inspector.md`](./PHASE-06-query-inspector.md) — the live `EXPLAIN` panel (sibling depth screen).
- [`./PHASE-08-testing.md`](./PHASE-08-testing.md) — where `summarize`/`buildCsv`/`groupByCluster` + drill-down smoke tests land.
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — §4.2 screen breakdown, §10 demo storyboard (1:08–1:43), §12 cut order, §15 polish checklist.
- [`../reference/submission-checklist.md`](../reference/submission-checklist.md) — Design criterion (real empty/loading/error states; clickable data model).
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — RSC/Server Actions, `<Suspense>` streaming for the rail.
```
