export type Edge = {
  parent: number;
  child: number;
  transform: string;
};

export type AffectedStore = {
  storeId: number;
  name: string;
  chain: string;
  address: string;
  lat: number;
  lng: number;
  units: number;
  arrivedAt: string;
};

export type SimilarIncident = {
  incidentId: number;
  text: string;
  pathogen: string | null;
  score: number;
};

export type TraceMeta = {
  latencyMs: number;
  lotCount: number;
  edgeCount: number;
  storeCount: number;
  totalUnits: number;
  asOf: string | null;
};

export type TraceResult = {
  meta: TraceMeta;
  edges: Edge[];
  stores: AffectedStore[];
  incidents: SimilarIncident[];
  sql: string;
};

export type LineageStep = {
  lot: string;
  facility: string;
  supplier: string;
  shipment: number;
  units: number;
  shippedAt: string;
};

export type LineageResult = {
  trail: LineageStep[];
};

export type IncidentCluster = {
  label: string;
  incidentIds: number[];
  size: number;
};

export type InboxIncident = SimilarIncident & {
  reportedAt: string;
  suspectedTlc: string | null;
  clusterKey: number;
};

export type IncidentsResult = {
  clusters: IncidentCluster[];
  incidents: InboxIncident[];
};

export type ConsoleSelection =
  | { kind: "store"; id: number; label?: string }
  | { kind: "lot"; id: number; label?: string };
