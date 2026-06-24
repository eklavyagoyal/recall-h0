import { pool } from "@/lib/db/pool";
import { embeddingFor, TRACE_PLANNER_TUNING, TRACE_SQL, toVectorLiteral } from "@/lib/db/queries/trace";
import { explainNodes } from "@/lib/explain/annotate";
import type { LogContext } from "@/lib/observability/log";

export type ExplainNode = {
  type: string;
  detail: string;
};

export type ExplainResult = {
  plan: string;
  nodes: ExplainNode[];
};

export async function explainTrace(
  tlc: string,
  asOf: string | null = null,
  queryEmbedding?: number[],
  logContext?: LogContext,
): Promise<ExplainResult> {
  const vector = await embeddingFor(tlc, { queryEmbedding, logContext });
  const vectorLiteral = toVectorLiteral(vector);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    for (const stmt of TRACE_PLANNER_TUNING) {
      await client.query(stmt);
    }
    const result = await client.query<{ "QUERY PLAN": string }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${TRACE_SQL}`,
      [tlc, vectorLiteral, asOf],
    );
    await client.query("ROLLBACK");

    const plan = result.rows.map((row) => row["QUERY PLAN"]).join("\n");
    return { plan, nodes: explainNodes(plan) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function parsePlanNodes(plan: string): ExplainNode[] {
  return explainNodes(plan);
}
