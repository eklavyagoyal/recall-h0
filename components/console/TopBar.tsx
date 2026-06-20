"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Clock3, FileSearch, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TraceMeta } from "@/lib/types";
import { AnimatedNumber } from "./polish";
const SLA_MS = 24 * 60 * 60 * 1000;

type TopBarProps = {
  meta: TraceMeta | null;
  tlc: string;
  onTlcChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
};

function Kpi({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="flex h-12 min-w-[88px] flex-col justify-center rounded-md border border-neutral-800 bg-neutral-900/90 px-3">
      <span className="text-[10px] font-medium uppercase text-neutral-500">{label}</span>
      <span className={`font-mono text-lg leading-tight ${accent ? "text-red-300" : "text-neutral-100"}`}>
        {value}
      </span>
    </div>
  );
}

function SlaCountdown() {
  const deadlineRef = useRef<number>(0);
  const [remaining, setRemaining] = useState(SLA_MS);

  useEffect(() => {
    deadlineRef.current = Date.now() + SLA_MS;
    const tick = () => setRemaining(Math.max(0, deadlineRef.current - Date.now()));
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  const urgent = remaining < 3_600_000;

  return (
    <div className="flex h-12 min-w-[116px] flex-col justify-center rounded-md border border-amber-900/70 bg-amber-950/30 px-3">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase text-amber-500/90">
        <Clock3 className="size-3" aria-hidden="true" />
        FDA 24h SLA
      </span>
      <span className={`font-mono text-lg leading-tight ${urgent ? "text-red-300" : "text-amber-300"}`}>
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}

export function TopBar({
  meta,
  tlc,
  onTlcChange,
  onSubmit,
  loading,
  inspectorOpen,
  onToggleInspector,
}: TopBarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-4 py-3">
      <div className="mr-1 flex min-w-[190px] items-center gap-2">
        <span className="size-2.5 rounded-full bg-red-500 shadow-[0_0_10px_3px_rgba(239,68,68,0.45)]" />
        <h1 className="text-sm font-semibold text-neutral-100">Recall Outbreak Console</h1>
      </div>

      <form onSubmit={onSubmit} className="flex min-w-[280px] flex-1 items-center gap-2 sm:flex-none">
        <label className="sr-only" htmlFor="trace-tlc">
          Traceability Lot Code
        </label>
        <input
          id="trace-tlc"
          data-testid="tlc-input"
          value={tlc}
          onChange={(event) => onTlcChange(event.target.value)}
          placeholder="Traceability Lot Code"
          className="h-9 min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 font-mono text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-red-500 focus:ring-3 focus:ring-red-900/30 sm:w-72"
        />
        <Button
          type="submit"
          data-testid="trace-button"
          disabled={loading}
          className="h-9 bg-red-600 px-3 hover:bg-red-500"
        >
          {loading ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Search aria-hidden="true" />
          )}
          {loading ? "Tracing..." : "Trace"}
        </Button>
      </form>

      <Button
        type="button"
        variant={inspectorOpen ? "secondary" : "outline"}
        className="h-9"
        aria-pressed={inspectorOpen}
        onClick={onToggleInspector}
        data-testid="inspector-toggle"
      >
        <FileSearch aria-hidden="true" />
        Query Plan
      </Button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Kpi
          label="Latency"
          value={
            <span data-testid="latency-badge">
              {meta ? <><AnimatedNumber value={meta.latencyMs} /> ms</> : "-"}
            </span>
          }
        />
        <Kpi label="Lots" value={meta ? <AnimatedNumber value={meta.lotCount} /> : "-"} />
        <Kpi
          label="Stores"
          value={
            <span data-testid="store-count">
              {meta ? <AnimatedNumber value={meta.storeCount} /> : "-"}
            </span>
          }
          accent
        />
        <Kpi label="Units" value={meta ? <AnimatedNumber value={meta.totalUnits} /> : "-"} accent />
        <SlaCountdown />
      </div>
    </header>
  );
}
