import { pool } from "@/lib/db/pool";

export type LineageRow = {
  lot: string;
  facility: string;
  supplier: string;
  shipment: number;
  units: number;
  shippedAt: string;
};

type RawLineageRow = {
  lot: string;
  facility: string;
  supplier: string;
  shipment: string | number | null;
  units: string | number | null;
  shippedAt: Date | string | null;
};

const lineageByStoreSql = `
  SELECT
    lo.tlc AS lot,
    fa.name AS facility,
    su.name AS supplier,
    sh.shipment_id AS shipment,
    sh.units AS units,
    sh.shipped_at AS "shippedAt"
  FROM shipments sh
  JOIN lots lo ON lo.lot_id = sh.lot_id
  JOIN facilities fa ON fa.facility_id = lo.facility_id
  JOIN suppliers su ON su.supplier_id = fa.supplier_id
  WHERE sh.store_id = $1
  ORDER BY sh.shipped_at DESC
  LIMIT 500
`;

const lineageByLotSql = `
  SELECT
    lo.tlc AS lot,
    fa.name AS facility,
    su.name AS supplier,
    sh.shipment_id AS shipment,
    sh.units AS units,
    sh.shipped_at AS "shippedAt"
  FROM lots lo
  JOIN facilities fa ON fa.facility_id = lo.facility_id
  JOIN suppliers su ON su.supplier_id = fa.supplier_id
  LEFT JOIN shipments sh ON sh.lot_id = lo.lot_id
  WHERE lo.lot_id = $1
  ORDER BY sh.shipped_at DESC NULLS LAST
  LIMIT 500
`;

function normalize(rows: RawLineageRow[]): LineageRow[] {
  return rows
    .filter((row) => row.shipment !== null && row.units !== null && row.shippedAt !== null)
    .map((row) => ({
      lot: row.lot,
      facility: row.facility,
      supplier: row.supplier,
      shipment: Number(row.shipment),
      units: Number(row.units),
      shippedAt: new Date(row.shippedAt as string | Date).toISOString(),
    }));
}

export async function lineageByStore(storeId: number): Promise<LineageRow[]> {
  const result = await pool.query<RawLineageRow>(lineageByStoreSql, [storeId]);
  return normalize(result.rows);
}

export async function lineageByLot(lotId: number): Promise<LineageRow[]> {
  const result = await pool.query<RawLineageRow>(lineageByLotSql, [lotId]);
  return normalize(result.rows);
}
