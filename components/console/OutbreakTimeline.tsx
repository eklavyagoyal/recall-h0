"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import type { AffectedStore } from "@/lib/types";
import { AnimatedNumber, distinctStates, fmtDate } from "./polish";

export type OutbreakTimelineProps = {
  stores: AffectedStore[];   // affected stores; each has arrivedAt (ISO string), address, units, name
  cutoff: number;            // current playhead, epoch ms
  minT: number | null;       // earliest arrivedAt epoch ms (null when no spread data)
  maxT: number | null;       // latest arrivedAt epoch ms
  playing: boolean;          // is the replay animating
  loading: boolean;          // trace in flight
  onScrub: (epochMs: number) => void;   // user dragged the scrubber → parent sets cutoff & pauses
  onTogglePlay: () => void;              // parent starts replay-from-start (or pauses if playing)
};

const BUCKETS = 48;
const SPARK_W = 200;
const SPARK_H = 40;

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function OutbreakTimeline(props: OutbreakTimelineProps) {
  const { stores, cutoff, minT, maxT, playing, loading, onScrub, onTogglePlay } = props;
  const reduce = useReducedMotion();

  const hasData = minT !== null && maxT !== null && stores.length > 0;
  // Guard divide-by-zero for a single-instant spread.
  const span = hasData ? Math.max(1, maxT - minT) : 1;

  // Cumulative-spread sparkline geometry. Memoized on the inputs that shape it.
  const spark = useMemo(() => {
    if (minT === null || maxT === null || stores.length === 0) return null;
    const localSpan = Math.max(1, maxT - minT);

    // Bucket arrivals, then accumulate.
    const counts = new Array<number>(BUCKETS).fill(0);
    for (const store of stores) {
      const t = Date.parse(store.arrivedAt);
      if (Number.isNaN(t)) continue;
      const ratio = (t - minT) / localSpan;
      const idx = Math.min(BUCKETS - 1, Math.max(0, Math.floor(ratio * BUCKETS)));
      const slot = counts[idx];
      counts[idx] = (slot ?? 0) + 1;
    }
    // Accumulate with a plain loop (no closure mutation) so the running total stays a
    // local during render — keeps the React Compiler happy and the intent obvious.
    const cumulative = new Array<number>(BUCKETS);
    let running = 0;
    for (let i = 0; i < BUCKETS; i += 1) {
      running += counts[i] ?? 0;
      cumulative[i] = running;
    }
    const peak = Math.max(1, cumulative[cumulative.length - 1] ?? 1);

    // One point per bucket edge, mapped into the SVG viewBox.
    const points = cumulative.map((value, i) => {
      const x = (i / (BUCKETS - 1)) * SPARK_W;
      const y = SPARK_H - (value / peak) * SPARK_H;
      return { x, y };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    const areaPath = `${linePath} L${SPARK_W} ${SPARK_H} L0 ${SPARK_H} Z`;

    return { areaPath, linePath, peak };
  }, [stores, minT, maxT]);

  // Playhead position as a fraction across the span (clamped to keep widths sane).
  const pct = hasData ? clampPct(((cutoff - (minT as number)) / span) * 100) : 0;
  const playheadX = (pct / 100) * SPARK_W;

  // Stores the contamination had reached by the current cutoff.
  const reachedStores = useMemo(
    () =>
      stores.filter((store) => {
        const t = Date.parse(store.arrivedAt);
        return Number.isNaN(t) || t <= cutoff;
      }),
    [stores, cutoff],
  );
  const reachedCount = reachedStores.length;
  const stateCount = useMemo(
    () => distinctStates(reachedStores.map((s) => s.address)).length,
    [reachedStores],
  );

  const disabled = !hasData || loading;
  const step = hasData ? Math.max(1, (span) / 600) : 1;

  // Empty / loading guard — keep the bar height so layout never shifts.
  if (!hasData) {
    return (
      <div
        data-testid="outbreak-timeline"
        className="flex h-[64px] shrink-0 items-center gap-3 border-t border-[var(--p-line)] bg-[var(--p-bg-2)] px-4"
      >
        <span className="console-kicker flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--p-faint)]"
            aria-hidden="true"
          />
          Outbreak timeline
        </span>
        <span className="console-mono text-xs text-[var(--p-faint)]">
          {loading ? "Loading spread…" : "No spread data"}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="outbreak-timeline"
      className="flex h-[64px] shrink-0 items-center gap-4 border-t border-[var(--p-line)] bg-[var(--p-bg-2)] px-4"
    >
      {/* Label cluster */}
      <span className="console-kicker flex shrink-0 items-center gap-2">
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-[var(--p-red)]"
          style={{ boxShadow: "0 0 8px 0 var(--p-red)" }}
          animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
          transition={
            reduce
              ? undefined
              : { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
          }
          aria-hidden="true"
        />
        Outbreak timeline
      </span>

      {/* Play / Pause */}
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        data-testid="outbreak-play"
        aria-pressed={playing}
        aria-label={playing ? "Pause replay" : "Replay spread"}
        className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium text-[var(--p-fg)] outline-none transition-colors duration-200 hover:border-[var(--p-red)] focus-visible:ring-2 focus-visible:ring-[var(--p-red-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          borderColor: playing ? "var(--p-red)" : "var(--p-line-2)",
          background: playing ? "var(--p-red-soft)" : "var(--p-surface)",
          color: playing ? "var(--p-red)" : "var(--p-fg)",
        }}
      >
        {playing ? (
          <Pause className="size-3.5" aria-hidden="true" />
        ) : (
          <Play className="size-3.5" aria-hidden="true" />
        )}
        {playing ? "Pause" : "Replay spread"}
      </button>

      {/* Date readout */}
      <div className="flex shrink-0 flex-col justify-center">
        <span className="console-kicker">Cutoff</span>
        <span
          className="console-mono text-sm leading-tight transition-colors duration-200"
          data-testid="outbreak-cutoff-date"
          style={{ color: playing ? "var(--p-red)" : "var(--p-fg)" }}
        >
          {fmtDate(new Date(cutoff).toISOString())}
        </span>
      </div>

      {/* Reached counter */}
      <div className="flex shrink-0 flex-col justify-center">
        <span className="console-kicker">Reached</span>
        <span className="console-mono text-sm leading-tight text-[var(--p-fg)]">
          <AnimatedNumber
            value={reachedCount}
            className={reachedCount > 0 ? "text-[var(--p-red)]" : "text-[var(--p-teal)]"}
          />
          <span className="text-[var(--p-faint)]"> / {stores.length} stores</span>
          <span className="text-[var(--p-faint)]"> · </span>
          <span className="text-[var(--p-teal)]">{stateCount}</span>
          <span className="text-[var(--p-faint)]"> states</span>
        </span>
      </div>

      {/* Cumulative-spread sparkline */}
      <svg
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        width={SPARK_W}
        height={SPARK_H}
        preserveAspectRatio="none"
        className="hidden h-9 shrink-0 lg:block"
        role="img"
        aria-label="Cumulative outbreak spread over time"
      >
        <defs>
          {/* Vertical fade for the reached area — bright at the curve, soft to the floor. */}
          <linearGradient id="outbreak-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,77,77,0.55)" />
            <stop offset="100%" stopColor="rgba(255,77,77,0.05)" />
          </linearGradient>
          <clipPath id="outbreak-spark-reached">
            <rect x="0" y="0" width={Math.max(0, playheadX)} height={SPARK_H} />
          </clipPath>
          <clipPath id="outbreak-spark-future">
            <rect x={playheadX} y="0" width={Math.max(0, SPARK_W - playheadX)} height={SPARK_H} />
          </clipPath>
        </defs>
        {spark && (
          <>
            {/* Future (un-reached) portion — a faint ghost of the full curve.
                NOTE: fill/stroke are set via `style` (CSS), never as SVG presentation
                attributes — var()/custom-props only resolve in CSS, and an unresolved
                attribute silently falls back to black. */}
            <path
              d={spark.areaPath}
              clipPath="url(#outbreak-spark-future)"
              style={{ fill: "rgba(255,255,255,0.05)" }}
            />
            <path
              d={spark.linePath}
              clipPath="url(#outbreak-spark-future)"
              style={{ fill: "none", stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 }}
            />
            {/* Reached portion — glowing red up to the playhead */}
            <path
              d={spark.areaPath}
              fill="url(#outbreak-spark-fill)"
              clipPath="url(#outbreak-spark-reached)"
            />
            <path
              d={spark.linePath}
              clipPath="url(#outbreak-spark-reached)"
              style={{
                fill: "none",
                stroke: "#ff4d4d",
                strokeWidth: 1.75,
                filter: "drop-shadow(0 0 2px rgba(255,77,77,0.7))",
              }}
            />
            {/* Vertical playhead line + glow */}
            <line
              x1={playheadX}
              y1={0}
              x2={playheadX}
              y2={SPARK_H}
              style={{
                stroke: "#ff4d4d",
                strokeWidth: 1.25,
                filter: "drop-shadow(0 0 3px #ff4d4d)",
              }}
            />
          </>
        )}
      </svg>

      {/* Scrubber — custom track/fill/thumb (Tailwind token classes paint reliably);
          the native range input rides on top as a transparent, accessible hit layer. */}
      <div className="relative flex h-4 min-w-0 flex-1 items-center">
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--p-line)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--p-red)]"
          style={{ width: `${pct}%`, boxShadow: "0 0 10px 0 var(--p-red)" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--p-red)] ring-2 ring-[var(--p-bg-2)]"
          style={{ left: `${pct}%`, boxShadow: "0 0 9px 1px var(--p-red)" }}
          aria-hidden="true"
        />
        <input
          type="range"
          min={minT as number}
          max={maxT as number}
          value={Math.min(maxT as number, Math.max(minT as number, cutoff))}
          step={step}
          onChange={(event) => onScrub(Number(event.target.value))}
          disabled={disabled}
          data-testid="outbreak-scrubber"
          aria-label="Outbreak spread timeline scrubber"
          className="outbreak-scrubber relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-red-soft)] disabled:cursor-not-allowed"
        />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .outbreak-scrubber::-webkit-slider-runnable-track { background: transparent; border: none; }
        .outbreak-scrubber::-moz-range-track { background: transparent; border: none; }
        .outbreak-scrubber::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          height: 18px; width: 18px; border-radius: 9999px;
          background: transparent; border: none; cursor: pointer;
        }
        .outbreak-scrubber::-moz-range-thumb {
          height: 18px; width: 18px; border-radius: 9999px;
          background: transparent; border: none; cursor: pointer;
        }
        .outbreak-scrubber:disabled { cursor: not-allowed; }
      `,
        }}
      />
    </div>
  );
}
