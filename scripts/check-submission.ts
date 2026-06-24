import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

type Check = {
  label: string;
  path: string;
  required: boolean;
  validate?: (contents: Buffer) => string | null;
};

type ImageExpectation = {
  label: string;
  path: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
};

const root = process.cwd();
const repoApiUrl = "https://api.github.com/repos/eklavyagoyal/recall-h0";
const repoHtmlUrl = "https://github.com/eklavyagoyal/recall-h0";
const liveUrl = "https://recall-h0.vercel.app";
const demoTlc = "PRD-OUTBREAK-0001";
const maxDemoDurationSeconds = 180;
const minDemoWidth = 1920;
const minDemoHeight = 1080;
const networkTimeoutMs = 15_000;
const traceTimeoutMs = 30_000;
const execFileAsync = promisify(execFile);

const expectedTraceMeta = {
  lotCount: 81,
  edgeCount: 80,
  storeCount: 1400,
  totalUnits: 674_285,
  incidentCount: 5,
};
const expectedExplainNodes = ["Recursive Union", "HNSW Index Scan", "GiST Spatial Path"];

const imageExpectations: ImageExpectation[] = [
  {
    label: "Architecture artifact dimensions",
    path: "docs/submission/architecture.png",
    minWidth: 1800,
    minHeight: 1000,
  },
  {
    label: "Live console screenshot dimensions",
    path: "docs/submission/hero-console.png",
    width: 1920,
    height: 1080,
  },
  {
    label: "Demo opening card dimensions",
    path: "docs/submission/demo-opening-card.png",
    width: 1920,
    height: 1080,
  },
  {
    label: "Demo end card dimensions",
    path: "docs/submission/demo-end-card.png",
    width: 1920,
    height: 1080,
  },
  {
    label: "Live EXPLAIN proof still dimensions",
    path: "docs/submission/db-proof-explain.png",
    width: 1920,
    height: 1080,
  },
  {
    label: "AWS DB proof composite dimensions",
    path: "docs/submission/db-proof.png",
    width: 1920,
    height: 1080,
  },
];

const checks: Check[] = [
  {
    label: "Published Vercel URL",
    path: "docs/submission/live-url.txt",
    required: true,
    validate: (contents) => (text(contents) === liveUrl ? null : `must equal ${liveUrl}`),
  },
  {
    label: "Vercel Team ID",
    path: "docs/submission/team-id.txt",
    required: true,
    validate: (contents) =>
      /^team_[A-Za-z0-9]+$/.test(text(contents)) ? null : "must look like team_<id>",
  },
  {
    label: "Submission package scripts",
    path: "package.json",
    required: true,
    validate: validateSubmissionPackageScripts,
  },
  {
    label: "Public repo command helper",
    path: "scripts/print-public-repo-command.ts",
    required: true,
    validate: validatePublicRepoCommandHelper,
  },
  {
    label: "Production deploy preflight",
    path: "scripts/preflight-prod-deploy.ts",
    required: true,
    validate: validateProdDeployPreflight,
  },
  {
    label: "Codex execution handoff",
    path: "docs/CODEX_HANDOFF_WIN.md",
    required: true,
    validate: validateCodexHandoff,
  },
  {
    label: "Vercel warm cron config",
    path: "vercel.json",
    required: true,
    validate: validateVercelCron,
  },
  {
    label: "Health endpoint source",
    path: "app/api/health/route.ts",
    required: true,
    validate: validateHealthEndpoint,
  },
  {
    label: "Readiness endpoint source",
    path: "app/api/ready/route.ts",
    required: true,
    validate: validateReadyEndpoint,
  },
  {
    label: "Warm cron runbook",
    path: "docs/ops/judging-warm-cron.md",
    required: true,
    validate: validateWarmCronRunbook,
  },
  {
    label: "Public repo rules proof",
    path: "docs/proof/h0-public-repo-rules.md",
    required: true,
    validate: validatePublicRepoProof,
  },
  {
    label: "v0 requirement proof",
    path: "docs/proof/h0-v0-requirement.md",
    required: true,
    validate: validateV0Proof,
  },
  {
    label: "Repository README",
    path: "README.md",
    required: true,
    validate: validateReadme,
  },
  {
    label: "Repository license",
    path: "LICENSE",
    required: true,
    validate: validateLicense,
  },
  {
    label: "Written submission",
    path: "docs/submission/submission.md",
    required: true,
    validate: validateSubmission,
  },
  {
    label: "Owner final handoff",
    path: "docs/submission/OWNER_FINAL_STEPS.md",
    required: true,
    validate: validateOwnerFinalSteps,
  },
  {
    label: "Devpost submission manifest",
    path: "docs/submission/MANIFEST.md",
    required: true,
    validate: validateSubmissionManifest,
  },
  {
    label: "Completion audit",
    path: "docs/submission/COMPLETION_AUDIT.md",
    required: true,
    validate: validateCompletionAudit,
  },
  {
    label: "Devpost field copy",
    path: "docs/submission/DEVPOST_FIELDS.md",
    required: true,
    validate: validateDevpostFields,
  },
  {
    label: "Demo recording checklist",
    path: "docs/submission/demo-script.md",
    required: true,
    validate: validateDemoScript,
  },
  {
    label: "AWS artifact shot list",
    path: "docs/submission/artifact-shot-list.md",
    required: true,
    validate: validateArtifactShotList,
  },
  {
    label: "Architecture artifact",
    path: "docs/submission/architecture.png",
    required: true,
    validate: png,
  },
  {
    label: "Live console screenshot",
    path: "docs/submission/hero-console.png",
    required: false,
    validate: png,
  },
  {
    label: "Demo opening card",
    path: "docs/submission/demo-opening-card.png",
    required: false,
    validate: png,
  },
  {
    label: "Demo end card",
    path: "docs/submission/demo-end-card.png",
    required: false,
    validate: png,
  },
  {
    label: "Live EXPLAIN proof screenshot",
    path: "docs/submission/db-proof-explain.png",
    required: false,
    validate: png,
  },
  {
    label: "AWS DB proof composite",
    path: "docs/submission/db-proof.png",
    required: true,
    validate: png,
  },
  {
    label: "Hosted demo video link",
    path: "docs/submission/demo-link.txt",
    required: true,
    validate: (contents) => {
      const value = text(contents);
      return validateHostedDemoUrlValue(value);
    },
  },
];

async function main(): Promise<void> {
  const failures: string[] = [];
  const rows: string[] = [];

  for (const check of checks) {
    const fullPath = join(root, check.path);
    const file = await read(fullPath);
    if (!file) {
      const status = check.required ? "MISSING" : "optional";
      rows.push(`${status.padEnd(8)} ${check.label} -> ${check.path}`);
      if (check.required) failures.push(`${check.label}: missing ${check.path}`);
      continue;
    }

    const validation = check.validate?.(file.contents) ?? null;
    if (validation) {
      rows.push(`INVALID  ${check.label} -> ${check.path} (${validation})`);
      failures.push(`${check.label}: ${validation}`);
      continue;
    }

    rows.push(`OK       ${check.label} -> ${check.path} (${formatBytes(file.size)})`);
  }

  await validateImageDimensions(rows, failures);

  const repoValidation = await validatePublicRepository();
  if (repoValidation) {
    rows.push(`INVALID  Public GitHub repository -> ${repoHtmlUrl} (${repoValidation})`);
    failures.push(`Public GitHub repository: ${repoValidation}`);
  } else {
    rows.push(`OK       Public GitHub repository -> ${repoHtmlUrl}`);
  }

  const liveValidation = await validateLiveDeployment();
  if (liveValidation) {
    rows.push(`INVALID  Published Vercel deployment -> ${liveUrl} (${liveValidation})`);
    failures.push(`Published Vercel deployment: ${liveValidation}`);
  } else {
    rows.push(`OK       Published Vercel deployment -> ${liveUrl}`);
  }

  const healthReadyValidation = await validateLiveHealthReady();
  if (healthReadyValidation) {
    rows.push(`INVALID  Live health/readiness probes -> ${liveUrl} (${healthReadyValidation})`);
    failures.push(`Live health/readiness probes: ${healthReadyValidation}`);
  } else {
    rows.push(`OK       Live health/readiness probes -> /api/health live, /api/ready ready`);
  }

  const traceValidation = await validateLiveTraceNumbers();
  if (traceValidation) {
    rows.push(`INVALID  Live demo trace numbers -> ${liveUrl}/api/trace (${traceValidation})`);
    failures.push(`Live demo trace numbers: ${traceValidation}`);
  } else {
    rows.push(
      `OK       Live demo trace numbers -> ${demoTlc} (${expectedTraceMeta.storeCount} stores, ${expectedTraceMeta.totalUnits} units, ${expectedTraceMeta.lotCount} lots, ${expectedTraceMeta.edgeCount} edges)`,
    );
  }

  const explainValidation = await validateLiveExplain();
  if (explainValidation) {
    rows.push(`INVALID  Live EXPLAIN proof nodes -> ${liveUrl}/api/explain (${explainValidation})`);
    failures.push(`Live EXPLAIN proof nodes: ${explainValidation}`);
  } else {
    rows.push(`OK       Live EXPLAIN proof nodes -> ${expectedExplainNodes.join(", ")}`);
  }

  const demoLink = await validateHostedDemoLink();
  if (demoLink.status === "invalid") {
    rows.push(`INVALID  Hosted demo video URL reachability -> ${demoLink.url} (${demoLink.message})`);
    failures.push(`Hosted demo video URL reachability: ${demoLink.message}`);
  } else if (demoLink.status === "ok") {
    rows.push(`OK       Hosted demo video URL reachability -> ${demoLink.url} (HTTP ${demoLink.statusCode})`);
  }

  const demoVideo = await validateDemoVideo();
  if (demoVideo.status === "missing") {
    rows.push(`MISSING  Demo video file -> docs/submission/demo.mp4`);
    failures.push("Demo video file: missing docs/submission/demo.mp4");
  } else if (demoVideo.status === "invalid") {
    rows.push(`INVALID  Demo video file -> docs/submission/demo.mp4 (${demoVideo.message})`);
    failures.push(`Demo video file: ${demoVideo.message}`);
  } else {
    rows.push(
      `OK       Demo video file -> docs/submission/demo.mp4 (${formatBytes(demoVideo.size)}, ${demoVideo.duration.toFixed(1)}s, ${demoVideo.width}x${demoVideo.height})`,
    );
  }

  console.log("Submission readiness check\n");
  console.log(rows.join("\n"));

  if (failures.length > 0) {
    console.log(`\nMissing or invalid required submission assets:\n- ${failures.join("\n- ")}\n`);
    console.log(ownerNextSteps());
    process.exit(1);
  }

  console.log("\nSubmission assets are staged.");
}

function ownerNextSteps(): string {
  return `Human-owned next steps:
1. Confirm the account-level visibility change, then run:
   pnpm submission:print-public-repo-command
   gh repo edit eklavyagoyal/recall-h0 --description 'Recall traces a foodborne outbreak to every affected shelf with one serializable Aurora PostgreSQL query.' --homepage 'https://recall-h0.vercel.app' --visibility public
2. Upgrade the Vercel team/project to a plan that supports sub-daily Cron Jobs for the */4 judging warm cron, then run the preflight and deploy this source to production. The preflight checks Vercel CLI auth, local project link, and cron config without deploying; it cannot verify plan entitlement. Wait for https://recall-h0.vercel.app/api/health and /api/ready to reflect it:
   pnpm submission:preflight:prod
   pnpm submission:deploy:prod
3. Record/export docs/submission/demo.mp4 from https://recall-h0.vercel.app, then verify:
   ffprobe -v error -show_entries format=duration -of csv=p=0 docs/submission/demo.mp4
   ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 docs/submission/demo.mp4
4. Upload the demo and stage the hosted URL; it must be the demo video URL, not the live app or repository URL:
   printf '%s\\n' '<unlisted demo video URL>' > docs/submission/demo-link.txt
5. Capture docs/submission/db-proof-rds.png and docs/submission/db-proof-acu.png from the owner AWS console, then run:
   pnpm submission:compose-db-proof
6. Paste the same hosted demo URL into docs/submission/submission.md and remove the repo visibility pending note.
7. Run final gates:
   pnpm submission:check
   pnpm verify
   pnpm build
   BASE_URL=https://recall-h0.vercel.app pnpm test:smoke

Do not run pnpm db:migrate, pnpm db:seed, or secret-fetch commands as part of final submission.`;
}

type LinkValidation =
  | { status: "skip" }
  | { status: "ok"; url: string; statusCode: number }
  | { status: "invalid"; url: string; message: string };

async function validateHostedDemoLink(): Promise<LinkValidation> {
  const url = readOptionalText("docs/submission/demo-link.txt");
  if (!url) {
    return { status: "skip" };
  }
  const localValidation = validateHostedDemoUrlValue(url);
  if (localValidation) return { status: "invalid", url, message: localValidation };

  const head = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" });
  if (head.ok) {
    await head.response.body?.cancel().catch(() => {});
    if (head.response.ok) return { status: "ok", url, statusCode: head.response.status };
    if (![403, 405].includes(head.response.status)) {
      return { status: "invalid", url, message: `returned HTTP ${head.response.status}` };
    }
  }

  const get = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
  if (!get.ok) return { status: "invalid", url, message: get.error };
  await get.response.body?.cancel().catch(() => {});
  if (!get.response.ok) return { status: "invalid", url, message: `returned HTTP ${get.response.status}` };
  return { status: "ok", url, statusCode: get.response.status };
}

function validateHostedDemoUrlValue(value: string): string | null {
  if (!/^https:\/\/\S+$/.test(value)) return "must be an https URL";
  if (/todo|pending|example/i.test(value)) return "must be the real hosted video URL";

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "must be a valid URL";
  }

  const live = new URL(liveUrl);
  if (parsed.origin === live.origin) return "must be a hosted demo video URL, not the live app URL";

  const repo = new URL(repoHtmlUrl);
  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  const repoPath = repo.pathname.replace(/\/+$/, "");
  if (parsed.origin === repo.origin && normalizedPath === repoPath) {
    return "must be a hosted demo video URL, not the repository URL";
  }

  return null;
}

type TraceApiResponse = {
  meta?: {
    lotCount?: unknown;
    edgeCount?: unknown;
    storeCount?: unknown;
    totalUnits?: unknown;
  };
  incidents?: unknown;
};

type ExplainApiResponse = {
  plan?: unknown;
  nodes?: unknown;
};

type HealthApiResponse = {
  status?: unknown;
  process?: unknown;
};

type ReadyApiResponse = {
  status?: unknown;
  db?: unknown;
  latencyMs?: unknown;
};

async function validateLiveHealthReady(): Promise<string | null> {
  const [healthIssue, readyIssue] = await Promise.all([validateLiveHealth(), validateLiveReady()]);
  const issues = [healthIssue, readyIssue].filter((issue): issue is string => issue !== null);
  return issues.length > 0 ? issues.join("; ") : null;
}

async function validateLiveHealth(): Promise<string | null> {
  const health = await fetchWithTimeout(`${liveUrl}/api/health`);
  if (!health.ok) return `health ${health.error}`;
  if (!health.response.ok) {
    const hint = health.response.status === 404 ? "; production does not include the current health route yet" : "";
    return `health returned HTTP ${health.response.status}${hint}`;
  }

  let healthBody: HealthApiResponse;
  try {
    healthBody = (await health.response.json()) as HealthApiResponse;
  } catch {
    return "health response was not JSON";
  }
  if (healthBody.status !== "live" || healthBody.process !== "up") {
    return `health returned unexpected body ${JSON.stringify(healthBody)}`;
  }
  return null;
}

async function validateLiveReady(): Promise<string | null> {
  const ready = await fetchWithTimeout(`${liveUrl}/api/ready`);
  if (!ready.ok) return `ready ${ready.error}`;
  if (!ready.response.ok) {
    const hint = ready.response.status === 404 ? "; production does not include the current readiness route yet" : "";
    return `ready returned HTTP ${ready.response.status}${hint}`;
  }

  let readyBody: ReadyApiResponse;
  try {
    readyBody = (await ready.response.json()) as ReadyApiResponse;
  } catch {
    return "ready response was not JSON";
  }
  if (readyBody.status !== "ready" || readyBody.db !== "up") {
    return `ready returned unexpected body ${JSON.stringify(readyBody)}`;
  }
  if (typeof readyBody.latencyMs !== "number" || !Number.isFinite(readyBody.latencyMs)) {
    return "ready response missing numeric latencyMs";
  }
  return null;
}

async function validateLiveTraceNumbers(): Promise<string | null> {
  const result = await fetchWithTimeout(
    `${liveUrl}/api/trace`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tlc: demoTlc }),
    },
    traceTimeoutMs,
  );
  if (!result.ok) return result.error;

  if (!result.response.ok) return `returned HTTP ${result.response.status}`;

  let body: TraceApiResponse;
  try {
    body = (await result.response.json()) as TraceApiResponse;
  } catch {
    return "response was not JSON";
  }

  const meta = body.meta;
  if (!meta) return "missing meta";
  const actual = {
    lotCount: meta.lotCount,
    edgeCount: meta.edgeCount,
    storeCount: meta.storeCount,
    totalUnits: meta.totalUnits,
    incidentCount: Array.isArray(body.incidents) ? body.incidents.length : null,
  };

  const mismatches = Object.entries(expectedTraceMeta)
    .filter(([key, expected]) => actual[key as keyof typeof actual] !== expected)
    .map(([key, expected]) => `${key} expected ${expected}, got ${String(actual[key as keyof typeof actual])}`);

  return mismatches.length > 0 ? mismatches.join("; ") : null;
}

async function validateLiveExplain(): Promise<string | null> {
  const result = await fetchWithTimeout(
    `${liveUrl}/api/explain`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tlc: demoTlc }),
    },
    traceTimeoutMs,
  );
  if (!result.ok) return result.error;

  if (!result.response.ok) return `returned HTTP ${result.response.status}`;

  let body: ExplainApiResponse;
  try {
    body = (await result.response.json()) as ExplainApiResponse;
  } catch {
    return "response was not JSON";
  }

  if (typeof body.plan !== "string" || body.plan.length < 100) return "missing text plan";
  const plan = body.plan;
  if (!Array.isArray(body.nodes)) return "missing annotated nodes";

  const nodeTypes = body.nodes
    .map((node) => (isRecord(node) && typeof node.type === "string" ? node.type : null))
    .filter((node): node is string => node !== null);
  const missingNodes = expectedExplainNodes.filter((expected) => !nodeTypes.includes(expected));
  if (missingNodes.length > 0) return `missing ${missingNodes.join(", ")}`;

  const requiredPlanText = ["Recursive Union", "idx_incidents_hnsw", "idx_stores_geom", "Index Scan"];
  const missingPlanText = requiredPlanText.filter((text) => !plan.includes(text));
  return missingPlanText.length > 0 ? `plan missing ${missingPlanText.join(", ")}` : null;
}

async function validateImageDimensions(rows: string[], failures: string[]): Promise<void> {
  for (const expectation of imageExpectations) {
    const fullPath = join(root, expectation.path);
    try {
      const info = await stat(fullPath);
      if (!info.isFile()) {
        rows.push(`INVALID  ${expectation.label} -> ${expectation.path} (not a file)`);
        failures.push(`${expectation.label}: not a file`);
        continue;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(fullPath).metadata();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      const message = error instanceof Error ? error.message : "could not read image metadata";
      rows.push(`INVALID  ${expectation.label} -> ${expectation.path} (${message})`);
      failures.push(`${expectation.label}: ${message}`);
      continue;
    }

    const { width, height } = metadata;
    if (!width || !height) {
      rows.push(`INVALID  ${expectation.label} -> ${expectation.path} (missing dimensions)`);
      failures.push(`${expectation.label}: missing dimensions`);
      continue;
    }

    const exactMismatch =
      (expectation.width !== undefined && width !== expectation.width) ||
      (expectation.height !== undefined && height !== expectation.height);
    if (exactMismatch) {
      const expected = `${expectation.width ?? "*"}x${expectation.height ?? "*"}`;
      rows.push(`INVALID  ${expectation.label} -> ${expectation.path} (expected ${expected}, got ${width}x${height})`);
      failures.push(`${expectation.label}: expected ${expected}, got ${width}x${height}`);
      continue;
    }

    const minMismatch =
      (expectation.minWidth !== undefined && width < expectation.minWidth) ||
      (expectation.minHeight !== undefined && height < expectation.minHeight);
    if (minMismatch) {
      const expected = `at least ${expectation.minWidth ?? 0}x${expectation.minHeight ?? 0}`;
      rows.push(`INVALID  ${expectation.label} -> ${expectation.path} (expected ${expected}, got ${width}x${height})`);
      failures.push(`${expectation.label}: expected ${expected}, got ${width}x${height}`);
      continue;
    }

    rows.push(`OK       ${expectation.label} -> ${expectation.path} (${width}x${height})`);
  }
}

async function validateLiveDeployment(): Promise<string | null> {
  const response = await fetchWithTimeout(liveUrl);
  if (!response.ok) return response.error;
  if (!response.response.ok) return `returned HTTP ${response.response.status}`;

  const html = await response.response.text();
  if (!html.includes("Recall")) return "response does not contain Recall";
  if (!html.includes("The Outbreak Console")) return "response does not contain The Outbreak Console";
  return null;
}

type DemoVideoResult =
  | { status: "ok"; duration: number; size: number; width: number; height: number }
  | { status: "missing" }
  | { status: "invalid"; message: string };

type FfprobePayload = {
  streams?: {
    codec_type?: unknown;
    width?: unknown;
    height?: unknown;
  }[];
  format?: {
    duration?: unknown;
  };
};

async function validateDemoVideo(): Promise<DemoVideoResult> {
  const path = join(root, "docs/submission/demo.mp4");
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing" };
    throw error;
  }

  if (!info.isFile() || info.size === 0) {
    return { status: "invalid", message: "must be a non-empty MP4 file" };
  }

  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height",
      "-of",
      "json",
      path,
    ]);
    let payload: FfprobePayload;
    try {
      payload = JSON.parse(stdout) as FfprobePayload;
    } catch {
      return { status: "invalid", message: "ffprobe returned unreadable JSON" };
    }

    const duration = Number.parseFloat(String(payload.format?.duration ?? ""));
    if (!Number.isFinite(duration)) return { status: "invalid", message: "ffprobe could not read duration" };
    if (duration >= maxDemoDurationSeconds) {
      return {
        status: "invalid",
        message: `must be < ${maxDemoDurationSeconds}s; got ${duration.toFixed(1)}s`,
      };
    }

    const videoStream = payload.streams?.find((stream) => stream.codec_type === "video");
    if (!videoStream) return { status: "invalid", message: "ffprobe could not find a video stream" };
    const width = Number(videoStream.width);
    const height = Number(videoStream.height);
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      return { status: "invalid", message: "ffprobe could not read video dimensions" };
    }
    if (width < minDemoWidth || height < minDemoHeight) {
      return {
        status: "invalid",
        message: `must be at least ${minDemoWidth}x${minDemoHeight}; got ${width}x${height}`,
      };
    }

    return { status: "ok", duration, size: info.size, width, height };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { status: "invalid", message: "ffprobe is not installed" };
    const message = error instanceof Error ? error.message : "unknown ffprobe error";
    return { status: "invalid", message: `ffprobe failed: ${message}` };
  }
}

type GitHubRepository = {
  private?: boolean;
  html_url?: string;
  homepage?: string | null;
  description?: string | null;
  default_branch?: string;
};

async function validatePublicRepository(): Promise<string | null> {
  try {
    const apiResult = await fetchWithTimeout(repoApiUrl, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "recall-submission-check",
      },
    });
    if (!apiResult.ok) return apiResult.error;
    const response = apiResult.response;

    if (response.status === 404) {
      return "repo is not public or does not exist";
    }
    if (!response.ok) {
      return `GitHub API returned HTTP ${response.status}`;
    }

    const repo = (await response.json()) as GitHubRepository;
    if (repo.private !== false) return "repo is not public";
    if (repo.html_url !== repoHtmlUrl) return `must resolve to ${repoHtmlUrl}`;
    if (repo.homepage !== liveUrl) return `homepage must equal ${liveUrl}`;
    if (!repo.description || repo.description.trim().length < 20) {
      return "description must be set to the project thesis";
    }
    if (!repo.default_branch) return "default branch is missing";

    const [readme, license, packageJson, vercelConfig, healthRoute, readyRoute] = await Promise.all([
      fetchGitHubFile("README.md", repo.default_branch),
      fetchGitHubFile("LICENSE", repo.default_branch),
      fetchGitHubFile("package.json", repo.default_branch),
      fetchGitHubFile("vercel.json", repo.default_branch),
      fetchGitHubFile("app/api/health/route.ts", repo.default_branch),
      fetchGitHubFile("app/api/ready/route.ts", repo.default_branch),
    ]);
    if ("error" in readme) return `public README.md ${readme.error}`;
    const readmeValidation = validateReadme(Buffer.from(readme.contents));
    if (readmeValidation) return `public README.md ${readmeValidation}`;
    if ("error" in license) return `public LICENSE ${license.error}`;
    const licenseValidation = validateLicense(Buffer.from(license.contents));
    if (licenseValidation) return `public LICENSE ${licenseValidation}`;
    if ("error" in packageJson) return `public package.json ${packageJson.error}`;
    const packageValidation = validateSubmissionPackageScripts(Buffer.from(packageJson.contents));
    if (packageValidation) return `public package.json ${packageValidation}`;
    if ("error" in vercelConfig) return `public vercel.json ${vercelConfig.error}`;
    const vercelValidation = validateVercelCron(Buffer.from(vercelConfig.contents));
    if (vercelValidation) return `public vercel.json ${vercelValidation}`;
    if ("error" in healthRoute) return `public app/api/health/route.ts ${healthRoute.error}`;
    const healthValidation = validateHealthEndpoint(Buffer.from(healthRoute.contents));
    if (healthValidation) return `public app/api/health/route.ts ${healthValidation}`;
    if ("error" in readyRoute) return `public app/api/ready/route.ts ${readyRoute.error}`;
    const readyValidation = validateReadyEndpoint(Buffer.from(readyRoute.contents));
    if (readyValidation) return `public app/api/ready/route.ts ${readyValidation}`;

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return `could not verify via GitHub API: ${message}`;
  }
}

type GitHubFile =
  | { contents: string; error?: never }
  | { contents?: never; error: string };

async function fetchGitHubFile(path: string, branch: string): Promise<GitHubFile> {
  const result = await fetchWithTimeout(`${repoApiUrl}/contents/${path}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      accept: "application/vnd.github.raw",
      "user-agent": "recall-submission-check",
    },
  });
  if (!result.ok) return { error: result.error };
  const response = result.response;
  if (response.status === 404) return { error: "is missing from the public repo" };
  if (!response.ok) return { error: `returned HTTP ${response.status}` };
  return { contents: await response.text() };
}

type FetchResult =
  | { ok: true; response: Response }
  | { ok: false; error: string };

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = networkTimeoutMs,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { ok: true, response };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown network error";
    return { ok: false, error: `could not fetch ${url}: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

async function read(path: string): Promise<{ contents: Buffer; size: number } | null> {
  try {
    const [contents, info] = await Promise.all([readFile(path), stat(path)]);
    if (!info.isFile() || info.size === 0) return null;
    return { contents, size: info.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function text(contents: Buffer): string {
  return contents.toString("utf8").trim();
}

function validateReadme(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["live URL", /https:\/\/recall-h0\.vercel\.app/],
    ["hero SQL", /WITH RECURSIVE/],
    ["architecture artifact", /docs\/submission\/architecture\.png/],
    ["Aurora PostgreSQL", /Aurora PostgreSQL/],
    ["PostGIS", /PostGIS/],
    ["pgvector", /pgvector/],
    ["1,400 stores", /`1,400` affected stores/],
    ["674,285 units", /`674,285` recalled units/],
    ["81 lots", /`81` contaminated lots/],
    ["80 edges", /`80` supply-chain edges/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateLicense(contents: Buffer): string | null {
  const value = text(contents);
  if (!value.startsWith("MIT License")) return "must be MIT License";
  if (!value.includes("Permission is hereby granted")) return "missing MIT permission grant";
  return null;
}

function validateSubmissionPackageScripts(contents: Buffer): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text(contents));
  } catch {
    return "must be valid JSON";
  }

  if (!isRecord(parsed)) return "must be a JSON object";
  const scripts = parsed.scripts;
  if (!isRecord(scripts)) return "must define scripts";

  const expectedScripts: [string, string][] = [
    ["verify", "pnpm typecheck && pnpm lint && pnpm test"],
    ["build", "next build --webpack"],
    ["test:smoke", "playwright test"],
    ["submission:check", "tsx scripts/check-submission.ts"],
    ["submission:compose-db-proof", "tsx scripts/compose-db-proof.ts"],
    ["submission:deploy:prod", "vercel deploy --prod --yes"],
    ["submission:preflight:prod", "tsx scripts/preflight-prod-deploy.ts"],
    ["submission:print-public-repo-command", "tsx scripts/print-public-repo-command.ts"],
    ["submission:render-demo-cards", "tsx scripts/render-demo-cards.ts"],
  ];
  const mismatches = expectedScripts
    .filter(([name, expected]) => scripts[name] !== expected)
    .map(([name]) => name);
  return mismatches.length > 0 ? `missing or changed scripts ${mismatches.join(", ")}` : null;
}

function validatePublicRepoCommandHelper(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["public repo command", /gh repo edit eklavyagoyal\/recall-h0[\s\S]*--visibility public/],
    ["repo description", /--description 'Recall traces a foodborne outbreak to every affected shelf with one serializable Aurora PostgreSQL query\.'/],
    ["repo homepage", /--homepage 'https:\/\/recall-h0\.vercel\.app'/],
    ["confirmation warning", /Owner confirmation required before changing repository visibility/],
    ["non-execution warning", /only prints the command; it does not execute gh/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  if (missing.length > 0) return `missing ${missing.join(", ")}`;

  const forbidden = value.match(/\b(exec|execFile|spawn|spawnSync|fork)\b|child_process|execa/);
  if (forbidden) return `must not execute shell commands; found "${forbidden[0]}"`;
  return null;
}

function validateProdDeployPreflight(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["linked project ID", /prj_fpcTcY6LONlThOY98bsOJv3Tn08L/],
    ["linked team ID", /team_vr98mdXQJyxKN5yAtBuO48T8/],
    ["project name", /recall-h0/],
    ["vercel project file", /\.vercel\/project\.json/],
    ["vercel config file", /vercel\.json/],
    ["Vercel CLI runner", /execFileSync\("pnpm", \["exec", "vercel"/],
    ["Vercel CLI version check", /--version/],
    ["Vercel CLI auth check", /whoami/],
    ["ready cron path", /\/api\/ready/],
    ["four-minute cron", /\*\/4 \* \* \* \*/],
    ["sub-daily plan warning", /Vercel plan supports sub-daily Cron Jobs/],
    ["non-deploying boundary", /does not deploy/],
    ["plan entitlement boundary", /cannot verify Vercel plan entitlement/],
    ["deploy command", /pnpm submission:deploy:prod/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateCodexHandoff(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["current status section", /## 0\. CURRENT EXECUTION STATUS . 2026-06-24/],
    ["fresh readiness command", /Fresh readiness command:\*\* `pnpm submission:check`/],
    ["local gates", /`pnpm verify`, `pnpm build`, `BASE_URL=https:\/\/recall-h0\.vercel\.app pnpm test:smoke`, and `git diff --check`/],
    ["live trace numbers", /`1,400` stores, `674,285` units, `81` lots, `80` edges/],
    ["live health blocker", /live `\/api\/health` returns 404/],
    ["Vercel Hobby cron blocker", /Vercel Hobby plan blocks the `\*\/4 \* \* \* \*` judging warm cron/],
    ["deploy preflight", /pnpm submission:preflight:prod/],
    ["deploy script", /pnpm submission:deploy:prod/],
    ["repo visibility helper", /pnpm submission:print-public-repo-command/],
    ["demo artifact blockers", /docs\/submission\/demo\.mp4[\s\S]*docs\/submission\/demo-link\.txt/],
    ["AWS proof blockers", /docs\/submission\/db-proof-rds\.png[\s\S]*docs\/submission\/db-proof-acu\.png[\s\S]*pnpm submission:compose-db-proof/],
    ["pending note blocker", /visibility flip pending owner confirmation/],
    ["owner final steps file", /docs\/submission\/OWNER_FINAL_STEPS\.md/],
    ["manifest file", /docs\/submission\/MANIFEST\.md/],
    ["completion audit file", /docs\/submission\/COMPLETION_AUDIT\.md/],
    ["Devpost fields file", /docs\/submission\/DEVPOST_FIELDS\.md/],
    ["checker file", /scripts\/check-submission\.ts/],
    ["DB guardrail", /Do not run `pnpm db:migrate`, `pnpm db:seed`, or secret-fetch commands/],
    ["repo visibility guardrail", /Do not flip repo\s+visibility without owner confirmation/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateVercelCron(contents: Buffer): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text(contents));
  } catch {
    return "must be valid JSON";
  }

  if (!isRecord(parsed)) return "must be a JSON object";
  const regions = parsed.regions;
  if (!Array.isArray(regions) || !regions.includes("iad1")) return "must include iad1 region";

  const crons = parsed.crons;
  if (!Array.isArray(crons)) return "must define crons";
  const readyCron = crons.find((entry): entry is Record<string, unknown> => isRecord(entry) && entry.path === "/api/ready");
  if (!readyCron) return "must define a cron for /api/ready";
  if (readyCron.schedule !== "*/4 * * * *") return "must run /api/ready every four minutes";
  return null;
}

function validateHealthEndpoint(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["node runtime", /runtime\s*=\s*"nodejs"/],
    ["force dynamic", /dynamic\s*=\s*"force-dynamic"/],
    ["live status body", /status:\s*"live"/],
    ["process up body", /process:\s*"up"/],
    ["no-store headers", /noStoreHeaders/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateReadyEndpoint(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["node runtime", /runtime\s*=\s*"nodejs"/],
    ["force dynamic", /dynamic\s*=\s*"force-dynamic"/],
    ["maxDuration", /maxDuration\s*=\s*15/],
    ["bounded statement timeout", /SET LOCAL statement_timeout = '3000ms'/],
    ["cheap readiness query", /SELECT 1/],
    ["503 not-ready response", /status:\s*503/],
    ["db down body", /db:\s*"down"/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateWarmCronRunbook(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["cron path", /\/api\/ready/],
    ["four-minute schedule", /\*\/4 \* \* \* \*/],
    ["bounded SELECT 1", /bounded `SELECT 1`/],
    ["rollback", /remove the `crons` entry/],
    ["health semantics", /\/api\/health` is liveness/],
    ["ready 503 semantics", /returns `200` when DB answers, `503`/],
    ["plan prerequisite", /Plan prerequisite/],
    ["Hobby deploy failure", /Hobby accounts are limited to daily cron jobs/],
    ["sub-daily cron support", /supports sub-daily Cron Jobs/],
    ["fallback warning", /lower-reliability fallback, not the target/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validatePublicRepoProof(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["date checked", /Date checked: 2026-06-24/],
    ["rules source", /https:\/\/h01\.devpost\.com\/rules/],
    ["overview source", /https:\/\/h01\.devpost\.com\//],
    ["resources source", /https:\/\/h01\.devpost\.com\/resources/],
    ["public allowed conclusion", /public repository visibility is allowed/],
    ["public review requirement", /repository must be public for review/],
    ["credentials warning", /keep AWS credentials out of the repository/],
    ["owner confirmation", /confirmed by the owner before running `gh repo edit/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateV0Proof(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["date checked", /Date checked: 2026-06-24/],
    ["resources source", /https:\/\/h01\.devpost\.com\/resources/],
    ["overview source", /https:\/\/h01\.devpost\.com\//],
    ["not mandatory conclusion", /not mandatory for eligibility/],
    ["recommended not required", /recommended\s+for speed, not required/],
    ["Vercel deployment requirement", /must deploy on Vercel/],
    ["Recall live URL", /https:\/\/recall-h0\.vercel\.app/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateSubmission(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["live URL", /https:\/\/recall-h0\.vercel\.app/],
    ["GitHub URL", /https:\/\/github\.com\/eklavyagoyal\/recall-h0/],
    ["Vercel Team ID", /team_vr98mdXQJyxKN5yAtBuO48T8/],
    ["Aurora PostgreSQL", /Amazon Aurora PostgreSQL/],
    ["PRD-OUTBREAK-0001", /PRD-OUTBREAK-0001/],
    ["1,400 stores", /1,400 affected stores/],
    ["674,285 units", /674,285 units/],
    ["81 lots", /81 contaminated lots/],
    ["80 edges", /80 edges/],
    ["Outbreak Time-Travel", /Outbreak Time-Travel/],
    ["Query Inspector", /Query Inspector/],
    ["v0 status", /v0 status/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  if (missing.length > 0) return `missing ${missing.join(", ")}`;

  const unresolved = value.match(/visibility flip pending|pending owner|todo|tbd|placeholder/i);
  if (unresolved) return `contains unresolved marker "${unresolved[0]}"`;

  const demoLink = readOptionalText("docs/submission/demo-link.txt");
  if (!demoLink) return "missing hosted demo URL in writeup";
  if (!value.includes(demoLink)) return `must include hosted demo URL ${demoLink}`;

  return null;
}

function validateOwnerFinalSteps(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["print-only helper", /pnpm submission:print-public-repo-command/],
    ["public repo command", /gh repo edit eklavyagoyal\/recall-h0[\s\S]*--visibility public/],
    ["repo description", /--description 'Recall traces a foodborne outbreak to every affected shelf with one serializable Aurora PostgreSQL query\.'/],
    ["repo homepage", /--homepage 'https:\/\/recall-h0\.vercel\.app'/],
    ["public default branch source check", /`README\.md`, `LICENSE`, `package\.json`, `vercel\.json`, and the current `\/api\/health` plus\s+`\/api\/ready` route sources on the public default branch/],
    ["production deploy step", /Ensure the production Vercel deployment includes this source/],
    ["Hobby cron blocker", /Vercel Hobby plan[\s\S]*does not allow the `\*\/4 \* \* \* \*` judging warm cron/],
    ["plan prerequisite", /supports sub-daily Cron Jobs/],
    ["Vercel preflight command", /pnpm submission:preflight:prod/],
    ["Vercel deploy command", /pnpm submission:deploy:prod/],
    ["live probe verification", /verifies the production deployment exposes `\/api\/health`, `\/api\/ready`/],
    ["ffprobe duration check", /ffprobe -v error -show_entries format=duration -of csv=p=0 docs\/submission\/demo\.mp4/],
    ["ffprobe dimension check", /ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 docs\/submission\/demo\.mp4/],
    ["hosted demo link staging", /printf '%s\\n' '<unlisted demo video URL>' > docs\/submission\/demo-link\.txt/],
    ["hosted demo URL distinction", /not the live app or repository URL/],
    ["RDS proof source", /docs\/submission\/db-proof-rds\.png/],
    ["CloudWatch ACU proof source", /docs\/submission\/db-proof-acu\.png/],
    ["DB proof compose command", /pnpm submission:compose-db-proof/],
    ["DB proof output dimensions", /docs\/submission\/db-proof\.png`, `1920x1080`/],
    ["remove visibility note", /Remove the `visibility flip pending owner confirmation` note/],
    ["paste demo URL", /Add the hosted demo video URL/],
    ["verified 1,400 stores", /`1,400` stores/],
    ["verified 674,285 units", /`674,285` units/],
    ["verified 81 lots", /`81` lots/],
    ["verified 80 edges", /`80` edges/],
    ["submission check gate", /pnpm submission:check/],
    ["verify gate", /pnpm verify/],
    ["build gate", /pnpm build/],
    ["live smoke gate", /BASE_URL=https:\/\/recall-h0\.vercel\.app pnpm test:smoke/],
    ["migration guardrail", /Do not run `pnpm db:migrate`/],
    ["seed guardrail", /`pnpm db:seed`/],
    ["secret-fetch guardrail", /secret-fetch commands/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateSubmissionManifest(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["manifest title", /# Devpost Submission Manifest/],
    ["submission check preflight", /Run `pnpm submission:check` before copying fields into Devpost/],
    ["live URL source", /\| Published Vercel project link \| `docs\/submission\/live-url\.txt` \| Ready/],
    ["live trace recheck", /\| Live demo trace numbers \| `PRD-OUTBREAK-0001` via `\/api\/trace` \| Ready/],
    ["live EXPLAIN recheck", /\| Live EXPLAIN proof nodes \| `PRD-OUTBREAK-0001` via `\/api\/explain` \| Ready/],
    ["team ID source", /\| Vercel Team ID \| `docs\/submission\/team-id\.txt` \| Ready/],
    ["warm cron source", /\| Judging warm cron \| `vercel\.json`, `app\/api\/ready\/route\.ts`, `docs\/ops\/judging-warm-cron\.md` \| Ready/],
    ["rules proof source", /\| H0 rules proof \| `docs\/proof\/h0-public-repo-rules\.md`, `docs\/proof\/h0-v0-requirement\.md` \| Ready/],
    ["public repo pending", /\| Public GitHub repository \| `https:\/\/github\.com\/eklavyagoyal\/recall-h0` \| Pending owner visibility confirmation \|/],
    ["public repo source sync", /\| Public README, LICENSE, and source sync \| `README\.md`, `LICENSE`, `package\.json`, `vercel\.json`, `app\/api\/health\/route\.ts`, `app\/api\/ready\/route\.ts` \| Ready locally; rechecked via GitHub default branch after visibility flip \|/],
    ["production deployment sync", /\| Production deployment source sync \| `https:\/\/recall-h0\.vercel\.app\/api\/health`, `\/api\/ready` \| Pending Vercel plan support for `\*\/4` warm cron and current-source deploy; rechecked live by `pnpm submission:check` \|/],
    ["written submission pending", /\| Written description \| `docs\/submission\/submission\.md` \| Pending final demo URL paste and removal of owner-pending note \|/],
    ["architecture artifact source", /\| Architecture diagram \| `docs\/submission\/architecture\.png` \| Ready/],
    ["EXPLAIN proof still source", /\| Live EXPLAIN proof still \| `docs\/submission\/db-proof-explain\.png` \| Ready \|/],
    ["RDS source pending", /\| RDS console source still \| `docs\/submission\/db-proof-rds\.png` \| Pending owner AWS console capture \|/],
    ["CloudWatch source pending", /\| CloudWatch ACU source still \| `docs\/submission\/db-proof-acu\.png` \| Pending owner AWS console capture \|/],
    ["DB proof pending", /\| AWS DB usage proof screenshot \| `docs\/submission\/db-proof\.png` \| Pending `pnpm submission:compose-db-proof` after owner captures; final PNG must be 1920x1080 \|/],
    ["demo MP4 pending", /\| Demo video file \| `docs\/submission\/demo\.mp4` \| Pending owner recording\/export; must be <3:00 and at least 1920x1080 by `ffprobe` \|/],
    ["demo link pending", /\| Hosted demo video URL \| `docs\/submission\/demo-link\.txt` \| Pending owner recording\/upload; must be the hosted demo video URL, not the live app or repository URL; reachability rechecked by `pnpm submission:check` \|/],
    ["gallery screenshot source", /\| Gallery screenshot \| `docs\/submission\/hero-console\.png` \| Ready; 1920x1080 \|/],
    ["demo cards source", /`docs\/submission\/demo-opening-card\.png`[\s\S]*`docs\/submission\/demo-end-card\.png`/],
    ["demo checklist source", /\| Demo recording checklist \| `docs\/submission\/demo-script\.md` \| Ready \|/],
    ["AWS shot-list source", /\| AWS artifact shot list \| `docs\/submission\/artifact-shot-list\.md` \| Ready \|/],
    ["completion audit source", /\| Completion audit \| `docs\/submission\/COMPLETION_AUDIT\.md` \| Ready; current blocker map \|/],
    ["Devpost field copy source", /\| Devpost field copy \| `docs\/submission\/DEVPOST_FIELDS\.md` \| Ready; paste only after final gates pass \|/],
    ["Codex handoff source", /\| Codex execution handoff \| `docs\/CODEX_HANDOFF_WIN\.md` \| Ready; current execution status at top \|/],
    ["owner handoff source", /\| Owner final handoff \| `docs\/submission\/OWNER_FINAL_STEPS\.md` \| Ready \|/],
    ["print-only helper", /pnpm submission:print-public-repo-command/],
    ["public repo command", /gh repo edit eklavyagoyal\/recall-h0[\s\S]*--visibility public/],
    ["Vercel preflight command", /pnpm submission:preflight:prod/],
    ["Vercel deploy command", /pnpm submission:deploy:prod/],
    ["ffprobe command", /ffprobe -v error -show_entries format=duration -of csv=p=0 docs\/submission\/demo\.mp4/],
    ["ffprobe dimensions command", /ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 docs\/submission\/demo\.mp4/],
    ["DB proof compose command", /pnpm submission:compose-db-proof/],
    ["demo link command", /printf '%s\\n' '<unlisted demo video URL>' > docs\/submission\/demo-link\.txt/],
    ["final submission check", /pnpm submission:check/],
    ["no placeholder instruction", /Do not create placeholder `demo-link\.txt`, `demo\.mp4`, or `db-proof\.png`/],
    ["real artifact requirement", /intentionally fails until the repo is public, the real <3:00 exported demo exists, the real hosted/],
    ["demo URL distinction", /demo URL is not the live app or repository URL/],
    ["DB proof output instruction", /run\s+`pnpm submission:compose-db-proof` to generate the final `db-proof\.png` composite/],
    ["Hobby cron blocker", /production deploy attempt failed on Hobby before build/],
    ["sub-daily cron support", /supports sub-daily Cron Jobs/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateCompletionAudit(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["title", /# Completion Audit/],
    ["date checked", /Date checked: 2026-06-24/],
    ["handoff scope", /Scope: `docs\/CODEX_HANDOFF_WIN\.md`/],
    ["not complete statement", /does not mark the project complete/],
    ["submission check evidence", /Fresh `pnpm submission:check` evidence/],
    ["visibility blocker", /visibility flip pending/],
    ["db proof blocker", /docs\/submission\/db-proof\.png` is missing/],
    ["demo link blocker", /docs\/submission\/demo-link\.txt` is missing/],
    ["public repo blocker", /not public yet/],
    ["production deploy blocker", /\/api\/health` returns 404/],
    ["Vercel plan blocker", /Vercel Hobby plan blocks the `\*\/4 \* \* \* \*` warm cron/],
    ["sub-daily Cron Jobs gate", /plan that supports sub-daily Cron Jobs/],
    ["demo MP4 blocker", /docs\/submission\/demo\.mp4` is missing/],
    ["P0 map", /\| P0-1 Aurora cold-start bounds and warming UX \|/],
    ["P1 map", /\| P1-1 Health and readiness probes \|/],
    ["P2 map", /\| P2-1 Submission manifest \|/],
    ["owner completion gate", /## Owner Completion Gate/],
    ["live probes gate", /\/api\/health` plus `\/api\/ready` pass live/],
    ["Vercel plan gate", /Vercel plan supports the `\*\/4 \* \* \* \*` judging warm cron/],
    ["production preflight script", /pnpm submission:preflight:prod/],
    ["production deploy script", /pnpm submission:deploy:prod/],
    ["public GitHub gate", /GitHub repo is public/],
    ["public source gate", /public API validation sees README, LICENSE, homepage, description, package scripts, warm cron config, and current health\/ready route sources on the default branch/],
    ["ffprobe gate", /ffprobe` reports a duration below 180 seconds and video dimensions of at least 1920x1080/],
    ["hosted URL gate", /real hosted HTTPS demo URL/],
    ["compose DB proof gate", /pnpm submission:compose-db-proof/],
    ["submission writeup gate", /removes the repo visibility pending note/],
    ["submission check gate", /pnpm submission:check/],
    ["verify gate", /pnpm verify/],
    ["build gate", /pnpm build/],
    ["smoke gate", /BASE_URL=https:\/\/recall-h0\.vercel\.app pnpm test:smoke/],
    ["DB guardrail", /Do not run `pnpm db:migrate`, `pnpm db:seed`, or secret-fetch commands/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateDevpostFields(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["title", /# Devpost Field Copy/],
    ["submission check source of truth", /`pnpm submission:check` passes/],
    ["project name", /\| Project name \| Recall \|/],
    ["tagline", /One serializable Aurora PostgreSQL query traces a foodborne outbreak to every affected shelf/],
    ["AWS database", /\| AWS database \| Amazon Aurora PostgreSQL \|/],
    ["live URL", /\| Published Vercel project link \| https:\/\/recall-h0\.vercel\.app \|/],
    ["team ID", /\| Vercel Team ID \| team_vr98mdXQJyxKN5yAtBuO48T8 \|/],
    ["repo URL", /\| Repository URL \| https:\/\/github\.com\/eklavyagoyal\/recall-h0 \|/],
    ["track", /\| Track \| Monetizable B2B \|/],
    ["long description source", /Copy the full contents of `docs\/submission\/submission\.md`/],
    ["remove visibility note", /Remove the `visibility flip pending owner confirmation` note/],
    ["demo URL source", /Add the hosted demo video URL from `docs\/submission\/demo-link\.txt`/],
    ["demo URL distinction", /must not be the live app or repository URL/],
    ["verified 1,400 stores", /`1,400` stores/],
    ["verified 674,285 units", /`674,285` units/],
    ["verified 81 lots", /`81` lots/],
    ["verified 80 edges", /`80` edges/],
    ["one-query reason", /recursive CTE \+ PostGIS GiST \+ pgvector HNSW \+ FK-enforced DAG integrity/],
    ["live app source", /\| Live app \| `docs\/submission\/live-url\.txt` \|/],
    ["public repo instruction", /Make `https:\/\/github\.com\/eklavyagoyal\/recall-h0` public first/],
    ["demo video source", /Upload `docs\/submission\/demo\.mp4`, write the reachable HTTPS URL to `docs\/submission\/demo-link\.txt`/],
    ["demo paste distinction", /It must not be the live app or repository URL/],
    ["architecture upload", /\| Architecture diagram \| `docs\/submission\/architecture\.png` \|/],
    ["DB proof upload", /\| AWS database usage proof \| `docs\/submission\/db-proof\.png` \|/],
    ["gallery upload", /\| Gallery screenshot \| `docs\/submission\/hero-console\.png` \|/],
    ["opening card upload", /\| Optional opening title card \| `docs\/submission\/demo-opening-card\.png` \|/],
    ["end card upload", /\| Optional end title card \| `docs\/submission\/demo-end-card\.png` \|/],
    ["submission check gate", /pnpm submission:check/],
    ["verify gate", /pnpm verify/],
    ["build gate", /pnpm build/],
    ["smoke gate", /BASE_URL=https:\/\/recall-h0\.vercel\.app pnpm test:smoke/],
    ["DB guardrail", /Do not run `pnpm db:migrate`, `pnpm db:seed`, or secret-fetch/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateDemoScript(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["timecoded title", /# Recall . Demo Video Script \(timecoded shot list\)/],
    ["under hard cap", /Total runtime: 175s \(under the 180s hard cap\)/],
    ["live URL", /https:\/\/recall-h0\.vercel\.app/],
    ["never localhost", /never localhost/i],
    ["demo TLC", /PRD-OUTBREAK-0001/],
    ["Aurora warmup", /Warm up Aurora ~30s before recording/],
    ["incognito check", /fresh incognito window/],
    ["Query Inspector prep", /Have the Query Inspector ready/],
    ["EXPLAIN nodes", /Recursive Union[\s\S]*HNSW Index Scan[\s\S]*GiST Spatial Path/],
    ["recording resolution", /1920.1080 \(16:9\)/],
    ["RDS proof tab", /RDS console \(cluster `recall-aurora`, engine 16\.6, `us-east-1`\)/],
    ["CloudWatch proof tab", /CloudWatch `ServerlessDatabaseCapacity` graph/],
    ["demo cards command", /pnpm submission:render-demo-cards/],
    ["hook beat", /0:00[\s\S]*0:20[\s\S]*FSMA-204[\s\S]*24-hour FDA SLA/],
    ["trace beat", /0:35[\s\S]*0:55[\s\S]*one serializable SQL statement/],
    ["verified numbers", /1,400 affected stores[\s\S]*674,285 units[\s\S]*81 contaminated lots[\s\S]*80 edges/],
    ["state count", /38 states/],
    ["Time-Travel beat", /Time-Travel replay[\s\S]*`asOf` cutoff/],
    ["live EXPLAIN beat", /Query Inspector[\s\S]*EXPLAIN \(ANALYZE, BUFFERS\)/],
    ["lineage correctness beat", /Lineage drawer[\s\S]*serializable[\s\S]*FK/],
    ["why Aurora beat", /DynamoDB[\s\S]*DSQL[\s\S]*Aurora PostgreSQL/],
    ["Aurora differentiators", /PostGIS[\s\S]*pgvector[\s\S]*foreign keys/],
    ["zero-stack beat", /0\.0 ACU[\s\S]*2\.0 ACU[\s\S]*Vercel OIDC/],
    ["no long-lived keys", /No long-lived AWS keys/],
    ["criteria map", /Judging-criterion map/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function validateArtifactShotList(contents: Buffer): string | null {
  const value = text(contents);
  const requiredPatterns: [string, RegExp][] = [
    ["title", /# Required Artifact Shot List/],
    ["architecture output", /Generated artifact: `docs\/submission\/architecture\.png`/],
    ["browser box", /Browser \/ Outbreak Console/],
    ["Vercel region", /Vercel Fluid Compute in `iad1`/],
    ["OIDC path", /Vercel OIDC to AWS STS \/ IAM role/],
    ["Aurora named", /Aurora PostgreSQL Serverless v2 in `us-east-1`/],
    ["Bedrock named", /Bedrock Titan embeddings/],
    ["pool proof", /TLS-verified `pg` pool with `attachDatabasePool`/],
    ["DB proof output", /## db-proof\.png/],
    ["EXPLAIN still", /docs\/submission\/db-proof-explain\.png/],
    ["RDS source", /AWS RDS console for cluster `recall-aurora`, engine PostgreSQL 16\.6, region `us-east-1`/],
    ["plan nodes", /Recursive Union, GiST Spatial Path, and HNSW Index Scan/],
    ["CloudWatch ACU graph", /CloudWatch `ServerlessDatabaseCapacity` graph showing 0\.0 ACU idle and 2\.0 ACU under load/],
    ["live warmup order", /Run trace `PRD-OUTBREAK-0001` once to warm Aurora/],
    ["RDS capture filename", /capture it as `docs\/submission\/db-proof-rds\.png`/],
    ["CloudWatch capture filename", /capture it as `docs\/submission\/db-proof-acu\.png`/],
    ["compose command", /Run `pnpm submission:compose-db-proof`/],
    ["final proof output", /docs\/submission\/db-proof\.png/],
    ["source minimum dimensions", /at least `1200x700` each/],
    ["final dimensions", /final `1920x1080`/],
    ["secret redaction", /Do not paste or reveal secrets, connection strings, passwords, or environment variable values/],
  ];
  const missing = requiredPatterns
    .filter(([, pattern]) => !pattern.test(value))
    .map(([label]) => label);
  return missing.length > 0 ? `missing ${missing.join(", ")}` : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalText(path: string): string | null {
  try {
    return readFileSync(join(root, path), "utf8").trim() || null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function png(contents: Buffer): string | null {
  const signature = contents.subarray(0, 8).toString("hex");
  return signature === "89504e470d0a1a0a" ? null : "must be a PNG file";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
