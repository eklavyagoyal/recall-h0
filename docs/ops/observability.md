# Observability

Recall emits newline-delimited JSON logs from server route handlers and engine-adjacent code.
Each request-scoped log includes:

- `traceId` — copied from `x-trace-id` / `x-request-id` when present, otherwise generated.
- `route` — route or subsystem name, such as `api.trace`, `api.explain`, or `api.ready`.
- `event` — stable event name.
- `dependency` — remote dependency when relevant, such as `aurora_postgres` or `bedrock`.
- `failureClass` — normalized class for alerting and dashboards.

Failure-class enum:

| failureClass | Meaning |
|---|---|
| `dependency_timeout` | A dependency did not answer before the bounded deadline. |
| `dependency_error` | A dependency failed without matching the timeout class. |
| `invalid_input` | Request validation failed before any dependency call. |
| `rate_limited` | Per-client admission/token limits rejected the request. |
| `route_saturated` | Global route concurrency limits rejected the request. |
| `unexpected` | Reserved for bugs that do not fit a known class. |

Important event names:

| event | Fields |
|---|---|
| `trace.start` | `tlc`, `asOf` |
| `trace.success` | `latencyMs`, `lotCount`, `edgeCount`, `storeCount`, `totalUnits` |
| `trace.timeout` | `dependency`, `failureClass`, `sqlstate` |
| `trace.retry` | `dependency`, `failureClass`, `sqlstate`, `retryCount`, `delayMs` |
| `trace.admission_rejected` | `failureClass`, `status`, `ip` |
| `embedding.degraded` | `dependency`, `failureClass`, typed error details |
| `explain.start` / `explain.success` | `tlc`, `asOf`, `nodeCount` |
| `ready.success` / `ready.failure` | `dependency`, `latencyMs`, `sqlstate` |

Responses also carry `x-trace-id` so a judge/session issue can be matched back to server logs.
