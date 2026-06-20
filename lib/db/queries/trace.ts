import { performance } from "node:perf_hooks";
import { EMBED_DIM, TRACE_MAX_DEPTH } from "@/lib/config";
import { pool } from "@/lib/db/pool";
import { recordSample } from "@/lib/db/queries/metrics";
import { embed, toVectorLiteral as toPgVectorLiteral } from "@/lib/embeddings";
import type { AffectedStore, Edge, SimilarIncident, TraceResult } from "@/lib/types";

export const TRACE_SQL = `WITH RECURSIVE contaminated AS (
  SELECT l.lot_id, 0 AS depth, ARRAY[l.lot_id] AS path
  FROM lots l WHERE l.tlc = $1
  UNION ALL
  SELECT ll.child_lot_id, c.depth + 1, c.path || ll.child_lot_id
  FROM contaminated c JOIN lot_links ll ON ll.parent_lot_id = c.lot_id
  WHERE c.depth < ${TRACE_MAX_DEPTH} AND ll.child_lot_id <> ALL(c.path)
),
edges AS (
  SELECT DISTINCT ll.parent_lot_id, ll.child_lot_id, ll.transform_event
  FROM lot_links ll
  JOIN contaminated p ON p.lot_id = ll.parent_lot_id
  JOIN contaminated c ON c.lot_id = ll.child_lot_id
),
spatial_stores AS MATERIALIZED (
  SELECT s.store_id, s.name, s.chain, s.address, s.geom
  FROM stores s
  WHERE ST_DWithin(
    s.geom,
    ST_SetSRID(ST_MakePoint(-98.5795, 39.8283), 4326)::geography,
    5000000
  )
  ORDER BY s.geom <-> ST_SetSRID(ST_MakePoint(-98.5795, 39.8283), 4326)::geography
),
affected AS (
  SELECT s.store_id, s.name, s.chain, s.address, ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lng, SUM(sh.units) AS units
  FROM shipments sh
  JOIN contaminated c ON c.lot_id = sh.lot_id
  JOIN spatial_stores s ON s.store_id = sh.store_id
  WHERE ($3::timestamptz IS NULL OR sh.shipped_at <= $3)
  GROUP BY s.store_id, s.name, s.chain, s.address, s.geom
),
similar_incidents AS (
  SELECT i.incident_id, i.raw_text, i.pathogen, 1 - (i.embedding <=> $2::vector) AS score
  FROM incidents i
  WHERE EXISTS (SELECT 1 FROM contaminated)
  ORDER BY i.embedding <=> $2::vector LIMIT 5
)
SELECT (SELECT count(*) FROM contaminated) AS lot_count, (SELECT json_agg(edges) FROM edges) AS edges,
       (SELECT json_agg(affected ORDER BY units DESC) FROM affected) AS stores, (SELECT coalesce(sum(units),0) FROM affected) AS total_units,
       (SELECT count(*) FROM affected) AS store_count, (SELECT json_agg(similar_incidents) FROM similar_incidents) AS incidents;`;

type RawTraceRow = {
  lot_count: string | number;
  edges:
    | { parent_lot_id: string | number; child_lot_id: string | number; transform_event: string }[]
    | null;
  stores:
    | {
        store_id: string | number;
        name: string;
        chain: string;
        address: string;
        lat: string | number;
        lng: string | number;
        units: string | number;
      }[]
    | null;
  total_units: string | number;
  store_count: string | number;
  incidents:
    | {
        incident_id: string | number;
        raw_text: string;
        pathogen: string | null;
        score: string | number;
      }[]
    | null;
};

export type RunTraceOptions = {
  asOf?: string | null;
  queryEmbedding?: number[];
  queryText?: string;
};

export function toVectorLiteral(vector: number[]): string {
  if (vector.length !== EMBED_DIM) {
    throw new Error(`Embedding dim ${vector.length} !== EMBED_DIM ${EMBED_DIM}.`);
  }
  return toPgVectorLiteral(vector);
}

async function embeddingFor(tlc: string, options: RunTraceOptions): Promise<number[]> {
  if (options.queryEmbedding) return options.queryEmbedding;
  const vectors = await embed([options.queryText ?? tlc]);
  const first = vectors[0];
  if (!first) throw new Error("Embedding provider returned no vectors.");
  return first;
}

export async function runTrace(tlc: string, options: RunTraceOptions = {}): Promise<TraceResult> {
  const asOf = options.asOf ?? null;
  const embeddingLiteral = toVectorLiteral(await embeddingFor(tlc, options));
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const startedAt = performance.now();
      const result = await client.query<RawTraceRow>(TRACE_SQL, [tlc, embeddingLiteral, asOf]);
      const latencyMs = Math.round(performance.now() - startedAt);
      await client.query("COMMIT");
      recordSample(latencyMs);

      const row = result.rows[0] ?? emptyRawTraceRow();
      return mapTraceRow(row, latencyMs, asOf);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if ((error as { code?: string }).code === "40001" && attempt < maxRetries - 1) {
        continue;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  throw new Error("runTrace exhausted retry loop unexpectedly.");
}

function emptyRawTraceRow(): RawTraceRow {
  return {
    lot_count: 0,
    edges: null,
    stores: null,
    total_units: 0,
    store_count: 0,
    incidents: null,
  };
}

export function mapTraceRow(row: RawTraceRow, latencyMs: number, asOf: string | null): TraceResult {
  const edges: Edge[] = (row.edges ?? []).map((edge) => ({
    parent: Number(edge.parent_lot_id),
    child: Number(edge.child_lot_id),
    transform: edge.transform_event,
  }));

  const stores: AffectedStore[] = (row.stores ?? []).map((store) => ({
    storeId: Number(store.store_id),
    name: store.name,
    chain: store.chain,
    address: store.address,
    lat: Number(store.lat),
    lng: Number(store.lng),
    units: Number(store.units),
  }));

  const incidents: SimilarIncident[] = (row.incidents ?? []).map((incident) => ({
    incidentId: Number(incident.incident_id),
    text: incident.raw_text,
    pathogen: incident.pathogen,
    score: Number(incident.score),
  }));

  return {
    meta: {
      latencyMs,
      lotCount: Number(row.lot_count),
      edgeCount: edges.length,
      storeCount: Number(row.store_count),
      totalUnits: Number(row.total_units),
      asOf,
    },
    edges,
    stores,
    incidents,
    sql: TRACE_SQL,
  };
}
