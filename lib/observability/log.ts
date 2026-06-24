import { randomUUID } from "node:crypto";

export type FailureClass =
  | "dependency_timeout"
  | "dependency_error"
  | "invalid_input"
  | "rate_limited"
  | "route_saturated"
  | "unexpected";

export type LogContext = {
  traceId: string;
  route: string;
  method?: string;
  ip?: string;
  vercelId?: string | null;
};

type LogFields = Record<string, unknown>;

export function requestLogContext(request: Request, route: string): LogContext {
  return {
    traceId: request.headers.get("x-trace-id") ?? request.headers.get("x-request-id") ?? randomUUID(),
    route,
    method: request.method,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? undefined,
    vercelId: request.headers.get("x-vercel-id"),
  };
}

export function routeLogContext(route: string): LogContext {
  return { traceId: randomUUID(), route };
}

export function noStoreHeaders(traceId: string): HeadersInit {
  return { "Cache-Control": "no-store", "x-trace-id": traceId };
}

export function withTraceHeaders(response: Response, traceId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("x-trace-id", traceId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function logInfo(context: LogContext | undefined, event: string, fields: LogFields = {}): void {
  write("info", context, event, fields);
}

export function logWarn(context: LogContext | undefined, event: string, fields: LogFields = {}): void {
  write("warn", context, event, fields);
}

export function logError(
  context: LogContext | undefined,
  event: string,
  error: unknown,
  fields: LogFields = {},
): void {
  write("error", context, event, { ...fields, error: errorDetails(error) });
}

function write(
  level: "info" | "warn" | "error",
  context: LogContext | undefined,
  event: string,
  fields: LogFields,
): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function errorDetails(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: codeOf(error),
    };
  }
  return { message: String(error), code: codeOf(error) };
}

function codeOf(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code: unknown }).code)
    : null;
}
