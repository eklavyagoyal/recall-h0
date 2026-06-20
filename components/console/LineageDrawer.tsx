"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConsoleSelection, LineageResult, LineageStep } from "@/lib/types";
import { fmtDate } from "./polish";

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

  if (!selection) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/45" aria-hidden={false}>
      <aside
        aria-label="Lot lineage"
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-neutral-800 bg-neutral-950 text-neutral-100 shadow-2xl shadow-black/60"
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Lot lineage</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {selection.kind === "store"
                ? `${selection.label ?? `Store #${selection.id}`} / store shipment trail`
                : `${selection.label ?? `Lot #${selection.id}`} / lot shipment trail`}
            </p>
          </div>
          <Button ref={closeRef} type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X aria-hidden="true" />
            <span className="sr-only">Close lineage drawer</span>
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && <TrailSkeleton />}

          {!loading && error && (
            <div role="alert" className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && trail && trail.length === 0 && (
            <p className="py-10 text-center text-sm text-neutral-500">
              No lineage on record for this node.
            </p>
          )}

          {!loading && !error && trail && trail.length > 0 && (
            <ol className="relative space-y-0" aria-label="Lineage trail">
              {trail.map((step, index) => (
                <li key={`${step.shipment}-${step.lot}-${index}`} className="relative pb-6 pl-7">
                  {index < trail.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[7px] top-4 h-full w-px bg-neutral-800" />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1.5 size-3.5 rounded-full border-2 border-red-500 bg-neutral-950"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-sm font-medium text-neutral-100">{step.lot}</span>
                    <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
                      {step.units.toLocaleString("en-US")} units
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">
                    {step.facility} / {step.supplier}
                  </p>
                  <p className="mt-1 font-mono text-xs text-neutral-600">
                    shipment #{step.shipment} / shipped {fmtDate(step.shippedAt)}
                  </p>
                  {onTraceLot && index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => onTraceLot(step.lot)}
                    >
                      Trace from this lot
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

function TrailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2 pl-7">
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-800" />
          <div className="h-3 w-52 animate-pulse rounded bg-neutral-900" />
          <div className="h-3 w-40 animate-pulse rounded bg-neutral-900" />
        </div>
      ))}
    </div>
  );
}
