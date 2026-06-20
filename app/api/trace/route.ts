import { badRequest, invalidJson, serverError, traceBodySchema } from "@/lib/api/schemas";
import { runTrace } from "@/lib/db/queries/trace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJson();
  }

  const parsed = traceBodySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const result = await runTrace(parsed.data.tlc, { asOf: parsed.data.asOf ?? null });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverError(error);
  }
}
