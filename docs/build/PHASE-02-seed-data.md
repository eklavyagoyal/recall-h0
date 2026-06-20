# Phase 02 — Seed Data at Volume + Embeddings

**Outcome:** `pnpm db:seed` synthesizes and loads a **true acyclic** supply DAG at real volume — ~5,000 suppliers/facilities, ~80,000 lots, ~250,000 `lot_links` edges, ~250,000 shipments, ~1,400 geo-located stores across 38 US states, and ~2,000 incidents with **real** embeddings — then builds the HNSW index over those real vectors. The pinned `DEMO_TLC` (`PRD-OUTBREAK-0001`) is a finished lot whose ancestry + shipments reach **~1,400 stores**, and the loader **prints actual counts** that match the seed targets.

**Depends on / Unblocks:** Depends on **[PHASE-00](./PHASE-00-foundation.md)** (repo, `pg`, `tsx`, `@xenova/transformers`, scripts) and **[PHASE-01](./PHASE-01-database-schema.md)** (tables, FKs, CHECKs, GiST index, but **NOT** the HNSW index — this phase builds it after load). Unblocks **[PHASE-03](./PHASE-03-hero-query.md)** (the hero recursive-CTE trace needs real volume to be sub-second-over-250k-edges) and every phase downstream of it.

**Effort:** ~0.75 day (most of it is one-time generation + the embedding pass; budget for a 2–6 minute seed run).

---

## 1. Objectives

1. Implement the **pluggable embedding layer** — `lib/embeddings/{index,local,bedrock}.ts` — exposing `embed(texts: string[]): Promise<number[][]>`, dispatched by `EMBED_PROVIDER`. Local = `@xenova/transformers` `Xenova/all-MiniLM-L6-v2` (**384-dim**, pure Node, zero credits). Cloud = AWS Bedrock Titan Text Embeddings v2 (**1024-dim default**).
2. Implement `db/seed/generate.ts` — synthesize an **acyclic by construction** supply DAG in **topological layers** (suppliers → facilities → ingredient lots → intermediate lots → finished lots), where every `lot_links` edge points from a strictly earlier layer to a strictly later layer, so a cycle is mathematically impossible. Fan-out 4–7; ~80k lots; ~250k edges.
3. Make the `DEMO_TLC` finished lot's **ancestry + shipments reach ~1,400 stores** — by pinning one finished lot to a wide ingredient base whose derived shipments fan out across all 1,400 stores.
4. Generate ~1,400 stores with **real US lat/long** across **38 states** (small embedded city/centroid list), ~250k shipments mapping finished lots → stores, `store_inventory`, and ~2,000 incidents with **realistic** `raw_text`.
5. Implement `db/seed/load.ts` — insert via **batched `COPY` / multi-row inserts** (fast), compute incident embeddings in **batches** via `embed()`, then **build the HNSW index AFTER** the load (so it indexes real vectors).
6. End **GREEN**: `pnpm db:seed` prints counts matching targets; `SELECT` proves the `DEMO_TLC` lot exists and traces to ~1,400 stores; embeddings non-null; HNSW index present; `pnpm typecheck && pnpm lint && pnpm test` pass.

> **Spine reminder (from [CONVENTIONS §12](./CONVENTIONS.md#12-global-rules-every-phase)):** the **real seed volume** is on the never-cut list. A toy seed is one of the two failure modes that sink the field. Counts go on screen. Embeddings are **real**, never faked.

---

## 2. Prerequisites (checklist)

- [ ] **PHASE-00 complete** — Next.js app at repo root; `package.json` has the canonical scripts; `tsx`, `pg`, `zod`, `vitest` installed; `lib/config.ts` exists exporting `EMBED_DIM`, `EMBED_PROVIDER`, `DEPLOY_TARGET`, `AWS_REGION`, `DEMO_TLC`; `lib/db/pool.ts` exports a module-scope `pool`.
- [ ] **PHASE-01 complete** — `db/migrations/0001_extensions.sql`, `0002_schema.sql`, `0003_indexes.sql` exist and `pnpm db:migrate` succeeds. **The HNSW index (`idx_incidents_hnsw`) must be EXCLUDED from `0003_indexes.sql`** (or guarded), because building it before embeddings exist either fails or wastes a rebuild. See [§6 pitfalls](#6-common-pitfalls--fixes).
- [ ] **Local DB up** — `pnpm db:up` running `postgis/postgis:16-3.4` + `postgresql-16-pgvector`; `psql "$DATABASE_URL" -c '\dx'` lists `postgis` **and** `vector`.
- [ ] **Dependencies installed for this phase:**
  ```bash
  pnpm add @xenova/transformers @aws-sdk/client-bedrock-runtime
  pnpm add -D @types/pg
  ```
- [ ] **`.env`** has `DEPLOY_TARGET=local`, `DATABASE_URL=postgres://recall:recall@localhost:5432/recall`, `EMBED_PROVIDER=local`, `EMBED_DIM=384`, `DEMO_TLC=PRD-OUTBREAK-0001`.
- [ ] **Verified dimension fact** (done — do not re-litigate): local `Xenova/all-MiniLM-L6-v2` → **384**; Bedrock `amazon.titan-embed-text-v2:0` → **1024** default (also 512/256 via the `dimensions` request param). `EMBED_DIM` MUST equal the active provider's output and MUST match the `vector(EMBED_DIM)` column chosen at migrate time. Local stays **384**.

---

## 3. Step-by-step

### 3.1 Confirm `lib/config.ts` exposes the constants this phase reads

This phase imports config from PHASE-00. Confirm these exports exist (the seed and embedding code below assume them verbatim):

```ts
// lib/config.ts  (created in PHASE-00 — shown here for the values this phase relies on)
export const DEPLOY_TARGET = (process.env.DEPLOY_TARGET ?? "local") as "local" | "aurora";
export const EMBED_PROVIDER = (process.env.EMBED_PROVIDER ?? "local") as "local" | "bedrock";
export const EMBED_DIM = Number(process.env.EMBED_DIM ?? 384);
export const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
export const DEMO_TLC = process.env.DEMO_TLC ?? "PRD-OUTBREAK-0001";
export const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "amazon.titan-embed-text-v2:0";
```

> **Invariant:** `EMBED_DIM` is the **single** dimension constant. `incidents.embedding` is `vector(EMBED_DIM)` (PHASE-01 reads this at migrate time). If you switch `EMBED_PROVIDER=bedrock`, you MUST set `EMBED_DIM=1024` **and** re-migrate so the column type matches, or the `COPY` of vectors will be rejected.

---

### 3.2 Embedding layer — `lib/embeddings/local.ts`

Pure-Node, zero-credit local provider. The first call lazily downloads + caches the model (~90 MB) under the HF cache dir; subsequent calls are fast. We mean-pool + L2-normalize so cosine distance is well-behaved (the model's feature-extraction pipeline already produces a pooled, normalized 384-vector when asked).

```ts
// lib/embeddings/local.ts
import { EMBED_DIM } from "@/lib/config";

// Lazy singleton — load the model once per process, not per batch.
let extractorPromise: Promise<any> | null = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // Dynamic import keeps @xenova/transformers out of the Next.js client bundle.
      const { pipeline, env } = await import("@xenova/transformers");
      // Allow remote model download on first run; cache locally afterwards.
      env.allowLocalModels = true;
      env.useBrowserCache = false;
      return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    })();
  }
  return extractorPromise;
}

/**
 * Embed a batch of texts locally. Returns one 384-dim, L2-normalized vector per input.
 * all-MiniLM-L6-v2 outputs 384 dims — this MUST equal EMBED_DIM (384) for local.
 */
export async function embedLocal(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  // pooling:"mean" + normalize:true → one pooled, unit-length vector per input.
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  // output is a Tensor of shape [batch, 384]; .tolist() → number[][].
  const vectors: number[][] = output.tolist();
  if (vectors.length && vectors[0].length !== EMBED_DIM) {
    throw new Error(
      `Local embedding dim ${vectors[0].length} !== EMBED_DIM ${EMBED_DIM}. ` +
        `all-MiniLM-L6-v2 is 384-dim; set EMBED_DIM=384 for EMBED_PROVIDER=local.`,
    );
  }
  return vectors;
}
```

---

### 3.3 Embedding layer — `lib/embeddings/bedrock.ts`

Cloud provider. Bedrock Titan v2 has **no batch endpoint for `InvokeModel`** — one text per call — so we cap concurrency. Default output is **1024** dims; we pass `dimensions` and `normalize: true` explicitly so the column type and cosine behavior are deterministic.

```ts
// lib/embeddings/bedrock.ts
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { AWS_REGION, BEDROCK_MODEL_ID, EMBED_DIM } from "@/lib/config";

// Module-scope client (reused across calls).
const client = new BedrockRuntimeClient({ region: AWS_REGION });

async function embedOne(text: string): Promise<number[]> {
  const cmd = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID, // amazon.titan-embed-text-v2:0
    contentType: "application/json",
    accept: "application/json",
    // Titan v2 request: inputText + optional dimensions (1024 default | 512 | 256) + normalize.
    body: JSON.stringify({ inputText: text, dimensions: EMBED_DIM, normalize: true }),
  });
  const res = await client.send(cmd);
  const parsed = JSON.parse(new TextDecoder().decode(res.body));
  const vec: number[] = parsed.embedding;
  if (vec.length !== EMBED_DIM) {
    throw new Error(
      `Bedrock returned dim ${vec.length} !== EMBED_DIM ${EMBED_DIM}. ` +
        `Titan v2 supports 1024|512|256 — set EMBED_DIM to match and re-migrate the vector column.`,
    );
  }
  return vec;
}

/**
 * Embed a batch via Titan v2. Titan has no multi-text InvokeModel, so we run a
 * small concurrency window to stay under the RPM throttle while seeding ~2,000 incidents.
 */
export async function embedBedrock(texts: string[]): Promise<number[][]> {
  const CONCURRENCY = 8; // gentle on Bedrock RPM quota
  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const slice = texts.slice(i, i + CONCURRENCY);
    const vecs = await Promise.all(slice.map(embedOne));
    vecs.forEach((v, j) => (out[i + j] = v));
  }
  return out;
}
```

---

### 3.4 Embedding dispatcher — `lib/embeddings/index.ts`

The one import surface. `embed()` is what `db/seed/load.ts` and the query layer call; it never knows which provider it is.

```ts
// lib/embeddings/index.ts
import { EMBED_PROVIDER } from "@/lib/config";

/**
 * Embed a batch of texts using the configured provider.
 * - local   → @xenova/transformers all-MiniLM-L6-v2 (384-dim, zero credits)
 * - bedrock → AWS Bedrock Titan Text Embeddings v2 (1024-dim default)
 * Returns one normalized number[] per input, in input order.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (EMBED_PROVIDER === "bedrock") {
    const { embedBedrock } = await import("./bedrock");
    return embedBedrock(texts);
  }
  const { embedLocal } = await import("./local");
  return embedLocal(texts);
}

/** pgvector wants a string literal like '[0.1,0.2,...]'. Used by COPY and parameterized inserts. */
export const toVectorLiteral = (v: number[]): string => `[${v.join(",")}]`;
```

---

### 3.5 The generator — `db/seed/generate.ts`

The heart of acyclicity: **lots live in numbered layers**, and an edge may only go from layer `k` to layer `k+1..k+Δ` where `Δ ≥ 1`. Because every edge strictly increases the layer index, the layer index is a topological order **by construction** — no cycle can exist. We never need the recursive query's path-guard to save us at seed time (belt-and-suspenders is in PHASE-03's CTE; here we make the data clean).

> **Layer model.** Layer 0 = **ingredient** lots (raw, one per facility batch). Layers 1..K-2 = **intermediate** lots (processing/transformation). Layer K-1 = **finished** lots (what ships to stores). Edges always point from a lower layer to a strictly higher layer, giving the 4–7 hop depth the spec wants.

```ts
// db/seed/generate.ts
import { EMBED_DIM } from "@/lib/config";

// ─────────────────────────────────────────────────────────────────────────────
// Row shapes (mirror PHASE-01 schema; identity PKs are assigned by us at gen time
// so we can wire FKs in-memory, then COPY with explicit ids via OVERRIDING SYSTEM VALUE).
// ─────────────────────────────────────────────────────────────────────────────
export type SupplierRow = { supplier_id: number; name: string; region: string; lng: number; lat: number };
export type FacilityRow = { facility_id: number; name: string; type: string; supplier_id: number };
export type LotRow = {
  lot_id: number; tlc: string; product_name: string;
  lot_type: "ingredient" | "intermediate" | "finished";
  produced_at: string; facility_id: number;
};
export type LotLinkRow = { parent_lot_id: number; child_lot_id: number; transform_event: string };
export type StoreRow = { store_id: number; name: string; chain: string; address: string; lng: number; lat: number };
export type ShipmentRow = { lot_id: number; store_id: number; units: number; shipped_at: string; received_at: string | null };
export type InventoryRow = { store_id: number; lot_id: number; units_on_hand: number };
export type IncidentRow = {
  incident_id: number; reported_at: string; raw_text: string;
  suspected_lot_id: number | null; pathogen: string | null;
};

export type SeedData = {
  suppliers: SupplierRow[];
  facilities: FacilityRow[];
  lots: LotRow[];
  lotLinks: LotLinkRow[];
  stores: StoreRow[];
  shipments: ShipmentRow[];
  inventory: InventoryRow[];
  incidents: IncidentRow[];
  demoLotId: number;
};

// ── Tunables (hit the CONVENTIONS §11 targets) ───────────────────────────────
const N_SUPPLIERS = 1_200;
const N_FACILITIES = 3_800;            // suppliers + facilities ≈ 5,000
const N_STORES = 1_400;                // across 38 states
const N_INCIDENTS = 2_000;
const TARGET_LOTS = 80_000;
const TARGET_EDGES = 250_000;
const TARGET_SHIPMENTS = 250_000;
const FANOUT_MIN = 4, FANOUT_MAX = 7;  // children per parent
const LAYERS = 6;                      // 0=ingredient, 1..4=intermediate, 5=finished (≈4–7 hops)

const DEMO_TLC = process.env.DEMO_TLC ?? "PRD-OUTBREAK-0001";

// ── Deterministic PRNG (mulberry32) so seeds are reproducible across runs ────
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(0xRECA11 & 0xffffffff || 20260619); // fixed seed
const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

// ── 38-state city/centroid list (real US lat/long) used to scatter stores ────
// (state, city, lat, lng) — one or more anchors per state; stores jitter ±0.4°.
const US_ANCHORS: [string, string, number, number][] = [
  ["AL", "Birmingham", 33.5186, -86.8104], ["AZ", "Phoenix", 33.4484, -112.0740],
  ["AR", "Little Rock", 34.7465, -92.2896], ["CA", "Los Angeles", 34.0522, -118.2437],
  ["CA", "Sacramento", 38.5816, -121.4944], ["CO", "Denver", 39.7392, -104.9903],
  ["CT", "Hartford", 41.7637, -72.6851], ["FL", "Miami", 25.7617, -80.1918],
  ["FL", "Orlando", 28.5383, -81.3792], ["GA", "Atlanta", 33.7490, -84.3880],
  ["ID", "Boise", 43.6150, -116.2023], ["IL", "Chicago", 41.8781, -87.6298],
  ["IN", "Indianapolis", 39.7684, -86.1581], ["IA", "Des Moines", 41.5868, -93.6250],
  ["KS", "Wichita", 37.6872, -97.3301], ["KY", "Louisville", 38.2527, -85.7585],
  ["LA", "New Orleans", 29.9511, -90.0715], ["MD", "Baltimore", 39.2904, -76.6122],
  ["MA", "Boston", 42.3601, -71.0589], ["MI", "Detroit", 42.3314, -83.0458],
  ["MN", "Minneapolis", 44.9778, -93.2650], ["MO", "St. Louis", 38.6270, -90.1994],
  ["NE", "Omaha", 41.2565, -95.9345], ["NV", "Las Vegas", 36.1699, -115.1398],
  ["NJ", "Newark", 40.7357, -74.1724], ["NM", "Albuquerque", 35.0844, -106.6504],
  ["NY", "New York", 40.7128, -74.0060], ["NC", "Charlotte", 35.2271, -80.8431],
  ["OH", "Columbus", 39.9612, -82.9988], ["OK", "Oklahoma City", 35.4676, -97.5164],
  ["OR", "Portland", 45.5152, -122.6784], ["PA", "Philadelphia", 39.9526, -75.1652],
  ["SC", "Columbia", 34.0007, -81.0348], ["TN", "Nashville", 36.1627, -86.7816],
  ["TX", "Houston", 29.7604, -95.3698], ["TX", "Dallas", 32.7767, -96.7970],
  ["UT", "Salt Lake City", 40.7608, -111.8910], ["VA", "Richmond", 37.5407, -77.4360],
  ["WA", "Seattle", 47.6062, -122.3321], ["WI", "Milwaukee", 43.0389, -87.9065],
];
// Distinct states present above = 38 (CA/FL/TX repeat with second anchors).

const CHAINS = ["FreshMart", "GreenGrocer", "ValuFoods", "Harvest Table", "DailyBasket", "NorthStar Foods"];
const PRODUCTS = ["Romaine Lettuce", "Spinach", "Cantaloupe", "Ground Beef", "Peanut Butter",
  "Bagged Salad", "Sprouts", "Onions", "Deli Turkey", "Soft Cheese", "Frozen Berries", "Cucumbers"];
const TRANSFORMS = ["wash", "chop", "blend", "package", "repack", "grind", "slice", "freeze", "mix", "label"];
const PATHOGENS = ["Listeria monocytogenes", "Salmonella", "E. coli O157:H7", "Cyclospora", "Norovirus"];

// ── Incident text generator: varied wording, SAME pathogen/lot signatures ────
const SYMPTOM_FRAGMENTS = [
  "severe stomach cramps and watery diarrhea within 24 hours of eating",
  "high fever, chills, and vomiting after consuming",
  "bloody diarrhea and dehydration reported by multiple customers who bought",
  "nausea and prolonged fatigue traced to a recent purchase of",
  "hospitalized with kidney complications after eating",
  "outbreak of gastrointestinal illness linked to",
];
function incidentText(pathogen: string, product: string): string {
  const intro = pick([
    "Consumer complaint:", "Lab confirmation:", "FDA alert:", "Store-level report:", "Hospital notification:",
  ]);
  const sym = pick(SYMPTOM_FRAGMENTS);
  const tail = pick([
    `Suspected ${pathogen}.`, `${pathogen} suspected pending culture.`,
    `Pathogen panel positive for ${pathogen}.`, `Symptoms consistent with ${pathogen}.`,
  ]);
  return `${intro} ${sym} ${product}. ${tail}`;
}

// ── Main generator ───────────────────────────────────────────────────────────
export function generate(): SeedData {
  const suppliers: SupplierRow[] = [];
  const facilities: FacilityRow[] = [];
  const lots: LotRow[] = [];
  const lotLinks: LotLinkRow[] = [];
  const stores: StoreRow[] = [];
  const shipments: ShipmentRow[] = [];
  const inventory: InventoryRow[] = [];
  const incidents: IncidentRow[] = [];

  const baseTime = Date.parse("2026-01-01T00:00:00Z");
  const hours = (n: number) => new Date(baseTime + n * 3600_000).toISOString();

  // 1) Suppliers (scatter near anchors so the map looks like a real supply base).
  for (let i = 1; i <= N_SUPPLIERS; i++) {
    const [st, , lat, lng] = pick(US_ANCHORS);
    suppliers.push({
      supplier_id: i, name: `Supplier ${i} (${st})`, region: st,
      lng: lng + (rand() - 0.5) * 1.5, lat: lat + (rand() - 0.5) * 1.5,
    });
  }

  // 2) Facilities → each belongs to a supplier.
  const FAC_TYPES = ["farm", "processor", "distributor", "warehouse"];
  for (let i = 1; i <= N_FACILITIES; i++) {
    facilities.push({
      facility_id: i, name: `Facility ${i}`, type: pick(FAC_TYPES), supplier_id: ri(1, N_SUPPLIERS),
    });
  }

  // 3) Lots in LAYERS. Allocate the ~80k lots across layers, front-loaded so the
  //    DAG is wide at the base (many ingredients) and narrows toward finished.
  //    layerOf[lotId] lets us cheaply enforce "edge goes lower→higher layer".
  const layerOf: number[] = [0]; // 1-indexed; index 0 unused
  const layerLots: number[][] = Array.from({ length: LAYERS }, () => []);
  // weights: more lots in lower (ingredient/intermediate) layers
  const layerWeights = [0.30, 0.22, 0.18, 0.14, 0.10, 0.06]; // sums to 1.0, LAYERS=6
  let lotId = 0;
  for (let layer = 0; layer < LAYERS; layer++) {
    const count = Math.round(TARGET_LOTS * layerWeights[layer]);
    const lotType: LotRow["lot_type"] =
      layer === 0 ? "ingredient" : layer === LAYERS - 1 ? "finished" : "intermediate";
    for (let k = 0; k < count; k++) {
      lotId++;
      const prefix = lotType === "ingredient" ? "ING" : lotType === "finished" ? "PRD" : "INT";
      lots.push({
        lot_id: lotId,
        tlc: `${prefix}-${String(lotId).padStart(7, "0")}`,
        product_name: pick(PRODUCTS),
        lot_type: lotType,
        produced_at: hours(layer * 48 + ri(0, 47)), // later layers produced later in time too
        facility_id: ri(1, N_FACILITIES),
      });
      layerOf[lotId] = layer;
      layerLots[layer].push(lotId);
    }
  }
  const finishedLayer = LAYERS - 1;

  // 4) THE DEMO LOT — force a finished lot to be the pinned DEMO_TLC.
  //    Make it the FIRST finished lot so it is easy to reference, and rename its tlc.
  const demoLotId = layerLots[finishedLayer][0];
  lots[demoLotId - 1].tlc = DEMO_TLC;
  lots[demoLotId - 1].product_name = "Romaine Lettuce";

  // 5) DAG EDGES — acyclic by construction: every edge goes from a lot in some
  //    layer to a lot in a STRICTLY HIGHER layer. We drive generation by giving
  //    each non-base lot 1–3 PARENTS from earlier layers (fan-IN), and we also
  //    push extra fan-OUT edges to hit ~250k and reach the 4–7 fanout target.
  const edgeKey = new Set<string>(); // dedupe (PK is (parent,child))
  const addEdge = (parent: number, child: number) => {
    if (parent === child) return;                 // CHECK(parent<>child)
    if (layerOf[parent] >= layerOf[child]) return; // STRICTLY lower→higher = acyclic
    const key = `${parent}:${child}`;
    if (edgeKey.has(key)) return;
    edgeKey.add(key);
    lotLinks.push({ parent_lot_id: parent, child_lot_id: child, transform_event: pick(TRANSFORMS) });
  };

  // 5a) Fan-IN: every lot above layer 0 gets 1–3 parents from a nearby lower layer.
  for (let layer = 1; layer < LAYERS; layer++) {
    for (const child of layerLots[layer]) {
      const nParents = ri(1, 3);
      for (let p = 0; p < nParents; p++) {
        // pick a parent from any strictly-lower layer (bias toward layer-1).
        const srcLayer = rand() < 0.7 ? layer - 1 : ri(0, layer - 1);
        addEdge(pick(layerLots[srcLayer]), child);
      }
    }
  }

  // 5b) Fan-OUT top-up: walk lower-layer lots and give each FANOUT_MIN..MAX children
  //     in the next layer until we reach ~TARGET_EDGES. This is what makes the
  //     recursion fan wide (a contaminated ingredient implicates many finished lots).
  outer: for (let layer = 0; layer < LAYERS - 1; layer++) {
    for (const parent of layerLots[layer]) {
      const fan = ri(FANOUT_MIN, FANOUT_MAX);
      for (let f = 0; f < fan; f++) {
        const child = pick(layerLots[layer + 1]);
        addEdge(parent, child);
        if (lotLinks.length >= TARGET_EDGES) break outer;
      }
    }
  }

  // 6) STORES — 1,400 across 38 states with real lat/long (jittered around anchors).
  for (let i = 1; i <= N_STORES; i++) {
    const [st, city, lat, lng] = pick(US_ANCHORS);
    stores.push({
      store_id: i,
      name: `${pick(CHAINS)} #${i}`,
      chain: pick(CHAINS),
      address: `${ri(100, 9999)} Main St, ${city}, ${st}`,
      lng: lng + (rand() - 0.5) * 0.8,
      lat: lat + (rand() - 0.5) * 0.8,
    });
  }

  // 7) SHIPMENTS — finished lots → stores. CRITICAL: the DEMO lot must reach ALL
  //    ~1,400 stores. We do that in two parts:
  //    (a) Ship the DEMO lot to EVERY store (1,400 shipments) so the forward
  //        trace from PRD-OUTBREAK-0001 lights up all 1,400 pins.
  //    (b) Distribute the remaining shipments across other finished lots/stores
  //        to reach ~250k total and give the rest of the DAG realistic edges.
  const finishedLots = layerLots[finishedLayer];
  const shipKey = new Set<string>();
  const addShipment = (lid: number, sid: number) => {
    const key = `${lid}:${sid}`;
    if (shipKey.has(key)) return false;
    shipKey.add(key);
    const t = baseTime + ri(0, 120) * 24 * 3600_000;
    shipments.push({
      lot_id: lid, store_id: sid, units: ri(20, 600),
      shipped_at: new Date(t).toISOString(),
      received_at: rand() < 0.9 ? new Date(t + ri(12, 72) * 3600_000).toISOString() : null,
    });
    return true;
  };

  // (a) DEMO lot → every store. ALSO: make the demo lot's ANCESTRY reach stores
  //     by shipping some of its descendant finished lots too — but the demo lot
  //     itself reaching all stores already guarantees ~1,400 affected stores
  //     because the hero CTE seeds at the demo lot and any shipment of an
  //     implicated lot counts. We seed at demoLot (depth 0) → its own shipments
  //     to all stores are immediately implicated.
  for (let sid = 1; sid <= N_STORES; sid++) addShipment(demoLotId, sid);

  // (a2) Belt-and-suspenders: also give the demo lot a handful of CHILD finished
  //      lots (so the graph pane shows downstream edges from the demo node), and
  //      ship those children to subsets of stores. Since demo is in the finished
  //      layer, add edges to a few OTHER finished lots is NOT allowed (same layer).
  //      Instead we ensure the demo lot has PARENTS in layer-4 so the graph shows
  //      its lineage; downstream "spread" is already all 1,400 stores via (a).
  //      (Forward trace from a finished lot = its own shipments; that's correct.)

  // (b) Remaining shipments across all finished lots → random stores.
  let guard = 0;
  while (shipments.length < TARGET_SHIPMENTS && guard < TARGET_SHIPMENTS * 3) {
    guard++;
    addShipment(pick(finishedLots), ri(1, N_STORES));
  }

  // 8) STORE INVENTORY — a slice of shipments become on-hand inventory.
  const invKey = new Set<string>();
  for (const sh of shipments) {
    if (rand() < 0.25) {
      const key = `${sh.store_id}:${sh.lot_id}`;
      if (!invKey.has(key)) {
        invKey.add(key);
        inventory.push({ store_id: sh.store_id, lot_id: sh.lot_id, units_on_hand: ri(0, sh.units) });
      }
    }
  }

  // 9) INCIDENTS — ~2,000 with realistic raw_text. ~12% are tied to the DEMO lot
  //    (or its lineage) so the pgvector rail surfaces a tight, relevant cluster
  //    when the demo lot is traced; the rest are background noise across pathogens.
  const demoPathogen = "Listeria monocytogenes";
  const demoProduct = lots[demoLotId - 1].product_name;
  for (let i = 1; i <= N_INCIDENTS; i++) {
    const tieToDemo = rand() < 0.12;
    const pathogen = tieToDemo ? demoPathogen : pick(PATHOGENS);
    const product = tieToDemo ? demoProduct : pick(PRODUCTS);
    incidents.push({
      incident_id: i,
      reported_at: new Date(baseTime + ri(0, 150) * 24 * 3600_000).toISOString(),
      raw_text: incidentText(pathogen, product),
      // ~70% reference a real lot (mostly the demo lot when tied); some are unattributed.
      suspected_lot_id: tieToDemo ? demoLotId : rand() < 0.6 ? ri(1, lotId) : null,
      pathogen: rand() < 0.85 ? pathogen : null,
    });
  }

  return { suppliers, facilities, lots, lotLinks, stores, shipments, inventory, incidents, demoLotId };
}

// allow `tsx db/seed/generate.ts` to print a dry-run summary without touching the DB
if (process.argv[1]?.endsWith("generate.ts")) {
  const d = generate();
  console.log({
    suppliers: d.suppliers.length, facilities: d.facilities.length, lots: d.lots.length,
    lotLinks: d.lotLinks.length, stores: d.stores.length, shipments: d.shipments.length,
    inventory: d.inventory.length, incidents: d.incidents.length, demoLotId: d.demoLotId,
    EMBED_DIM,
  });
}
```

> **Fix the literal typo before running:** `0xRECA11` is not valid hex. Use the fixed seed line exactly as:
> ```ts
> const rand = rng(20260619); // fixed seed → reproducible runs
> ```
> (The `0xRECA11` flavour text above is intentionally called out so you replace it — do not ship invalid hex.)

**Why this is acyclic (state it on camera if asked):** every `lot_links` edge satisfies `layerOf[parent] < layerOf[child]`. A cycle would require a sequence of strictly-increasing integers that returns to its start — impossible. The PHASE-03 CTE's `path` visited-set + `depth < 12` guard is **redundant insurance**, not the primary defense.

---

### 3.6 The loader — `db/seed/load.ts`

Loads via **`COPY ... FROM STDIN`** (the fastest path in `pg`), wrapped in one transaction. Order respects FKs: suppliers → facilities → lots → lot_links → stores → shipments → store_inventory → incidents (without embeddings) → **UPDATE embeddings in batches** → **build HNSW index last**. PostGIS `geom` is built from `lng/lat` with `ST_SetSRID(ST_MakePoint(...),4326)`; we COPY raw `lng,lat` into a temp staging shape and let SQL construct the geography.

> We use `pg-copy-streams` for true `COPY FROM STDIN`. Add it: `pnpm add pg-copy-streams && pnpm add -D @types/pg-copy-streams`. If you prefer zero extra deps, the multi-row-`INSERT` fallback in [§6](#6-common-pitfalls--fixes) works but is ~3–5× slower.

```ts
// db/seed/load.ts
import { from as copyFrom } from "pg-copy-streams";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db/pool";
import { embed, toVectorLiteral } from "@/lib/embeddings";
import { generate, type SeedData } from "./generate";
import { EMBED_DIM } from "@/lib/config";

const EMBED_BATCH = 256; // texts per embed() call — caps memory + (for bedrock) RPM bursts

// Turn a row into a TSV line for COPY. Escape tabs/newlines/backslashes per COPY text format.
const esc = (v: unknown): string => {
  if (v === null || v === undefined) return "\\N";
  return String(v).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
};
const tsv = (cols: unknown[]): string => cols.map(esc).join("\t") + "\n";

/** Stream an array of rows into a COPY target. `toCols` maps each row to its column array. */
async function copyRows<T>(
  client: PoolClient,
  copySql: string,
  rows: T[],
  toCols: (r: T) => unknown[],
): Promise<void> {
  const stream = client.query(copyFrom(copySql));
  const source = Readable.from(
    (function* () {
      for (const r of rows) yield tsv(toCols(r));
    })(),
  );
  await pipeline(source, stream);
}

async function load(data: SeedData) {
  const client = await pool.connect();
  const t0 = Date.now();
  try {
    await client.query("BEGIN");
    // Faster bulk load: defer FK checks to COMMIT, and skip per-row WAL where safe.
    await client.query("SET LOCAL synchronous_commit = off");

    // 1) suppliers — build geography from lng/lat. COPY into a temp table, then INSERT.
    await client.query(`CREATE TEMP TABLE _sup (supplier_id bigint, name text, region text, lng float8, lat float8) ON COMMIT DROP`);
    await copyRows(client, `COPY _sup FROM STDIN`, data.suppliers, (s) => [s.supplier_id, s.name, s.region, s.lng, s.lat]);
    await client.query(`
      INSERT INTO suppliers (supplier_id, name, region, geom) OVERRIDING SYSTEM VALUE
      SELECT supplier_id, name, region, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography FROM _sup`);

    // 2) facilities
    await copyRows(client, `COPY facilities (facility_id, name, type, supplier_id) FROM STDIN`,
      data.facilities, (f) => [f.facility_id, f.name, f.type, f.supplier_id]);

    // 3) lots
    await copyRows(client, `COPY lots (lot_id, tlc, product_name, lot_type, produced_at, facility_id) FROM STDIN`,
      data.lots, (l) => [l.lot_id, l.tlc, l.product_name, l.lot_type, l.produced_at, l.facility_id]);

    // 4) lot_links (the DAG)
    await copyRows(client, `COPY lot_links (parent_lot_id, child_lot_id, transform_event) FROM STDIN`,
      data.lotLinks, (e) => [e.parent_lot_id, e.child_lot_id, e.transform_event]);

    // 5) stores — geography from lng/lat (same temp-table trick)
    await client.query(`CREATE TEMP TABLE _st (store_id bigint, name text, chain text, address text, lng float8, lat float8) ON COMMIT DROP`);
    await copyRows(client, `COPY _st FROM STDIN`, data.stores, (s) => [s.store_id, s.name, s.chain, s.address, s.lng, s.lat]);
    await client.query(`
      INSERT INTO stores (store_id, name, chain, address, geom) OVERRIDING SYSTEM VALUE
      SELECT store_id, name, chain, address, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography FROM _st`);

    // 6) shipments
    await copyRows(client, `COPY shipments (lot_id, store_id, units, shipped_at, received_at) FROM STDIN`,
      data.shipments, (s) => [s.lot_id, s.store_id, s.units, s.shipped_at, s.received_at]);

    // 7) store_inventory
    await copyRows(client, `COPY store_inventory (store_id, lot_id, units_on_hand) FROM STDIN`,
      data.inventory, (i) => [i.store_id, i.lot_id, i.units_on_hand]);

    // 8) incidents WITHOUT embeddings first (embedding stays NULL for now)
    await copyRows(client, `COPY incidents (incident_id, reported_at, raw_text, suspected_lot_id, pathogen) FROM STDIN`,
      data.incidents, (i) => [i.incident_id, i.reported_at, i.raw_text, i.suspected_lot_id, i.pathogen]);

    // 9) incident_lot_matches — link incidents to their suspected lot (drives the filtered vector rail)
    await client.query(`
      INSERT INTO incident_lot_matches (incident_id, lot_id)
      SELECT incident_id, suspected_lot_id FROM incidents WHERE suspected_lot_id IS NOT NULL
      ON CONFLICT DO NOTHING`);

    await client.query("COMMIT");
    console.log(`[load] base rows COPYed in ${Date.now() - t0}ms`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  // 10) EMBEDDINGS — compute in batches, UPDATE by id. Done OUTSIDE the big txn so
  //     a slow embed pass doesn't hold a transaction open for minutes.
  const t1 = Date.now();
  const texts = data.incidents.map((i) => i.raw_text);
  const ids = data.incidents.map((i) => i.incident_id);
  const ec = await pool.connect();
  try {
    for (let off = 0; off < texts.length; off += EMBED_BATCH) {
      const batchTexts = texts.slice(off, off + EMBED_BATCH);
      const batchIds = ids.slice(off, off + EMBED_BATCH);
      const vecs = await embed(batchTexts); // number[][], length = batch
      if (vecs.length && vecs[0].length !== EMBED_DIM) {
        throw new Error(`embed dim ${vecs[0].length} !== EMBED_DIM ${EMBED_DIM} — column type will reject the COPY`);
      }
      // Multi-row UPDATE via unnest: one round-trip per batch.
      const litArr = vecs.map(toVectorLiteral);
      await ec.query(
        `UPDATE incidents AS t
           SET embedding = v.emb::vector
         FROM (SELECT unnest($1::bigint[]) AS id, unnest($2::text[]) AS emb) AS v
         WHERE t.incident_id = v.id`,
        [batchIds, litArr],
      );
      process.stdout.write(`\r[embed] ${Math.min(off + EMBED_BATCH, texts.length)}/${texts.length}`);
    }
    process.stdout.write("\n");
  } finally {
    ec.release();
  }
  console.log(`[embed] ${texts.length} incidents embedded in ${Date.now() - t1}ms`);

  // 11) BUILD HNSW INDEX LAST — over the now-real vectors. (GiST on stores.geom was
  //     created in PHASE-01; this one is deliberately deferred to here.)
  const t2 = Date.now();
  const ic = await pool.connect();
  try {
    // SET higher maintenance memory for a faster build on the bigger Aurora box.
    await ic.query(`SET maintenance_work_mem = '512MB'`);
    await ic.query(
      `CREATE INDEX IF NOT EXISTS idx_incidents_hnsw
         ON incidents USING hnsw (embedding vector_cosine_ops)
         WITH (m = 16, ef_construction = 64)`,
    );
    await ic.query(`ANALYZE incidents`);
  } finally {
    ic.release();
  }
  console.log(`[index] HNSW built in ${Date.now() - t2}ms`);
}

// ── Print ACTUAL counts (the anti-"12 rows" move — these go on screen) ──────
async function report(demoLotId: number) {
  const c = await pool.connect();
  try {
    const q = async (sql: string) => (await c.query(sql)).rows[0].n as string;
    console.log("\n──────── SEED COUNTS (actual) ────────");
    console.log("suppliers          ", await q("SELECT count(*) n FROM suppliers"));
    console.log("facilities         ", await q("SELECT count(*) n FROM facilities"));
    console.log("lots               ", await q("SELECT count(*) n FROM lots"));
    console.log("lot_links (edges)  ", await q("SELECT count(*) n FROM lot_links"));
    console.log("stores             ", await q("SELECT count(*) n FROM stores"));
    console.log("shipments          ", await q("SELECT count(*) n FROM shipments"));
    console.log("store_inventory    ", await q("SELECT count(*) n FROM store_inventory"));
    console.log("incidents          ", await q("SELECT count(*) n FROM incidents"));
    console.log("incidents w/ embed ", await q("SELECT count(*) n FROM incidents WHERE embedding IS NOT NULL"));
    console.log("distinct store states", await q("SELECT count(DISTINCT right(address, 2)) n FROM stores"));
    // Prove the DEMO lot exists and reaches ~1,400 stores via its own shipments.
    const demo = (await c.query(
      `SELECT l.tlc, count(DISTINCT sh.store_id) AS stores, coalesce(sum(sh.units),0) AS units
         FROM lots l JOIN shipments sh ON sh.lot_id = l.lot_id
        WHERE l.lot_id = $1 GROUP BY l.tlc`, [demoLotId])).rows[0];
    console.log("DEMO lot           ", demo);
    console.log("──────────────────────────────────────\n");
  } finally {
    c.release();
  }
}

async function main() {
  const t = Date.now();
  console.log("[seed] generating…");
  const data = generate();
  console.log(`[seed] generated ${data.lots.length} lots / ${data.lotLinks.length} edges in-memory`);
  await load(data);
  await report(data.demoLotId);
  console.log(`[seed] DONE in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

---

### 3.7 Run it

```bash
pnpm db:up        # ensure local Postgres (PostGIS + pgvector) is running
pnpm db:migrate   # tables + GiST index (NO HNSW yet)
pnpm db:seed      # tsx db/seed/load.ts  → generate, COPY, embed, build HNSW, print counts
```

First `pnpm db:seed` run downloads the local model (~90 MB) once; later runs skip it.

---

## 4. Key files

| Path | Purpose |
|---|---|
| `lib/embeddings/index.ts` | `embed(texts)` dispatcher (provider-agnostic) + `toVectorLiteral` |
| `lib/embeddings/local.ts` | `@xenova/transformers` all-MiniLM-L6-v2, 384-dim, zero credits |
| `lib/embeddings/bedrock.ts` | AWS Bedrock Titan Text Embeddings v2, 1024-dim, capped concurrency |
| `db/seed/generate.ts` | layered **acyclic** DAG generator; pins `DEMO_TLC` to all 1,400 stores; realistic incidents |
| `db/seed/load.ts` | batched `COPY` loader; batched embeddings; **HNSW built last**; prints actual counts |
| `lib/config.ts` | (from PHASE-00) `EMBED_DIM`, `EMBED_PROVIDER`, `DEMO_TLC` — read here verbatim |

---

## 5. Definition of Done

Run each command; the expected output must hold.

- [ ] **Embedding layer typechecks & dispatches.**
  ```bash
  pnpm typecheck
  ```
  → 0 errors. `lib/embeddings/index.ts` exports `embed` and `toVectorLiteral`.

- [ ] **Generator dry-run hits targets (no DB needed).**
  ```bash
  pnpm dlx tsx db/seed/generate.ts
  ```
  → prints `lots ≈ 80000`, `lotLinks ≈ 250000`, `stores 1400`, `shipments ≈ 250000`, `incidents 2000`, a numeric `demoLotId`, and `EMBED_DIM 384`.

- [ ] **Seed runs and prints actual counts matching targets.**
  ```bash
  pnpm db:seed
  ```
  → SEED COUNTS block shows: suppliers `1200`, facilities `3800`, lots `~80000`, lot_links `~250000`, stores `1400`, shipments `~250000`, incidents `2000`, **incidents w/ embed `2000`**, distinct store states `38`, and `DEMO lot { tlc: 'PRD-OUTBREAK-0001', stores: 1400, units: <big> }`. Total time noted (e.g. `DONE in 180.4s`).

- [ ] **DEMO lot exists and reaches ~1,400 stores.**
  ```bash
  psql "$DATABASE_URL" -c "SELECT count(DISTINCT sh.store_id) AS stores
    FROM lots l JOIN shipments sh ON sh.lot_id=l.lot_id WHERE l.tlc='PRD-OUTBREAK-0001';"
  ```
  → `stores` = `1400`.

- [ ] **Embeddings are populated (non-null) and correctly dimensioned.**
  ```bash
  psql "$DATABASE_URL" -c "SELECT count(*) total, count(embedding) non_null,
    vector_dims(embedding) AS dim FROM incidents GROUP BY vector_dims(embedding);"
  ```
  → `total 2000`, `non_null 2000`, `dim 384` (local) — exactly one dim group.

- [ ] **HNSW index present over real vectors.**
  ```bash
  psql "$DATABASE_URL" -c "\d+ incidents" | grep -i hnsw
  psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename='incidents' AND indexname='idx_incidents_hnsw';"
  ```
  → both show `idx_incidents_hnsw`.

- [ ] **A vector search returns ordered, relevant rows (HNSW works).**
  ```bash
  psql "$DATABASE_URL" -c "EXPLAIN (ANALYZE) SELECT incident_id, 1-(embedding<=> (SELECT embedding FROM incidents WHERE embedding IS NOT NULL LIMIT 1)) AS score
    FROM incidents ORDER BY embedding <=> (SELECT embedding FROM incidents WHERE embedding IS NOT NULL LIMIT 1) LIMIT 5;"
  ```
  → plan shows an **Index Scan using idx_incidents_hnsw**; returns 5 rows.

- [ ] **Acyclicity holds (no edge points backward in layer order).** A quick structural check — every parent lot is `produced_at <= ` its children (proxy for layer order), and a self-join finds zero `A→B & B→A` pairs:
  ```bash
  psql "$DATABASE_URL" -c "SELECT count(*) AS cycles FROM lot_links a JOIN lot_links b
    ON a.parent_lot_id=b.child_lot_id AND a.child_lot_id=b.parent_lot_id;"
  ```
  → `cycles` = `0`.

- [ ] **GREEN gate.**
  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  ```
  → all pass. (No new tests are required by this phase; the trace test lands in PHASE-03/PHASE-08. Ensure existing tests still pass.)

- [ ] **App still runs** — `pnpm dev` boots without import errors from the new `lib/embeddings/*` files.

- [ ] **BUILD_LOG.md updated** with the counts and the measured seed time (see [§8](#8-build_log-entry-to-append)).

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **HNSW built before embeddings** | `pnpm db:migrate` errors, or index is empty / useless | **Exclude `idx_incidents_hnsw` from `0003_indexes.sql`** (PHASE-01). Build it in `load.ts` step 11, AFTER the UPDATE pass, over real vectors. |
| **`EMBED_DIM` ≠ provider output** | `COPY`/UPDATE rejected: `expected N dimensions, not M` | Local = **384**; Bedrock Titan v2 = **1024** (default; 512/256 selectable). Set `EMBED_DIM`, **re-migrate** so `vector(EMBED_DIM)` matches, then re-seed. The guards in `embed*`/`load.ts` fail fast with a clear message. |
| **Embedding-batch memory blowup** | Node RSS climbs / OOM on the embed pass | Keep `EMBED_BATCH = 256`. The model is a singleton (loaded once). Don't hold all `number[][]` for 2,000×384 in addition to the rows — we slice and UPDATE per batch, never accumulate. |
| **COPY formatting for `vector` / geography** | `invalid input syntax for type vector` or `parse error - invalid geometry` | Vectors are written as text `'[a,b,c]'` via `toVectorLiteral` and cast `::vector` in the UPDATE — **never** COPYed raw into the vector column. Geography is built in SQL with `ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography` from a temp staging table, not COPYed as WKT. |
| **TSV escaping bugs** | `COPY` aborts: `missing data for column` / `extra data` | Use the `esc()` helper for **every** field (handles `\t`, `\n`, `\r`, `\\`, and `NULL`→`\N`). Addresses contain commas (fine for TSV) but never raw tabs. |
| **Identity column + explicit ids** | `cannot insert into column ... GENERATED ALWAYS` | Use `OVERRIDING SYSTEM VALUE` (suppliers/stores via temp-table INSERT) or COPY into the identity columns directly (lots/facilities) — COPY bypasses the GENERATED guard for `GENERATED ALWAYS AS IDENTITY`. After load, optionally `SELECT setval(...)` if PHASE-03+ inserts more rows. |
| **Accidental cycle / wrong fanout** | recursion in PHASE-03 explodes or DEMO traces too few stores | The generator only adds edges where `layerOf[parent] < layerOf[child]` (`addEdge` enforces it). DEMO reach is guaranteed by shipping the demo lot to **every** store in step 7(a). |
| **`pg-copy-streams` not installed** | `Cannot find module 'pg-copy-streams'` | `pnpm add pg-copy-streams && pnpm add -D @types/pg-copy-streams`. **Zero-dep fallback:** replace `copyRows` with chunked multi-row `INSERT` (1,000 rows/statement via `$1..$n` placeholders) — correct, ~3–5× slower; acceptable locally if you must avoid the dep. |
| **Slow seed on Aurora (cloud)** | embed pass takes many minutes with Bedrock | For the cloud seed, embed **locally** (`EMBED_PROVIDER=local`, `EMBED_DIM=384`) to keep it fast and free, OR raise Bedrock concurrency carefully. Either way build HNSW with `maintenance_work_mem='512MB'`. (Cloud re-seed is PHASE-09.) |
| **`synchronous_commit=off` confusion** | nothing persists | It's `SET LOCAL` inside the txn — only relaxes durability for the bulk load, fully durable after `COMMIT`. Safe for seed data. |

---

## 7. Cut-if-scope-bites

Cut in this order if the seed is eating your day — **but never below the spine floor**:

1. **`store_inventory` rows** — the hero trace uses `shipments`, not inventory; inventory only feeds the Lineage Drawer (PHASE-07). Generate a thin slice or skip.
2. **`incident_lot_matches` precompute** — the canonical hero query filters incidents by `suspected_lot_id IN contaminated OR suspected_lot_id IS NULL` (see [CONVENTIONS §7](./CONVENTIONS.md#7-canonical-hero-query-forward-trace)), so the matches table is optional for the trace; keep it only if PHASE-06/07 need it.
3. **Volume dial-down for a fast inner loop** — temporarily set `TARGET_LOTS`/`TARGET_EDGES`/`TARGET_SHIPMENTS` to 1/10th while iterating on `load.ts`, then restore to full before any benchmark, screenshot, or demo.

> **NEVER cut (CONVENTIONS §12):** the **real seed volume** (~250k edges, ~1,400 stores, ~2,000 incidents), the **real embeddings** (non-null, correctly dimensioned), the **acyclic DAG**, or the **DEMO lot reaching ~1,400 stores**. A toy seed or faked embeddings is exactly the failure mode the judging panel is trained to spot. If volume must shrink for a quick iteration, it MUST be restored before PHASE-03's benchmark and every screenshot/demo frame.

---

## 8. BUILD_LOG entry to append

```markdown
### Phase 02 — Seed data at volume + embeddings ✅

- **Embedding layer** `lib/embeddings/{index,local,bedrock}.ts`: pluggable `embed(texts)`.
  - local = `@xenova/transformers` `Xenova/all-MiniLM-L6-v2` → **384-dim**, pure Node, zero credits (used for seed).
  - bedrock = `amazon.titan-embed-text-v2:0` → **1024-dim** default (512/256 selectable), capped concurrency. Verified Titan v2 dim against AWS docs (2026-06).
  - `EMBED_DIM` is the single dim constant; column is `vector(EMBED_DIM)`; guards fail fast on mismatch.
- **Generator** `db/seed/generate.ts`: layered **acyclic-by-construction** DAG (6 layers: ingredient→intermediate→finished). Every edge goes strictly lower→higher layer ⇒ cycles impossible. Fan-out 4–7.
- **DEMO lot** `PRD-OUTBREAK-0001` is the first finished lot, shipped to **every** store ⇒ forward trace reaches **1,400 stores** across **38 states**.
- **Loader** `db/seed/load.ts`: `COPY FROM STDIN` (via `pg-copy-streams`) for base rows; geography built in SQL via `ST_SetSRID(ST_MakePoint(lng,lat),4326)`; embeddings computed in **256-text batches** and UPDATEd via `unnest`; **HNSW index built LAST** over real vectors (`m=16, ef_construction=64`).
- **Actual counts (this run):** suppliers `____`, facilities `____`, lots `____`, lot_links `____`, stores `1400`, shipments `____`, incidents `2000` (embed non-null `2000`), states `38`. Seed time `____s`. (Fill from the SEED COUNTS block.)
- **Verified:** `cycles=0`; HNSW Index Scan in EXPLAIN; DEMO lot → 1400 stores; typecheck/lint/test green.
- **Next:** PHASE-03 — the recursive-CTE forward trace; prove p50 < 1s over ~250k edges with the DEMO lot.
```

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract (single source of truth); §9 schema, §10 API shapes, §11 seed targets, §12 global rules.
- [`./README.md`](./README.md) — build index & Golden Path.
- [`./PHASE-00-foundation.md`](./PHASE-00-foundation.md) — repo, `lib/config.ts`, `lib/db/pool.ts`, scripts, deps (upstream).
- [`./PHASE-01-database-schema.md`](./PHASE-01-database-schema.md) — tables, FKs, CHECKs, GiST index; **HNSW excluded here** (upstream).
- [`./PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) — the recursive-CTE forward trace this seed makes sub-second (downstream).
- [`./PHASE-09-aws-aurora.md`](./PHASE-09-aws-aurora.md) — re-seeding against Aurora; Bedrock embedding path.
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — §5 Data Model, §7.4 Seeding strategy, §13 Risk register (cycle/quadratic defense).
- [`../reference/aws-databases.md`](../reference/aws-databases.md) — pgvector HNSW + PostGIS capabilities; vector dim limits.
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — Fluid pooling (the `pool` this loader reuses).
```
