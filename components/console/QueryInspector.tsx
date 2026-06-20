"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, DatabaseZap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  annotateExplain,
  type AnnotatedPlan,
  type ExplainTag,
} from "@/lib/explain/annotate";

type ExplainResponse = {
  plan: string;
  nodes: { type: string; detail: string }[];
};

type QueryInspectorProps = {
  tlc: string;
  sql: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asOf?: string | null;
};

const allTags: ExplainTag[] = ["recursive-union", "hnsw", "gist"];

const tagMeta: Record<
  ExplainTag,
  { label: string; caption: string; lineClass: string; chipClass: string }
> = {
  "recursive-union": {
    label: "Recursive Union",
    caption: "supply graph recursion runs inside PostgreSQL",
    lineClass: "border-l-red-500 bg-red-500/10",
    chipClass: "border-red-800 bg-red-500/15 text-red-200",
  },
  hnsw: {
    label: "HNSW Index Scan",
    caption: "pgvector ranks similar incident embeddings",
    lineClass: "border-l-cyan-400 bg-cyan-500/10",
    chipClass: "border-cyan-800 bg-cyan-500/15 text-cyan-200",
  },
  gist: {
    label: "GiST Spatial Path",
    caption: "PostGIS bounds the affected store geography",
    lineClass: "border-l-emerald-400 bg-emerald-500/10",
    chipClass: "border-emerald-800 bg-emerald-500/15 text-emerald-200",
  },
};

export function QueryInspector({
  tlc,
  sql,
  open,
  onOpenChange,
  asOf = null,
}: QueryInspectorProps) {
  const [plan, setPlan] = useState<AnnotatedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const requestId = useRef(0);

  const runExplain = useCallback(async () => {
    if (!tlc.trim()) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tlc, asOf }),
        cache: "no-store",
      });

      if (currentRequest !== requestId.current) return;

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          sqlstate?: string | null;
        };
        throw new Error(body.sqlstate ?? body.error ?? `HTTP ${response.status}`);
      }

      const data = (await response.json()) as ExplainResponse;
      setPlan(annotateExplain(data.plan));
      setElapsedMs(Math.round(performance.now() - startedAt));
    } catch (caught) {
      if (currentRequest !== requestId.current) return;
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [tlc, asOf]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => void runExplain(), 0);
    return () => window.clearTimeout(id);
  }, [open, runExplain]);

  return (
    <section className="shrink-0 border-t border-neutral-800 bg-neutral-950 text-neutral-100">
      <header className="flex h-11 items-center gap-3 px-4">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-neutral-100 hover:text-white"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          <ChevronRight
            className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          Query Inspector
        </button>
        {open && <NodeProofChip plan={plan} />}
        {open && (
          <div className="ml-auto flex items-center gap-3">
            {elapsedMs !== null && !loading && (
              <span className="hidden font-mono text-xs text-neutral-500 sm:inline">
                fetched in {elapsedMs} ms
              </span>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void runExplain()}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="animate-spin" aria-hidden="true" />
              ) : (
                <DatabaseZap aria-hidden="true" />
              )}
              {loading ? "Running..." : "Re-run EXPLAIN"}
            </Button>
          </div>
        )}
      </header>

      {open && (
        <div className="grid max-h-[42vh] grid-cols-1 gap-4 overflow-auto border-t border-neutral-900 px-4 py-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-xs font-medium uppercase text-neutral-500">Hero SQL</h2>
              <span className="font-mono text-[10px] text-neutral-600">{sql.length} chars</span>
            </div>
            <pre className="max-h-[34vh] overflow-auto rounded-md border border-neutral-800 bg-black/70 p-3 text-[11px] leading-relaxed text-neutral-300">
              <code>{sql}</code>
            </pre>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs font-medium uppercase text-neutral-500">
                Live EXPLAIN ANALYZE / {tlc}
              </h2>
              <Legend />
            </div>
            {error ? (
              <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
                EXPLAIN failed: {error}
              </div>
            ) : loading && !plan ? (
              <PlanSkeleton />
            ) : plan ? (
              <PlanView plan={plan} />
            ) : (
              <div className="rounded-md border border-neutral-800 bg-black/60 p-3 text-sm text-neutral-500">
                Open the inspector to fetch the live query plan.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function NodeProofChip({ plan }: { plan: AnnotatedPlan | null }) {
  if (!plan) return null;
  const count = allTags.filter((tag) => plan.found[tag]).length;
  const ok = count === allTags.length;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${
        ok
          ? "border-emerald-800 bg-emerald-500/15 text-emerald-200"
          : "border-amber-800 bg-amber-500/15 text-amber-200"
      }`}
    >
      {count}/3 hero nodes in plan
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allTags.map((tag) => (
        <span
          key={tag}
          className={`rounded-full border px-2 py-0.5 text-[10px] ${tagMeta[tag].chipClass}`}
        >
          {tagMeta[tag].label}
        </span>
      ))}
    </div>
  );
}

function PlanView({ plan }: { plan: AnnotatedPlan }) {
  return (
    <div
      data-testid="explain-plan"
      className="max-h-[34vh] overflow-auto rounded-md border border-neutral-800 bg-black/70 text-[11px] leading-relaxed"
    >
      {plan.lines.map((line) => {
        const meta = line.tag ? tagMeta[line.tag] : null;
        return (
          <div
            key={line.index}
            className={
              meta
                ? `border-l-2 px-3 py-1 font-mono ${meta.lineClass}`
                : "border-l-2 border-l-transparent px-3 py-0.5 font-mono text-neutral-400"
            }
          >
            <span className="whitespace-pre">{line.text || " "}</span>
            {meta && (
              <span className="ml-2 text-[10px] italic text-neutral-400">
                {"<-"} {meta.label}: {meta.caption}
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
    <div className="space-y-2 rounded-md border border-neutral-800 bg-black/60 p-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded bg-neutral-800"
          style={{ width: `${62 + ((index * 9) % 32)}%` }}
        />
      ))}
    </div>
  );
}
