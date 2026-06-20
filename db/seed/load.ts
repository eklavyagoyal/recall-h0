import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { from as copyFrom } from "pg-copy-streams";
import type { PoolClient } from "pg";
import { EMBED_DIM } from "@/lib/config";
import { pool } from "@/lib/db/pool";
import { embed, toVectorLiteral } from "@/lib/embeddings";
import { generate, type SeedData } from "./generate";

const embedBatchSize = 256;

function escapeCopyValue(value: unknown): string {
  if (value === null || value === undefined) return "\\N";
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function tsv(columns: unknown[]): string {
  return `${columns.map(escapeCopyValue).join("\t")}\n`;
}

async function copyRows<T>(
  client: PoolClient,
  copySql: string,
  rows: readonly T[],
  toColumns: (row: T) => unknown[],
): Promise<void> {
  const stream = client.query(copyFrom(copySql));
  const source = Readable.from(
    (function* rowGenerator() {
      for (const row of rows) {
        yield tsv(toColumns(row));
      }
    })(),
  );
  await pipeline(source, stream);
}

async function resetTables(client: PoolClient): Promise<void> {
  await client.query("DROP INDEX IF EXISTS idx_incidents_hnsw");
  await client.query(`
    TRUNCATE
      incident_lot_matches,
      incidents,
      store_inventory,
      shipments,
      lot_links,
      stores,
      lots,
      facilities,
      suppliers
    RESTART IDENTITY CASCADE
  `);
}

async function resetIdentitySequences(client: PoolClient): Promise<void> {
  await client.query(`
    SELECT setval(pg_get_serial_sequence('suppliers', 'supplier_id'), (SELECT max(supplier_id) FROM suppliers), true);
    SELECT setval(pg_get_serial_sequence('facilities', 'facility_id'), (SELECT max(facility_id) FROM facilities), true);
    SELECT setval(pg_get_serial_sequence('lots', 'lot_id'), (SELECT max(lot_id) FROM lots), true);
    SELECT setval(pg_get_serial_sequence('stores', 'store_id'), (SELECT max(store_id) FROM stores), true);
    SELECT setval(pg_get_serial_sequence('incidents', 'incident_id'), (SELECT max(incident_id) FROM incidents), true);
  `);
}

async function copyBaseRows(data: SeedData): Promise<void> {
  const client = await pool.connect();
  const startedAt = Date.now();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL synchronous_commit = off");
    await resetTables(client);

    await client.query(`
      CREATE TEMP TABLE _suppliers (
        supplier_id bigint,
        name text,
        region text,
        lng float8,
        lat float8
      ) ON COMMIT DROP
    `);
    await copyRows(client, "COPY _suppliers FROM STDIN", data.suppliers, (supplier) => [
      supplier.supplier_id,
      supplier.name,
      supplier.region,
      supplier.lng,
      supplier.lat,
    ]);
    await client.query(`
      INSERT INTO suppliers (supplier_id, name, region, geom) OVERRIDING SYSTEM VALUE
      SELECT supplier_id, name, region, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      FROM _suppliers
    `);

    await client.query(`
      CREATE TEMP TABLE _facilities (
        facility_id bigint,
        name text,
        type text,
        supplier_id bigint
      ) ON COMMIT DROP
    `);
    await copyRows(client, "COPY _facilities FROM STDIN", data.facilities, (facility) => [
      facility.facility_id,
      facility.name,
      facility.type,
      facility.supplier_id,
    ]);
    await client.query(`
      INSERT INTO facilities (facility_id, name, type, supplier_id) OVERRIDING SYSTEM VALUE
      SELECT facility_id, name, type, supplier_id FROM _facilities
    `);

    await client.query(`
      CREATE TEMP TABLE _lots (
        lot_id bigint,
        tlc text,
        product_name text,
        lot_type text,
        produced_at timestamptz,
        facility_id bigint
      ) ON COMMIT DROP
    `);
    await copyRows(client, "COPY _lots FROM STDIN", data.lots, (lot) => [
      lot.lot_id,
      lot.tlc,
      lot.product_name,
      lot.lot_type,
      lot.produced_at,
      lot.facility_id,
    ]);
    await client.query(`
      INSERT INTO lots (lot_id, tlc, product_name, lot_type, produced_at, facility_id)
      OVERRIDING SYSTEM VALUE
      SELECT lot_id, tlc, product_name, lot_type, produced_at, facility_id FROM _lots
    `);

    await copyRows(
      client,
      "COPY lot_links (parent_lot_id, child_lot_id, transform_event) FROM STDIN",
      data.lotLinks,
      (edge) => [edge.parent_lot_id, edge.child_lot_id, edge.transform_event],
    );

    await client.query(`
      CREATE TEMP TABLE _stores (
        store_id bigint,
        name text,
        chain text,
        address text,
        lng float8,
        lat float8
      ) ON COMMIT DROP
    `);
    await copyRows(client, "COPY _stores FROM STDIN", data.stores, (store) => [
      store.store_id,
      store.name,
      store.chain,
      store.address,
      store.lng,
      store.lat,
    ]);
    await client.query(`
      INSERT INTO stores (store_id, name, chain, address, geom) OVERRIDING SYSTEM VALUE
      SELECT store_id, name, chain, address, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      FROM _stores
    `);

    await copyRows(
      client,
      "COPY shipments (lot_id, store_id, units, shipped_at, received_at) FROM STDIN",
      data.shipments,
      (shipment) => [
        shipment.lot_id,
        shipment.store_id,
        shipment.units,
        shipment.shipped_at,
        shipment.received_at,
      ],
    );

    await copyRows(
      client,
      "COPY store_inventory (store_id, lot_id, units_on_hand) FROM STDIN",
      data.inventory,
      (item) => [item.store_id, item.lot_id, item.units_on_hand],
    );

    await client.query(`
      CREATE TEMP TABLE _incidents (
        incident_id bigint,
        reported_at timestamptz,
        raw_text text,
        suspected_lot_id bigint,
        pathogen text
      ) ON COMMIT DROP
    `);
    await copyRows(client, "COPY _incidents FROM STDIN", data.incidents, (incident) => [
      incident.incident_id,
      incident.reported_at,
      incident.raw_text,
      incident.suspected_lot_id,
      incident.pathogen,
    ]);
    await client.query(`
      INSERT INTO incidents (incident_id, reported_at, raw_text, suspected_lot_id, pathogen)
      OVERRIDING SYSTEM VALUE
      SELECT incident_id, reported_at, raw_text, suspected_lot_id, pathogen FROM _incidents
    `);

    await client.query(`
      INSERT INTO incident_lot_matches (incident_id, lot_id)
      SELECT incident_id, suspected_lot_id
      FROM incidents
      WHERE suspected_lot_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await resetIdentitySequences(client);
    await client.query("COMMIT");
    console.log(`[load] base rows copied in ${Date.now() - startedAt}ms`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function embedIncidents(data: SeedData): Promise<void> {
  const texts = data.incidents.map((incident) => incident.raw_text);
  const ids = data.incidents.map((incident) => incident.incident_id);
  const client = await pool.connect();
  const startedAt = Date.now();

  try {
    for (let offset = 0; offset < texts.length; offset += embedBatchSize) {
      const batchTexts = texts.slice(offset, offset + embedBatchSize);
      const batchIds = ids.slice(offset, offset + embedBatchSize);
      const vectors = await embed(batchTexts);
      const first = vectors[0];

      if (first && first.length !== EMBED_DIM) {
        throw new Error(`Embedding dim ${first.length} !== EMBED_DIM ${EMBED_DIM}.`);
      }

      await client.query(
        `UPDATE incidents AS target
           SET embedding = vector_rows.embedding::vector
         FROM (
           SELECT unnest($1::bigint[]) AS incident_id, unnest($2::text[]) AS embedding
         ) AS vector_rows
         WHERE target.incident_id = vector_rows.incident_id`,
        [batchIds, vectors.map(toVectorLiteral)],
      );

      process.stdout.write(`\r[embed] ${Math.min(offset + embedBatchSize, texts.length)}/${texts.length}`);
    }
    process.stdout.write("\n");
  } finally {
    client.release();
  }

  console.log(`[embed] ${texts.length} incidents embedded in ${Date.now() - startedAt}ms`);
}

async function buildHnswIndex(): Promise<void> {
  const client = await pool.connect();
  const startedAt = Date.now();

  try {
    await client.query("SET maintenance_work_mem = '512MB'");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_incidents_hnsw
      ON incidents USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    await client.query("ANALYZE");
  } finally {
    client.release();
  }

  console.log(`[index] HNSW built in ${Date.now() - startedAt}ms`);
}

async function count(client: PoolClient, sql: string): Promise<string> {
  const result = await client.query<{ n: string }>(sql);
  return result.rows[0]?.n ?? "0";
}

async function report(demoLotId: number): Promise<void> {
  const client = await pool.connect();

  try {
    console.log("\n-------- SEED COUNTS (actual) --------");
    console.log("suppliers           ", await count(client, "SELECT count(*) n FROM suppliers"));
    console.log("facilities          ", await count(client, "SELECT count(*) n FROM facilities"));
    console.log("lots                ", await count(client, "SELECT count(*) n FROM lots"));
    console.log("lot_links (edges)   ", await count(client, "SELECT count(*) n FROM lot_links"));
    console.log("stores              ", await count(client, "SELECT count(*) n FROM stores"));
    console.log("shipments           ", await count(client, "SELECT count(*) n FROM shipments"));
    console.log("store_inventory     ", await count(client, "SELECT count(*) n FROM store_inventory"));
    console.log("incidents           ", await count(client, "SELECT count(*) n FROM incidents"));
    console.log(
      "incidents w/ embed  ",
      await count(client, "SELECT count(*) n FROM incidents WHERE embedding IS NOT NULL"),
    );
    console.log(
      "distinct store states",
      await count(client, "SELECT count(DISTINCT right(address, 2)) n FROM stores"),
    );

    const demo = await client.query<{
      tlc: string;
      stores: string;
      units: string;
      downstream_edges: string;
    }>(
      `SELECT l.tlc,
              count(DISTINCT sh.store_id) AS stores,
              coalesce(sum(sh.units), 0) AS units,
              (SELECT count(*) FROM lot_links WHERE parent_lot_id = l.lot_id) AS downstream_edges
         FROM lots l
         JOIN shipments sh ON sh.lot_id = l.lot_id
        WHERE l.lot_id = $1
        GROUP BY l.tlc, l.lot_id`,
      [demoLotId],
    );
    console.log("DEMO lot            ", demo.rows[0]);
    console.log("--------------------------------------\n");
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log("[seed] generating...");
  const data = generate();
  console.log(`[seed] generated ${data.lots.length} lots / ${data.lotLinks.length} edges in memory`);
  await copyBaseRows(data);
  await embedIncidents(data);
  await buildHnswIndex();
  await report(data.demoLotId);
  console.log(`[seed] DONE in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  await pool.end();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
