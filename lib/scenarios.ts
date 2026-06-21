/**
 * The five demo outbreak scenarios — a single source of truth shared by the seed
 * generator (db/seed/generate.ts) and the console UI (the scenario cycler).
 *
 * Each scenario is a real, curated "finished" lot in the seeded graph: it fans out
 * to `targetStores` distinct stores and gets `children` downstream lots, so every
 * scenario traces live against Aurora with a distinct, meaningful blast radius.
 * All five products also appear across the incident corpus, so the pgvector
 * similar-incident search returns product-relevant results for each.
 */
export type Scenario = {
  id: number;
  tlc: string;
  product: string;
  pathogen: string;
  /** Short human scale label, e.g. "Nationwide". */
  scale: string;
  /** One-line description for the cycler card. */
  blurb: string;
  /** UI accent. */
  accent: "red" | "amber" | "teal";
  /** Seed: ship the scenario lot to this many distinct stores (the blast radius). */
  targetStores: number;
  /** Seed: number of downstream finished lots wired under this scenario. */
  children: number;
};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 1,
    tlc: "PRD-OUTBREAK-0001",
    product: "Romaine Lettuce",
    pathogen: "Listeria monocytogenes",
    scale: "Nationwide",
    blurb: "A bagged-salad lot blended from a single contaminated field.",
    accent: "red",
    targetStores: 1400,
    children: 80,
  },
  {
    id: 2,
    tlc: "PRD-OUTBREAK-0002",
    product: "Ground Beef",
    pathogen: "E. coli O157:H7",
    scale: "Multi-state",
    blurb: "One grinder run distributed across a regional cold chain.",
    accent: "red",
    targetStores: 920,
    children: 55,
  },
  {
    id: 3,
    tlc: "PRD-OUTBREAK-0003",
    product: "Peanut Butter",
    pathogen: "Salmonella",
    scale: "Regional",
    blurb: "A jarred lot from a processor with a positive environmental swab.",
    accent: "amber",
    targetStores: 610,
    children: 40,
  },
  {
    id: 4,
    tlc: "PRD-OUTBREAK-0004",
    product: "Cantaloupe",
    pathogen: "Listeria monocytogenes",
    scale: "Targeted",
    blurb: "Whole melons from one packing house, narrow distribution.",
    accent: "amber",
    targetStores: 360,
    children: 25,
  },
  {
    id: 5,
    tlc: "PRD-OUTBREAK-0005",
    product: "Frozen Berries",
    pathogen: "Norovirus",
    scale: "Contained",
    blurb: "A frozen lot caught early — a small, contained footprint.",
    accent: "teal",
    targetStores: 180,
    children: 15,
  },
] as const;

export const DEFAULT_SCENARIO = SCENARIOS[0];
