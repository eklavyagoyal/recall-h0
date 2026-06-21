"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, GitBranch, ArrowDownRight } from "lucide-react";
import type { ConsoleSelection, LineageResult, LineageStep } from "@/lib/types";
import { AnimatedNumber, fmtDate } from "./polish";

type LineageDrawerProps = {
  selection: ConsoleSelection | null;
  onClose: () => void;
  onTraceLot?: (tlc: string) => void;
};

export function LineageDrawer({ selection, onClose, onTraceLot }: LineageDrawerProps) {
  const [trail, setTrail] = useState<LineageStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!selection) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [selection]);

  useEffect(() => {
    if (selection) return;
    const id = window.setTimeout(() => returnFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [selection]);

  useEffect(() => {
    if (!selection) return;
    const controller = new AbortController();
    const resetId = window.setTimeout(() => {
      setTrail(null);
      setError(null);
      setLoading(true);
    }, 0);

    const query =
      selection.kind === "store" ? `storeId=${selection.id}` : `lotId=${selection.id}`;

    fetch(`/api/lineage?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Lineage failed (${response.status})`);
        return (await response.json()) as LineageResult;
      })
      .then((data) => setTrail(data.trail))
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Lineage failed");
      })
      .finally(() => setLoading(false));

    return () => {
      window.clearTimeout(resetId);
      controller.abort();
    };
  }, [selection]);

  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection, onClose]);

  const subtitle =
    selection?.kind === "store"
      ? `${selection.label ?? `Store #${selection.id}`} · store shipment trail`
      : `${selection?.label ?? `Lot #${selection?.id ?? ""}`} · lot shipment trail`;

  return (
    <AnimatePresence>
      {selection && (
        <div className="console-root fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            aria-label="Lot lineage"
            role="dialog"
            aria-modal="true"
            className="console-grid-bg absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[var(--p-line-2)] bg-[var(--p-bg)] text-[var(--p-fg)] shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.8)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-[var(--p-line)] bg-[var(--p-bg-2)] px-3.5">
              <span className="console-kicker flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--p-teal)", boxShadow: "0 0 8px 0 var(--p-teal)" }}
                  aria-hidden="true"
                />
                Lot lineage
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-[var(--p-line)] bg-[var(--p-surface)] text-[var(--p-muted)] transition-colors duration-150 hover:border-[var(--p-line-2)] hover:text-[var(--p-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-teal)]/60"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Close lineage drawer</span>
              </button>
            </header>

            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--p-line)] px-3.5 py-2.5">
              <GitBranch className="size-3.5 shrink-0 text-[var(--p-teal)]" aria-hidden="true" />
              <span className="console-mono truncate text-[11px] text-[var(--p-muted)]">{subtitle}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
              {loading && <TrailSkeleton />}

              {!loading && error && (
                <div
                  role="alert"
                  className="rounded-md border border-[var(--p-red)]/40 bg-[var(--p-red-soft)] px-3 py-2.5 text-sm text-[var(--p-red)]"
                >
                  {error}
                </div>
              )}

              {!loading && !error && trail && trail.length === 0 && (
                <p className="py-10 text-center text-sm text-[var(--p-muted)]">
                  No lineage on record for this node.
                </p>
              )}

              {!loading && !error && trail && trail.length > 0 && (
                <ol className="relative space-y-0" aria-label="Lineage trail">
                  {trail.map((step, index) => {
                    const isLast = index === trail.length - 1;
                    return (
                      <motion.li
                        key={`${step.shipment}-${step.lot}-${index}`}
                        className="relative pb-6 pl-7 last:pb-0"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.26,
                          delay: Math.min(index * 0.05, 0.4),
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        {!isLast && (
                          <span
                            aria-hidden="true"
                            className="absolute left-[6px] top-4 h-full w-px bg-[var(--p-line-2)]"
                          />
                        )}
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1.5 size-3.5 rounded-full border-2 border-[var(--p-red)] bg-[var(--p-bg)]"
                          style={{ boxShadow: "0 0 8px 0 color-mix(in oklab, var(--p-red) 70%, transparent)" }}
                        />
                        <div className="flex items-start justify-between gap-3">
                          <span className="console-mono text-sm font-medium text-[var(--p-fg)]">{step.lot}</span>
                          <span className="console-mono shrink-0 rounded-full border border-[var(--p-line-2)] bg-[var(--p-surface)] px-2 py-0.5 text-[11px] text-[var(--p-teal)]">
                            <AnimatedNumber value={step.units} /> units
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--p-muted)]">
                          <span className="text-[var(--p-fg)]">{step.facility}</span> · {step.supplier}
                        </p>
                        <p className="console-mono mt-1 text-xs text-[var(--p-faint)]">
                          shipment #{step.shipment} · shipped {fmtDate(step.shippedAt)}
                        </p>
                        {onTraceLot && index > 0 && (
                          <button
                            type="button"
                            onClick={() => onTraceLot(step.lot)}
                            className="console-mono mt-2 flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--p-line)] bg-[var(--p-surface)] px-2.5 py-1 text-[11px] text-[var(--p-muted)] transition-colors duration-150 hover:border-[var(--p-red)]/50 hover:text-[var(--p-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-red)]/60"
                          >
                            <ArrowDownRight className="size-3" aria-hidden="true" />
                            Trace from this lot
                          </button>
                        )}
                      </motion.li>
                    );
                  })}
                </ol>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function TrailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2 pl-7">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--p-surface-2)]" />
          <div className="h-3 w-52 animate-pulse rounded bg-[var(--p-surface)]" />
          <div className="h-3 w-40 animate-pulse rounded bg-[var(--p-surface)]" />
        </div>
      ))}
    </div>
  );
}
