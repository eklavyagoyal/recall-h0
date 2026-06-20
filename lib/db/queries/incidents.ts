import { pool } from "@/lib/db/pool";
import type { InboxIncident } from "@/lib/types";

export type IncidentRow = InboxIncident;

export type Cluster = {
  label: string;
  incidentIds: number[];
  size: number;
};

type RawIncidentRow = {
  incident_id: string | number;
  raw_text: string;
  pathogen: string | null;
  reported_at: Date | string;
  suspected_tlc: string | null;
  cluster_key: string | number;
};

const incidentsSql = `
  WITH base AS (
    SELECT
      i.incident_id,
      i.raw_text,
      i.pathogen,
      i.reported_at,
      i.embedding,
      l.tlc AS suspected_tlc
    FROM incidents i
    LEFT JOIN lots l ON l.lot_id = i.suspected_lot_id
    WHERE i.embedding IS NOT NULL
    ORDER BY i.reported_at DESC
    LIMIT $2
  ),
  clustered AS (
    SELECT
      b.incident_id,
      b.raw_text,
      b.pathogen,
      b.reported_at,
      b.suspected_tlc,
      LEAST(
        b.incident_id,
        COALESCE(MIN(neighbor.incident_id) FILTER (WHERE neighbor.distance <= $1), b.incident_id)
      ) AS cluster_key
    FROM base b
    LEFT JOIN LATERAL (
      SELECT
        n.incident_id,
        n.embedding <=> b.embedding AS distance
      FROM incidents n
      WHERE n.embedding IS NOT NULL
        AND n.incident_id <> b.incident_id
        AND n.pathogen IS NOT DISTINCT FROM b.pathogen
      ORDER BY n.embedding <=> b.embedding
      LIMIT 8
    ) neighbor ON true
    GROUP BY b.incident_id, b.raw_text, b.pathogen, b.reported_at, b.suspected_tlc
  )
  SELECT incident_id, raw_text, pathogen, reported_at, suspected_tlc, cluster_key
  FROM clustered
  ORDER BY reported_at DESC
`;

export async function getIncidents(
  threshold: number,
  limit: number,
): Promise<{ incidents: IncidentRow[]; clusters: Cluster[] }> {
  const result = await pool.query<RawIncidentRow>(incidentsSql, [threshold, limit]);

  const incidents = result.rows.map((row) => ({
    incidentId: Number(row.incident_id),
    text: row.raw_text,
    pathogen: row.pathogen,
    score: 1,
    reportedAt: new Date(row.reported_at).toISOString(),
    suspectedTlc: row.suspected_tlc,
    clusterKey: Number(row.cluster_key),
  }));

  const byCluster = new Map<number, IncidentRow[]>();
  for (const incident of incidents) {
    const group = byCluster.get(incident.clusterKey) ?? [];
    group.push(incident);
    byCluster.set(incident.clusterKey, group);
  }

  const clusters = [...byCluster.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const pathogens = [...new Set(group.map((incident) => incident.pathogen).filter(Boolean))];
      return {
        label:
          pathogens.length === 1
            ? `Possible ${pathogens[0]} cluster`
            : "Possible outbreak cluster",
        incidentIds: group.map((incident) => incident.incidentId),
        size: group.length,
      };
    })
    .sort((left, right) => right.size - left.size);

  return { incidents, clusters };
}
