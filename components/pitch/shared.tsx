"use client";

import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* Shared easing — a soft, confident "out-expo"-ish curve used everywhere. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/* ---------------- Scroll progress bar (top of viewport) ---------------- */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.35 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left"
    >
      <div className="h-full w-full bg-gradient-to-r from-[var(--p-red)] to-[var(--p-red-2)]" />
    </motion.div>
  );
}

/* ---------------- Section wrapper (centered, generous rhythm) ---------------- */
export function Section({
  id,
  children,
  className,
  full,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  full?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative w-full px-6 py-28 sm:px-8 md:py-40",
        full && "flex min-h-screen flex-col justify-center",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

/* ---------------- Kicker / eyebrow label ---------------- */
export function Kicker({
  children,
  tone = "red",
  className,
}: {
  children: ReactNode;
  tone?: "red" | "teal";
  className?: string;
}) {
  return <span className={cn("pitch-kicker", tone === "teal" && "teal", className)}>{children}</span>;
}

/* ---------------- Reveal on scroll-into-view ---------------- */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-12% 0px -12% 0px" }}
      transition={{ duration: 0.75, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Staggered group ---------------- */
export function Stagger({
  children,
  className,
  gap = 0.08,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10%" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 22,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- CountUp (animates when scrolled into view) ---------------- */
function formatNumber(n: number, decimals: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function CountUp({
  value,
  decimals = 0,
  duration = 1.7,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? formatNumber(value, decimals) : formatNumber(0, decimals));

  useEffect(() => {
    if (!inView || reduce) {
      if (reduce) setDisplay(formatNumber(value, decimals));
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(formatNumber(v, decimals)),
    });
    return () => controls.stop();
  }, [inView, value, decimals, duration, reduce]);

  return (
    <span ref={ref} className={cn("pitch-mono tabular-nums", className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ---------------- Parallax helper (scroll-linked Y translate) ---------------- */
export function useParallax(distance = 80): { ref: React.RefObject<HTMLDivElement | null>; y: MotionValue<number> } {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return { ref, y };
}

/* ---------------- Decorative backdrops ---------------- */
export function GridBackdrop({ className }: { className?: string }) {
  return <div aria-hidden className={cn("pitch-grid", className)} />;
}

export function Glow({
  className,
  color = "var(--p-red)",
  size = 520,
  style,
}: {
  className?: string;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("pitch-glow", className)}
      style={{ width: size, height: size, background: color, ...style }}
    />
  );
}

/* ---------------- Stat block (number + label) ---------------- */
export function Stat({
  value,
  label,
  decimals = 0,
  prefix = "",
  suffix = "",
  tone = "fg",
}: {
  value: number;
  label: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  tone?: "fg" | "red" | "teal";
}) {
  const color = tone === "red" ? "var(--p-red)" : tone === "teal" ? "var(--p-teal)" : "var(--p-fg)";
  return (
    <div>
      <div className="text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color }}>
        <CountUp value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
      </div>
      <div className="mt-2 text-sm text-[var(--p-muted)]">{label}</div>
    </div>
  );
}
