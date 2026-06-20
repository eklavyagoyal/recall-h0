"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { IncidentCluster, InboxIncident, IncidentsResult } from "@/lib/types";
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

  return (
    <section className="flex min-h-0 flex-col border-t border-neutral-800 bg-neutral-950">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 px-3">
        <span className="text-xs font-medium uppercase text-neutral-400">Incident inbox</span>
        {data && (
          <span className="font-mono text-[10px] text-neutral-600">
            {data.incidents.length} reports / {data.clusters.length} clusters
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading && <InboxSkeleton />}
        {!loading && error && (
          <p role="alert" className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </p>
        )}
        {!loading && !error && groups.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-600">No incident reports.</p>
        )}
        {!loading && !error && groups.length > 0 && (
          <div className="space-y-4">
            {groups.slice(0, 4).map((group) => (
              <div key={group.key} className="space-y-2">
                {group.cluster && (
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-red-800 bg-red-500/15 px-2 py-0.5 text-[10px] text-red-200"
                      title="pgvector grouped differently worded reports as one signature"
                    >
                      <span className="size-1.5 rounded-full bg-red-500 animate-pin-pulse" />
                      possible cluster / {group.cluster.size}
                    </span>
                    <span className="truncate text-xs text-neutral-500">{group.cluster.label}</span>
                  </div>
                )}

                <ul className="space-y-2">
                  {group.incidents.slice(0, group.cluster ? 3 : 5).map((incident) => (
                    <IncidentRow
                      key={incident.incidentId}
                      incident={incident}
                      tracing={!!incident.suspectedTlc && incident.suspectedTlc === tracingTlc}
                      onTrace={onTrace}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function IncidentRow({
  incident,
  tracing,
  onTrace,
}: {
  incident: InboxIncident;
  tracing: boolean;
  onTrace: (tlc: string) => void;
}) {
  const traceable = Boolean(incident.suspectedTlc);
  return (
    <li className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs leading-relaxed text-neutral-300">{incident.text}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-neutral-500">
            {incident.pathogen && (
              <span className="rounded border border-neutral-700 px-1.5 py-0.5">{incident.pathogen}</span>
            )}
            {incident.suspectedTlc && (
              <span className="font-mono text-neutral-400">{incident.suspectedTlc}</span>
            )}
            <span>{fmtRelative(incident.reportedAt)}</span>
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!traceable || tracing}
          onClick={() => incident.suspectedTlc && onTrace(incident.suspectedTlc)}
          aria-label={
            incident.suspectedTlc ? `Trace lot ${incident.suspectedTlc}` : "No suspected lot"
          }
        >
          {tracing ? "Tracing..." : "Trace"}
        </Button>
      </div>
    </li>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-md border border-neutral-800 p-3">
          <div className="h-4 w-full animate-pulse rounded bg-neutral-800" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-900" />
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
