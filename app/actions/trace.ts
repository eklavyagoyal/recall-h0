"use server";

import { traceBodySchema } from "@/lib/api/schemas";
import { runTrace } from "@/lib/db/queries/trace";
import type { TraceResult } from "@/lib/types";

export type TraceActionResult =
  | { ok: true; data: TraceResult }
  | { ok: false; error: string; code?: string | undefined };

export async function traceAction(input: {
  tlc: string;
  asOf?: string | null;
}): Promise<TraceActionResult> {
  const parsed = traceBodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid Traceability Lot Code." };
  }

  try {
    const data = await runTrace(parsed.data.tlc, { asOf: parsed.data.asOf ?? null });
    return { ok: true, data };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;
    console.error("[traceAction] trace failed", error);
    return { ok: false, error: "Trace failed. Retry when the database is available.", code };
  }
}
