import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TRACE_SQL } from "@/lib/db/queries/trace";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("anti-fake SQL and cache guards", () => {
  it("TRACE_SQL is the real recursive CTE", () => {
    expect(TRACE_SQL).toMatch(/WITH RECURSIVE/i);
    expect(TRACE_SQL).toMatch(/lot_links/);
    expect(TRACE_SQL).toMatch(/<=>/);
    expect(TRACE_SQL).toMatch(/ST_[XY]\s*\(/i);
    expect(TRACE_SQL).toMatch(/<>\s*ALL\s*\(/i);
    expect(TRACE_SQL).toMatch(/depth\s*<\s*12/i);
  });

  it("trace source binds TLC and vector as parameters", () => {
    const source = read("lib/db/queries/trace.ts");
    expect(source).toMatch(/\$1/);
    expect(source).toMatch(/\$2/);
    expect(source).toMatch(/\$3/);
    expect(source).toMatch(/client\.query<RawTraceRow>\(TRACE_SQL,\s*\[tlc,\s*embeddingLiteral,\s*asOf\]\)/);
    expect(source).not.toMatch(/\$\{\s*tlc\s*\}/i);
    expect(source).not.toMatch(/\$\{\s*embeddingLiteral\s*\}/i);
  });

  it("runTrace measures latency with a clock, not a literal badge", () => {
    const source = read("lib/db/queries/trace.ts");
    expect(source).toMatch(/performance\.now\(\)|Date\.now\(\)|process\.hrtime/);
    expect(source).not.toMatch(/latencyMs\s*[:=]\s*\d{2,4}\b(?!\s*[-+*/])/);
  });

  it("/api/trace is dynamic and not statically cached", () => {
    const source = read("app/api/trace/route.ts");
    expect(source).toMatch(/dynamic\s*=\s*["']force-dynamic["']/);
    expect(source).toMatch(/["']Cache-Control["']\s*:\s*["']no-store["']/);
    expect(source).not.toMatch(/dynamic\s*=\s*["']force-static["']/);
    expect(source).not.toMatch(/export\s+const\s+revalidate\s*=\s*\d+/);
  });
});
