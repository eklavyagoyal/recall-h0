"use client";

import { motion, useReducedMotion } from "motion/react";
import { type ReactNode } from "react";
import {
  EASE,
  Glow,
  GridBackdrop,
  Kicker,
  Reveal,
  Section,
  Stagger,
  StaggerItem,
} from "@/components/pitch/shared";
import { cn } from "@/lib/utils";

/* ---------------- Node model (laid out on a 0..1000 x 0..560 canvas) ---------------- */

type NodeKind = "neutral" | "oidc" | "teal" | "red";

type FlowNode = {
  id: string;
  title: string;
  sub?: string;
  tag?: string;
  kind: NodeKind;
  /* center coordinates in viewBox units */
  cx: number;
  cy: number;
  w: number;
  h: number;
};

const NODES: readonly FlowNode[] = [
  { id: "browser", title: "Browser", sub: "paste a lot code", tag: "client", kind: "neutral", cx: 120, cy: 280, w: 168, h: 96 },
  { id: "vercel", title: "Vercel", sub: "Next.js · Fluid Compute · iad1", tag: "edge", kind: "neutral", cx: 360, cy: 280, w: 196, h: 108 },
  { id: "oidc", title: "OIDC → STS → IAM", sub: "Vercel OIDC · AWS STS · least-priv role", tag: "keyless", kind: "oidc", cx: 600, cy: 280, w: 204, h: 112 },
  { id: "aurora", title: "Aurora PostgreSQL", sub: "Serverless v2 · pgvector · PostGIS", tag: "data", kind: "teal", cx: 868, cy: 156, w: 220, h: 104 },
  { id: "bedrock", title: "Bedrock Titan v2", sub: "1024-dim embeddings", tag: "embeddings", kind: "teal", cx: 868, cy: 404, w: 220, h: 104 },
] as const;

/* Connectors reference node ids; each carries the pulse animation offset. */
type Edge = { from: string; to: string; delay: number; tone: "neutral" | "teal" };

const EDGES: readonly Edge[] = [
  { from: "browser", to: "vercel", delay: 0, tone: "neutral" },
  { from: "vercel", to: "oidc", delay: 0.9, tone: "neutral" },
  { from: "oidc", to: "aurora", delay: 1.8, tone: "teal" },
  { from: "oidc", to: "bedrock", delay: 2.4, tone: "teal" },
] as const;

const VIEW_W = 1000;
const VIEW_H = 560;

function nodeById(id: string): FlowNode {
  const found = NODES.find((n) => n.id === id);
  if (!found) throw new Error(`unknown node ${id}`);
  return found;
}

/* Smooth horizontal-ish cubic between two nodes' facing edges. */
function edgePath(from: FlowNode, to: FlowNode): string {
  const x1 = from.cx + from.w / 2;
  const y1 = from.cy;
  const x2 = to.cx - to.w / 2;
  const y2 = to.cy;
  const dx = Math.max(56, (x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

const toneStroke: Record<Edge["tone"], string> = {
  neutral: "var(--p-line-2)",
  teal: "var(--p-teal)",
};

const tonePulse: Record<Edge["tone"], string> = {
  neutral: "var(--p-fg)",
  teal: "var(--p-teal)",
};

/* ---------------- Animated connector with traveling pulse ---------------- */

function Connector({ edge, reduce }: { edge: Edge; reduce: boolean }) {
  const d = edgePath(nodeById(edge.from), nodeById(edge.to));
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={toneStroke[edge.tone]}
        strokeWidth={1.25}
        strokeOpacity={edge.tone === "teal" ? 0.55 : 0.7}
        strokeLinecap="round"
      />
      {/* faint underglow track for teal data paths */}
      {edge.tone === "teal" && (
        <path d={d} fill="none" stroke="var(--p-teal-soft)" strokeWidth={5} strokeOpacity={0.18} strokeLinecap="round" />
      )}
      {!reduce && (
        <circle r={3.4} fill={tonePulse[edge.tone]} opacity={0.95}>
          <animateMotion dur="3.6s" begin={`${edge.delay}s`} repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear" path={d} />
          <animate attributeName="opacity" dur="3.6s" begin={`${edge.delay}s`} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.85;1" />
        </circle>
      )}
    </g>
  );
}

/* ---------------- Node card rendered as foreignObject for crisp text ---------------- */

const kindAccent: Record<NodeKind, string> = {
  neutral: "var(--p-line)",
  oidc: "var(--p-teal)",
  teal: "var(--p-teal)",
  red: "var(--p-red)",
};

function LockMark() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden className="shrink-0">
      <rect x={5} y={10.5} width={14} height={9.5} rx={2} fill="none" stroke="var(--p-teal)" strokeWidth={1.6} />
      <path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 V10.5" fill="none" stroke="var(--p-teal)" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={12} cy={15} r={1.5} fill="var(--p-teal)" />
    </svg>
  );
}

function FlowCard({ node, index, reduce }: { node: FlowNode; index: number; reduce: boolean }) {
  const accent = kindAccent[node.kind];
  return (
    <foreignObject x={node.cx - node.w / 2} y={node.cy - node.h / 2} width={node.w} height={node.h} style={{ overflow: "visible" }}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.65, delay: 0.12 * index, ease: EASE }}
        className={cn(
          "pitch-card flex h-full flex-col justify-center gap-1 px-4 py-3",
          node.kind === "oidc" && "border-[var(--p-teal-soft)]",
        )}
        style={{ borderColor: node.kind === "neutral" ? undefined : `color-mix(in srgb, ${accent} 38%, var(--p-line))` }}
      >
        <div className="flex items-center gap-2">
          {node.kind === "oidc" && <LockMark />}
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: node.kind === "neutral" ? "var(--p-faint)" : accent, boxShadow: node.kind === "neutral" ? "none" : `0 0 8px ${accent}` }}
          />
          <span className="truncate text-[0.92rem] font-semibold tracking-tight text-[var(--p-fg)]">{node.title}</span>
        </div>
        {node.sub && <div className="pitch-mono truncate text-[0.66rem] text-[var(--p-muted)]">{node.sub}</div>}
        {node.tag && (
          <div className="text-[0.6rem] uppercase tracking-widest text-[var(--p-faint)]">{node.tag}</div>
        )}
      </motion.div>
    </foreignObject>
  );
}

/* ---------------- Emphasis callout ---------------- */

function Callout({ children }: { children: ReactNode }) {
  return (
    <StaggerItem className="pitch-card flex items-start gap-3 px-4 py-3.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--p-teal)]" style={{ boxShadow: "0 0 8px var(--p-teal)" }} />
      <p className="text-[0.9rem] leading-relaxed text-[var(--p-muted)]">{children}</p>
    </StaggerItem>
  );
}

/* ---------------- Mini stat chip ---------------- */

function StatChip({ value, label, tone }: { value: string; label: string; tone: "teal" | "fg" }) {
  const color = tone === "teal" ? "var(--p-teal)" : "var(--p-fg)";
  return (
    <div className="flex items-baseline gap-2">
      <span className="pitch-mono text-lg font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[0.6rem] uppercase tracking-widest text-[var(--p-faint)]">{label}</span>
    </div>
  );
}

/* ---------------- Section ---------------- */

export default function Architecture() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section id="architecture" className="relative overflow-hidden">
      <GridBackdrop className="opacity-[0.5]" />
      <Glow color="var(--p-teal)" size={620} className="absolute -right-40 top-10 opacity-[0.1]" />
      <Glow color="var(--p-red)" size={460} className="absolute -left-32 bottom-0 opacity-[0.06]" />

      <div className="relative z-10">
        <Reveal>
          <Kicker tone="teal">Step 3 · the cloud</Kicker>
        </Reveal>

        <Reveal delay={0.06} className="mt-5 max-w-3xl">
          <h2 className="pitch-display text-4xl sm:text-5xl md:text-6xl">
            Serverless, scale-to-zero, and zero AWS keys.
          </h2>
        </Reveal>

        <Reveal delay={0.12} className="mt-4 max-w-2xl">
          <p className="text-base leading-relaxed text-[var(--p-muted)] sm:text-lg">
            One request fans out from the edge into AWS &mdash; without a single stored credential. The
            function assumes a least-privilege role on demand, queries Aurora over a verified channel, and
            costs nothing when no one&apos;s looking.
          </p>
        </Reveal>

        {/* ---------------- Diagram ---------------- */}
        <Reveal delay={0.16} className="mt-12">
          <div className="pitch-card relative overflow-hidden p-2 sm:p-4">
            <div className="pointer-events-none absolute left-4 top-4 z-10 text-[0.6rem] uppercase tracking-widest text-[var(--p-faint)]">
              request path
            </div>
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="h-auto w-full"
              role="img"
              aria-label="Browser to Vercel to an OIDC keyless hop, branching to Aurora PostgreSQL and Bedrock Titan v2."
            >
              {/* connectors first so cards sit on top */}
              {EDGES.map((e) => (
                <Connector key={`${e.from}-${e.to}`} edge={e} reduce={reduce} />
              ))}
              {/* branch label near the OIDC fork */}
              <text x={742} y={272} fill="var(--p-faint)" fontSize={11} letterSpacing={2} className="pitch-mono">
                ASSUME ROLE
              </text>
              {NODES.map((n, i) => (
                <FlowCard key={n.id} node={n} index={i} reduce={reduce} />
              ))}
            </svg>
          </div>
        </Reveal>

        {/* ---------------- Stat row ---------------- */}
        <Reveal delay={0.1} className="mt-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-y border-[var(--p-line)] py-5">
            <StatChip value="0" label="AWS keys" tone="teal" />
            <span className="h-4 w-px bg-[var(--p-line-2)]" aria-hidden />
            <StatChip value="0" label="Min ACU" tone="fg" />
            <span className="h-4 w-px bg-[var(--p-line-2)]" aria-hidden />
            <StatChip value="us-east-1" label="region" tone="fg" />
          </div>
        </Reveal>

        {/* ---------------- Callouts ---------------- */}
        <Stagger gap={0.1} className="mt-8 grid gap-3 md:grid-cols-3">
          <Callout>
            <span className="font-medium text-[var(--p-fg)]">No long-lived AWS keys anywhere</span> &mdash; the
            function assumes a <span className="text-[var(--p-teal)]">least-privilege role</span> via OIDC,
            scoped per request.
          </Callout>
          <Callout>
            <span className="text-[var(--p-teal)]">TLS-verified</span> connection to Aurora, pinned to the{" "}
            <span className="font-medium text-[var(--p-fg)]">RDS certificate authority</span> &mdash; no
            man-in-the-middle, no plaintext.
          </Callout>
          <Callout>
            <span className="text-[var(--p-teal)]">Scale-to-zero</span>: Serverless v2 idles down to{" "}
            <span className="font-medium text-[var(--p-fg)]">~$0 when idle</span> and wakes on the next lot
            lookup.
          </Callout>
        </Stagger>
      </div>
    </Section>
  );
}
