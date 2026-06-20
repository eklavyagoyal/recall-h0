import { badRequest, metricsQuerySchema, serverError } from "@/lib/api/schemas";
import { getMetrics } from "@/lib/db/queries/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = metricsQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const result = await getMetrics(parsed.data.limit);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}
