import type { ReactNode } from "react";

type PaneShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PaneShell({ title, subtitle, children }: PaneShellProps) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-neutral-950">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 px-3">
        <span className="text-xs font-medium uppercase text-neutral-400">{title}</span>
        {subtitle && <span className="font-mono text-[10px] text-neutral-600">{subtitle}</span>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
