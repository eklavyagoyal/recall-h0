"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DatabaseZap, RefreshCw, X } from "lucide-react";
import {
  annotateExplain,
  type AnnotatedLine,
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

type TagMeta = {
  label: string;
  caption: string;
  accent: string;
  soft: string;
};

const tagMeta: Record<ExplainTag, TagMeta> = {
  "recursive-union": {
    label: "Recursive Union",
    caption: "supply graph recursion runs inside PostgreSQL",
    accent: "var(--p-red)",
    soft: "var(--p-red-soft)",
  },
  hnsw: {
    label: "HNSW Index Scan",
    caption: "pgvector ranks similar incident embeddings",
    accent: "var(--p-teal)",
    soft: "var(--p-teal-soft)",
  },
  gist: {
    label: "GiST Spatial Path",
    caption: "PostGIS bounds the affected store geography",
    accent: "var(--p-teal)",
    soft: "var(--p-teal-soft)",
  },
};

// Visual-only: lines that are sequential scans get an amber caution tint.
function isSeqScan(text: string): boolean {
  return /seq scan/i.test(text);
}

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
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

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

  // Drawer affordances: focus the close button on open, Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    const focusId = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusId);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="query-inspector"
          className="console-root fixed inset-0 z-40 flex justify-end bg-black/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => onOpenChange(false)}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Query inspector"
            data-testid="query-inspector"
            className="relative flex h-full w-full max-w-3xl flex-col border-l border-[var(--p-line)] bg-[var(--p-bg-2)] text-[var(--p-fg)] shadow-2xl shadow-black/70"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%", opacity: 0.4 }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%", opacity: 0.4 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[var(--p-line)] px-4">
              <span className="console-kicker flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--p-teal)", boxShadow: "0 0 8px 0 var(--p-teal)" }}
                  aria-hidden="true"
                />
                Query Inspector
              </span>
              <NodeProofChip plan={plan} />

              <div className="ml-auto flex items-center gap-2.5">
                {elapsedMs !== null && !loading && (
                  <span className="console-mono hidden text-[11px] text-[var(--p-faint)] sm:inline">
                    fetched in {elapsedMs} ms
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void runExplain()}
                  disabled={loading}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--p-line-2)] bg-[var(--p-surface-2)] px-2.5 py-1 text-[11px] text-[var(--p-fg)] transition-colors duration-200 hover:border-[var(--p-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-teal)] disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? (
                    <RefreshCw className="size-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <DatabaseZap className="size-3 text-[var(--p-teal)]" aria-hidden="true" />
                  )}
                  {loading ? "Running…" : "Re-run EXPLAIN"}
                </button>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close query inspector"
                  className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-[var(--p-line)] text-[var(--p-muted)] transition-colors duration-200 hover:border-[var(--p-line-2)] hover:text-[var(--p-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-teal)]"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-hidden bg-[var(--p-line)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <section className="flex min-h-0 min-w-0 flex-col bg-[var(--p-bg-2)]">
                <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-[var(--p-line)] px-4">
                  <span className="console-kicker">Hero SQL</span>
                  <span className="console-mono text-[10px] text-[var(--p-faint)]">
                    {sql.length} chars
                  </span>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto px-4 py-3 text-[11.5px] leading-[1.7] text-[var(--p-muted)] console-mono">
                  <code>{sql}</code>
                </pre>
              </section>

              <section className="flex min-h-0 min-w-0 flex-col bg-[var(--p-bg-2)]">
                <div className="flex h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--p-line)] px-4">
                  <span className="console-kicker truncate">
                    Live EXPLAIN ANALYZE · {tlc}
                  </span>
                  <Legend />
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
                  {error ? (
                    <div
                      role="alert"
                      className="rounded-md border border-[var(--p-red)]/40 bg-[var(--p-red-soft)] px-3 py-2.5 text-sm text-[var(--p-red)]"
                    >
                      <span className="console-mono">EXPLAIN failed:</span> {error}
                    </div>
                  ) : loading && !plan ? (
                    <PlanSkeleton />
                  ) : plan ? (
                    <PlanView plan={plan} />
                  ) : (
                    <div className="rounded-md border border-[var(--p-line)] bg-[var(--p-surface)] px-3 py-2.5 text-sm text-[var(--p-muted)]">
                      Open the inspector to fetch the live query plan.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NodeProofChip({ plan }: { plan: AnnotatedPlan | null }) {
  if (!plan) return null;
  const count = allTags.filter((tag) => plan.found[tag]).length;
  const ok = count === allTags.length;
  const accent = ok ? "var(--p-teal)" : "var(--p-amber)";
  return (
    <span
      className="console-mono hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] md:inline-flex"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 45%, transparent)`,
        background: `color-mix(in oklab, ${accent} 13%, transparent)`,
        color: accent,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: accent, boxShadow: `0 0 6px 0 ${accent}` }}
        aria-hidden="true"
      />
      {count}/3 hero nodes in plan
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allTags.map((tag) => {
        const meta = tagMeta[tag];
        return (
          <span
            key={tag}
            className="console-mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
            style={{
              borderColor: `color-mix(in oklab, ${meta.accent} 40%, transparent)`,
              background: meta.soft,
              color: meta.accent,
            }}
          >
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: meta.accent }}
              aria-hidden="true"
            />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

function PlanLine({ line }: { line: AnnotatedLine }) {
  const meta = line.tag ? tagMeta[line.tag] : null;
  const seq = !meta && isSeqScan(line.text);
  const accent = meta?.accent ?? (seq ? "var(--p-amber)" : null);

  if (accent) {
    return (
      <div
        className="console-mono px-3 py-1"
        style={{
          borderLeft: `2px solid ${accent}`,
          background: meta?.soft ?? "color-mix(in oklab, var(--p-amber) 11%, transparent)",
        }}
      >
        <span className="whitespace-pre" style={{ color: accent }}>
          {line.text || " "}
        </span>
        {meta && (
          <span className="console-mono ml-2 text-[10px] text-[var(--p-faint)]">
            {"←"} {meta.label}: {meta.caption}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="console-mono border-l-2 border-l-transparent px-3 py-0.5 text-[var(--p-muted)]">
      <span className="whitespace-pre">{line.text || " "}</span>
    </div>
  );
}

function PlanView({ plan }: { plan: AnnotatedPlan }) {
  return (
    <div
      data-testid="explain-plan"
      className="overflow-auto rounded-md border border-[var(--p-line)] bg-[var(--p-bg)] text-[11px] leading-relaxed"
    >
      {plan.lines.map((line) => (
        <PlanLine key={line.index} line={line} />
      ))}
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div className="space-y-2 rounded-md border border-[var(--p-line)] bg-[var(--p-bg)] p-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded bg-[var(--p-surface-2)]"
          style={{ width: `${62 + ((index * 9) % 32)}%` }}
        />
      ))}
    </div>
  );
}
