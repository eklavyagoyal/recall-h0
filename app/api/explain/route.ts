import { badRequest, explainBodySchema, invalidJson, serverError } from "@/lib/api/schemas";
import { admitExpensiveRoute } from "@/lib/api/admission";
import { explainTrace } from "@/lib/db/explain";
import { logInfo, logWarn, noStoreHeaders, requestLogContext, withTraceHeaders } from "@/lib/observability/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const context = requestLogContext(request, "api.explain");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logWarn(context, "explain.invalid_json", { failureClass: "invalid_input" });
    return withTraceHeaders(invalidJson(), context.traceId);
  }

  const parsed = explainBodySchema.safeParse(body);
  if (!parsed.success) {
    logWarn(context, "explain.invalid_input", { failureClass: "invalid_input" });
    return withTraceHeaders(badRequest(parsed.error), context.traceId);
  }

  const admission = admitExpensiveRoute({
    route: "explain",
    request,
    maxConcurrentPerIp: 1,
    maxGlobalConcurrent: 2,
    burst: 4,
    refillPerSecond: 0.5,
  });
  if (!admission.ok) {
    logWarn(context, "explain.admission_rejected", {
      failureClass: admission.response.status === 503 ? "route_saturated" : "rate_limited",
      status: admission.response.status,
      ip: admission.ip,
    });
    return withTraceHeaders(admission.response, context.traceId);
  }

  try {
    logInfo(context, "explain.start", { tlc: parsed.data.tlc, asOf: parsed.data.asOf ?? null });
    const result = await explainTrace(parsed.data.tlc, parsed.data.asOf ?? null, undefined, context);
    logInfo(context, "explain.success", { nodeCount: result.nodes.length });
    return Response.json(result, { headers: noStoreHeaders(context.traceId) });
  } catch (error) {
    return withTraceHeaders(serverError(error, context), context.traceId);
  } finally {
    admission.release();
  }
}
