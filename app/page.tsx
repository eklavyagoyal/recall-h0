import { Console } from "@/components/console/Console";
import { DEMO_TLC } from "@/lib/config";
import { runTrace, TRACE_SQL } from "@/lib/db/queries/trace";
import type { TraceResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initial: TraceResult | null = null;
  let bootError: string | null = null;
  let bootCode: string | undefined;

  try {
    initial = await runTrace(DEMO_TLC);
  } catch (error) {
    bootError = error instanceof Error ? error.message : "Could not reach the database.";
    bootCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;
  }

  return (
    <Console
      initial={initial}
      initialTlc={DEMO_TLC}
      bootError={bootError}
      bootCode={bootCode}
      traceSql={TRACE_SQL}
    />
  );
}
