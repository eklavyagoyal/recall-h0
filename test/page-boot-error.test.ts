import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const mocks = vi.hoisted(() => ({
  runTrace: vi.fn(),
}));

vi.mock("@/lib/db/queries/trace", () => ({
  runTrace: mocks.runTrace,
  TRACE_SQL: "SELECT 1",
}));

vi.mock("@/components/console/Console", () => ({
  Console: vi.fn(() => null),
}));

type ConsoleElement = ReactElement<{
  bootError: string | null;
  bootCode?: string;
  initial: unknown;
  initialTlc: string;
  traceSql: string;
}>;

describe("home page boot fallback", () => {
  beforeEach(() => {
    mocks.runTrace.mockReset();
  });

  it("passes bootError and sqlstate to Console when the initial trace fails", async () => {
    mocks.runTrace.mockRejectedValueOnce(Object.assign(new Error("database unavailable"), { code: "ETIMEDOUT" }));
    const { default: Home } = await import("@/app/page");

    const element = (await Home()) as ConsoleElement;

    expect(element.props).toMatchObject({
      initial: null,
      bootError: "database unavailable",
      bootCode: "ETIMEDOUT",
      traceSql: "SELECT 1",
    });
  });
});
