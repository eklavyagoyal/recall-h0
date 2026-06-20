import { badRequest, lineageQuerySchema, serverError } from "@/lib/api/schemas";
import { lineageByLot, lineageByStore } from "@/lib/db/queries/lineage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = lineageQuerySchema.safeParse({
    storeId: url.searchParams.get("storeId") ?? undefined,
    lotId: url.searchParams.get("lotId") ?? undefined,
  });
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const trail =
      parsed.data.storeId !== undefined
        ? await lineageByStore(parsed.data.storeId)
        : await lineageByLot(parsed.data.lotId as number);
    return Response.json({ trail }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}
