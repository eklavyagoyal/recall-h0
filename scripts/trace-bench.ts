import "dotenv/config";
import { DEMO_TLC } from "@/lib/config";
import { explainTrace } from "@/lib/db/explain";
import { pool } from "@/lib/db/pool";
import { runTrace } from "@/lib/db/queries/trace";
import { embed } from "@/lib/embeddings";

const iterations = 30;
const budgetMs = 1000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

async function main(): Promise<void> {
  const tlc = process.argv[2] ?? DEMO_TLC;
  const queryEmbedding = (await embed([tlc]))[0];
  if (!queryEmbedding) throw new Error("Embedding provider returned no vectors.");

  console.log("\n=== Recall hero-query bench ===");
  console.log(`TLC: ${tlc}   iterations: ${iterations}   budget(p50): ${budgetMs}ms\n`);

  const warm = await runTrace(tlc, { queryEmbedding });
  console.log(
    `warm-up scope -> lots=${warm.meta.lotCount} edges=${warm.meta.edgeCount} stores=${warm.meta.storeCount} totalUnits=${warm.meta.totalUnits} incidents=${warm.incidents.length}`,
  );

  const samples: number[] = [];
  for (let index = 0; index < iterations; index++) {
    const result = await runTrace(tlc, { queryEmbedding });
    samples.push(result.meta.latencyMs);
  }
  samples.sort((left, right) => left - right);

  const min = samples[0] ?? 0;
  const p50 = percentile(samples, 50);
  const p99 = percentile(samples, 99);
  const max = samples[samples.length - 1] ?? 0;

  console.log(`\nlatency over ${iterations} runs (ms): min=${min} p50=${p50} p99=${p99} max=${max}`);

  const { plan, nodes } = await explainTrace(tlc, null, queryEmbedding);
  console.log(`\n=== EXPLAIN (ANALYZE, BUFFERS) ===\n${plan}\n`);

  const planLower = plan.toLowerCase();
  const hasRecursiveIndexScan =
    planLower.includes("recursive union") &&
    (/index scan[^\n]*lot_links/.test(planLower) ||
      /bitmap index scan[^\n]*idx_lot_links_parent/.test(planLower));
  const hasHnsw = planLower.includes("idx_incidents_hnsw");
  const hasGist = planLower.includes("idx_stores_geom");
  const hasHotSeqScan =
    /seq scan[^\n]*(lot_links|shipments)/.test(planLower) ||
    /parallel seq scan[^\n]*(lot_links|shipments)/.test(planLower);

  console.log("required-node check:");
  console.log(`  recursive Index Scan on lot_links : ${hasRecursiveIndexScan ? "OK" : "MISSING"}`);
  console.log(`  HNSW index scan (incidents)       : ${hasHnsw ? "OK" : "MISSING"}`);
  console.log(`  GiST spatial path (stores.geom)   : ${hasGist ? "OK" : "MISSING"}`);
  console.log(`  NO seq scan on lot_links/shipments: ${hasHotSeqScan ? "FAIL" : "OK"}`);
  console.log(`  parsed nodes: ${nodes.map((node) => node.type).join(", ") || "(none parsed)"}`);

  await pool.end();

  const failures: string[] = [];
  if (p50 >= budgetMs) failures.push(`p50 ${p50}ms >= budget ${budgetMs}ms`);
  if (!hasRecursiveIndexScan) failures.push("recursive Index Scan on lot_links missing");
  if (!hasHnsw) failures.push("HNSW index scan missing");
  if (!hasGist) failures.push("GiST spatial path missing");
  if (hasHotSeqScan) failures.push("seq scan on hot path (lot_links/shipments)");

  if (failures.length > 0) {
    console.error(`\nBENCH FAILED:\n  - ${failures.join("\n  - ")}\n`);
    process.exit(1);
  }

  console.log(`\nBENCH PASSED — p50 ${p50}ms < ${budgetMs}ms, all required nodes present.\n`);
}

main().catch(async (error: unknown) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
