"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Clock3, FileSearch, Loader2, Search } from "lucide-react";
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

function Kpi({
  label,
  value,
  tone = "fg",
  testId,
}: {
  label: string;
  value: ReactNode;
  tone?: "fg" | "red" | "teal";
  testId?: string;
}) {
  const color = tone === "red" ? "var(--p-red)" : tone === "teal" ? "var(--p-teal)" : "var(--p-fg)";
  return (
    <div className="flex h-12 min-w-[86px] flex-col justify-center rounded-lg border border-[var(--p-line)] bg-[var(--p-surface)] px-3">
      <span className="console-kicker">{label}</span>
      <span className="console-mono text-lg leading-tight" style={{ color }} data-testid={testId}>
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
    <div className="flex h-12 min-w-[120px] flex-col justify-center rounded-lg border border-[var(--p-amber)]/30 bg-[var(--p-amber)]/[0.06] px-3">
      <span className="console-kicker flex items-center gap-1 text-[var(--p-amber)]/90">
        <Clock3 className="size-3" aria-hidden="true" />
        FDA 24h SLA
      </span>
      <span
        className="console-mono text-lg leading-tight"
        style={{ color: urgent ? "var(--p-red)" : "var(--p-amber)" }}
      >
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
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--p-line)] bg-[var(--p-bg)] px-4 py-3">
      <div className="mr-1 flex min-w-[200px] items-center gap-2.5">
        <span
          className="size-2.5 rounded-full bg-[var(--p-red)]"
          style={{ boxShadow: "0 0 12px 3px color-mix(in oklab, var(--p-red) 55%, transparent)" }}
          aria-hidden="true"
        />
        <h1 className="text-sm font-semibold tracking-tight text-[var(--p-fg)]">
          Recall <span className="text-[var(--p-faint)]">·</span>{" "}
          <span className="text-[var(--p-muted)]">Outbreak Console</span>
        </h1>
      </div>

      <form onSubmit={onSubmit} className="flex min-w-[280px] flex-1 items-center gap-2 sm:flex-none">
        <label className="sr-only" htmlFor="trace-tlc">
          Traceability Lot Code
        </label>
        <div className="relative flex-1 sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--p-faint)]"
            aria-hidden="true"
          />
          <input
            id="trace-tlc"
            data-testid="tlc-input"
            value={tlc}
            onChange={(event) => onTlcChange(event.target.value)}
            placeholder="Traceability Lot Code"
            spellCheck={false}
            className="console-mono h-9 w-full min-w-0 rounded-lg border border-[var(--p-line-2)] bg-[var(--p-surface)] pl-9 pr-3 text-sm text-[var(--p-fg)] outline-none transition-colors placeholder:text-[var(--p-faint)] focus:border-[var(--p-red)] focus:ring-2 focus:ring-[var(--p-red-soft)]"
          />
        </div>
        <button
          type="submit"
          data-testid="trace-button"
          disabled={loading}
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--p-red)] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[var(--p-red-2)] disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
          {loading ? "Tracing…" : "Trace"}
        </button>
      </form>

      <button
        type="button"
        onClick={onToggleInspector}
        aria-pressed={inspectorOpen}
        data-testid="inspector-toggle"
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors"
        style={{
          borderColor: inspectorOpen ? "var(--p-teal)" : "var(--p-line-2)",
          color: inspectorOpen ? "var(--p-teal)" : "var(--p-fg)",
          background: inspectorOpen ? "var(--p-teal-soft)" : "var(--p-surface)",
        }}
      >
        <FileSearch className="size-4" aria-hidden="true" />
        Query Plan
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Kpi
          label="Latency"
          tone="teal"
          testId="latency-badge"
          value={meta ? <><AnimatedNumber value={meta.latencyMs} /> ms</> : "—"}
        />
        <Kpi label="Lots" value={meta ? <AnimatedNumber value={meta.lotCount} /> : "—"} />
        <Kpi
          label="Stores"
          tone="red"
          testId="store-count"
          value={meta ? <AnimatedNumber value={meta.storeCount} /> : "—"}
        />
        <Kpi
          label="Units"
          tone="red"
          value={meta ? <AnimatedNumber value={meta.totalUnits} /> : "—"}
        />
        <SlaCountdown />
      </div>
    </header>
  );
}
