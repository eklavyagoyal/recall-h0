import { access } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const submissionDir = join(root, "docs/submission");

const inputs = {
  rds: join(submissionDir, "db-proof-rds.png"),
  acu: join(submissionDir, "db-proof-acu.png"),
  explain: join(submissionDir, "db-proof-explain.png"),
};
const inputRequirements = [
  {
    label: "RDS console source",
    path: inputs.rds,
    minWidth: 1200,
    minHeight: 700,
  },
  {
    label: "CloudWatch ACU source",
    path: inputs.acu,
    minWidth: 1200,
    minHeight: 700,
  },
  {
    label: "Live EXPLAIN source",
    path: inputs.explain,
    minWidth: 1600,
    minHeight: 900,
  },
];
const output = join(submissionDir, "db-proof.png");

const canvas = { width: 1920, height: 1080 };
const margin = 32;
const gap = 22;
const footerHeight = 70;
const footerTop = canvas.height - margin - footerHeight;
const panelTop = margin;
const panelHeight = footerTop - gap - panelTop;
const leftWidth = 700;
const rightWidth = canvas.width - margin * 2 - gap - leftWidth;
const leftPanelHeight = Math.floor((panelHeight - gap) / 2);

async function main(): Promise<void> {
  const missing = await missingInputs();
  if (missing.length > 0) {
    console.error("Cannot compose docs/submission/db-proof.png. Missing source screenshots:");
    for (const path of missing) console.error(`- ${path}`);
    console.error("\nCapture the owner-only AWS console screenshots, then rerun:");
    console.error("  pnpm submission:compose-db-proof");
    process.exit(1);
  }

  const invalid = await invalidInputs();
  if (invalid.length > 0) {
    console.error("Cannot compose docs/submission/db-proof.png. Source screenshots are invalid:");
    for (const issue of invalid) console.error(`- ${issue}`);
    console.error("\nUse full-resolution PNG captures, then rerun:");
    console.error("  pnpm submission:compose-db-proof");
    process.exit(1);
  }

  const [rds, acu, explain] = await Promise.all([
    panel(inputs.rds, "AWS RDS console - recall-aurora / PostgreSQL 16.6 / us-east-1", leftWidth, leftPanelHeight),
    panel(inputs.acu, "CloudWatch - ServerlessDatabaseCapacity 0.0 ACU idle -> 2.0 ACU burst", leftWidth, leftPanelHeight),
    panel(inputs.explain, "Live Vercel Query Inspector - Recursive Union + GiST + HNSW", rightWidth, panelHeight),
  ]);

  await sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: "#03060a",
    },
  })
    .composite([
      { input: rds, left: margin, top: panelTop },
      { input: acu, left: margin, top: panelTop + leftPanelHeight + gap },
      { input: explain, left: margin + leftWidth + gap, top: panelTop },
      { input: footer(), left: margin, top: footerTop },
    ])
    .png()
    .toFile(output);

  console.log(`Wrote ${output}`);
}

async function invalidInputs(): Promise<string[]> {
  const checks = await Promise.all(
    inputRequirements.map(async ({ label, path, minWidth, minHeight }) => {
      try {
        const metadata = await sharp(path).metadata();
        const { width, height, format } = metadata;
        if (format !== "png") return `${label}: ${path} must be a PNG`;
        if (!width || !height) return `${label}: ${path} has unreadable dimensions`;
        if (width < minWidth || height < minHeight) {
          return `${label}: ${path} must be at least ${minWidth}x${minHeight}; got ${width}x${height}`;
        }
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "could not read screenshot";
        return `${label}: ${path} is not a readable image (${message})`;
      }
    }),
  );
  return checks.filter((issue): issue is string => issue !== null);
}

async function missingInputs(): Promise<string[]> {
  const entries = Object.values(inputs);
  const checks = await Promise.all(
    entries.map(async (path) => {
      try {
        await access(path);
        return null;
      } catch {
        return path;
      }
    }),
  );
  return checks.filter((path): path is string => path !== null);
}

async function panel(path: string, label: string, width: number, height: number): Promise<Buffer> {
  const titleHeight = 44;
  const bodyHeight = height - titleHeight;
  const image = await sharp(path)
    .resize({
      width,
      height: bodyHeight,
      fit: "contain",
      background: "#060a10",
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#060a10",
    },
  })
    .composite([
      { input: Buffer.from(title(label, width, titleHeight)), left: 0, top: 0 },
      { input: image, left: 0, top: titleHeight },
      { input: Buffer.from(border(width, height)), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

function title(label: string, width: number, height: number): string {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0b1118"/>
      <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#24f0d0" stroke-opacity="0.45"/>
      <circle cx="20" cy="${height / 2}" r="5" fill="#24f0d0"/>
      <text x="36" y="28" fill="#f4f7fb" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700">${escapeXml(label)}</text>
    </svg>
  `;
}

function border(width: number, height: number): string {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#2d3748" stroke-width="1"/>
    </svg>
  `;
}

function footer(): Buffer {
  const width = canvas.width - margin * 2;
  const database = "Amazon Aurora PostgreSQL Serverless v2 - pgvector HNSW + PostGIS GiST + FK DAG";
  const live = "https://recall-h0.vercel.app";
  const team = "Vercel Team ID: team_vr98mdXQJyxKN5yAtBuO48T8";
  const svg = `
    <svg width="${width}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="10" fill="#081018" stroke="#24f0d0" stroke-opacity="0.45"/>
      <text x="24" y="28" fill="#24f0d0" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="800">H0 AWS Database Proof</text>
      <text x="24" y="52" fill="#f4f7fb" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="700">${escapeXml(database)}</text>
      <text x="${width - 24}" y="28" text-anchor="end" fill="#f4f7fb" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700">${escapeXml(live)}</text>
      <text x="${width - 24}" y="52" text-anchor="end" fill="#9aa4b2" font-family="Inter, Arial, sans-serif" font-size="14">${escapeXml(team)}</text>
    </svg>
  `;
  return Buffer.from(svg);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
