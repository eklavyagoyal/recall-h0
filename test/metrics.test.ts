import { describe, expect, it } from "vitest";
import { getMetrics, recordSample } from "@/lib/db/queries/metrics";

describe("metrics ring", () => {
  it("uses the in-memory per-instance ring as the single source of truth", () => {
    recordSample(101);
    recordSample(202);

    const metrics = getMetrics(1);

    expect(metrics.lastRowCount).toBe(0);
    expect(metrics.samples).toHaveLength(1);
    expect(metrics.samples[0]?.latencyMs).toBe(202);
    expect(Date.parse(metrics.samples[0]?.ts ?? "")).not.toBeNaN();
  });
});
