import { describe, expect, it } from "vitest";
import { DEMO_TLC, EMBED_DIM } from "@/lib/config";
import { mapTraceRow, runTrace, TRACE_SQL } from "@/lib/db/queries/trace";
import { embed } from "@/lib/embeddings";
import { countRows, inRollbackTx } from "./helpers/db";

const zeroVector = `[${new Array(EMBED_DIM).fill(0).join(",")}]`;

describe("hero trace against real seed volume", () => {
  it("DEMO_TLC traces to a large, well-formed store set", async () => {
    expect(await countRows("lot_links")).toBeGreaterThan(50_000);

    const [queryEmbedding] = await embed([DEMO_TLC]);
    if (!queryEmbedding) throw new Error("Embedding provider returned no vectors.");

    const result = await runTrace(DEMO_TLC, { queryEmbedding });
    expect(result.meta.lotCount).toBeGreaterThan(1);
    expect(result.meta.storeCount).toBeGreaterThan(500);
    expect(result.stores).toHaveLength(result.meta.storeCount);
    expect(result.edges).toHaveLength(result.meta.edgeCount);
    expect(result.meta.totalUnits).toBeGreaterThan(0);

    for (const store of result.stores.slice(0, 50)) {
      expect(store.storeId).toEqual(expect.any(Number));
      expect(store.lat).toBeGreaterThan(18);
      expect(store.lat).toBeLessThan(72);
      expect(store.lng).toBeLessThan(-50);
      expect(store.lng).toBeGreaterThan(-170);
      expect(store.units).toBeGreaterThan(0);
    }

    const scores = result.incidents.map((incident) => incident.score);
    expect(scores).toEqual([...scores].sort((left, right) => right - left));
  });

  it("non-existent TLC returns a clean empty result without throwing", async () => {
    const result = await runTrace("DOES-NOT-EXIST-9999", {
      queryEmbedding: new Array(EMBED_DIM).fill(0),
    });

    expect(result.meta.lotCount).toBe(0);
    expect(result.meta.storeCount).toBe(0);
    expect(result.meta.totalUnits).toBe(0);
    expect(result.edges).toEqual([]);
    expect(result.stores).toEqual([]);
    expect(result.incidents).toEqual([]);
    expect(result.sql).toMatch(/WITH RECURSIVE/i);
  });

  it("real-but-unshipped TLC maps to the clean lot shape", async () => {
    await inRollbackTx(async (client) => {
      await client.query(`
        INSERT INTO lots (tlc, product_name, lot_type, produced_at, facility_id)
        VALUES (
          'TST-CLEAN-0001',
          'orphan ingredient',
          'ingredient',
          now(),
          (SELECT facility_id FROM facilities ORDER BY facility_id LIMIT 1)
        )
      `);

      const query = await client.query(TRACE_SQL, ["TST-CLEAN-0001", zeroVector, null]);
      const row = query.rows[0];
      expect(Number(row.lot_count)).toBe(1);
      expect(Number(row.store_count)).toBe(0);
      expect(Number(row.total_units)).toBe(0);

      const mapped = mapTraceRow(row, 1, null);
      expect(mapped.meta.lotCount).toBe(1);
      expect(mapped.meta.storeCount).toBe(0);
      expect(mapped.edges).toEqual([]);
      expect(mapped.stores).toEqual([]);
    });
  });

  it("deliberate A to B to A cycle terminates and stays bounded", async () => {
    await inRollbackTx(async (client) => {
      const makeLot = async (tlc: string, type: "ingredient" | "intermediate" | "finished") => {
        const result = await client.query<{ lot_id: string }>(
          `
          INSERT INTO lots (tlc, product_name, lot_type, produced_at, facility_id)
          VALUES ($1, $1, $2, now(), (SELECT facility_id FROM facilities ORDER BY facility_id LIMIT 1))
          RETURNING lot_id::text
          `,
          [tlc, type],
        );
        return Number(result.rows[0]?.lot_id);
      };

      const a = await makeLot("TST-CYCLE-A", "finished");
      const b = await makeLot("TST-CYCLE-B", "intermediate");
      const c = await makeLot("TST-CYCLE-C", "intermediate");

      await client.query(
        `
        INSERT INTO lot_links (parent_lot_id, child_lot_id, transform_event)
        VALUES ($1, $2, 'mix'), ($2, $1, 'cycle'), ($1, $3, 'split')
        `,
        [a, b, c],
      );

      const startedAt = performance.now();
      const result = await client.query<{ lot_id: string; visits: number }>(
        `
        WITH RECURSIVE contaminated AS (
          SELECT l.lot_id, 0 AS depth, ARRAY[l.lot_id] AS path
          FROM lots l WHERE l.tlc = $1
          UNION ALL
          SELECT ll.child_lot_id, c.depth + 1, c.path || ll.child_lot_id
          FROM contaminated c JOIN lot_links ll ON ll.parent_lot_id = c.lot_id
          WHERE c.depth < 12 AND ll.child_lot_id <> ALL(c.path)
        )
        SELECT lot_id::text, count(*)::int AS visits
        FROM contaminated
        GROUP BY lot_id
        `,
        ["TST-CYCLE-A"],
      );
      const elapsedMs = performance.now() - startedAt;

      expect(elapsedMs).toBeLessThan(2_000);
      expect(result.rows.map((row) => Number(row.lot_id)).sort((left, right) => left - right)).toEqual(
        [a, b, c].sort((left, right) => left - right),
      );
      for (const row of result.rows) expect(row.visits).toBe(1);
    });
  });

  it("DEMO_TLC latency stays within a generous budget and is re-measured", async () => {
    const [queryEmbedding] = await embed([DEMO_TLC]);
    if (!queryEmbedding) throw new Error("Embedding provider returned no vectors.");

    await runTrace(DEMO_TLC, { queryEmbedding });
    const samples: number[] = [];
    for (let index = 0; index < 7; index += 1) {
      const result = await runTrace(DEMO_TLC, { queryEmbedding });
      samples.push(result.meta.latencyMs);
    }

    const sorted = [...samples].sort((left, right) => left - right);
    const p50 = sorted[Math.floor(sorted.length / 2)] ?? 0;
    console.log(`[trace.test] samples=${samples.join(",")} p50=${p50}ms`);

    expect(p50).toBeGreaterThan(0);
    expect(p50).toBeLessThan(5_000);
    expect(new Set(samples).size).toBeGreaterThan(1);
  }, 60_000);
});
