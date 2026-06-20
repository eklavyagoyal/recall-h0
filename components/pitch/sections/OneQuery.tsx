"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import {
  EASE,
  Glow,
  GridBackdrop,
  Kicker,
  Reveal,
  Section,
} from "@/components/pitch/shared";
import { cn } from "@/lib/utils";

/* Each token is a coloring class applied to a slice of a SQL line. */
type Tone = "kw" | "fn" | "var" | "punc" | "str" | "plain" | "cRed" | "cBlue" | "cTeal";

type Token = { t: string; tone: Tone };

const TONE_CLASS: Record<Tone, string> = {
  kw: "text-[var(--p-teal)]",
  fn: "text-[var(--p-fg)]",
  var: "text-[var(--p-amber)]",
  punc: "text-[var(--p-faint)]",
  str: "text-[var(--p-fg)]",
  plain: "text-[var(--p-muted)]",
  cRed: "text-[var(--p-red)]",
  cBlue: "text-[#8aa0c2]",
  cTeal: "text-[var(--p-teal)]",
};

/* The hero query, rendered line-by-line as colorized tokens. The three
   index-comment lines carry an anchor id so the annotation chips can mark them. */
type Line = { tokens: Token[]; anchor?: 1 | 2 | 3; danger?: boolean };

const QUERY: Line[] = [
  { tokens: [{ t: "WITH RECURSIVE", tone: "kw" }, { t: " contaminated ", tone: "fn" }, { t: "AS", tone: "kw" }, { t: " (", tone: "punc" }], danger: true },
  {
    tokens: [
      { t: "  SELECT", tone: "kw" },
      { t: " lot_id ", tone: "plain" },
      { t: "FROM", tone: "kw" },
      { t: " lots ", tone: "plain" },
      { t: "WHERE", tone: "kw" },
      { t: " tlc = ", tone: "plain" },
      { t: "$1", tone: "var" },
    ],
    danger: true,
  },
  { tokens: [{ t: "  UNION ALL", tone: "kw" }], danger: true },
  {
    tokens: [
      { t: "  SELECT", tone: "kw" },
      { t: " ll.child_lot_id", tone: "plain" },
    ],
    danger: true,
  },
  {
    tokens: [
      { t: "  FROM", tone: "kw" },
      { t: " contaminated c", tone: "plain" },
    ],
    danger: true,
  },
  {
    tokens: [
      { t: "  JOIN", tone: "kw" },
      { t: " lot_links ll ", tone: "plain" },
      { t: "ON", tone: "kw" },
      { t: " ll.parent_lot_id = c.lot_id", tone: "plain" },
      { t: "      -- (1) walk the supply DAG", tone: "cRed" },
    ],
    anchor: 1,
    danger: true,
  },
  { tokens: [{ t: "),", tone: "punc" }] },
  { tokens: [{ t: "affected ", tone: "fn" }, { t: "AS", tone: "kw" }, { t: " (", tone: "punc" }] },
  {
    tokens: [
      { t: "  SELECT", tone: "kw" },
      { t: " s.store_id, s.name, ", tone: "plain" },
      { t: "SUM", tone: "fn" },
      { t: "(sh.units) ", tone: "plain" },
      { t: "AS", tone: "kw" },
      { t: " units", tone: "plain" },
    ],
  },
  {
    tokens: [
      { t: "  FROM", tone: "kw" },
      { t: " shipments sh", tone: "plain" },
    ],
  },
  {
    tokens: [
      { t: "  JOIN", tone: "kw" },
      { t: " contaminated c ", tone: "plain" },
      { t: "ON", tone: "kw" },
      { t: " c.lot_id = sh.lot_id", tone: "plain" },
    ],
  },
  {
    tokens: [
      { t: "  JOIN", tone: "kw" },
      { t: " stores s ", tone: "plain" },
      { t: "ON", tone: "kw" },
      { t: " s.store_id = sh.store_id", tone: "plain" },
      { t: "             -- (2) PostGIS GiST geography", tone: "cBlue" },
    ],
    anchor: 2,
  },
  { tokens: [{ t: "),", tone: "punc" }] },
  { tokens: [{ t: "similar ", tone: "fn" }, { t: "AS", tone: "kw" }, { t: " (", tone: "punc" }] },
  {
    tokens: [
      { t: "  SELECT", tone: "kw" },
      { t: " i.raw_text, ", tone: "plain" },
      { t: "1 - (i.embedding ", tone: "plain" },
      { t: "<=>", tone: "cTeal" },
      { t: " ", tone: "plain" },
      { t: "$2", tone: "var" },
      { t: ") ", tone: "plain" },
      { t: "AS", tone: "kw" },
      { t: " score", tone: "plain" },
    ],
  },
  {
    tokens: [
      { t: "  FROM", tone: "kw" },
      { t: " incidents i", tone: "plain" },
    ],
  },
  {
    tokens: [
      { t: "  ORDER BY", tone: "kw" },
      { t: " i.embedding ", tone: "plain" },
      { t: "<=>", tone: "cTeal" },
      { t: " ", tone: "plain" },
      { t: "$2", tone: "var" },
      { t: "                           -- (3) pgvector HNSW", tone: "cTeal" },
    ],
    anchor: 3,
  },
  {
    tokens: [
      { t: "  LIMIT", tone: "kw" },
      { t: " 5", tone: "var" },
    ],
  },
  { tokens: [{ t: ")", tone: "punc" }] },
  {
    tokens: [
      { t: "SELECT", tone: "kw" },
      { t: " * ", tone: "plain" },
      { t: "FROM", tone: "kw" },
      { t: " affected, similar;", tone: "plain" },
      { t: "   -- one statement, one round trip", tone: "plain" },
    ],
  },
];

type Annotation = { n: number; symbol: string; label: string; tone: "red" | "blue" | "teal" };

const ANNOTATIONS: Annotation[] = [
  { n: 1, symbol: "①", label: "recursive graph traversal", tone: "red" },
  { n: 2, symbol: "②", label: "geospatial join", tone: "blue" },
  { n: 3, symbol: "③", label: "vector similarity", tone: "teal" },
];

function annTone(tone: Annotation["tone"]): { dot: string; text: string; border: string } {
  if (tone === "red") {
    return { dot: "bg-[var(--p-red)]", text: "text-[var(--p-red)]", border: "border-[var(--p-red-soft)]" };
  }
  if (tone === "teal") {
    return { dot: "bg-[var(--p-teal)]", text: "text-[var(--p-teal)]", border: "border-[var(--p-teal-soft)]" };
  }
  return { dot: "bg-[#8aa0c2]", text: "text-[#8aa0c2]", border: "border-[var(--p-line-2)]" };
}

function CodeLine({ line }: { line: Line }) {
  return (
    <div className="whitespace-pre">
      {line.tokens.map((tok, i) => (
        <span key={i} className={TONE_CLASS[tok.tone]}>
          {tok.t}
        </span>
      ))}
    </div>
  );
}

export default function OneQuery() {
  const reduce = useReducedMotion();
  const blockRef = useRef<HTMLDivElement>(null);
  const inView = useInView(blockRef, { once: true, margin: "-15% 0px -15% 0px" });

  return (
    <Section id="query" className="relative overflow-hidden">
      <GridBackdrop className="opacity-[0.55]" />
      <Glow
        color="var(--p-teal-soft)"
        size={620}
        className="absolute -right-40 top-10 opacity-40"
      />
      <Glow
        color="var(--p-red-soft)"
        size={480}
        className="absolute -left-32 bottom-0 opacity-30"
      />

      <div className="relative z-10">
        <Reveal>
          <Kicker tone="teal">Step 2 &middot; the hero query</Kicker>
        </Reveal>

        <Reveal delay={0.06} className="mt-6 max-w-4xl">
          <h2 className="pitch-display text-4xl leading-[1.04] sm:text-5xl md:text-6xl">
            The entire investigation is{" "}
            <span className="pitch-ink-red">one SQL statement.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {/* Code block */}
          <Reveal delay={0.12} y={34}>
            <div ref={blockRef} className="pitch-card overflow-hidden p-0">
              {/* Header strip */}
              <div className="flex items-center justify-between border-b border-[var(--p-line)] bg-[var(--p-surface-2)] px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--p-red)]" aria-hidden />
                  <span className="h-2 w-2 rounded-full bg-[var(--p-amber)]" aria-hidden />
                  <span className="h-2 w-2 rounded-full bg-[var(--p-teal)]" aria-hidden />
                  <span className="pitch-mono ml-2 text-[0.7rem] text-[var(--p-muted)]">
                    trace.sql
                  </span>
                </div>
                <span className="pitch-mono text-[0.6rem] uppercase tracking-widest text-[var(--p-faint)]">
                  aurora postgresql
                </span>
              </div>

              {/* SQL body */}
              <motion.pre
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: inView || reduce ? 1 : 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="pitch-mono overflow-x-auto px-4 py-5 text-[0.72rem] leading-[1.7] sm:text-[0.8rem] sm:leading-[1.75]"
              >
                <code className="block">
                  {QUERY.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{
                        opacity: inView || reduce ? 1 : 0,
                        x: inView || reduce ? 0 : -8,
                      }}
                      transition={{
                        duration: 0.45,
                        delay: reduce ? 0 : 0.25 + i * 0.028,
                        ease: EASE,
                      }}
                    >
                      <CodeLine line={line} />
                    </motion.div>
                  ))}
                </code>
              </motion.pre>
            </div>

            <Reveal delay={0.2} className="mt-4">
              <p className="text-sm text-[var(--p-muted)]">
                Report in &rarr; outbreak out. One round trip, run{" "}
                <span className="pitch-mono text-[var(--p-teal)]">SERIALIZABLE</span>.
              </p>
            </Reveal>
          </Reveal>

          {/* Annotation chips — fade in sequentially */}
          <div className="flex flex-col gap-4 lg:pt-2">
            <span className="pitch-mono text-[0.6rem] uppercase tracking-widest text-[var(--p-faint)]">
              three engines, one pass
            </span>
            {ANNOTATIONS.map((a, i) => {
              const c = annTone(a.tone);
              return (
                <motion.div
                  key={a.n}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{
                    opacity: inView || reduce ? 1 : 0,
                    y: inView || reduce ? 0 : 14,
                  }}
                  transition={{
                    duration: 0.55,
                    delay: reduce ? 0 : 0.9 + i * 0.28,
                    ease: EASE,
                  }}
                  className={cn(
                    "pitch-card flex items-start gap-3 border px-4 py-3",
                    c.border,
                  )}
                >
                  <span
                    className={cn(
                      "pitch-mono mt-px text-base leading-none",
                      c.text,
                    )}
                    aria-hidden
                  >
                    {a.symbol}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span
                      className={cn(
                        "pitch-mono text-[0.6rem] uppercase tracking-widest",
                        c.text,
                      )}
                    >
                      index {a.n}
                    </span>
                    <span className="text-sm leading-snug text-[var(--p-fg)]">
                      {a.label}
                    </span>
                  </div>
                  <span
                    className={cn("ml-auto mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", c.dot)}
                    aria-hidden
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
}
