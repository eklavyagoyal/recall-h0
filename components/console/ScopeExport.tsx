"use client";

import { useMemo, useState } from "react";
import { Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <section className="border-t border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-600">
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
    <section className="border-t border-neutral-800 bg-neutral-950 p-3">
      <header className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-neutral-400">Recall scope</span>
        <span className="rounded-full border border-neutral-700 px-2 py-0.5 font-mono text-[10px] text-neutral-500">
          FSMA-204
        </span>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <ScopeKpi label="Stores" value={summary.storeCount} />
        <ScopeKpi label="States" value={summary.stateCount} />
        <ScopeKpi label="Units" value={summary.totalUnits} />
      </div>

      <div className="mt-3">
        <p className="text-[10px] uppercase text-neutral-600">Implicated lot ids</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {summary.lotIds.slice(0, 5).map((lotId) => (
            <span key={lotId} className="rounded border border-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
              {lotId}
            </span>
          ))}
          {summary.lotIds.length > 5 && (
            <span className="rounded border border-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
              +{summary.lotIds.length - 5}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
          <Download aria-hidden="true" />
          Export FDA record
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={notified}
          onClick={() => {
            setNotified(true);
            setNotice(`Notifications queued: integration pending for ${summary.storeCount} stores`);
          }}
        >
          <Send aria-hidden="true" />
          {notified ? "Notifications queued" : "Notify stores"}
        </Button>
      </div>

      {notice && (
        <p role="status" className="mt-2 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">
          {notice}
        </p>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div role="dialog" aria-modal="true" aria-label="Export FDA traceability record" className="w-full max-w-md rounded-md border border-neutral-800 bg-neutral-950 p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-neutral-100">Export FDA traceability record</h2>
            <p className="mt-2 text-sm text-neutral-400">
              {summary.storeCount.toLocaleString("en-US")} stores across {summary.stateCount} states /{" "}
              {summary.totalUnits.toLocaleString("en-US")} units. The file is built from the live trace rows.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => exportRecord("json")}>
                Download JSON
              </Button>
              <Button type="button" variant="secondary" onClick={() => exportRecord("csv")}>
                Download CSV
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ScopeKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-2">
      <div className="font-mono text-sm font-semibold text-neutral-100">
        <AnimatedNumber value={value} />
      </div>
      <div className="mt-0.5 text-[10px] uppercase text-neutral-600">{label}</div>
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
