import { describe, expect, it } from "vitest";
import {
  ErrorResponse,
  ExplainResponse,
  HealthResponse,
  IncidentsResponse,
  LineageResponse,
  MetricsResponse,
  ReadyResponse,
  TraceResponse,
} from "./helpers/contracts";
import { firstSeedStoreId } from "./helpers/db";
import { DEMO_TLC } from "@/lib/config";

const BASE_URL = process.env.BASE_URL?.startsWith("http")
  ? process.env.BASE_URL.replace(/\/$/, "")
  : undefined;

async function callRoute(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<{ status: number; json: unknown }> {
  if (BASE_URL) {
    const requestInit: RequestInit = {
      method: init.method,
      headers: { "content-type": "application/json" },
    };
    if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);
    const response = await fetch(`${BASE_URL}${path}`, requestInit);
    return { status: response.status, json: await response.json() };
  }

  const requestInit: RequestInit = {
    method: init.method,
    headers: { "content-type": "application/json" },
  };
  if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);
  const request = new Request(`http://local.test${path}`, requestInit);

  switch (path.split("?")[0]) {
    case "/api/trace": {
      const { POST } = await import("@/app/api/trace/route");
      const response = await POST(request);
      return { status: response.status, json: await response.json() };
    }
    case "/api/explain": {
      const { POST } = await import("@/app/api/explain/route");
      const response = await POST(request);
      return { status: response.status, json: await response.json() };
    }
    case "/api/incidents": {
      const { GET } = await import("@/app/api/incidents/route");
      const response = await GET(request);
      return { status: response.status, json: await response.json() };
    }
    case "/api/lineage": {
      const { GET } = await import("@/app/api/lineage/route");
      const response = await GET(request);
      return { status: response.status, json: await response.json() };
    }
    case "/api/metrics": {
      const { GET } = await import("@/app/api/metrics/route");
      const response = await GET(request);
      return { status: response.status, json: await response.json() };
    }
    case "/api/health": {
      const { GET } = await import("@/app/api/health/route");
      const response = await GET(request);
      return { status: response.status, json: await response.json() };
    }
    case "/api/ready": {
      const { GET } = await import("@/app/api/ready/route");
      const response = await GET(request);
      return { status: response.status, json: await response.json() };
    }
    default:
      throw new Error(`No route mapping for ${path}`);
  }
}

describe("API contracts against seeded DB", () => {
  it("POST /api/trace returns TraceResponse", async () => {
    const { status, json } = await callRoute("/api/trace", {
      method: "POST",
      body: { tlc: DEMO_TLC },
    });
    expect(status).toBe(200);
    const parsed = TraceResponse.parse(json);
    expect(parsed.meta.storeCount).toBe(parsed.stores.length);
    expect(parsed.meta.edgeCount).toBe(parsed.edges.length);
    expect(parsed.sql).toMatch(/WITH RECURSIVE/i);
  });

  it("POST /api/trace rejects invalid input with 400", async () => {
    const { status, json } = await callRoute("/api/trace", {
      method: "POST",
      body: { tlc: 123 },
    });
    expect(status).toBe(400);
    expect(ErrorResponse.parse(json).error).toBe("invalid_input");
  });

  it("POST /api/explain returns ExplainResponse with a real plan", async () => {
    const { status, json } = await callRoute("/api/explain", {
      method: "POST",
      body: { tlc: DEMO_TLC },
    });
    expect(status).toBe(200);
    const parsed = ExplainResponse.parse(json);
    expect(parsed.plan).toMatch(/Index Scan|Index Only Scan/i);
    expect(parsed.plan).toMatch(/Recursive/i);
    expect(parsed.nodes.length).toBeGreaterThan(0);
  });

  it("GET /api/incidents returns clustered incidents", async () => {
    const { status, json } = await callRoute("/api/incidents", { method: "GET" });
    expect(status).toBe(200);
    const parsed = IncidentsResponse.parse(json);
    expect(parsed.incidents.length).toBeGreaterThan(0);
  });

  it("GET /api/lineage?storeId returns LineageResponse", async () => {
    const storeId = await firstSeedStoreId();
    const { status, json } = await callRoute(`/api/lineage?storeId=${storeId}`, { method: "GET" });
    expect(status).toBe(200);
    const parsed = LineageResponse.parse(json);
    expect(parsed.trail.length).toBeGreaterThan(0);
  });

  it("GET /api/lineage without selector rejects input with 400", async () => {
    const { status, json } = await callRoute("/api/lineage", { method: "GET" });
    expect(status).toBe(400);
    expect(ErrorResponse.parse(json).error).toBe("invalid_input");
  });

  it("GET /api/metrics returns MetricsResponse", async () => {
    const { status, json } = await callRoute("/api/metrics", { method: "GET" });
    expect(status).toBe(200);
    const parsed = MetricsResponse.parse(json);
    for (const sample of parsed.samples) expect(sample.latencyMs).toBeGreaterThan(0);
  });

  it("GET /api/health is liveness only", async () => {
    const { status, json } = await callRoute("/api/health", { method: "GET" });
    expect(status).toBe(200);
    HealthResponse.parse(json);
  });

  it("GET /api/ready proves DB readiness", async () => {
    const { status, json } = await callRoute("/api/ready", { method: "GET" });
    expect(status).toBe(200);
    ReadyResponse.parse(json);
  });
});
