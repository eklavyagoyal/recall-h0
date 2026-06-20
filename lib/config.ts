export type DeployTarget = "local" | "aurora";
export type EmbedProvider = "local" | "bedrock";

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function asInt(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Env var ${name} must be an integer, got: ${value}`);
  }
  return n;
}

const deployTarget = (process.env.DEPLOY_TARGET ?? "local") as DeployTarget;
const embedProvider = (process.env.EMBED_PROVIDER ?? "local") as EmbedProvider;

if (deployTarget !== "local" && deployTarget !== "aurora") {
  throw new Error(`DEPLOY_TARGET must be local or aurora, got: ${deployTarget}`);
}

if (embedProvider !== "local" && embedProvider !== "bedrock") {
  throw new Error(`EMBED_PROVIDER must be local or bedrock, got: ${embedProvider}`);
}

export const config = {
  deployTarget,
  embedProvider,
  embedDim: asInt("EMBED_DIM", process.env.EMBED_DIM, 384),
  demoTlc: process.env.DEMO_TLC ?? "PRD-OUTBREAK-0001",
  traceMaxDepth: asInt("TRACE_MAX_DEPTH", process.env.TRACE_MAX_DEPTH, 12),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://recall:recall@localhost:5433/recall",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  awsRoleArn: process.env.AWS_ROLE_ARN ?? "",
  aurora: {
    host: process.env.AURORA_HOST ?? "",
    port: asInt("AURORA_PORT", process.env.AURORA_PORT, 5432),
    db: process.env.AURORA_DB ?? "recall",
    user: process.env.AURORA_USER ?? "recall_app",
    secretArn: process.env.AURORA_SECRET_ARN ?? "",
  },
  bedrockModelId: process.env.BEDROCK_MODEL_ID ?? "amazon.titan-embed-text-v2:0",
} as const;

export const DEPLOY_TARGET = config.deployTarget;
export const EMBED_PROVIDER = config.embedProvider;
export const EMBED_DIM = config.embedDim;
export const AWS_REGION = config.awsRegion;
export const DEMO_TLC = config.demoTlc;
export const BEDROCK_MODEL_ID = config.bedrockModelId;
export const TRACE_MAX_DEPTH = config.traceMaxDepth;

export function assertAuroraEnv(): void {
  if (config.deployTarget !== "aurora") return;
  required("AURORA_HOST", config.aurora.host);
  required("AWS_ROLE_ARN", config.awsRoleArn);
}
