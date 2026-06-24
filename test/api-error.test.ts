import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  runTrace: vi.fn(),
}));

vi.mock("@/lib/db/queries/trace", () => ({
  runTrace: mocks.runTrace,
}));

vi.mock("@/lib/db/pool", () => ({
  pool: {
    connect: mocks.connect,
  },
}));

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://local.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API error and degraded-mode behavior without a live DB", () => {
  beforeEach(() => {
    mocks.runTrace.mockReset();
    mocks.connect.mockReset();
  });

  it("/api/trace returns sqlstate on pool errors", async () => {
    mocks.runTrace.mockRejectedValueOnce(Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }));
    const { POST } = await import("@/app/api/trace/route");

    const response = await POST(jsonRequest("/api/trace", { tlc: "PRD-OUTBREAK-0001" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ error: "trace_failed", sqlstate: "ECONNREFUSED" });
  });

  it("/api/trace returns typed timeout for database deadlines", async () => {
    mocks.runTrace.mockRejectedValueOnce(Object.assign(new Error("statement timeout"), { code: "57014" }));
    const { POST } = await import("@/app/api/trace/route");

    const response = await POST(jsonRequest("/api/trace", { tlc: "PRD-OUTBREAK-0001" }));
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body).toMatchObject({
      error: "trace_timeout",
      failureClass: "dependency_timeout",
      dependency: "aurora_postgres",
      retryable: true,
      sqlstate: "57014",
    });
  });

  it("/api/health is liveness-only and does not touch the DB pool", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("https://recall.test/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "live", process: "up" });
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("/api/ready returns 503 when DB connect fails", async () => {
    mocks.connect.mockRejectedValueOnce(Object.assign(new Error("connect timeout"), { code: "ETIMEDOUT" }));
    const { GET } = await import("@/app/api/ready/route");

    const response = await GET(new Request("https://recall.test/api/ready"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "not_ready",
      db: "down",
      dependency: "aurora_postgres",
      sqlstate: "ETIMEDOUT",
    });
  });
});
