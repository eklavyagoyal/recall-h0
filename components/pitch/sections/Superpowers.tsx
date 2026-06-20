"use client";

import { motion, useReducedMotion } from "motion/react";
import { type ReactNode } from "react";
import { EASE, Kicker, Reveal, Section, Stagger, StaggerItem } from "@/components/pitch/shared";
import { cn } from "@/lib/utils";

type ChipTone = "red" | "neutral" | "teal";

const CHIP_COLOR: Record<ChipTone, { fg: string; border: string; bg: string }> = {
  red: { fg: "var(--p-red)", border: "var(--p-red)", bg: "var(--p-red-soft)" },
  teal: { fg: "var(--p-teal)", border: "var(--p-teal)", bg: "var(--p-teal-soft)" },
  neutral: { fg: "var(--p-muted)", border: "var(--p-line-2)", bg: "var(--p-surface-2)" },
};

function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const c = CHIP_COLOR[tone];
  return (
    <span
      className="pitch-mono inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.7rem] tracking-wide"
      style={{ color: c.fg, borderColor: c.border, backgroundColor: c.bg }}
    >
      {children}
    </span>
  );
}

/* ---- Glyph 1: recursive graph traversal — connected nodes lighting up hop by hop ---- */
function GraphGlyph() {
  const reduce = useReducedMotion();
  const nodes = [
    { cx: 14, cy: 40, r: 5 },
    { cx: 44, cy: 18, r: 4.5 },
    { cx: 46, cy: 60, r: 4.5 },
    { cx: 78, cy: 30, r: 4 },
    { cx: 80, cy: 64, r: 4 },
  ] as const;
  const edges = [
    { x1: 14, y1: 40, x2: 44, y2: 18 },
    { x1: 14, y1: 40, x2: 46, y2: 60 },
    { x1: 44, y1: 18, x2: 78, y2: 30 },
    { x1: 46, y1: 60, x2: 80, y2: 64 },
  ] as const;
  return (
    <svg viewBox="0 0 96 80" className="h-16 w-24" fill="none" aria-hidden>
      {edges.map((e, i) => (
        <motion.line
          key={`e${i}`}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke="var(--p-red)"
          strokeWidth={1.1}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0, opacity: 0.2 }}
          whileInView={{ pathLength: 1, opacity: 0.8 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 * i, ease: EASE }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.circle
          key={`n${i}`}
          cx={n.cx}
          cy={n.cy}
          r={n.r}
          fill="var(--p-bg)"
          stroke="var(--p-red)"
          strokeWidth={1.4}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.18 * i, ease: EASE }}
          style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
        />
      ))}
    </svg>
  );
}

/* ---- Glyph 2: geospatial — map pin over concentric rings rippling out ---- */
function GeoGlyph() {
  const reduce = useReducedMotion();
  const rings = [10, 18, 26] as const;
  return (
    <svg viewBox="0 0 96 80" className="h-16 w-24" fill="none" aria-hidden>
      {rings.map((r, i) => (
        <motion.circle
          key={`r${i}`}
          cx={48}
          cy={52}
          r={r}
          stroke="var(--p-muted)"
          strokeWidth={1}
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 0.5 - i * 0.12, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.12 * i, ease: EASE }}
          style={{ transformOrigin: "48px 52px" }}
        />
      ))}
      <motion.path
        d="M48 14c-7 0-12 5-12 12 0 9 12 22 12 22s12-13 12-22c0-7-5-12-12-12z"
        fill="var(--p-surface-2)"
        stroke="var(--p-fg)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        initial={reduce ? false : { y: -8, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: EASE }}
      />
      <circle cx={48} cy={26} r={3.4} fill="var(--p-teal)" />
    </svg>
  );
}

/* ---- Glyph 3: vector similarity — scattered dots with a highlighted nearest cluster ---- */
function VectorGlyph() {
  const reduce = useReducedMotion();
  const far = [
    { cx: 16, cy: 18 },
    { cx: 80, cy: 22 },
    { cx: 22, cy: 64 },
    { cx: 84, cy: 58 },
  ] as const;
  const near = [
    { cx: 48, cy: 40 },
    { cx: 58, cy: 34 },
    { cx: 56, cy: 50 },
    { cx: 42, cy: 50 },
  ] as const;
  const query = { cx: 50, cy: 42 } as const;
  return (
    <svg viewBox="0 0 96 80" className="h-16 w-24" fill="none" aria-hidden>
      <motion.circle
        cx={query.cx}
        cy={query.cy}
        r={20}
        stroke="var(--p-teal)"
        strokeWidth={1}
        strokeDasharray="2 4"
        initial={reduce ? false : { opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 0.55, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE }}
        style={{ transformOrigin: `${query.cx}px ${query.cy}px` }}
      />
      {near.map((n, i) => (
        <motion.line
          key={`l${i}`}
          x1={query.cx}
          y1={query.cy}
          x2={n.cx}
          y2={n.cy}
          stroke="var(--p-teal)"
          strokeWidth={0.9}
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.6 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 * i + 0.2, ease: EASE }}
        />
      ))}
      {far.map((n, i) => (
        <circle key={`f${i}`} cx={n.cx} cy={n.cy} r={2.4} fill="var(--p-faint)" />
      ))}
      {near.map((n, i) => (
        <motion.circle
          key={`nr${i}`}
          cx={n.cx}
          cy={n.cy}
          r={2.8}
          fill="var(--p-teal)"
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.1 * i + 0.25, ease: EASE }}
          style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
        />
      ))}
      <circle cx={query.cx} cy={query.cy} r={3.6} fill="var(--p-bg)" stroke="var(--p-teal)" strokeWidth={1.6} />
    </svg>
  );
}

type Card = {
  title: string;
  line: string;
  chip: string;
  tone: ChipTone;
  glyph: ReactNode;
};

const CARDS: ReadonlyArray<Card> = [
  {
    title: "Recursive graph traversal",
    line: "A WITH RECURSIVE CTE walks the foreign-key supply DAG, hop by hop.",
    chip: "EXPLAIN ▸ Recursive Union",
    tone: "red",
    glyph: <GraphGlyph />,
  },
  {
    title: "Geospatial — PostGIS",
    line: "Finds and orders every affected store by location for the map.",
    chip: "EXPLAIN ▸ GiST Spatial Path",
    tone: "neutral",
    glyph: <GeoGlyph />,
  },
  {
    title: "Vector similarity — pgvector",
    line: "Surfaces the most semantically similar past incidents.",
    chip: "EXPLAIN ▸ HNSW Index Scan",
    tone: "teal",
    glyph: <VectorGlyph />,
  },
];

export default function Superpowers() {
  return (
    <Section id="superpowers">
      <Reveal>
        <Kicker>three index paths · one query</Kicker>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="pitch-display mt-5 text-4xl sm:text-5xl md:text-6xl">
          One statement, <span className="pitch-ink-red">three engines.</span>
        </h2>
      </Reveal>

      <Stagger gap={0.12} className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        {CARDS.map((card) => (
          <StaggerItem key={card.title} className="group h-full">
            <div className="pitch-card flex h-full flex-col p-6">
              <div className="flex h-16 items-center">{card.glyph}</div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-[var(--p-fg)]">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--p-muted)]">{card.line}</p>
              <div className="mt-6 pt-5 pitch-hairline border-t border-[var(--p-line)]">
                <Chip tone={card.tone}>{card.chip}</Chip>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal delay={0.1}>
        <p
          className={cn(
            "pitch-mono mx-auto mt-12 max-w-2xl text-center text-[0.8rem] leading-relaxed text-[var(--p-faint)]",
          )}
        >
          DynamoDB can&apos;t join. DSQL has no PostGIS or pgvector. Only Aurora PostgreSQL fuses all
          three.
        </p>
      </Reveal>
    </Section>
  );
}
