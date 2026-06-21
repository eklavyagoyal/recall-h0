import { EMBED_DIM } from "@/lib/config";
import { SCENARIOS } from "@/lib/scenarios";

export type SupplierRow = {
  supplier_id: number;
  name: string;
  region: string;
  lng: number;
  lat: number;
};

export type FacilityRow = {
  facility_id: number;
  name: string;
  type: "farm" | "processor" | "distributor" | "warehouse";
  supplier_id: number;
};

export type LotRow = {
  lot_id: number;
  tlc: string;
  product_name: string;
  lot_type: "ingredient" | "intermediate" | "finished";
  produced_at: string;
  facility_id: number;
};

export type LotLinkRow = {
  parent_lot_id: number;
  child_lot_id: number;
  transform_event: string;
};

export type StoreRow = {
  store_id: number;
  name: string;
  chain: string;
  address: string;
  lng: number;
  lat: number;
};

export type ShipmentRow = {
  lot_id: number;
  store_id: number;
  units: number;
  shipped_at: string;
  received_at: string | null;
};

export type InventoryRow = {
  store_id: number;
  lot_id: number;
  units_on_hand: number;
};

export type IncidentRow = {
  incident_id: number;
  reported_at: string;
  raw_text: string;
  suspected_lot_id: number | null;
  pathogen: string | null;
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

const supplierCount = 1_200;
const facilityCount = 3_800;
const storeCount = 1_400;
const incidentCount = 2_000;
const targetLots = 80_000;
const targetEdges = 250_000;
const targetShipments = 250_000;
const fanoutMin = 4;
const fanoutMax = 7;
const layerCount = 6;

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20260619);

function ri(low: number, high: number): number {
  return low + Math.floor(rand() * (high - low + 1));
}

function pick<T>(values: readonly T[]): T {
  const value = values[Math.floor(rand() * values.length)];
  if (value === undefined) {
    throw new Error("Cannot pick from an empty array.");
  }
  return value;
}

/** A deterministic sample of `n` distinct store ids (the scenario blast radius). */
function sampleStores(n: number): number[] {
  if (n >= storeCount) return Array.from({ length: storeCount }, (_, i) => i + 1);
  const set = new Set<number>();
  let guard = 0;
  while (set.size < n && guard < n * 25) {
    guard++;
    set.add(ri(1, storeCount));
  }
  return [...set];
}

const usAnchors = [
  ["AL", "Birmingham", 33.5186, -86.8104],
  ["AZ", "Phoenix", 33.4484, -112.074],
  ["AR", "Little Rock", 34.7465, -92.2896],
  ["CA", "Los Angeles", 34.0522, -118.2437],
  ["CA", "Sacramento", 38.5816, -121.4944],
  ["CO", "Denver", 39.7392, -104.9903],
  ["CT", "Hartford", 41.7637, -72.6851],
  ["FL", "Miami", 25.7617, -80.1918],
  ["FL", "Orlando", 28.5383, -81.3792],
  ["GA", "Atlanta", 33.749, -84.388],
  ["ID", "Boise", 43.615, -116.2023],
  ["IL", "Chicago", 41.8781, -87.6298],
  ["IN", "Indianapolis", 39.7684, -86.1581],
  ["IA", "Des Moines", 41.5868, -93.625],
  ["KS", "Wichita", 37.6872, -97.3301],
  ["KY", "Louisville", 38.2527, -85.7585],
  ["LA", "New Orleans", 29.9511, -90.0715],
  ["MD", "Baltimore", 39.2904, -76.6122],
  ["MA", "Boston", 42.3601, -71.0589],
  ["MI", "Detroit", 42.3314, -83.0458],
  ["MN", "Minneapolis", 44.9778, -93.265],
  ["MO", "St. Louis", 38.627, -90.1994],
  ["MS", "Jackson", 32.2988, -90.1848],
  ["NE", "Omaha", 41.2565, -95.9345],
  ["NV", "Las Vegas", 36.1699, -115.1398],
  ["NJ", "Newark", 40.7357, -74.1724],
  ["NM", "Albuquerque", 35.0844, -106.6504],
  ["NY", "New York", 40.7128, -74.006],
  ["NC", "Charlotte", 35.2271, -80.8431],
  ["OH", "Columbus", 39.9612, -82.9988],
  ["OK", "Oklahoma City", 35.4676, -97.5164],
  ["OR", "Portland", 45.5152, -122.6784],
  ["PA", "Philadelphia", 39.9526, -75.1652],
  ["SC", "Columbia", 34.0007, -81.0348],
  ["TN", "Nashville", 36.1627, -86.7816],
  ["TX", "Houston", 29.7604, -95.3698],
  ["TX", "Dallas", 32.7767, -96.797],
  ["UT", "Salt Lake City", 40.7608, -111.891],
  ["VA", "Richmond", 37.5407, -77.436],
  ["WA", "Seattle", 47.6062, -122.3321],
  ["WI", "Milwaukee", 43.0389, -87.9065],
] as const satisfies readonly (readonly [string, string, number, number])[];

const chains = [
  "FreshMart",
  "GreenGrocer",
  "ValuFoods",
  "Harvest Table",
  "DailyBasket",
  "NorthStar Foods",
] as const;
const products = [
  "Romaine Lettuce",
  "Spinach",
  "Cantaloupe",
  "Ground Beef",
  "Peanut Butter",
  "Bagged Salad",
  "Sprouts",
  "Onions",
  "Deli Turkey",
  "Soft Cheese",
  "Frozen Berries",
  "Cucumbers",
] as const;
const transforms = [
  "wash",
  "chop",
  "blend",
  "package",
  "repack",
  "grind",
  "slice",
  "freeze",
  "mix",
  "label",
] as const;
const pathogens = [
  "Listeria monocytogenes",
  "Salmonella",
  "E. coli O157:H7",
  "Cyclospora",
  "Norovirus",
] as const;
const facilityTypes = ["farm", "processor", "distributor", "warehouse"] as const;
const symptomFragments = [
  "severe stomach cramps and watery diarrhea within 24 hours of eating",
  "high fever, chills, and vomiting after consuming",
  "bloody diarrhea and dehydration reported by multiple customers who bought",
  "nausea and prolonged fatigue traced to a recent purchase of",
  "hospitalized with kidney complications after eating",
  "outbreak of gastrointestinal illness linked to",
] as const;

function incidentText(pathogen: string, product: string): string {
  const intro = pick([
    "Consumer complaint:",
    "Lab confirmation:",
    "FDA alert:",
    "Store-level report:",
    "Hospital notification:",
  ]);
  const symptom = pick(symptomFragments);
  const tail = pick([
    `Suspected ${pathogen}.`,
    `${pathogen} suspected pending culture.`,
    `Pathogen panel positive for ${pathogen}.`,
    `Symptoms consistent with ${pathogen}.`,
  ]);
  return `${intro} ${symptom} ${product}. ${tail}`;
}

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
  const hours = (n: number) => new Date(baseTime + n * 3_600_000).toISOString();

  for (let id = 1; id <= supplierCount; id++) {
    const [state, , lat, lng] = pick(usAnchors);
    suppliers.push({
      supplier_id: id,
      name: `Supplier ${id} (${state})`,
      region: state,
      lng: lng + (rand() - 0.5) * 1.5,
      lat: lat + (rand() - 0.5) * 1.5,
    });
  }

  for (let id = 1; id <= facilityCount; id++) {
    facilities.push({
      facility_id: id,
      name: `Facility ${id}`,
      type: pick(facilityTypes),
      supplier_id: ri(1, supplierCount),
    });
  }

  const layerOf: number[] = [0];
  const layerLots: number[][] = Array.from({ length: layerCount }, () => []);
  const layerWeights = [0.3, 0.22, 0.18, 0.14, 0.1, 0.06] as const;
  let lotId = 0;

  for (let layer = 0; layer < layerCount; layer++) {
    const count = Math.round(targetLots * (layerWeights[layer] ?? 0));
    const lotType: LotRow["lot_type"] =
      layer === 0 ? "ingredient" : layer === layerCount - 1 ? "finished" : "intermediate";

    for (let index = 0; index < count; index++) {
      lotId++;
      const prefix = lotType === "ingredient" ? "ING" : lotType === "finished" ? "PRD" : "INT";
      lots.push({
        lot_id: lotId,
        tlc: `${prefix}-${String(lotId).padStart(7, "0")}`,
        product_name: pick(products),
        lot_type: lotType,
        produced_at: hours(layer * 48 + ri(0, 47)),
        facility_id: ri(1, facilityCount),
      });
      layerOf[lotId] = layer;
      layerLots[layer]?.push(lotId);
    }
  }

  const demoLayer = layerCount - 2;
  const finishedLayer = layerCount - 1;

  // Curate the five demo scenarios: take the first lots of the demo layer and turn
  // each into a named "finished" outbreak lot with its own product + pathogen.
  const scenarioLots = SCENARIOS.map((scenario, i) => {
    const id = layerLots[demoLayer]?.[i];
    if (!id) throw new Error(`Failed to choose scenario lot ${i}.`);
    const lot = lots[id - 1];
    if (!lot) throw new Error(`Scenario lot ${id} index missing.`);
    lot.tlc = scenario.tlc;
    lot.product_name = scenario.product;
    lot.lot_type = "finished";
    return { scenario, lotId: id };
  });
  const scenarioChildren: number[][] = scenarioLots.map(() => []);
  const demoLotId = scenarioLots[0]?.lotId;
  if (!demoLotId) throw new Error("No scenario lots generated.");

  // Keep each scenario lot's downstream graph isolated so its blast radius is exactly
  // its curated store set: scenario lots get NO random outgoing edges (only the
  // explicit children added below), and those children are excluded from random fill.
  const scenarioLotIdSet = new Set(scenarioLots.map((entry) => entry.lotId));
  const scenarioChildSet = new Set<number>();
  let allowScenarioEdges = false;

  const edgeKey = new Set<string>();
  const addEdge = (parent: number, child: number) => {
    if (parent === child) return;
    if (!allowScenarioEdges && scenarioLotIdSet.has(parent)) return;
    if ((layerOf[parent] ?? 0) >= (layerOf[child] ?? 0)) return;
    const key = `${parent}:${child}`;
    if (edgeKey.has(key)) return;
    edgeKey.add(key);
    lotLinks.push({
      parent_lot_id: parent,
      child_lot_id: child,
      transform_event: pick(transforms),
    });
  };

  for (let layer = 1; layer < layerCount; layer++) {
    for (const child of layerLots[layer] ?? []) {
      const parentCount = ri(1, 3);
      for (let index = 0; index < parentCount; index++) {
        const sourceLayer = rand() < 0.7 ? layer - 1 : ri(0, layer - 1);
        addEdge(pick(layerLots[sourceLayer] ?? []), child);
      }
    }
  }

  allowScenarioEdges = true;
  scenarioLots.forEach(({ scenario, lotId }, i) => {
    const start = i * 120;
    for (const child of (layerLots[finishedLayer] ?? []).slice(start, start + scenario.children)) {
      addEdge(lotId, child);
      scenarioChildren[i]?.push(child);
      scenarioChildSet.add(child);
    }
  });
  allowScenarioEdges = false;

  outer: for (let layer = 0; layer < layerCount - 1; layer++) {
    for (const parent of layerLots[layer] ?? []) {
      const fanout = ri(fanoutMin, fanoutMax);
      for (let fan = 0; fan < fanout; fan++) {
        addEdge(parent, pick(layerLots[layer + 1] ?? []));
        if (lotLinks.length >= targetEdges) break outer;
      }
    }
  }

  const firstStoreAnchors = Array.from(
    new Map(usAnchors.map((anchor) => [anchor[0], anchor])).values(),
  );
  for (let id = 1; id <= storeCount; id++) {
    const [state, city, lat, lng] = firstStoreAnchors[id - 1] ?? pick(usAnchors);
    stores.push({
      store_id: id,
      name: `${pick(chains)} #${id}`,
      chain: pick(chains),
      address: `${ri(100, 9999)} Main St, ${city}, ${state}`,
      lng: lng + (rand() - 0.5) * 0.8,
      lat: lat + (rand() - 0.5) * 0.8,
    });
  }

  const finishedLots = layerLots[finishedLayer] ?? [];
  const shipKey = new Set<string>();
  const addShipment = (currentLotId: number, storeId: number): boolean => {
    const key = `${currentLotId}:${storeId}`;
    if (shipKey.has(key)) return false;
    shipKey.add(key);
    const shippedAt = baseTime + ri(0, 120) * 24 * 3_600_000;
    shipments.push({
      lot_id: currentLotId,
      store_id: storeId,
      units: ri(20, 600),
      shipped_at: new Date(shippedAt).toISOString(),
      received_at:
        rand() < 0.9 ? new Date(shippedAt + ri(12, 72) * 3_600_000).toISOString() : null,
    });
    return true;
  };

  // Each scenario lot ships to its own blast radius; its children ship only WITHIN
  // that set, so the affected-store count stays controlled and distinct per scenario.
  scenarioLots.forEach(({ scenario, lotId }, i) => {
    const storeIds = sampleStores(scenario.targetStores);
    for (const storeId of storeIds) addShipment(lotId, storeId);
    for (const child of scenarioChildren[i] ?? []) {
      for (let k = 0; k < 10; k++) {
        const storeId = storeIds[Math.floor(rand() * storeIds.length)];
        if (storeId !== undefined) addShipment(child, storeId);
      }
    }
  });

  const fillLots = finishedLots.filter((id) => !scenarioChildSet.has(id));
  let shipmentGuard = 0;
  while (shipments.length < targetShipments && shipmentGuard < targetShipments * 4) {
    shipmentGuard++;
    addShipment(pick(fillLots), ri(1, storeCount));
  }

  const inventoryKey = new Set<string>();
  for (const shipment of shipments) {
    if (rand() < 0.25) {
      const key = `${shipment.store_id}:${shipment.lot_id}`;
      if (!inventoryKey.has(key)) {
        inventoryKey.add(key);
        inventory.push({
          store_id: shipment.store_id,
          lot_id: shipment.lot_id,
          units_on_hand: ri(0, shipment.units),
        });
      }
    }
  }

  for (let id = 1; id <= incidentCount; id++) {
    const tied = rand() < 0.16 ? scenarioLots[Math.floor(rand() * scenarioLots.length)] : undefined;
    const pathogen = tied ? tied.scenario.pathogen : pick(pathogens);
    const product = tied ? tied.scenario.product : pick(products);
    incidents.push({
      incident_id: id,
      reported_at: new Date(baseTime + ri(0, 150) * 24 * 3_600_000).toISOString(),
      raw_text: incidentText(pathogen, product),
      suspected_lot_id: tied ? tied.lotId : rand() < 0.6 ? ri(1, lotId) : null,
      pathogen: rand() < 0.85 ? pathogen : null,
    });
  }

  return { suppliers, facilities, lots, lotLinks, stores, shipments, inventory, incidents, demoLotId };
}

if (process.argv[1]?.endsWith("generate.ts")) {
  const data = generate();
  console.log({
    suppliers: data.suppliers.length,
    facilities: data.facilities.length,
    lots: data.lots.length,
    lotLinks: data.lotLinks.length,
    stores: data.stores.length,
    shipments: data.shipments.length,
    inventory: data.inventory.length,
    incidents: data.incidents.length,
    demoLotId: data.demoLotId,
    EMBED_DIM,
  });
}
