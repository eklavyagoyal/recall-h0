"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import {
  CountUp,
  EASE,
  GridBackdrop,
  Glow,
  Kicker,
  Reveal,
  Section,
  Stagger,
  StaggerItem,
} from "@/components/pitch/shared";
import { cn } from "@/lib/utils";

type ProofStat = {
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  label: string;
  tone: "fg" | "teal";
};

const PROOF_STATS: readonly ProofStat[] = [
  { value: 300, decimals: 0, prefix: "~", suffix: " ms", label: "warm response", tone: "teal" },
  { value: 580000, decimals: 0, prefix: "", suffix: "", label: "rows traced", tone: "fg" },
  { value: 1400, decimals: 0, prefix: "", suffix: "", label: "stores mapped", tone: "fg" },
  { value: 0, decimals: 0, prefix: "", suffix: "", label: "AWS keys", tone: "teal" },
  { value: 24, decimals: 0, prefix: "", suffix: "", label: "tests passing", tone: "fg" },
] as const;

type Criterion = {
  axis: string;
  line: string;
};

const CRITERIA: readonly Criterion[] = [
  {
    axis: "Technological Implementation",
    line: "three index types + a keyless cloud in one query",
  },
  {
    axis: "Design",
    line: "makes an invisible distributed-systems property visible",
  },
  {
    axis: "Impact",
    line: "recalls go from days to sub-second; a real FSMA-204 buyer",
  },
  {
    axis: "Originality",
    line: "a product recall is one Postgres query",
  },
] as const;

/* A tiny ACU profile that rises 0 -> 2 -> 0, drawn as a smooth area + line. */
const ACU_POINTS: readonly { x: number; y: number }[] = [
  { x: 0, y: 56 },
  { x: 30, y: 52 },
  { x: 58, y: 38 },
  { x: 86, y: 16 },
  { x: 114, y: 6 },
  { x: 142, y: 18 },
  { x: 170, y: 40 },
  { x: 200, y: 56 },
] as const;

const ACU_LINE = ACU_POINTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
const ACU_AREA = `${ACU_LINE} L 200 64 L 0 64 Z`;

function AcuSparkline() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const reduce = useReducedMotion();
  const animateNow = inView && !reduce;

  return (
    <div className="pitch-card relative overflow-hidden p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="pitch-mono text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
          Aurora ACU
        </span>
        <span className="pitch-mono text-[0.65rem] uppercase tracking-widest text-[var(--p-teal)]">
          scale-to-zero
        </span>
      </div>
      <svg
        ref={ref}
        viewBox="0 0 200 64"
        preserveAspectRatio="none"
        className="h-16 w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="acuFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--p-teal)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--p-teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={ACU_AREA}
          fill="url(#acuFill)"
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={animateNow ? { opacity: 1 } : reduce ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
        />
        <motion.path
          d={ACU_LINE}
          fill="none"
          stroke="var(--p-teal)"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          animate={animateNow ? { pathLength: 1 } : reduce ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 1.4, ease: EASE }}
        />
      </svg>
      <div className="mt-3 pitch-mono text-[0.7rem] text-[var(--p-muted)]">
        Aurora ACU · scale-to-zero (&asymp; $0 idle)
      </div>
    </div>
  );
}

export default function Close() {
  return (
    <Section id="close" full className="relative overflow-hidden">
      <GridBackdrop className="opacity-50" />
      <Glow
        color="var(--p-teal)"
        size={680}
        className="left-1/2 top-[12%] -translate-x-1/2 opacity-30"
      />

      <div className="relative z-10">
        <Reveal>
          <Kicker tone="teal">proof · it&apos;s live</Kicker>
        </Reveal>

        <Reveal delay={0.06} className="mt-7">
          <h2 className="pitch-display text-4xl leading-[1.02] sm:text-5xl md:text-6xl">
            A recall, solved in one query.
          </h2>
          <p className="pitch-display mt-3 text-2xl text-[var(--p-teal)] sm:text-3xl md:text-4xl">
            And it&apos;s running right now.
          </p>
        </Reveal>

        {/* Proof stats */}
        <Stagger
          gap={0.07}
          className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-[var(--p-line)] pt-12 sm:grid-cols-3 lg:grid-cols-5"
        >
          {PROOF_STATS.map((s) => (
            <StaggerItem key={s.label}>
              <div
                className="text-4xl font-semibold tracking-tight sm:text-5xl"
                style={{ color: s.tone === "teal" ? "var(--p-teal)" : "var(--p-fg)" }}
              >
                <CountUp
                  value={s.value}
                  decimals={s.decimals}
                  prefix={s.prefix}
                  suffix={s.suffix}
                />
              </div>
              <div className="mt-2 text-sm text-[var(--p-muted)]">{s.label}</div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* ACU sparkline + judging criteria */}
        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <Reveal y={20}>
            <AcuSparkline />
          </Reveal>

          <Reveal y={20} delay={0.08}>
            <div className="grid h-full grid-cols-1 gap-px overflow-hidden rounded-[var(--radius,0.75rem)] border border-[var(--p-line)] bg-[var(--p-line)] sm:grid-cols-2">
              {CRITERIA.map((c) => (
                <div
                  key={c.axis}
                  className="flex flex-col justify-between gap-3 bg-[var(--p-surface)] p-5"
                >
                  <span className="pitch-mono text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
                    {c.axis}
                  </span>
                  <span className="text-sm leading-snug text-[var(--p-fg)]">{c.line}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* CTAs */}
        <Reveal y={18} delay={0.05} className="mt-16">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <a
              href="https://recall-h0.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group relative inline-flex items-center gap-2 overflow-hidden rounded-full",
                "border border-[var(--p-red)] px-7 py-3.5 text-base font-semibold",
                "text-[var(--p-fg)] transition-transform duration-300 hover:-translate-y-0.5",
              )}
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-[var(--p-red)] to-[var(--p-red-2)] opacity-15 transition-opacity duration-300 group-hover:opacity-30"
              />
              <span className="relative">See it live &rarr;</span>
            </a>

            <a
              href="https://github.com/eklavyagoyal/recall-h0"
              target="_blank"
              rel="noopener noreferrer"
              className="pitch-mono text-sm text-[var(--p-muted)] underline-offset-4 transition-colors duration-300 hover:text-[var(--p-fg)] hover:underline"
            >
              Source on GitHub &nearr;
            </a>
          </div>
        </Reveal>

        {/* Footer */}
        <Reveal y={14} delay={0.1} className="mt-20 border-t border-[var(--p-line)] pt-8">
          <p className="pitch-mono text-[0.7rem] uppercase tracking-widest text-[var(--p-faint)]">
            Built on Vercel + Amazon Aurora PostgreSQL · H0 Hackathon
          </p>
          <p className="mt-5 text-center text-base italic text-[var(--p-muted)] sm:text-lg">
            the database is the protagonist; the UI is its courtroom evidence.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
