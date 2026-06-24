import { z } from "zod";

export const ErrorResponse = z.object({
  error: z.string(),
  issues: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
  sqlstate: z.string().nullable().optional(),
});

export const TraceResponse = z.object({
  meta: z.object({
    latencyMs: z.number().nonnegative(),
    lotCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative(),
    storeCount: z.number().int().nonnegative(),
    totalUnits: z.number().nonnegative(),
    asOf: z.string().nullable(),
  }),
  edges: z.array(z.object({ parent: z.number(), child: z.number(), transform: z.string() })),
  stores: z.array(
    z.object({
      storeId: z.number(),
      name: z.string(),
      chain: z.string(),
      address: z.string(),
      lat: z.number(),
      lng: z.number(),
      units: z.number().nonnegative(),
    }),
  ),
  incidents: z.array(
    z.object({
      incidentId: z.number(),
      text: z.string(),
      pathogen: z.string().nullable(),
      score: z.number(),
    }),
  ),
  sql: z.string().min(1),
});

export const ExplainResponse = z.object({
  plan: z.string().min(1),
  nodes: z.array(z.object({ type: z.string(), detail: z.string() })),
});

export const IncidentsResponse = z.object({
  clusters: z.array(
    z.object({
      label: z.string(),
      incidentIds: z.array(z.number()),
      size: z.number().int().nonnegative(),
    }),
  ),
  incidents: z.array(
    z.object({
      incidentId: z.number(),
      text: z.string(),
      pathogen: z.string().nullable(),
      score: z.number(),
      reportedAt: z.string(),
      suspectedTlc: z.string().nullable(),
      clusterKey: z.number(),
    }),
  ),
});

export const LineageResponse = z.object({
  trail: z.array(
    z.object({
      lot: z.string(),
      facility: z.string(),
      supplier: z.string(),
      shipment: z.number(),
      units: z.number(),
      shippedAt: z.string(),
    }),
  ),
});

export const MetricsResponse = z.object({
  samples: z.array(z.object({ ts: z.string(), latencyMs: z.number() })),
  lastRowCount: z.number().int().nonnegative(),
});

export const HealthResponse = z.object({
  status: z.literal("live"),
  process: z.literal("up"),
});

export const ReadyResponse = z.object({
  status: z.literal("ready"),
  db: z.literal("up"),
  latencyMs: z.number().nonnegative(),
});

export const NotReadyResponse = z.object({
  status: z.literal("not_ready"),
  db: z.literal("down"),
  dependency: z.string(),
  sqlstate: z.string().nullable(),
  latencyMs: z.number().nonnegative(),
});
