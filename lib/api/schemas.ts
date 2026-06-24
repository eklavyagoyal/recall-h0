import { z } from "zod";
import { logError, type LogContext } from "@/lib/observability/log";

export const tlcSchema = z
  .string()
  .trim()
  .min(1, "tlc is required")
  .max(128, "tlc is too long")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "tlc has invalid characters");

const asOfSchema = z
  .string()
  .datetime({ offset: true })
  .nullish()
  .transform((value) => value ?? null);

export const traceBodySchema = z.object({
  tlc: tlcSchema,
  asOf: asOfSchema.optional(),
});

export const explainBodySchema = z.object({
  tlc: tlcSchema,
  asOf: asOfSchema.optional(),
});

const idParam = z.coerce.number().int().positive();

export const lineageQuerySchema = z
  .object({
    storeId: idParam.optional(),
    lotId: idParam.optional(),
  })
  .refine((query) => (query.storeId === undefined) !== (query.lotId === undefined), {
    message: "provide exactly one of storeId or lotId",
  });

export const incidentsQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(2).optional().default(0.25),
  limit: z.coerce.number().int().positive().max(500).optional().default(200),
});

export const metricsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

export function badRequest(error: z.ZodError): Response {
  return Response.json(
    {
      error: "invalid_input",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

export function invalidJson(): Response {
  return Response.json(
    { error: "invalid_input", issues: [{ path: "", message: "body must be JSON" }] },
    { status: 400 },
  );
}

export function serverError(error: unknown, context?: LogContext): Response {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : null;
  logError(context, "api.handler_error", error, {
    dependency: "aurora_postgres",
    failureClass: "dependency_error",
    sqlstate: code,
  });
  return Response.json({ error: "trace_failed", sqlstate: code }, { status: 500 });
}

function errorCode(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code: unknown }).code)
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isTimeoutLike(error: unknown): boolean {
  const code = errorCode(error);
  if (code && ["57014", "ETIMEDOUT", "ETIMEOUT", "ECONNABORTED"].includes(code)) return true;
  return /timeout|timed out|statement timeout|connection terminated due to connection timeout/i.test(
    errorMessage(error),
  );
}

export function traceFailure(error: unknown, context?: LogContext): Response {
  const code = errorCode(error);
  if (isTimeoutLike(error)) {
    logError(context, "trace.timeout", error, {
      dependency: "aurora_postgres",
      failureClass: "dependency_timeout",
      sqlstate: code,
    });
    return Response.json(
      {
        error: "trace_timeout",
        failureClass: "dependency_timeout",
        dependency: "aurora_postgres",
        retryable: true,
        sqlstate: code,
        message:
          "Aurora is scaling from zero ACU. Retry shortly; the database wake-up is bounded and did not hang.",
      },
      { status: 504, headers: { "Cache-Control": "no-store" } },
    );
  }

  return serverError(error, context);
}
