import { join } from "node:path";
import sharp from "sharp";

const submissionDir = join(process.cwd(), "docs/submission");
const width = 1920;
const height = 1080;

const palette = {
  bg: "#03060a",
  panel: "#081018",
  line: "#263241",
  red: "#ff4d4d",
  teal: "#24f0d0",
  fg: "#f4f7fb",
  muted: "#9aa4b2",
  faint: "#5d6674",
};

async function main(): Promise<void> {
  await Promise.all([
    renderOpening(),
    renderEnd(),
  ]);
  console.log("Wrote docs/submission/demo-opening-card.png");
  console.log("Wrote docs/submission/demo-end-card.png");
}

async function renderOpening(): Promise<void> {
  await renderCard({
    output: join(submissionDir, "demo-opening-card.png"),
    eyebrow: "Recall",
    title: "The Outbreak Console",
    subtitle: "One serializable Aurora PostgreSQL query traces a contaminated lot to every affected shelf.",
    rows: [
      ["Live URL", "https://recall-h0.vercel.app"],
      ["Demo TLC", "PRD-OUTBREAK-0001 · Romaine Lettuce"],
      ["Verified scope", "1,400 stores · 674,285 units · 81 lots / 80 edges"],
    ],
    footer: "FSMA-204 recall readiness · Amazon Aurora PostgreSQL Serverless v2 · Vercel Fluid Compute",
  });
}

async function renderEnd(): Promise<void> {
  await renderCard({
    output: join(submissionDir, "demo-end-card.png"),
    eyebrow: "Live submission",
    title: "Recall",
    subtitle: "Graph recursion + PostGIS + pgvector HNSW in one serializable Aurora transaction.",
    rows: [
      ["Published Vercel URL", "https://recall-h0.vercel.app"],
      ["Vercel Team ID", "team_vr98mdXQJyxKN5yAtBuO48T8"],
      ["AWS database", "Amazon Aurora PostgreSQL Serverless v2 · pgvector HNSW · PostGIS GiST"],
    ],
    footer: "No long-lived AWS keys · Vercel OIDC → AWS STS → Bedrock Titan embeddings",
  });
}

async function renderCard({
  output,
  eyebrow,
  title,
  subtitle,
  rows,
  footer,
}: {
  output: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  rows: [string, string][];
  footer: string;
}): Promise<void> {
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: palette.bg,
    },
  })
    .composite([
      { input: Buffer.from(background()), left: 0, top: 0 },
      { input: Buffer.from(card({ eyebrow, title, subtitle, rows, footer })), left: 0, top: 0 },
    ])
    .png()
    .toFile(output);
}

function background(): string {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="redGlow" cx="16%" cy="22%" r="55%">
          <stop offset="0%" stop-color="${palette.red}" stop-opacity="0.28"/>
          <stop offset="56%" stop-color="${palette.red}" stop-opacity="0.06"/>
          <stop offset="100%" stop-color="${palette.red}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="tealGlow" cx="86%" cy="18%" r="46%">
          <stop offset="0%" stop-color="${palette.teal}" stop-opacity="0.22"/>
          <stop offset="58%" stop-color="${palette.teal}" stop-opacity="0.05"/>
          <stop offset="100%" stop-color="${palette.teal}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="${palette.bg}"/>
      <rect width="100%" height="100%" fill="url(#redGlow)"/>
      <rect width="100%" height="100%" fill="url(#tealGlow)"/>
      ${grid()}
      ${graphMotif()}
    </svg>
  `;
}

function grid(): string {
  const lines: string[] = [];
  for (let x = 0; x <= width; x += 80) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${palette.line}" stroke-opacity="0.28"/>`);
  }
  for (let y = 0; y <= height; y += 80) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${palette.line}" stroke-opacity="0.24"/>`);
  }
  return `<g>${lines.join("")}</g>`;
}

function graphMotif(): string {
  const cx = 1480;
  const cy = 620;
  const arms = Array.from({ length: 32 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 32;
    const r = 170 + (index % 4) * 28;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${palette.red}" stroke-opacity="0.42" stroke-width="2"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="${palette.red}" opacity="0.82"/>`;
  }).join("");
  return `<g opacity="0.7"><circle cx="${cx}" cy="${cy}" r="24" fill="${palette.red}"/>${arms}</g>`;
}

function card({
  eyebrow,
  title,
  subtitle,
  rows,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  rows: [string, string][];
  footer: string;
}): string {
  const rowMarkup = rows
    .map(([label, value], index) => {
      const y = 555 + index * 84;
      return `
        <g>
          <rect x="170" y="${y - 42}" width="1040" height="62" rx="8" fill="${palette.panel}" stroke="${palette.line}"/>
          <text x="195" y="${y - 11}" fill="${palette.faint}" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="4">${escapeXml(label.toUpperCase())}</text>
          <text x="195" y="${y + 17}" fill="${index === 0 ? palette.teal : palette.fg}" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="800">${escapeXml(value)}</text>
        </g>
      `;
    })
    .join("");

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="170" cy="158" r="8" fill="${palette.red}"/>
      <text x="194" y="166" fill="${palette.muted}" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="800">${escapeXml(eyebrow)}</text>
      <text x="168" y="305" fill="${palette.fg}" font-family="Inter, Arial, sans-serif" font-size="92" font-weight="900">${escapeXml(title)}</text>
      <text x="174" y="365" fill="${palette.muted}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="600">${escapeXml(subtitle)}</text>
      <rect x="168" y="427" width="118" height="6" fill="${palette.red}"/>
      <rect x="300" y="427" width="118" height="6" fill="${palette.teal}"/>
      ${rowMarkup}
      <rect x="168" y="914" width="1120" height="64" rx="8" fill="#050b12" stroke="${palette.line}"/>
      <text x="194" y="954" fill="${palette.muted}" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(footer)}</text>
    </svg>
  `;
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
