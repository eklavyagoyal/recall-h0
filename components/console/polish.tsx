"use client";

import { useEffect, useRef, useState } from "react";

export function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || fromRef.current === value) {
      fromRef.current = value;
      const id = window.setTimeout(() => setDisplay(value), 0);
      return () => window.clearTimeout(id);
    }

    const from = fromRef.current;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return display;
}

export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const display = useCountUp(value);
  return (
    <span className={className} aria-live="polite">
      {display.toLocaleString("en-US")}
    </span>
  );
}

export function distinctStates(addresses: string[]): string[] {
  const states = new Set<string>();
  for (const address of addresses) {
    const match = address.match(/,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
    if (match?.[1]) states.add(match[1]);
  }
  return [...states].sort();
}

export function fmtDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
