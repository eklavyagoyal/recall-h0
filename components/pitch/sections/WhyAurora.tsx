"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE, Glow, GridBackdrop, Kicker, Reveal, Section, Stagger, StaggerItem } from "@/components/pitch/shared";
import { cn } from "@/lib/utils";

type ColKey = "dynamo" | "dsql" | "aurora";

const COLUMNS: ReadonlyArray<{ key: ColKey; name: string; sub: string; winner: boolean }> = [
  { key: "dynamo", name: "DynamoDB", sub: "key-value", winner: false },
  { key: "dsql", name: "Aurora DSQL", sub: "distributed sql", winner: false },
  { key: "aurora", name: "Aurora PostgreSQL", sub: "the choice", winner: true },
];

const ROWS: ReadonlyArray<{
  capability: string;
  detail: string;
  cells: Record<ColKey, boolean>;
}> = [
  {
    capability: "Recursive graph traversal",
    detail: "WITH RECURSIVE — walk lot → shipment → store in one statement",
    cells: { dynamo: false, dsql: false, aurora: true },
  },
  {
    capability: "Geospatial (PostGIS)",
    detail: "ST_DWithin over store geometry to draw the exposure radius",
    cells: { dynamo: false, dsql: false, aurora: true },
  },
  {
    capability: "Vector search (pgvector)",
    detail: "HNSW index to surface semantically similar prior incidents",
    cells: { dynamo: false, dsql: false, aurora: true },
  },
  {
    capability: "Foreign-key integrity",
    detail: "Referential constraints so the trace can never lie to you",
    cells: { dynamo: false, dsql: false, aurora: true },
  },
];

function Mark({ ok, winner }: { ok: boolean; winner: boolean }) {
  const reduce = useReducedMotion();
  const color = ok ? "var(--p-teal)" : "var(--p-red)";
  return (
    <motion.span
      aria-label={ok ? "supported" : "not supported"}
      className="pitch-mono inline-flex h-7 w-7 items-center justify-center rounded-full text-base font-semibold leading-none"
      style={{
        color,
        background: ok ? "var(--p-teal-soft)" : winner ? "transparent" : "var(--p-red-soft)",
        border: `1px solid ${ok ? "var(--p-teal)" : "var(--p-line-2)"}`,
        opacity: ok ? 1 : 0.62,
      }}
      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
      whileInView={{ scale: 1, opacity: ok ? 1 : 0.62 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {ok ? "✓" : "✗"}
    </motion.span>
  );
}

function HeaderCell({ name, sub, winner }: { name: string; sub: string; winner: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-4 text-center",
        winner && "rounded-t-lg",
      )}
      style={
        winner
          ? { background: "var(--p-teal-soft)", borderBottom: "1px solid var(--p-teal)" }
          : undefined
      }
    >
      <span
        className={cn("text-sm font-semibold tracking-tight sm:text-base")}
        style={{ color: winner ? "var(--p-teal)" : "var(--p-fg)" }}
      >
        {name}
      </span>
      <span className="pitch-mono text-[0.6rem] uppercase tracking-widest text-[var(--p-faint)]">
        {sub}
      </span>
    </div>
  );
}

export default function WhyAurora() {
  return (
    <Section id="why" className="relative">
      <GridBackdrop />
      <Glow color="var(--p-teal)" size={560} className="right-0 top-10" style={{ opacity: 0.12 }} />
      <Glow color="var(--p-red)" size={420} className="-left-10 bottom-0" style={{ opacity: 0.08 }} />

      <div className="relative z-10">
        <div className="mb-10 flex flex-col items-start gap-3">
          <Kicker tone="teal">the load-bearing choice</Kicker>
          <h2 className="pitch-display max-w-3xl text-4xl sm:text-5xl md:text-6xl">
            Swap the database out, and the product can&apos;t exist.
          </h2>
          <p className="max-w-xl text-base text-[var(--p-muted)]">
            Recall is not a database wrapper — it is four Postgres capabilities, composed in a
            single statement. Take any one away and the trace breaks. So we did the comparison
            honestly.
          </p>
        </div>

        {/* Matrix */}
        <div className="pitch-card overflow-hidden p-0">
          {/* Header row */}
          <div className="grid grid-cols-[1.5fr_repeat(3,minmax(0,1fr))] border-b border-[var(--p-line)] sm:grid-cols-[1.8fr_repeat(3,minmax(0,1fr))]">
            <div className="flex items-end px-4 py-4">
              <span className="pitch-mono text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
                capability
              </span>
            </div>
            {COLUMNS.map((col) => (
              <HeaderCell key={col.key} name={col.name} sub={col.sub} winner={col.winner} />
            ))}
          </div>

          {/* Body rows — built one by one on scroll */}
          <Stagger gap={0.12}>
            {ROWS.map((row, idx) => (
              <StaggerItem key={row.capability} y={14}>
                <div
                  className={cn(
                    "grid grid-cols-[1.5fr_repeat(3,minmax(0,1fr))] items-stretch sm:grid-cols-[1.8fr_repeat(3,minmax(0,1fr))]",
                    idx !== ROWS.length - 1 && "border-b border-[var(--p-line)]",
                  )}
                >
                  {/* Capability label */}
                  <div className="flex flex-col justify-center gap-1 px-4 py-4">
                    <span className="text-sm font-medium text-[var(--p-fg)] sm:text-base">
                      {row.capability}
                    </span>
                    <span className="hidden text-xs text-[var(--p-faint)] sm:block">
                      {row.detail}
                    </span>
                  </div>

                  {/* Cells */}
                  {COLUMNS.map((col) => (
                    <div
                      key={col.key}
                      className="flex items-center justify-center px-3 py-4"
                      style={
                        col.winner
                          ? { background: "var(--p-teal-soft)" }
                          : undefined
                      }
                    >
                      <Mark ok={row.cells[col.key]} winner={col.winner} />
                    </div>
                  ))}
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          {/* Verdict strip under the winning column */}
          <div className="grid grid-cols-[1.5fr_repeat(3,minmax(0,1fr))] border-t border-[var(--p-line)] sm:grid-cols-[1.8fr_repeat(3,minmax(0,1fr))]">
            <div className="flex items-center px-4 py-3">
              <span className="pitch-mono text-[0.65rem] uppercase tracking-widest text-[var(--p-faint)]">
                verdict
              </span>
            </div>
            <Verdict label="0 / 4" tone="red" />
            <Verdict label="0 / 4" tone="red" />
            <Verdict label="4 / 4" tone="teal" winner />
          </div>
        </div>

        <Reveal delay={0.1} className="mt-6">
          <p className="max-w-3xl text-xs leading-relaxed text-[var(--p-faint)]">
            <span className="pitch-mono uppercase tracking-widest text-[var(--p-muted)]">
              Precision:
            </span>{" "}
            Aurora DSQL does support basic recursive CTEs — we don&apos;t claim otherwise. The
            unimpeachable gaps are PostGIS, pgvector, and foreign keys.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

function Verdict({
  label,
  tone,
  winner = false,
}: {
  label: string;
  tone: "red" | "teal";
  winner?: boolean;
}) {
  const color = tone === "teal" ? "var(--p-teal)" : "var(--p-red)";
  return (
    <div
      className={cn("flex items-center justify-center px-3 py-3", winner && "rounded-b-lg")}
      style={winner ? { background: "var(--p-teal-soft)" } : undefined}
    >
      <span
        className="pitch-mono text-sm font-semibold tabular-nums"
        style={{ color, opacity: winner ? 1 : 0.7 }}
      >
        {label}
      </span>
    </div>
  );
}
