"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CountUp, EASE, Glow, GridBackdrop, Kicker, Section } from "@/components/pitch/shared";

const DEMO_TLC = "PRD-OUTBREAK-0001";

/* Verified baked result from the live run — renders instantly so the section is never empty. */
const BAKED = {
  latencyMs: 251,
  storeCount: 1400,
  states: 38,
  totalUnits: 674285,
  lotCount: 81,
  edgeCount: 80,
  incidents: [
    { text: "FDA alert: outbreak of gastrointestinal illness linked to Romaine Lettuce. Symptoms consistent with Listeria monocytogenes.", score: 0.651 },
    { text: "FDA alert: outbreak linked to Romaine Lettuce. Pathogen panel positive for Listeria monocytogenes.", score: 0.636 },
    { text: "Cluster of illness reports after Romaine Lettuce consumption. Listeria suspected pending culture.", score: 0.632 },
    { text: "High fever, chills, and vomiting after consuming Romaine Lettuce. Listeria monocytogenes positive.", score: 0.628 },
    { text: "Regional complaint spike for Romaine Lettuce. Symptoms consistent with Listeria.", score: 0.621 },
  ],
};

type TraceState = typeof BAKED & { live: boolean };

/* ---- stylized supply graph: root -> processors -> stores, ignites left to right ---- */
type Pt = { x: number; y: number };
const ROOT = { x: 7, y: 31, r: 4.4 };
const m0: Pt = { x: 33, y: 12 }, m1: Pt = { x: 33, y: 24 }, m2: Pt = { x: 33, y: 38 }, m3: Pt = { x: 33, y: 50 };
const l0: Pt = { x: 64, y: 7 }, l1: Pt = { x: 64, y: 17 }, l2: Pt = { x: 64, y: 27 };
const l3: Pt = { x: 64, y: 36 }, l4: Pt = { x: 64, y: 45 }, l5: Pt = { x: 64, y: 55 };
const l6: Pt = { x: 88, y: 13 }, l7: Pt = { x: 88, y: 24 }, l8: Pt = { x: 88, y: 35 }, l9: Pt = { x: 88, y: 47 };
const MIDS: Pt[] = [m0, m1, m2, m3];
const LEAVES: Pt[] = [l0, l1, l2, l3, l4, l5, l6, l7, l8, l9];
const EDGES: Array<[Pt, Pt, number]> = [
  [ROOT, m0, 0], [ROOT, m1, 0.05], [ROOT, m2, 0.1], [ROOT, m3, 0.15],
  [m0, l0, 0.3], [m0, l1, 0.35], [m1, l2, 0.4], [m1, l3, 0.45],
  [m2, l4, 0.5], [m2, l5, 0.55], [m3, l3, 0.5], [m3, l5, 0.55],
  [l1, l6, 0.7], [l2, l7, 0.72], [l3, l8, 0.74], [l5, l9, 0.76],
];

function SupplyGraph({ run }: { run: boolean }) {
  const reduce = useReducedMotion();
  const shown = run || reduce;
  return (
    <svg viewBox="0 0 100 62" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="rg-node" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8a6a" />
          <stop offset="100%" stopColor="var(--p-red)" />
        </radialGradient>
      </defs>
      {EDGES.map(([a, b, delay], i) => (
        <motion.line
          key={`e${i}`}
          x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke="var(--p-red)" strokeWidth={0.45} strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.15 }}
          animate={shown ? { pathLength: 1, opacity: 0.55 } : {}}
          transition={{ duration: 0.5, delay: 0.2 + delay, ease: EASE }}
        />
      ))}
      {[...LEAVES, ...MIDS].map((n, i) => {
        const isMid = i >= LEAVES.length;
        const delay = 0.2 + (isMid ? 0.05 * (i - LEAVES.length) : 0.55 + 0.03 * i);
        return (
          <motion.circle
            key={`n${i}`}
            cx={n.x} cy={n.y} r={isMid ? 2.2 : 1.5}
            fill={isMid ? "url(#rg-node)" : "var(--p-red)"}
            initial={{ scale: 0, opacity: 0 }}
            animate={shown ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.4, delay, ease: EASE }}
            style={{ transformOrigin: `${n.x}px ${n.y}px`, filter: "drop-shadow(0 0 3px var(--p-red))" }}
          />
        );
      })}
      <motion.circle
        cx={ROOT.x} cy={ROOT.y} r={ROOT.r}
        fill="url(#rg-node)"
        initial={{ scale: 0 }}
        animate={shown ? { scale: [0, 1.25, 1] } : {}}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ transformOrigin: `${ROOT.x}px ${ROOT.y}px`, filter: "drop-shadow(0 0 6px var(--p-red))" }}
      />
    </svg>
  );
}

export default function LiveDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const [phase, setPhase] = useState<"idle" | "tracing" | "done">("idle");
  const [data, setData] = useState<TraceState>({ ...BAKED, live: false });
  const labelId = useId();

  const runLive = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tlc: DEMO_TLC }),
        signal: controller.signal,
      });
      if (!res.ok) return;
      const json = await res.json();
      setData((prev) => ({
        ...prev,
        latencyMs: json?.meta?.latencyMs ?? prev.latencyMs,
        storeCount: json?.meta?.storeCount ?? prev.storeCount,
        totalUnits: json?.meta?.totalUnits ?? prev.totalUnits,
        lotCount: json?.meta?.lotCount ?? prev.lotCount,
        edgeCount: json?.meta?.edgeCount ?? prev.edgeCount,
        incidents:
          Array.isArray(json?.incidents) && json.incidents.length
            ? json.incidents.map((i: { text: string; score: number }) => ({ text: i.text, score: i.score }))
            : prev.incidents,
        live: true,
      }));
    } catch {
      /* keep baked data — never show a broken demo */
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    if (!inView || phase !== "idle") return;
    setPhase("tracing");
    void runLive();
    const t = setTimeout(() => setPhase("done"), 1700);
    return () => clearTimeout(t);
  }, [inView, phase, runLive]);

  const rerun = useCallback(() => {
    setPhase("tracing");
    void runLive();
    setTimeout(() => setPhase("done"), 1500);
  }, [runLive]);

  return (
    <Section id="live" className="relative">
      <GridBackdrop />
      <Glow color="var(--p-red)" size={620} className="left-1/2 top-0 -translate-x-1/2" style={{ opacity: 0.16 }} />
      <div ref={ref} className="relative">
        <div className="mb-8 flex flex-col items-start gap-3">
          <Kicker>Live · not a mockup</Kicker>
          <h2 className="pitch-display max-w-3xl text-4xl sm:text-5xl md:text-6xl">
            Watch a recall resolve in <span className="pitch-ink-red">one query.</span>
          </h2>
          <p className="max-w-xl text-base text-[var(--p-muted)]">
            This panel calls the deployed app against real Amazon Aurora PostgreSQL. Paste a lot code,
            and the whole outbreak comes back — graph, stores, and similar incidents — in milliseconds.
          </p>
        </div>

        {/* Console panel */}
        <div className="pitch-card overflow-hidden">
          {/* chrome */}
          <div className="flex items-center justify-between border-b border-[var(--p-line)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="pitch-mono ml-3 text-xs text-[var(--p-faint)]">recall // outbreak-console</span>
            </div>
            <div className="pitch-mono flex items-center gap-2 text-[0.7rem]">
              <motion.span
                className="h-2 w-2 rounded-full"
                style={{ background: data.live ? "var(--p-teal)" : "var(--p-amber)" }}
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <span style={{ color: data.live ? "var(--p-teal)" : "var(--p-muted)" }}>
                {data.live ? "live · Aurora us-east-1" : "demo data"}
              </span>
            </div>
          </div>

          {/* query line */}
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="pitch-mono flex items-center gap-2 text-sm">
              <span className="text-[var(--p-faint)]">TLC ▸</span>
              <span className="text-[var(--p-fg)]">{DEMO_TLC}</span>
              <motion.span
                aria-hidden
                className="inline-block h-4 w-[2px] bg-[var(--p-red)]"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="ml-2 rounded bg-[var(--p-red-soft)] px-2 py-0.5 text-xs text-[var(--p-red)]">
                Romaine Lettuce
              </span>
            </div>
            <button
              type="button"
              onClick={rerun}
              className="pitch-mono w-fit rounded-md border border-[var(--p-line-2)] bg-[var(--p-surface-2)] px-3 py-1.5 text-xs text-[var(--p-fg)] transition hover:border-[var(--p-red)] hover:text-[var(--p-red)]"
            >
              {phase === "tracing" ? "tracing…" : "▷ run trace again"}
            </button>
          </div>

          {/* body: graph + results */}
          <div className="grid gap-0 border-t border-[var(--p-line)] md:grid-cols-[1.15fr_1fr]">
            {/* graph */}
            <div className="relative h-[260px] border-b border-[var(--p-line)] p-4 md:border-b-0 md:border-r">
              <span className="pitch-mono absolute left-4 top-3 text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
                contaminated supply graph
              </span>
              <SupplyGraph run={phase !== "idle"} />
              <AnimatePresence>
                {phase === "done" && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="pitch-mono absolute bottom-3 right-4 text-[0.65rem] text-[var(--p-red)]"
                  >
                    {data.lotCount} lots · {data.edgeCount} edges
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* results */}
            <div className="flex flex-col">
              <div className="grid grid-cols-3 divide-x divide-[var(--p-line)] border-b border-[var(--p-line)]">
                <Metric label="affected stores" value={data.storeCount} tone="red" />
                <Metric label="US states" value={data.states} />
                <Metric label="query" value={data.latencyMs} suffix="ms" tone="teal" />
              </div>
              <div className="px-4 py-3">
                <div className="pitch-mono mb-2 flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
                  <span id={labelId}>similar incidents · pgvector HNSW</span>
                  <span>{data.totalUnits.toLocaleString("en-US")} units</span>
                </div>
                <ul className="flex flex-col gap-1.5" aria-labelledby={labelId}>
                  {data.incidents.slice(0, 4).map((inc, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: 12 }}
                      animate={phase === "done" ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.1 * i, duration: 0.5, ease: EASE }}
                      className="flex items-center gap-3"
                    >
                      <span className="pitch-mono w-10 shrink-0 text-xs text-[var(--p-teal)]">
                        {inc.score.toFixed(3)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs text-[var(--p-muted)]">{inc.text}</div>
                        <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--p-line)]">
                          <motion.div
                            className="h-full rounded-full bg-[var(--p-teal)]"
                            initial={{ width: 0 }}
                            animate={phase === "done" ? { width: `${Math.min(100, inc.score * 120)}%` } : {}}
                            transition={{ delay: 0.15 * i, duration: 0.7, ease: EASE }}
                          />
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <p className="pitch-mono mt-4 text-center text-xs text-[var(--p-faint)]">
          one SERIALIZABLE statement · recursive CTE + PostGIS GiST + pgvector HNSW · Aurora Serverless v2
        </p>
      </div>
    </Section>
  );
}

function Metric({
  label,
  value,
  suffix = "",
  tone = "fg",
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: "fg" | "red" | "teal";
}) {
  const color = tone === "red" ? "var(--p-red)" : tone === "teal" ? "var(--p-teal)" : "var(--p-fg)";
  return (
    <div className="px-4 py-4">
      <div className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color }}>
        <CountUp value={value} suffix={suffix} />
      </div>
      <div className="pitch-mono mt-1 text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">{label}</div>
    </div>
  );
}
