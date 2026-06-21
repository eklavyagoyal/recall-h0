"use client";

import { motion, useReducedMotion } from "motion/react";
import type { SimilarIncident } from "@/lib/types";
import { PaneShell } from "./PaneShell";

function RailSkeleton() {
  return (
    <ul className="space-y-px">
      {Array.from({ length: 5 }).map((_, index) => (
        <li key={index} className="px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="h-2.5 w-24 animate-pulse rounded-sm bg-[var(--p-surface-2)]" />
            <div className="h-2.5 w-10 animate-pulse rounded-sm bg-[var(--p-surface-2)]" />
          </div>
          <div className="mt-2.5 h-2 w-full animate-pulse rounded-sm bg-[var(--p-surface)]" />
          <div className="mt-1.5 h-2 w-3/4 animate-pulse rounded-sm bg-[var(--p-surface)]" />
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[var(--p-surface-2)]">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--p-teal-soft)]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function IncidentRail({
  incidents,
  loading,
}: {
  incidents: SimilarIncident[];
  loading: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const subtitle =
    loading && incidents.length === 0
      ? "scanning"
      : incidents.length > 0
        ? `${incidents.length} matches`
        : "pgvector / cosine";

  return (
    <PaneShell title="Similar incidents" subtitle={subtitle} accent="teal">
      <div className="relative h-full min-h-0 overflow-y-auto">
        {loading && incidents.length === 0 ? (
          <RailSkeleton />
        ) : incidents.length === 0 ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-1.5 px-5 text-center">
            <span className="console-kicker text-[var(--p-faint)]">Awaiting trace</span>
            <span className="console-mono text-[10px] text-[var(--p-faint)]">
              pgvector / cosine similarity
            </span>
          </div>
        ) : (
          <ul>
            {incidents.map((incident, index) => {
              const score = Math.max(0, Math.min(1, incident.score));
              const pct = Math.round(score * 100);
              return (
                <motion.li
                  key={incident.incidentId}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.26,
                    delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.4),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="group border-b border-[var(--p-line)] px-3.5 py-3 transition-colors duration-150 hover:bg-[var(--p-surface)] last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="console-kicker min-w-0 truncate text-[var(--p-teal)]">
                      {incident.pathogen ?? "Unclassified"}
                    </span>
                    <span
                      className="console-mono shrink-0 text-[11px] font-medium text-[var(--p-teal)] tabular-nums"
                      title="Cosine similarity to the query embedding"
                    >
                      {pct}%
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--p-fg)]">
                    {incident.text}
                  </p>

                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--p-surface-2)]">
                      <motion.div
                        className="h-full origin-left rounded-full bg-[var(--p-teal)]"
                        style={{
                          width: "100%",
                          boxShadow: "0 0 6px 0 var(--p-teal)",
                        }}
                        initial={reduceMotion ? false : { scaleX: 0 }}
                        animate={{ scaleX: score }}
                        transition={{
                          duration: 0.55,
                          delay: reduceMotion ? 0 : Math.min(index * 0.045 + 0.12, 0.5),
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    </div>
                    <span className="console-mono shrink-0 text-[10px] text-[var(--p-faint)]">
                      #{incident.incidentId}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}

        {loading && incidents.length > 0 && (
          <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-px overflow-hidden bg-[var(--p-line)]">
            <motion.div
              className="h-full w-1/2 origin-left bg-[var(--p-teal)]"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            />
          </div>
        )}
      </div>
    </PaneShell>
  );
}
