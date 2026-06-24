export type MetricSample = {
  ts: string;
  latencyMs: number;
};

const ring: MetricSample[] = [];
const ringMax = 200;

export function recordSample(latencyMs: number): void {
  ring.push({ ts: new Date().toISOString(), latencyMs });
  if (ring.length > ringMax) ring.shift();
}

export function getMetrics(limit: number): {
  samples: MetricSample[];
  lastRowCount: number;
} {
  return { samples: ring.slice(-limit), lastRowCount: 0 };
}
