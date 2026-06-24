import { describe, expect, it, vi } from "vitest";
import { FDA_SLA_MS, formatSlaDuration, slaDeadlineMs, slaRemainingMs } from "@/lib/sla";

describe("FDA SLA helpers", () => {
  it("anchors the deadline to incident reportedAt plus 24 hours", () => {
    const reportedAt = "2026-06-24T10:00:00.000Z";
    expect(slaDeadlineMs(reportedAt)).toBe(Date.parse(reportedAt) + FDA_SLA_MS);
  });

  it("returns null when no report timestamp exists", () => {
    expect(slaRemainingMs(null)).toBeNull();
    expect(slaRemainingMs("not-a-date")).toBeNull();
  });

  it("clamps elapsed SLA time to zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T10:00:00.000Z"));
    expect(slaRemainingMs("2026-06-24T10:00:00.000Z")).toBe(0);
    vi.useRealTimers();
  });

  it("formats durations as HH:MM:SS", () => {
    expect(formatSlaDuration(3_723_000)).toBe("01:02:03");
  });
});
