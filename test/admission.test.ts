import { beforeEach, describe, expect, it } from "vitest";
import { admitExpensiveRoute, resetAdmissionStateForTests } from "@/lib/api/admission";

const baseOptions = {
  route: "trace",
  maxConcurrentPerIp: 2,
  maxGlobalConcurrent: 4,
  burst: 8,
  refillPerSecond: 1,
};

function request(ip: string): Request {
  return new Request("https://local.test/api/trace", {
    headers: { "x-forwarded-for": `${ip}, 198.51.100.9` },
  });
}

describe("expensive route admission", () => {
  beforeEach(() => {
    resetAdmissionStateForTests();
  });

  it("enforces concurrent requests per client and releases capacity", async () => {
    const first = admitExpensiveRoute({ ...baseOptions, request: request("203.0.113.10") });
    const second = admitExpensiveRoute({ ...baseOptions, request: request("203.0.113.10") });
    const third = admitExpensiveRoute({ ...baseOptions, request: request("203.0.113.10") });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.response.status).toBe(429);
      await expect(third.response.json()).resolves.toMatchObject({
        error: "too_many_concurrent_requests",
        retryable: true,
      });
    }

    if (first.ok) first.release();
    const afterRelease = admitExpensiveRoute({ ...baseOptions, request: request("203.0.113.10") });
    expect(afterRelease.ok).toBe(true);

    if (second.ok) second.release();
    if (afterRelease.ok) afterRelease.release();
  });

  it("bounds total concurrent work for a route", async () => {
    const first = admitExpensiveRoute({
      ...baseOptions,
      maxConcurrentPerIp: 4,
      maxGlobalConcurrent: 2,
      request: request("203.0.113.11"),
    });
    const second = admitExpensiveRoute({
      ...baseOptions,
      maxConcurrentPerIp: 4,
      maxGlobalConcurrent: 2,
      request: request("203.0.113.12"),
    });
    const third = admitExpensiveRoute({
      ...baseOptions,
      maxConcurrentPerIp: 4,
      maxGlobalConcurrent: 2,
      request: request("203.0.113.13"),
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.response.status).toBe(503);
      expect(third.response.headers.get("Retry-After")).toBe("2");
      await expect(third.response.json()).resolves.toMatchObject({ error: "route_saturated" });
    }

    if (first.ok) first.release();
    if (second.ok) second.release();
  });

  it("spends burst tokens even after work is released", async () => {
    const first = admitExpensiveRoute({
      ...baseOptions,
      burst: 1,
      refillPerSecond: 0,
      request: request("203.0.113.14"),
    });
    expect(first.ok).toBe(true);
    if (first.ok) first.release();

    const second = admitExpensiveRoute({
      ...baseOptions,
      burst: 1,
      refillPerSecond: 0,
      request: request("203.0.113.14"),
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.response.status).toBe(429);
      await expect(second.response.json()).resolves.toMatchObject({ error: "rate_limited" });
    }
  });
});
