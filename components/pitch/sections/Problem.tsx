"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import {
  Section,
  Kicker,
  Reveal,
  CountUp,
  GridBackdrop,
  Glow,
} from "@/components/pitch/shared";
import { cn } from "@/lib/utils";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatClock(totalSeconds: number): string {
  const safe = totalSeconds < 0 ? 0 : totalSeconds;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

const START_SECONDS = 24 * 3600;

function TickingClock() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const reduced = useReducedMotion();
  const [seconds, setSeconds] = useState<number>(START_SECONDS);

  useEffect(() => {
    if (!inView || reduced) {
      return;
    }
    const id = window.setInterval(() => {
      setSeconds((prev: number) => (prev <= 0 ? START_SECONDS : prev - 137));
    }, 90);
    return () => window.clearInterval(id);
  }, [inView, reduced]);

  return (
    <div ref={ref} className="flex items-baseline gap-3">
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 translate-y-[-0.15em] rounded-full bg-[var(--p-red)]"
        style={{
          boxShadow: "0 0 12px 2px var(--p-red-soft)",
        }}
      />
      <span className="pitch-mono text-3xl tabular-nums tracking-tight text-[var(--p-red)] sm:text-4xl">
        {formatClock(seconds)}
      </span>
    </div>
  );
}

type PanelTone = "danger" | "proof";

function ContrastPanel({
  tone,
  label,
  caption,
  delay,
  children,
}: {
  tone: PanelTone;
  label: string;
  caption: string;
  delay: number;
  children: React.ReactNode;
}) {
  const isDanger = tone === "danger";
  const accent = isDanger ? "var(--p-red)" : "var(--p-teal)";
  const accentSoft = isDanger ? "var(--p-red-soft)" : "var(--p-teal-soft)";

  return (
    <Reveal delay={delay} y={28} className="h-full">
      <div
        className={cn(
          "pitch-card relative flex h-full flex-col justify-between overflow-hidden p-8 sm:p-10",
        )}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            opacity: 0.5,
          }}
        />
        <Glow
          color={accentSoft}
          size={260}
          className="-right-16 -top-16"
        />
        <div className="relative z-10 flex items-center justify-between">
          <span className="pitch-mono text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
            {label}
          </span>
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: accent, boxShadow: `0 0 10px 1px ${accentSoft}` }}
          />
        </div>
        <div className="relative z-10 py-10">{children}</div>
        <p className="relative z-10 pitch-mono text-[0.7rem] uppercase tracking-widest text-[var(--p-muted)]">
          {caption}
        </p>
      </div>
    </Reveal>
  );
}

export default function Problem() {
  return (
    <Section id="problem" className="relative overflow-hidden">
      <GridBackdrop className="opacity-[0.4]" />
      <Glow
        color="var(--p-red-soft)"
        size={520}
        className="-left-32 top-0 -z-0"
      />

      <div className="relative z-10">
        <Reveal>
          <Kicker tone="red">The 24-hour clock</Kicker>
        </Reveal>

        <Reveal delay={0.05} className="mt-6">
          <h2 className="pitch-display max-w-4xl text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
            When a lot goes bad, every hour is a shelf still selling it.
          </h2>
        </Reveal>

        <Reveal delay={0.12} className="mt-7">
          <p className="max-w-2xl text-base leading-relaxed text-[var(--p-muted)] sm:text-lg">
            Today, answering &quot;which stores have product from this batch?&quot;
            takes hours to days of spreadsheets, supplier emails and warehouse
            lookups — while contaminated product stays on shelves. The
            FDA&apos;s FSMA-204 rule will require traceability records within 24
            hours.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
          <ContrastPanel
            tone="danger"
            label="Today"
            caption="Manual trace · spreadsheets & emails"
            delay={0.1}
          >
            <div className="flex flex-col gap-5">
              <div className="flex items-baseline gap-3">
                <span className="pitch-display text-5xl text-[var(--p-fg)] sm:text-6xl">
                  hours
                </span>
                <span className="pitch-mono text-2xl text-[var(--p-faint)]">
                  →
                </span>
                <span className="pitch-display text-5xl text-[var(--p-red)] sm:text-6xl">
                  days
                </span>
              </div>
              <TickingClock />
            </div>
          </ContrastPanel>

          <ContrastPanel
            tone="proof"
            label="Recall"
            caption="One Aurora PostgreSQL query"
            delay={0.22}
          >
            <div className="flex flex-col gap-5">
              <CountUp
                value={300}
                prefix="~"
                suffix=" ms"
                className="pitch-display text-5xl text-[var(--p-teal)] sm:text-6xl"
              />
              <div className="flex items-baseline gap-3">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 translate-y-[-0.15em] rounded-full bg-[var(--p-teal)]"
                  style={{ boxShadow: "0 0 12px 2px var(--p-teal-soft)" }}
                />
                <span className="pitch-mono text-sm uppercase tracking-widest text-[var(--p-teal)]">
                  every affected store, instantly
                </span>
              </div>
            </div>
          </ContrastPanel>
        </div>

        <Reveal delay={0.34} className="mt-12">
          <div className="flex items-center gap-5">
            <span
              aria-hidden="true"
              className="hidden h-px flex-1 bg-[var(--p-line)] sm:block"
            />
            <p className="pitch-display text-center text-2xl text-[var(--p-fg)] sm:text-3xl md:text-4xl">
              roughly{" "}
              <span className="pitch-ink-red">100,000&times; faster.</span>
            </p>
            <span
              aria-hidden="true"
              className="hidden h-px flex-1 bg-[var(--p-line)] sm:block"
            />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
