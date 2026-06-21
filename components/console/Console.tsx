"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { AlertTriangle, RotateCcw, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { traceAction } from "@/app/actions/trace";
import { SCENARIOS } from "@/lib/scenarios";
import type { ConsoleSelection, TraceResult } from "@/lib/types";
import { GraphPane } from "./GraphPane";
import { IncidentInbox } from "./IncidentInbox";
import { IncidentRail } from "./IncidentRail";
import { LineageDrawer } from "./LineageDrawer";
import { MapPane } from "./MapPane";
import { OutbreakTimeline } from "./OutbreakTimeline";
import { QueryInspector } from "./QueryInspector";
import { ScenarioCycler } from "./ScenarioCycler";
import { ScopeExport } from "./ScopeExport";
import { TopBar } from "./TopBar";

type Status = "idle" | "loading" | "error";

// Earliest / latest moment the contamination reached a store, in epoch ms.
// Drives the Outbreak Time-Travel scrubber. Returns nulls when there's no spread.
function arrivalRange(trace: TraceResult | null): { minT: number | null; maxT: number | null } {
  let minT = Number.POSITIVE_INFINITY;
  let maxT = Number.NEGATIVE_INFINITY;
  for (const store of trace?.stores ?? []) {
    const reached = Date.parse(store.arrivedAt);
    if (Number.isNaN(reached)) continue;
    if (reached < minT) minT = reached;
    if (reached > maxT) maxT = reached;
  }
  if (!Number.isFinite(minT) || !Number.isFinite(maxT)) return { minT: null, maxT: null };
  return { minT, maxT };
}

type ConsoleProps = {
  initial: TraceResult | null;
  initialTlc: string;
  bootError: string | null;
  bootCode?: string | undefined;
  traceSql: string;
};

export function Console({ initial, initialTlc, bootError, bootCode, traceSql }: ConsoleProps) {
  const [result, setResult] = useState<TraceResult | null>(initial);
  const [tlc, setTlc] = useState(initialTlc);
  const [status, setStatus] = useState<Status>(bootError ? "error" : "idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(bootError);
  const [errorCode, setErrorCode] = useState<string | undefined>(bootCode);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selection, setSelection] = useState<ConsoleSelection | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const [cutoff, setCutoff] = useState<number>(() => arrivalRange(initial).maxT ?? 0);
  const [playing, setPlaying] = useState(false);
  const [prevResult, setPrevResult] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const loading = status === "loading" || isPending;
  const timeline = useMemo(() => arrivalRange(result), [result]);

  // When a new trace lands, snap the playhead to the end (show everything) and stop any
  // replay — done during render so cutoff is never stale or non-finite for even one frame
  // (OutbreakTimeline formats it as a date; MapPane filters pins by it).
  if (result !== prevResult) {
    setPrevResult(result);
    setPlaying(false);
    setCutoff(timeline.maxT ?? 0);
  }

  // Replay loop: sweep the cutoff from the first arrival to the last over ~5.2s, then stop.
  // Driven by a SINGLE clock — completion is when the playhead itself reaches maxT, not a
  // parallel wall-clock timeout, so a throttled/background tab can't desync the two. playing
  // only flips true via onTogglePlay (which pre-validates the range), and any new trace
  // resets playing=false during render, so the guard here is a pure no-op exit.
  useEffect(() => {
    if (!playing) return;
    const { minT, maxT } = timeline;
    if (minT === null || maxT === null || maxT <= minT) return;
    const DURATION_MS = 5200;
    const STEP_MS = 60;
    const increment = (maxT - minT) * (STEP_MS / DURATION_MS);
    let current = minT;
    const ticker = window.setInterval(() => {
      current = Math.min(maxT, current + increment);
      setCutoff(current);
      if (current >= maxT) {
        window.clearInterval(ticker);
        setPlaying(false);
      }
    }, STEP_MS);
    return () => window.clearInterval(ticker);
  }, [playing, timeline]);

  const onScrub = useCallback((next: number) => {
    setPlaying(false);
    setCutoff(next);
  }, []);

  const onTogglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const { minT, maxT } = timeline;
    if (minT === null || maxT === null || maxT <= minT) return;
    setCutoff(minT);
    setPlaying(true);
  }, [playing, timeline]);
  const isClean =
    status !== "error" &&
    !loading &&
    result !== null &&
    result.meta.storeCount === 0 &&
    result.edges.length === 0;

  const submitTlcTrace = useCallback((nextTlc: string) => {
    const value = nextTlc.trim();
    if (!value) return;

    setStatus("loading");
    setErrorMsg(null);
    setErrorCode(undefined);

    startTransition(() => {
      void traceAction({ tlc: value }).then((response) => {
        if (response.ok) {
          setResult(response.data);
          setStatus("idle");
          return;
        }
        setStatus("error");
        setErrorMsg(response.error);
        setErrorCode(response.code);
      });
    });
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setAutoplay(false);
      submitTlcTrace(tlc);
    },
    [submitTlcTrace, tlc],
  );

  const traceFromTlc = useCallback(
    (nextTlc: string) => {
      setSelection(null);
      setTlc(nextTlc);
      submitTlcTrace(nextTlc);
    },
    [submitTlcTrace],
  );

  return (
    <main className="console-root flex min-h-dvh flex-col overflow-x-hidden lg:h-dvh lg:min-h-[760px] lg:overflow-hidden">
      <TopBar
        meta={result?.meta ?? null}
        tlc={tlc}
        onTlcChange={setTlc}
        onSubmit={onSubmit}
        loading={loading}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((current) => !current)}
      />

      <ScenarioCycler
        scenarios={SCENARIOS}
        activeTlc={tlc}
        onPick={traceFromTlc}
        loading={loading}
        latencyMs={result?.meta.latencyMs ?? null}
        autoplay={autoplay}
        onToggleAutoplay={() => setAutoplay((current) => !current)}
      />

      {/* loading shimmer */}
      <div className="h-[2px] shrink-0 overflow-hidden bg-transparent">
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              className="h-full w-2/5 bg-gradient-to-r from-transparent via-[var(--p-red)] to-transparent"
            />
          )}
        </AnimatePresence>
      </div>

      {status === "error" && (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-lg border border-[var(--p-red)]/40 bg-[var(--p-red-soft)] px-4 py-3 text-sm text-[var(--p-fg)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AlertTriangle className="size-4 shrink-0 text-[var(--p-red)]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">{errorMsg ?? "Trace failed."}</p>
                {errorCode && (
                  <p className="console-mono mt-0.5 text-xs text-[var(--p-red)]/80">SQLSTATE {errorCode}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => submitTlcTrace(tlc)}
              disabled={loading}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--p-red)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--p-red-2)] disabled:opacity-70"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      )}

      {status !== "error" && (
        <div className="relative flex-1 overflow-visible lg:min-h-0 lg:overflow-hidden">
          <div className="grid min-h-[1720px] grid-cols-1 grid-rows-[420px_420px_880px] gap-px bg-[var(--p-line)] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px] lg:grid-rows-none lg:overflow-hidden">
            <GraphPane
              edges={result?.edges ?? []}
              seedTlc={tlc}
              loading={loading}
              onSelect={setSelection}
            />
            <MapPane
              stores={result?.stores ?? []}
              loading={loading}
              onSelect={setSelection}
              cutoff={cutoff}
            />
            <div className="grid min-h-0 grid-rows-[minmax(180px,1fr)_auto_minmax(190px,0.9fr)] bg-[var(--p-bg)]">
              <IncidentRail incidents={result?.incidents ?? []} loading={loading} />
              <ScopeExport trace={result} />
              <IncidentInbox onTrace={traceFromTlc} tracingTlc={loading ? tlc : null} />
            </div>
          </div>

          {isClean && (
            <section className="absolute inset-4 z-20 flex items-center justify-center rounded-xl border border-[var(--p-teal)]/40 bg-[var(--p-bg-2)]/95 px-6 text-center backdrop-blur-sm">
              <div className="max-w-xl">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-[var(--p-teal)]/50 bg-[var(--p-teal-soft)] text-[var(--p-teal)]">
                  <ShieldCheck className="size-6" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-[var(--p-teal)]">
                  Clean lot — no shelves at risk
                </h2>
                <p className="mt-2 text-sm text-[var(--p-muted)]">
                  <span className="console-mono text-[var(--p-fg)]">{tlc}</span> traced{" "}
                  {result.meta.lotCount.toLocaleString("en-US")} lots and reached no affected stores.
                </p>
              </div>
            </section>
          )}
        </div>
      )}

      {status !== "error" && result && result.meta.storeCount > 0 && timeline.minT !== null && (
        <OutbreakTimeline
          stores={result.stores}
          cutoff={cutoff}
          minT={timeline.minT}
          maxT={timeline.maxT}
          playing={playing}
          loading={loading}
          onScrub={onScrub}
          onTogglePlay={onTogglePlay}
        />
      )}

      <QueryInspector tlc={tlc} sql={traceSql} open={inspectorOpen} onOpenChange={setInspectorOpen} />
      <LineageDrawer selection={selection} onClose={() => setSelection(null)} onTraceLot={traceFromTlc} />
    </main>
  );
}
