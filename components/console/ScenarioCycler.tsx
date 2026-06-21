"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Pause, Play, Zap } from "lucide-react";
import type { Scenario } from "@/lib/scenarios";

const ACCENT: Record<Scenario["accent"], string> = {
  red: "var(--p-red)",
  amber: "var(--p-amber)",
  teal: "var(--p-teal)",
};

type ScenarioCyclerProps = {
  scenarios: readonly Scenario[];
  activeTlc: string;
  onPick: (tlc: string) => void;
  loading: boolean;
  latencyMs: number | null;
  autoplay: boolean;
  onToggleAutoplay: () => void;
};

export function ScenarioCycler({
  scenarios,
  activeTlc,
  onPick,
  loading,
  latencyMs,
  autoplay,
  onToggleAutoplay,
}: ScenarioCyclerProps) {
  const activeIndex = Math.max(
    0,
    scenarios.findIndex((scenario) => scenario.tlc === activeTlc),
  );
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!autoplay || loading) return;
    const id = window.setTimeout(() => {
      const next = scenarios[(activeIndex + 1) % scenarios.length];
      if (next) onPickRef.current(next.tlc);
    }, 4200);
    return () => window.clearTimeout(id);
  }, [autoplay, loading, activeIndex, scenarios]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--p-line)] bg-[var(--p-bg-2)] px-3 py-2.5">
      <span className="console-kicker mr-1 hidden items-center gap-1.5 md:flex">
        <Zap className="size-3 text-[var(--p-teal)]" aria-hidden="true" />
        live scenarios
      </span>

      <div className="flex flex-1 flex-wrap items-center gap-2">
        {scenarios.map((scenario) => {
          const active = scenario.tlc === activeTlc;
          const accent = ACCENT[scenario.accent];
          return (
            <button
              key={scenario.tlc}
              type="button"
              onClick={() => onPick(scenario.tlc)}
              disabled={loading}
              aria-pressed={active}
              title={`${scenario.product} — ${scenario.pathogen} — ${scenario.scale}`}
              className="group relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-colors duration-200 hover:border-[var(--p-line-2)] disabled:cursor-wait"
              style={{
                borderColor: active ? accent : "var(--p-line)",
                background: active ? `color-mix(in oklab, ${accent} 13%, transparent)` : "var(--p-surface)",
              }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: accent, boxShadow: active ? `0 0 8px 0 ${accent}` : "none" }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span
                  className="block truncate text-xs font-medium"
                  style={{ color: active ? "var(--p-fg)" : "var(--p-muted)" }}
                >
                  {scenario.product}
                </span>
                <span className="console-mono block text-[10px] text-[var(--p-faint)]">
                  {scenario.scale} · {scenario.targetStores.toLocaleString("en-US")} stores
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {latencyMs !== null && (
          <span className="console-mono flex items-center gap-1.5 rounded-md border border-[var(--p-teal)]/40 bg-[var(--p-teal-soft)] px-2.5 py-1 text-[11px] text-[var(--p-teal)]">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-[var(--p-teal)]"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY }}
              aria-hidden="true"
            />
            {latencyMs} ms · Aurora
          </span>
        )}
        <button
          type="button"
          onClick={onToggleAutoplay}
          aria-pressed={autoplay}
          aria-label={autoplay ? "Pause automatic scenario cycling" : "Auto-cycle scenarios"}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--p-line-2)] bg-[var(--p-surface-2)] px-2.5 py-1 text-[11px] text-[var(--p-fg)] transition-colors hover:border-[var(--p-teal)]"
        >
          {autoplay ? <Pause className="size-3" aria-hidden="true" /> : <Play className="size-3" aria-hidden="true" />}
          {autoplay ? "Cycling" : "Auto-play"}
        </button>
      </div>
    </div>
  );
}
