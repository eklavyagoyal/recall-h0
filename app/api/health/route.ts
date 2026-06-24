import { noStoreHeaders, requestLogContext } from "@/lib/observability/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const context = requestLogContext(request, "api.health");
  return Response.json(
    { status: "live", process: "up" },
    { headers: noStoreHeaders(context.traceId) },
  );
}
