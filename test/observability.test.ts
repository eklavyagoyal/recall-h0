import { describe, expect, it } from "vitest";
import { requestLogContext, withTraceHeaders } from "@/lib/observability/log";

describe("observability helpers", () => {
  it("preserves inbound request IDs as trace IDs", () => {
    const request = new Request("https://local.test/api/trace", {
      method: "POST",
      headers: {
        "x-request-id": "req_123",
        "x-forwarded-for": "203.0.113.42, 10.0.0.1",
        "x-vercel-id": "iad1::abc",
      },
    });

    expect(requestLogContext(request, "api.trace")).toMatchObject({
      traceId: "req_123",
      route: "api.trace",
      method: "POST",
      ip: "203.0.113.42",
      vercelId: "iad1::abc",
    });
  });

  it("adds trace IDs without changing the JSON response body", async () => {
    const response = withTraceHeaders(Response.json({ ok: true }), "trace_123");

    expect(response.headers.get("x-trace-id")).toBe("trace_123");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
