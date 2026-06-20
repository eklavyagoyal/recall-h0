import type { PoolClient } from "pg";
import { pool } from "@/lib/db/pool";

export async function inRollbackTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    return await fn(client);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}

export async function countRows(table: string): Promise<number> {
  const result = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
  return Number(result.rows[0]?.n ?? 0);
}

export async function firstSeedStoreId(): Promise<number> {
  const result = await pool.query<{ store_id: string }>(
    "SELECT store_id::text FROM shipments ORDER BY shipment_id LIMIT 1",
  );
  const id = result.rows[0]?.store_id;
  if (!id) throw new Error("seeded shipments are required for lineage contract tests");
  return Number(id);
}
