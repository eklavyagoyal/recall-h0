"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  Section,
  Kicker,
  Reveal,
  Stat,
  GridBackdrop,
  Glow,
  EASE,
} from "@/components/pitch/shared";

type ExternalLink = {
  readonly label: string;
  readonly href: string;
};

const LINKS: readonly ExternalLink[] = [
  { label: "recall-h0.vercel.app", href: "https://recall-h0.vercel.app" },
  { label: "GitHub", href: "https://github.com/eklavyagoyal/recall-h0" },
] as const;

type HeroStat = {
  readonly value: number;
  readonly label: string;
  readonly decimals?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly tone?: "fg" | "red" | "teal";
};

const STATS: readonly HeroStat[] = [
  { value: 1400, label: "Affected stores" },
  { value: 38, label: "US states" },
  { value: 300, label: "Query", prefix: "~", suffix: " ms" },
  { value: 0, label: "AWS keys", tone: "teal" },
] as const;

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end start"],
  });
  const headlineY = useTransform(scrollYProgress, [0, 1], [0, -64]);
  const backdropY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <div ref={scrollRef} className="relative">
      <Section full className="relative overflow-hidden">
        {/* Backdrops */}
        <motion.div
          aria-hidden
          style={reduceMotion ? undefined : { y: backdropY }}
          className="pointer-events-none absolute inset-0"
        >
          <GridBackdrop className="opacity-60" />
          <Glow
            color="var(--p-red)"
            size={620}
            className="absolute -left-40 -top-48"
            style={{ opacity: 0.14 }}
          />
          <Glow
            color="var(--p-teal)"
            size={640}
            className="absolute -bottom-56 -right-44"
            style={{ opacity: 0.14 }}
          />
        </motion.div>

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 z-20 px-6 pt-7 sm:px-10">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2.5">
              <motion.span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-[var(--p-red)]"
                style={{ boxShadow: "0 0 12px var(--p-red)" }}
                animate={
                  reduceMotion
                    ? undefined
                    : { opacity: [1, 0.35, 1], scale: [1, 0.82, 1] }
                }
                transition={{
                  duration: 2.4,
                  ease: EASE,
                  repeat: Infinity,
                }}
              />
              <span className="pitch-mono text-sm font-semibold tracking-[0.22em] text-[var(--p-fg)]">
                RECALL
              </span>
            </div>
            <nav className="flex items-center gap-5 sm:gap-7">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="pitch-mono group inline-flex items-center gap-1 text-[0.7rem] tracking-widest text-[var(--p-muted)] transition-colors hover:text-[var(--p-fg)]"
                >
                  {link.label}
                  <span
                    aria-hidden
                    className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  >
                    {"↗"}
                  </span>
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex w-full flex-col items-center text-center">
          <Reveal y={14}>
            <Kicker>H0 · Vercel + AWS Aurora · Monetizable B2B</Kicker>
          </Reveal>

          <motion.div
            style={reduceMotion ? undefined : { y: headlineY }}
            className="mt-8"
          >
            <Reveal delay={0.08} y={22}>
              <h1 className="pitch-display text-4xl leading-[0.98] tracking-tight text-[var(--p-fg)] sm:text-5xl md:text-7xl">
                A product recall, in
                <br />
                <span className="pitch-ink-red">one query.</span>
              </h1>
            </Reveal>
          </motion.div>

          <Reveal delay={0.2} y={18} className="mt-7">
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-[var(--p-muted)] sm:text-lg">
              Trace a contaminated food lot to every affected shelf — graph
              recursion, geospatial, and vector search fused into a single
              Amazon Aurora PostgreSQL statement.{" "}
              <span className="pitch-mono text-[var(--p-fg)]">
                ~300ms over 580,000 rows.
              </span>
            </p>
          </Reveal>

          <Reveal delay={0.32} y={16} className="mt-12 w-full">
            <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--p-line)] bg-[var(--p-line)] sm:grid-cols-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center justify-center bg-[var(--p-surface)] px-4 py-6"
                >
                  <Stat
                    value={stat.value}
                    label={stat.label}
                    decimals={stat.decimals}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    tone={stat.tone}
                  />
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Scroll hint */}
        <div className="absolute inset-x-0 bottom-8 z-10 flex flex-col items-center gap-2">
          <span className="pitch-mono text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
            Scroll
          </span>
          <motion.div
            aria-hidden
            className="text-[var(--p-muted)]"
            animate={reduceMotion ? undefined : { y: [0, 7, 0] }}
            transition={{
              duration: 1.8,
              ease: EASE,
              repeat: Infinity,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </motion.div>
        </div>
      </Section>
    </div>
  );
}
