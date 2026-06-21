"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import type { IncidentCluster, InboxIncident, IncidentsResult } from "@/lib/types";
import { PaneShell } from "./PaneShell";
import { fmtRelative } from "./polish";

type IncidentInboxProps = {
  onTrace: (tlc: string) => void;
  tracingTlc?: string | null;
};

type Group = {
  key: string;
  cluster: IncidentCluster | null;
  incidents: InboxIncident[];
};

export function IncidentInbox({ onTrace, tracingTlc = null }: IncidentInboxProps) {
  const [data, setData] = useState<IncidentsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const groups = useMemo(() => groupByCluster(data), [data]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/incidents", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Inbox failed (${response.status})`);
        return (await response.json()) as IncidentsResult;
      })
      .then((result) => setData(result))
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Inbox failed");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const subtitle = data
    ? `${data.incidents.length} reports / ${data.clusters.length} clusters`
    : loading
      ? "loading"
      : undefined;

  return (
    <PaneShell title="Incident inbox" subtitle={subtitle} accent="red">
      <div className="h-full min-h-0 overflow-y-auto px-3.5 py-3">
        {loading && <InboxSkeleton />}
        {!loading && error && (
          <p
            role="alert"
            className="console-mono rounded-md border border-[var(--p-red)]/40 bg-[var(--p-red-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--p-red)]"
          >
            {error}
          </p>
        )}
        {!loading && !error && groups.length === 0 && (
          <p className="console-mono py-10 text-center text-xs text-[var(--p-muted)]">
            No incident reports.
          </p>
        )}
        {!loading && !error && groups.length > 0 && (
          <div className="space-y-5">
            {groups.slice(0, 4).map((group) => {
              const rows = group.incidents.slice(0, group.cluster ? 3 : 5);
              return (
                <div key={group.key} className="space-y-2">
                  {group.cluster && (
                    <div className="flex items-center gap-2">
                      <span
                        className="console-mono inline-flex items-center gap-1.5 rounded-full border border-[var(--p-red)]/40 bg-[var(--p-red-soft)] px-2 py-0.5 text-[10px] text-[var(--p-red)]"
                        title="pgvector grouped differently worded reports as one signature"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-[var(--p-red)]"
                          style={{ boxShadow: "0 0 6px 0 var(--p-red)" }}
                          aria-hidden="true"
                        />
                        possible cluster / {group.cluster.size}
                      </span>
                      <span className="truncate text-xs text-[var(--p-muted)]">{group.cluster.label}</span>
                    </div>
                  )}

                  <ul className="space-y-1.5">
                    {rows.map((incident, index) => (
                      <IncidentRow
                        key={incident.incidentId}
                        incident={incident}
                        index={index}
                        tracing={!!incident.suspectedTlc && incident.suspectedTlc === tracingTlc}
                        onTrace={onTrace}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PaneShell>
  );
}

function IncidentRow({
  incident,
  index,
  tracing,
  onTrace,
}: {
  incident: InboxIncident;
  index: number;
  tracing: boolean;
  onTrace: (tlc: string) => void;
}) {
  const traceable = Boolean(incident.suspectedTlc);
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index, 8) * 0.045, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        disabled={!traceable || tracing}
        onClick={() => incident.suspectedTlc && onTrace(incident.suspectedTlc)}
        aria-label={incident.suspectedTlc ? `Trace lot ${incident.suspectedTlc}` : "No suspected lot"}
        aria-busy={tracing}
        className="group relative block w-full cursor-pointer rounded-md border border-[var(--p-line)] bg-[var(--p-surface)] py-2.5 pl-3.5 pr-3 text-left transition-colors duration-200 hover:border-[var(--p-line-2)] hover:bg-[var(--p-surface-2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--p-red)] disabled:cursor-default"
      >
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[var(--p-red)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ opacity: tracing ? 1 : undefined, boxShadow: tracing ? "0 0 8px 0 var(--p-red)" : undefined }}
          aria-hidden="true"
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 text-xs leading-relaxed text-[var(--p-fg)]">{incident.text}</p>
            <p className="console-mono mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--p-faint)]">
              {incident.pathogen && (
                <span className="rounded border border-[var(--p-line-2)] px-1.5 py-0.5 text-[var(--p-muted)]">
                  {incident.pathogen}
                </span>
              )}
              {incident.suspectedTlc && (
                <span className="rounded border border-[var(--p-teal)]/30 bg-[var(--p-teal-soft)] px-1.5 py-0.5 text-[var(--p-teal)]">
                  {incident.suspectedTlc}
                </span>
              )}
              <span>{fmtRelative(incident.reportedAt)}</span>
            </p>
          </div>

          {traceable && (
            <span
              className="mt-0.5 flex shrink-0 items-center gap-1 text-[10px] text-[var(--p-red)]"
              aria-hidden="true"
            >
              {tracing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span className="console-mono">tracing</span>
                </>
              ) : (
                <ArrowUpRight className="size-4 text-[var(--p-faint)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--p-red)] group-hover:opacity-100 group-focus-visible:opacity-100" />
              )}
            </span>
          )}
        </div>
      </button>
    </motion.li>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-md border border-[var(--p-line)] bg-[var(--p-surface)] px-3.5 py-2.5">
          <div className="h-3.5 w-full animate-pulse rounded bg-[var(--p-surface-2)]" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--p-surface)]" />
        </div>
      ))}
    </div>
  );
}

export function groupByCluster(data: IncidentsResult | null): Group[] {
  if (!data) return [];
  const byId = new Map(data.incidents.map((incident) => [incident.incidentId, incident]));
  const claimed = new Set<number>();
  const groups: Group[] = [];

  for (const cluster of [...data.clusters].sort((left, right) => right.size - left.size)) {
    const incidents = cluster.incidentIds
      .map((id) => byId.get(id))
      .filter((incident): incident is InboxIncident => Boolean(incident));
    if (incidents.length === 0) continue;
    incidents.forEach((incident) => claimed.add(incident.incidentId));
    groups.push({ key: `cluster:${cluster.label}:${cluster.incidentIds.join("-")}`, cluster, incidents });
  }

  const unclustered = data.incidents.filter((incident) => !claimed.has(incident.incidentId));
  if (unclustered.length > 0) {
    groups.push({ key: "unclustered", cluster: null, incidents: unclustered });
  }

  return groups;
}
