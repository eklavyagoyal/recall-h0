import { badRequest, explainBodySchema, invalidJson, serverError } from "@/lib/api/schemas";
import { explainTrace } from "@/lib/db/explain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJson();
  }

  const parsed = explainBodySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const result = await explainTrace(parsed.data.tlc, parsed.data.asOf ?? null);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}
