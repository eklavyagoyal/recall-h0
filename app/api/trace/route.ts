import { badRequest, invalidJson, traceBodySchema, traceFailure } from "@/lib/api/schemas";
import { admitExpensiveRoute } from "@/lib/api/admission";
import { runTrace } from "@/lib/db/queries/trace";
import { logInfo, logWarn, requestLogContext, withTraceHeaders } from "@/lib/observability/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  const context = requestLogContext(request, "api.trace");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logWarn(context, "trace.invalid_json", { failureClass: "invalid_input" });
    return withTraceHeaders(invalidJson(), context.traceId);
  }

  const parsed = traceBodySchema.safeParse(body);
  if (!parsed.success) {
    logWarn(context, "trace.invalid_input", { failureClass: "invalid_input" });
    return withTraceHeaders(badRequest(parsed.error), context.traceId);
  }

  const admission = admitExpensiveRoute({
    route: "trace",
    request,
    maxConcurrentPerIp: 2,
    maxGlobalConcurrent: 4,
    burst: 8,
    refillPerSecond: 1,
  });
  if (!admission.ok) {
    logWarn(context, "trace.admission_rejected", {
      failureClass: admission.response.status === 503 ? "route_saturated" : "rate_limited",
      status: admission.response.status,
      ip: admission.ip,
    });
    return withTraceHeaders(admission.response, context.traceId);
  }

  try {
    logInfo(context, "trace.start", { tlc: parsed.data.tlc, asOf: parsed.data.asOf ?? null });
    const result = await runTrace(parsed.data.tlc, {
      asOf: parsed.data.asOf ?? null,
      logContext: context,
    });
    logInfo(context, "trace.success", {
      latencyMs: result.meta.latencyMs,
      lotCount: result.meta.lotCount,
      edgeCount: result.meta.edgeCount,
      storeCount: result.meta.storeCount,
      totalUnits: result.meta.totalUnits,
    });
    return Response.json(result, {
      headers: { "Cache-Control": "no-store", "x-trace-id": context.traceId },
    });
  } catch (error) {
    return withTraceHeaders(traceFailure(error, context), context.traceId);
  } finally {
    admission.release();
  }
}
