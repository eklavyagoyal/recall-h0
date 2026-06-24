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
  Stat,
} from "@/components/pitch/shared";
import { cn } from "@/lib/utils";

/* ---- Pipeline definition: the supply chain as a graph the DB can walk ---- */
type Tone = "neutral" | "lot" | "store";

type PipelineNode = {
  label: string;
  sub: string;
  tone: Tone;
};

const NODES: readonly PipelineNode[] = [
  { label: "Supplier", sub: "origin", tone: "neutral" },
  { label: "Facility", sub: "transform", tone: "neutral" },
  { label: "Lot", sub: "lot_links DAG", tone: "lot" },
  { label: "Shipment", sub: "PostGIS", tone: "neutral" },
  { label: "Store", sub: "endpoint", tone: "store" },
] as const;

const SEED_STATS: readonly {
  value: number;
  label: string;
  tone: "fg" | "red" | "teal";
}[] = [
  { value: 80000, label: "lots", tone: "fg" },
  { value: 250000, label: "lot_links edges", tone: "red" },
  { value: 250000, label: "shipments", tone: "fg" },
  { value: 1400, label: "stores", tone: "teal" },
  { value: 2000, label: "incidents", tone: "teal" },
] as const;

function toneAccent(tone: Tone): string {
  if (tone === "lot") return "var(--p-red)";
  if (tone === "store") return "var(--p-teal)";
  return "var(--p-fg)";
}

/* ---- One pill node in the pipeline ---- */
function NodePill({ node, index }: { node: PipelineNode; index: number }) {
  const accent = toneAccent(node.tone);
  const isAccent = node.tone !== "neutral";
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
      className="relative z-10 flex shrink-0 flex-col items-center"
    >
      {/* lot_links self-loop badge sits above the Lot node */}
      {node.tone === "lot" && (
        <div
          className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.6rem] uppercase tracking-widest"
          style={{
            borderColor: "var(--p-red)",
            color: "var(--p-red)",
            background: "var(--p-red-soft)",
          }}
        >
          <span className="pitch-mono">↺ lot_links · DAG</span>
        </div>
      )}
      <div
        className={cn(
          "pitch-card flex min-w-[7.5rem] flex-col items-center px-5 py-4 text-center",
          isAccent && "shadow-[0_0_0_1px_rgba(0,0,0,0)]",
        )}
        style={
          isAccent
            ? { borderColor: accent, boxShadow: `0 0 24px -10px ${accent}` }
            : undefined
        }
      >
        <span
          className="text-base font-semibold tracking-tight sm:text-lg"
          style={{ color: isAccent ? accent : "var(--p-fg)" }}
        >
          {node.label}
        </span>
        <span className="pitch-mono mt-1 text-[0.6rem] uppercase tracking-widest text-[var(--p-faint)]">
          {node.sub}
        </span>
      </div>
      <span className="pitch-mono mt-2 text-[0.6rem] tabular-nums text-[var(--p-faint)]">
        0{index + 1}
      </span>
    </motion.div>
  );
}

/* ---- Animated connector that draws left-to-right on scroll-in ---- */
function Connector({ delay }: { delay: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative z-0 hidden h-[2px] flex-1 items-center self-start mt-[2.6rem] md:flex">
      <motion.div
        aria-hidden
        className="h-px w-full origin-left"
        style={{
          background:
            "linear-gradient(90deg, var(--p-line-2), var(--p-red), var(--p-teal))",
        }}
        initial={reduce ? false : { scaleX: 0, opacity: 0.4 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 0.7, delay, ease: EASE }}
      />
      <motion.span
        aria-hidden
        className="absolute right-0 top-1/2 -translate-y-1/2 text-[0.7rem] text-[var(--p-faint)]"
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 0.4, delay: delay + 0.55, ease: EASE }}
      >
        →
      </motion.span>
    </div>
  );
}

export default function DataModel() {
  const reduce = useReducedMotion();
  const pipelineRef = useRef<HTMLDivElement>(null);
  const pipelineInView = useInView(pipelineRef, { once: true, margin: "-15%" });

  return (
    <Section id="model" className="relative overflow-hidden">
      <GridBackdrop className="opacity-[0.5]" />
      <Glow
        color="var(--p-teal)"
        size={460}
        className="-left-32 top-1/3 opacity-30"
      />
      <Glow
        color="var(--p-red)"
        size={420}
        className="right-0 top-10 opacity-25"
      />

      <div className="relative z-10">
        <Reveal>
          <Kicker>Step 1 · the data model</Kicker>
        </Reveal>

        <Reveal delay={0.05} className="mt-6">
          <h2 className="pitch-display max-w-4xl text-4xl sm:text-5xl md:text-6xl">
            We model the supply chain as a graph the database can walk.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-6">
          <p className="max-w-2xl text-base leading-relaxed text-[var(--p-muted)] sm:text-lg">
            Suppliers flow to facilities to lots; a self-referencing{" "}
            <span className="pitch-mono text-[var(--p-red)]">lot_links</span> edge
            table turns every transformation into a directed acyclic graph.
            Shipments connect finished lots to stores&nbsp;&mdash; each carrying
            PostGIS coordinates&nbsp;&mdash; and incidents carry 1024-dimension
            embedding vectors. Every relationship is an enforced foreign key, so
            the trace is trustworthy by database guarantee, not by hope.
          </p>
        </Reveal>

        {/* ---- The pipeline ---- */}
        <Reveal delay={0.15} className="mt-16">
          <div className="pitch-mono mb-6 text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
            schema topology
          </div>

          <motion.div
            ref={pipelineRef}
            initial="hidden"
            animate={pipelineInView || reduce ? "show" : "hidden"}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.12 } },
            }}
            className="flex flex-col gap-8 md:flex-row md:items-stretch md:gap-3"
          >
            {NODES.map((node, i) => (
              <div
                key={node.label}
                className="flex flex-col items-center gap-3 md:flex-1 md:flex-row"
              >
                <NodePill node={node} index={i} />
                {i < NODES.length - 1 && <Connector delay={0.3 + i * 0.14} />}
              </div>
            ))}
          </motion.div>

          {/* ---- incidents · vector(1024) card feeding the graph ---- */}
          <div className="mt-10 flex items-stretch gap-4">
            <motion.div
              aria-hidden
              className="hidden w-px shrink-0 origin-bottom sm:block"
              style={{
                background:
                  "linear-gradient(180deg, transparent, var(--p-teal))",
              }}
              initial={reduce ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
            />
            <Reveal delay={0.2} className="w-full sm:w-auto">
              <div
                className="pitch-card flex items-center gap-4 px-5 py-4"
                style={{
                  borderColor: "var(--p-teal)",
                  boxShadow: "0 0 28px -12px var(--p-teal)",
                }}
              >
                <div className="flex flex-col">
                  <span className="text-base font-semibold tracking-tight text-[var(--p-teal)]">
                    incidents
                  </span>
                  <span className="pitch-mono mt-1 text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
                    semantic match → lot
                  </span>
                </div>
                <span
                  className="pitch-mono rounded-md px-2.5 py-1 text-xs tabular-nums"
                  style={{
                    background: "var(--p-teal-soft)",
                    color: "var(--p-teal)",
                  }}
                >
                  vector(1024)
                </span>
              </div>
            </Reveal>
          </div>
        </Reveal>

        {/* ---- Seed-scale stats ---- */}
        <div className="mt-20">
          <div className="pitch-hairline mb-10" />
          <div className="pitch-mono mb-8 text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
            seed scale
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {SEED_STATS.map((s) => (
              <Stat
                key={s.label}
                value={s.value}
                label={s.label}
                tone={s.tone}
              />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
