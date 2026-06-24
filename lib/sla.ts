export const FDA_SLA_MS = 24 * 60 * 60 * 1000;

export function slaDeadlineMs(reportedAt: string | null | undefined): number | null {
  if (!reportedAt) return null;
  const reportedMs = Date.parse(reportedAt);
  if (!Number.isFinite(reportedMs)) return null;
  return reportedMs + FDA_SLA_MS;
}

export function slaRemainingMs(reportedAt: string | null | undefined, nowMs = Date.now()): number | null {
  const deadline = slaDeadlineMs(reportedAt);
  if (deadline === null) return null;
  return Math.max(0, deadline - nowMs);
}

export function formatSlaDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
