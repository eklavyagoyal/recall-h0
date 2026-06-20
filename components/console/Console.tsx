"use client";

import { useCallback, useState, useTransition, type FormEvent } from "react";
import { AlertTriangle, RotateCcw, ShieldCheck } from "lucide-react";
import { traceAction } from "@/app/actions/trace";
import { Button } from "@/components/ui/button";
import type { ConsoleSelection, TraceResult } from "@/lib/types";
import { GraphPane } from "./GraphPane";
import { IncidentInbox } from "./IncidentInbox";
import { IncidentRail } from "./IncidentRail";
import { LineageDrawer } from "./LineageDrawer";
import { MapPane } from "./MapPane";
import { QueryInspector } from "./QueryInspector";
import { ScopeExport } from "./ScopeExport";
import { TopBar } from "./TopBar";

type Status = "idle" | "loading" | "error";

type ConsoleProps = {
  initial: TraceResult | null;
  initialTlc: string;
  bootError: string | null;
  bootCode?: string | undefined;
  traceSql: string;
};

export function Console({
  initial,
  initialTlc,
  bootError,
  bootCode,
  traceSql,
}: ConsoleProps) {
  const [result, setResult] = useState<TraceResult | null>(initial);
  const [tlc, setTlc] = useState(initialTlc);
  const [status, setStatus] = useState<Status>(bootError ? "error" : "idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(bootError);
  const [errorCode, setErrorCode] = useState<string | undefined>(bootCode);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selection, setSelection] = useState<ConsoleSelection | null>(null);
  const [isPending, startTransition] = useTransition();

  const loading = status === "loading" || isPending;
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
    <main className="flex min-h-dvh flex-col overflow-x-hidden bg-neutral-950 text-neutral-100 lg:h-dvh lg:min-h-[720px] lg:overflow-hidden">
      <TopBar
        meta={result?.meta ?? null}
        tlc={tlc}
        onTlcChange={setTlc}
        onSubmit={onSubmit}
        loading={loading}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((current) => !current)}
      />

      {status === "error" && (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-md border border-red-900/80 bg-red-950/50 px-4 py-3 text-sm text-red-100 shadow-lg shadow-red-950/20"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AlertTriangle className="size-4 shrink-0 text-red-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">{errorMsg ?? "Trace failed."}</p>
                {errorCode && (
                  <p className="mt-0.5 font-mono text-xs text-red-300/80">SQLSTATE {errorCode}</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => submitTlcTrace(tlc)}
              disabled={loading}
            >
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {status !== "error" && (
        <div className="relative flex-1 overflow-visible lg:min-h-0 lg:overflow-hidden">
          <div className="grid min-h-[1720px] grid-cols-1 grid-rows-[420px_420px_880px] gap-px bg-neutral-800 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px] lg:grid-rows-none lg:overflow-hidden">
            <GraphPane
              edges={result?.edges ?? []}
              seedTlc={tlc}
              loading={loading}
              onSelect={setSelection}
            />
            <MapPane stores={result?.stores ?? []} loading={loading} onSelect={setSelection} />
            <div className="grid min-h-0 grid-rows-[minmax(180px,1fr)_auto_minmax(190px,0.9fr)] bg-neutral-950">
              <IncidentRail incidents={result?.incidents ?? []} loading={loading} />
              <ScopeExport trace={result} />
              <IncidentInbox onTrace={traceFromTlc} tracingTlc={loading ? tlc : null} />
            </div>
          </div>

          {isClean && (
            <section className="absolute inset-4 z-20 flex items-center justify-center rounded-md border border-emerald-900/70 bg-emerald-950/90 px-6 text-center shadow-2xl shadow-black/40 backdrop-blur-sm">
              <div className="max-w-xl">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-emerald-700 bg-emerald-500/10 text-emerald-300">
                  <ShieldCheck className="size-6" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-emerald-200">
                  Clean lot - no shelves at risk
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  <span className="font-mono text-neutral-200">{tlc}</span> traced{" "}
                  {result.meta.lotCount.toLocaleString("en-US")} lots and reached no affected
                  stores.
                </p>
              </div>
            </section>
          )}
        </div>
      )}

      <QueryInspector
        tlc={tlc}
        sql={traceSql}
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
      />
      <LineageDrawer
        selection={selection}
        onClose={() => setSelection(null)}
        onTraceLot={traceFromTlc}
      />
    </main>
  );
}
