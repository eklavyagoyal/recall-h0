import type { ReactNode } from "react";

type PaneShellProps = {
  title: string;
  subtitle?: string;
  accent?: "red" | "teal";
  children: ReactNode;
};

export function PaneShell({ title, subtitle, accent = "red", children }: PaneShellProps) {
  const dot = accent === "teal" ? "var(--p-teal)" : "var(--p-red)";
  return (
    <section className="relative flex h-full min-h-0 flex-col bg-[var(--p-bg)]">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--p-line)] px-3.5">
        <span className="console-kicker flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dot, boxShadow: `0 0 8px 0 ${dot}` }}
            aria-hidden="true"
          />
          {title}
        </span>
        {subtitle && <span className="console-mono text-[10px] text-[var(--p-faint)]">{subtitle}</span>}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  );
}
