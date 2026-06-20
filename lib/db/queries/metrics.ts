import { pool } from "@/lib/db/pool";

export type MetricSample = {
  ts: string;
  latencyMs: number;
};

const ring: MetricSample[] = [];
const ringMax = 200;

export function recordSample(latencyMs: number): void {
  ring.push({ ts: new Date().toISOString(), latencyMs });
  if (ring.length > ringMax) ring.shift();
}

async function traceMetricsTableExists(): Promise<boolean> {
  const result = await pool.query<{ present: boolean }>(
    "SELECT to_regclass('public.trace_metrics') IS NOT NULL AS present",
  );
  return result.rows[0]?.present ?? false;
}

export async function getMetrics(limit: number): Promise<{
  samples: MetricSample[];
  lastRowCount: number;
}> {
  if (await traceMetricsTableExists()) {
    const [samples, last] = await Promise.all([
      pool.query<{ ts: Date | string; latency_ms: string | number }>(
        "SELECT ts, latency_ms FROM trace_metrics ORDER BY ts DESC LIMIT $1",
        [limit],
      ),
      pool.query<{ row_count: string | number }>(
        "SELECT row_count FROM trace_metrics ORDER BY ts DESC LIMIT 1",
      ),
    ]);
    return {
      samples: samples.rows
        .map((row) => ({ ts: new Date(row.ts).toISOString(), latencyMs: Number(row.latency_ms) }))
        .reverse(),
      lastRowCount: Number(last.rows[0]?.row_count ?? 0),
    };
  }

  return { samples: ring.slice(-limit), lastRowCount: 0 };
}
