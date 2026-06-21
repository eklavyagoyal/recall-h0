"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, FileJson, Send, X } from "lucide-react";
import type { TraceResult } from "@/lib/types";
import { AnimatedNumber, distinctStates } from "./polish";

type ScopeSummary = {
  storeCount: number;
  stateCount: number;
  states: string[];
  totalUnits: number;
  lotIds: string[];
};

export function ScopeExport({ trace }: { trace: TraceResult | null }) {
  const summary = useMemo(() => summarize(trace), [trace]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);

  if (!trace || summary.storeCount === 0) {
    return (
      <section className="border-t border-[var(--p-line)] bg-[var(--p-bg)] px-3.5 py-3 text-sm text-[var(--p-muted)]">
        Run a trace to compute an exportable recall scope.
      </section>
    );
  }

  const exportRecord = (format: "json" | "csv") => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "json") {
      download(
        `recall-scope-${stamp}.json`,
        JSON.stringify(buildFdaJson(trace, summary), null, 2),
        "application/json",
      );
    } else {
      download(`recall-scope-${stamp}.csv`, buildCsv(trace), "text/csv");
    }
    setNotice(`${format.toUpperCase()} export ready: ${summary.storeCount} stores`);
    setDialogOpen(false);
  };

  return (
    <section className="border-t border-[var(--p-line)] bg-[var(--p-bg)] px-3.5 py-3">
      <header className="mb-3 flex items-center justify-between">
        <span className="console-kicker flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--p-red)]"
            style={{ boxShadow: "0 0 8px 0 var(--p-red)" }}
            aria-hidden="true"
          />
          Recall scope
        </span>
        <span className="console-mono rounded-full border border-[var(--p-line-2)] px-2 py-0.5 text-[10px] text-[var(--p-faint)]">
          FSMA-204
        </span>
      </header>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[var(--p-line)] bg-[var(--p-line)]">
        <ScopeKpi label="Stores" value={summary.storeCount} accent="red" />
        <ScopeKpi label="States" value={summary.stateCount} />
        <ScopeKpi label="Units" value={summary.totalUnits} accent="red" />
      </div>

      <div className="mt-3">
        <div className="console-kicker flex items-center justify-between">
          <span>Implicated lot ids</span>
          <span className="console-mono text-[var(--p-teal)]">
            <AnimatedNumber value={summary.lotIds.length} />
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {summary.lotIds.slice(0, 5).map((lotId) => (
            <span
              key={lotId}
              className="console-mono rounded border border-[var(--p-line-2)] bg-[var(--p-surface)] px-1.5 py-0.5 text-[10px] text-[var(--p-muted)]"
            >
              {lotId}
            </span>
          ))}
          {summary.lotIds.length > 5 && (
            <span className="console-mono rounded border border-[var(--p-line)] px-1.5 py-0.5 text-[10px] text-[var(--p-faint)]">
              +{summary.lotIds.length - 5}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--p-teal)]/40 bg-[var(--p-teal-soft)] px-3 py-2 text-xs font-medium text-[var(--p-teal)] transition-colors duration-200 hover:border-[var(--p-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-teal)]/60"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Export FDA record
        </button>
        <button
          type="button"
          disabled={notified}
          onClick={() => {
            setNotified(true);
            setNotice(`Notifications queued: integration pending for ${summary.storeCount} stores`);
          }}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--p-line-2)] bg-[var(--p-surface)] px-3 py-2 text-xs font-medium text-[var(--p-fg)] transition-colors duration-200 hover:border-[var(--p-line-2)] hover:bg-[var(--p-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-line-2)] disabled:cursor-not-allowed disabled:text-[var(--p-faint)]"
        >
          <Send className="size-3.5" aria-hidden="true" />
          {notified ? "Notifications queued" : "Notify stores"}
        </button>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="console-mono mt-2 rounded-md border border-[var(--p-line)] bg-[var(--p-surface)] px-2.5 py-1.5 text-[11px] text-[var(--p-muted)]"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            onClick={() => setDialogOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Export FDA traceability record"
              initial={{ opacity: 0, scale: 0.98, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-lg border border-[var(--p-line-2)] bg-[var(--p-bg-2)] p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="console-kicker flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[var(--p-teal)]"
                      style={{ boxShadow: "0 0 8px 0 var(--p-teal)" }}
                      aria-hidden="true"
                    />
                    Export record
                  </span>
                  <h2 className="mt-2 text-base font-semibold text-[var(--p-fg)]">
                    FDA traceability record
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  aria-label="Cancel export"
                  className="flex cursor-pointer items-center justify-center rounded-md border border-[var(--p-line)] p-1.5 text-[var(--p-muted)] transition-colors hover:border-[var(--p-line-2)] hover:text-[var(--p-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-line-2)]"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>

              <p className="mt-3 text-sm text-[var(--p-muted)]">
                <span className="console-mono text-[var(--p-fg)]">
                  {summary.storeCount.toLocaleString("en-US")}
                </span>{" "}
                stores across{" "}
                <span className="console-mono text-[var(--p-fg)]">{summary.stateCount}</span> states /{" "}
                <span className="console-mono text-[var(--p-fg)]">
                  {summary.totalUnits.toLocaleString("en-US")}
                </span>{" "}
                units. The file is built from the live trace rows.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => exportRecord("json")}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--p-teal)]/40 bg-[var(--p-teal-soft)] px-3 py-2 text-xs font-medium text-[var(--p-teal)] transition-colors duration-200 hover:border-[var(--p-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-teal)]/60"
                >
                  <FileJson className="size-3.5" aria-hidden="true" />
                  Download JSON
                </button>
                <button
                  type="button"
                  onClick={() => exportRecord("csv")}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--p-teal)]/40 bg-[var(--p-teal-soft)] px-3 py-2 text-xs font-medium text-[var(--p-teal)] transition-colors duration-200 hover:border-[var(--p-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-teal)]/60"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download CSV
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ScopeKpi({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: number;
  accent?: "red" | "neutral";
}) {
  return (
    <div className="bg-[var(--p-bg)] p-2.5">
      <div
        className="console-mono text-base font-semibold"
        style={{ color: accent === "red" ? "var(--p-red)" : "var(--p-fg)" }}
      >
        <AnimatedNumber value={value} />
      </div>
      <div className="console-kicker mt-1">{label}</div>
    </div>
  );
}

export function summarize(trace: TraceResult | null): ScopeSummary {
  if (!trace) return { storeCount: 0, stateCount: 0, states: [], totalUnits: 0, lotIds: [] };
  const states = distinctStates(trace.stores.map((store) => store.address));
  const lotIds = [...new Set(trace.edges.flatMap((edge) => [String(edge.parent), String(edge.child)]))];
  return {
    storeCount: trace.meta.storeCount,
    stateCount: states.length,
    states,
    totalUnits: trace.meta.totalUnits,
    lotIds,
  };
}

export function buildFdaJson(trace: TraceResult, summary: ScopeSummary) {
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
      query_latency_ms: trace.meta.latencyMs,
    },
    affected_stores: trace.stores.map((store) => ({
      store_id: store.storeId,
      name: store.name,
      chain: store.chain,
      address: store.address,
      lat: store.lat,
      lng: store.lng,
      recalled_units: store.units,
    })),
    similar_incidents: trace.incidents.map((incident) => ({
      incident_id: incident.incidentId,
      pathogen: incident.pathogen,
      cosine_score: incident.score,
      text: incident.text,
    })),
  };
}

export function buildCsv(trace: TraceResult): string {
  const header = ["store_id", "name", "chain", "address", "lat", "lng", "recalled_units"];
  const rows = trace.stores.map((store) =>
    [store.storeId, store.name, store.chain, store.address, store.lat, store.lng, store.units]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\r\n");
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
