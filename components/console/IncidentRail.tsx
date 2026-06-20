"use client";

import { Badge } from "@/components/ui/badge";
import type { SimilarIncident } from "@/lib/types";

function scoreClass(score: number): string {
  if (score >= 0.85) return "border-red-700 bg-red-500/15 text-red-200";
  if (score >= 0.7) return "border-amber-700 bg-amber-500/15 text-amber-200";
  return "border-neutral-700 bg-neutral-800 text-neutral-300";
}

function RailSkeleton() {
  return (
    <div className="space-y-3 p-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-md border border-neutral-800 bg-neutral-900"
        />
      ))}
    </div>
  );
}

export function IncidentRail({
  incidents,
  loading,
}: {
  incidents: SimilarIncident[];
  loading: boolean;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-neutral-950">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 px-3">
        <span className="text-xs font-medium uppercase text-neutral-400">Similar incidents</span>
        <span className="font-mono text-[10px] text-neutral-600">pgvector / HNSW</span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {loading && incidents.length === 0 ? (
          <RailSkeleton />
        ) : incidents.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5 text-center text-sm text-neutral-600">
            No similar incidents for this trace.
          </div>
        ) : (
          <ul className="space-y-3 p-3">
            {incidents.map((incident) => (
              <li
                key={incident.incidentId}
                className="rounded-md border border-neutral-800 bg-neutral-900 p-3 transition-colors hover:border-neutral-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-xs font-medium text-neutral-300">
                    {incident.pathogen ?? "Unclassified report"}
                  </span>
                  <Badge
                    variant="outline"
                    className={`h-5 shrink-0 rounded-full px-2 font-mono text-[10px] ${scoreClass(
                      incident.score,
                    )}`}
                    title="Cosine similarity to the query embedding"
                  >
                    {incident.score.toFixed(2)}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-400">
                  {incident.text}
                </p>
                <span className="mt-2 block font-mono text-[10px] text-neutral-600">
                  #{incident.incidentId}
                </span>
              </li>
            ))}
          </ul>
        )}
        {loading && incidents.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 overflow-hidden bg-neutral-900">
            <div className="h-full w-1/2 animate-pulse bg-red-500/70" />
          </div>
        )}
      </div>
    </aside>
  );
}
