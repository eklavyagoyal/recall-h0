import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const expectedProject = {
  projectId: "prj_fpcTcY6LONlThOY98bsOJv3Tn08L",
  orgId: "team_vr98mdXQJyxKN5yAtBuO48T8",
  projectName: "recall-h0",
};

type VercelProject = {
  projectId?: unknown;
  orgId?: unknown;
  projectName?: unknown;
};

type VercelConfig = {
  crons?: unknown;
};

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(`${path} could not be read as JSON: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertEqual(label: string, actual: unknown, expected: string): void {
  if (actual !== expected) {
    throw new Error(`${label} must be ${expected}; got ${String(actual)}`);
  }
}

function outputText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return "";
}

function commandErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "unknown error";
  }
  const failure = error as { message?: unknown; stderr?: unknown; stdout?: unknown };
  const detail = [outputText(failure.stderr), outputText(failure.stdout)]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
  if (detail) return detail;
  return typeof failure.message === "string" ? failure.message : "unknown error";
}

function vercelCli(args: string[], label: string): string {
  try {
    const output = execFileSync("pnpm", ["exec", "vercel", ...args], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    if (!output) {
      throw new Error(`pnpm exec vercel ${args.join(" ")} returned no output`);
    }
    return output;
  } catch (error) {
    throw new Error(`${label} failed: ${commandErrorMessage(error)}`);
  }
}

function main(): void {
  const cliVersion = vercelCli(["--version"], "Vercel CLI version check");
  const vercelUser = vercelCli(["whoami"], "Vercel CLI authentication check");

  const project = readJson(".vercel/project.json") as VercelProject;
  assertEqual("Vercel projectId", project.projectId, expectedProject.projectId);
  assertEqual("Vercel orgId", project.orgId, expectedProject.orgId);
  assertEqual("Vercel projectName", project.projectName, expectedProject.projectName);

  const config = readJson("vercel.json") as VercelConfig;
  if (!Array.isArray(config.crons)) {
    throw new Error("vercel.json must define crons before production deploy");
  }

  const readyCron = config.crons.find((entry) => isRecord(entry) && entry.path === "/api/ready");
  if (!isRecord(readyCron)) {
    throw new Error("vercel.json must include a /api/ready warm cron");
  }
  assertEqual("/api/ready cron schedule", readyCron.schedule, "*/4 * * * *");

  console.log("Production deploy preflight");
  console.log(`- Vercel CLI: ${cliVersion}`);
  console.log(`- Authenticated Vercel user: ${vercelUser}`);
  console.log("- Local Vercel project link: recall-h0 / team_vr98mdXQJyxKN5yAtBuO48T8");
  console.log("- Warm cron target: /api/ready every four minutes");
  console.log("- Required account state: Vercel plan supports sub-daily Cron Jobs");
  console.log("- Boundary: this preflight does not deploy and cannot verify Vercel plan entitlement");
  console.log("");
  console.log("If the plan has been upgraded, run:");
  console.log("  pnpm submission:deploy:prod");
}

main();
