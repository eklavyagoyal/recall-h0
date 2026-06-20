import { badRequest, incidentsQuerySchema, serverError } from "@/lib/api/schemas";
import { getIncidents } from "@/lib/db/queries/incidents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = incidentsQuerySchema.safeParse({
    threshold: url.searchParams.get("threshold") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const result = await getIncidents(parsed.data.threshold, parsed.data.limit);
    return Response.json(result, { headers: { "Cache-Control": "private, max-age=10" } });
  } catch (error) {
    return serverError(error);
  }
}
