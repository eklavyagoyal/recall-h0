import { pool } from "@/lib/db/pool";
import { logError, logInfo, noStoreHeaders, requestLogContext, type LogContext } from "@/lib/observability/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request): Promise<Response> {
  const context = requestLogContext(request, "api.ready");
  const startedAt = performance.now();
  const client = await pool.connect().catch((error: unknown) => ({ error }));

  if ("error" in client) {
    return notReady(client.error, Math.round(performance.now() - startedAt), context);
  }

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '3000ms'");
    await client.query("SELECT 1");
    await client.query("COMMIT");
    const latencyMs = Math.round(performance.now() - startedAt);
    logInfo(context, "ready.success", { dependency: "aurora_postgres", latencyMs });
    return Response.json(
      {
        status: "ready",
        db: "up",
        latencyMs,
      },
      { headers: noStoreHeaders(context.traceId) },
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return notReady(error, Math.round(performance.now() - startedAt), context);
  } finally {
    client.release();
  }
}

function notReady(error: unknown, latencyMs: number, context: LogContext): Response {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : null;
  logError(context, "ready.failure", error, {
    dependency: "aurora_postgres",
    failureClass: "dependency_error",
    sqlstate: code,
    latencyMs,
  });
  return Response.json(
    {
      status: "not_ready",
      db: "down",
      dependency: "aurora_postgres",
      sqlstate: code,
      latencyMs,
    },
    { status: 503, headers: noStoreHeaders(context.traceId) },
  );
}
