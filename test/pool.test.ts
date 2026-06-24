import { afterEach, describe, expect, it, vi } from "vitest";

describe("database pool config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bounds Aurora connection and statement wait time", async () => {
    vi.resetModules();
    vi.stubEnv("DEPLOY_TARGET", "aurora");
    vi.stubEnv("DATABASE_URL", "postgres://recall:recall@example.invalid:5432/recall");

    const { createPoolConfig, pool } = await import("@/lib/db/pool");
    try {
      const config = createPoolConfig();
      expect(config.connectionTimeoutMillis).toBe(12_000);
      expect(config.statement_timeout).toBe(18_000);
      expect(config.max).toBe(5);
    } finally {
      await pool.end().catch(() => {});
    }
  });
});
