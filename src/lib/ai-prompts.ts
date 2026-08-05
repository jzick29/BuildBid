// AI-assisted estimating — structured prompt templates + deterministic smart parser.
// Isomorphic module: no Node dependencies, safe to import from client or server.
// The parser extracts equipment/types/quantities from plain-English job descriptions
// and maps them to realistic per-trade line items (pricing mirrors the seeded
// templates + supplier catalog overrides supplied by the caller).

export type Confidence = "high" | "medium" | "low";

export type AiLineItem = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  markup: number;
  confidence: Confidence;
  /** labor hours per unit of quantity */
  laborPerUnit: number;
};

export type AiEstimateResult = {
  lineItems: AiLineItem[];
  laborHours: number;
  materialsSubtotal: number;
  laborSubtotal: number;
  recommendedMarkup: number;
  laborRate: number;
  trade: string;
  location: string;
  regionMultiplier: number;
  squareFootage: number;
  rooms: number;
  matched: string[];
  note: string;
};

export type AiParseOptions = {
  location?: string;
  squareFootage?: number;
  rooms?: number;
  /** Supplier catalog rows: { name, unit, unit_cost, trade } — used to override unit costs */
  catalog?: { name: string; unit?: string; unit_cost?: number; trade?: string }[];
  photoCount?: number;
};

// ---------------------------------------------------------------------------
// Trade profiles
// ---------------------------------------------------------------------------
export const TRADE_PROFILES: Record<
  string,
  { label: string; laborRate: number; defaultMarkup: number; context: string }
> = {
  plumbing: {
    label: "Plumbing",
    laborRate: 95,
    defaultMarkup: 20,
    context:
      "water heater replacement (electric 30/40/50-gal, gas, tankless), gas line runs (CSST), sewer line replacement, fixture installs (toilet, faucet, sink), re-pipes, expansion tanks, permits",
  },
  electrical: {
    label: "Electrical",
    laborRate: 85,
    defaultMarkup: 15,
    context:
      "panel upgrades (100A/200A), EV charger installs (50A), whole-house rewires, outlet/switch installs, LED lighting retrofits, recessed lighting, ceiling fans, permits",
  },
  hvac: {
    label: "HVAC",
    laborRate: 95,
    defaultMarkup: 20,
    context:
      "furnace replacement (80/95% AFUE), central AC replacement (14/16/18 SEER), heat pumps, ductwork replacement, smart thermostats, line sets, permits",
  },
  roofing: {
    label: "Roofing",
    laborRate: 70,
    defaultMarkup: 20,
    context:
      "asphalt shingle re-roofs (per square), standing seam metal, TPO/flat, gutters & downspouts, underlayment, ice & water shield, ridge cap, demo & tear-off",
  },
  general: {
    label: "General",
    laborRate: 65,
    defaultMarkup: 15,
    context:
      "kitchen remodels, bathroom remodels, basement finishes, deck builds, drywall, flooring (LVP/tile), demo & disposal, painting, framing",
  },
};

export const TRADE_KEYS = Object.keys(TRADE_PROFILES);

// ---------------------------------------------------------------------------
// Regional pricing adjustment (state → multiplier). Defaults to 1.0.
// ---------------------------------------------------------------------------
const STATE_MULTIPLIERS: Record<string, number> = {
  CA: 1.22, NY: 1.15, MA: 1.12, NJ: 1.1, HI: 1.25, CT: 1.1, WA: 1.08, OR: 1.06,
  CO: 1.05, IL: 1.05, AZ: 1.02, TX: 1.0, FL: 0.98, PA: 0.97, NC: 0.95, OH: 0.95,
  MI: 0.96, GA: 0.94, TN: 0.93, SC: 0.94, IN: 0.95, VA: 0.98, MD: 1.03, MN: 1.02,
};
const STATE_NAMES: Record<string, string> = {
  california: "CA", "new york": "NY", massachusetts: "MA", "new jersey": "NJ",
  hawaii: "HI", connecticut: "CT", washington: "WA", oregon: "OR", colorado: "CO",
  illinois: "IL", arizona: "AZ", texas: "TX", florida: "FL", pennsylvania: "PA",
  "north carolina": "NC", ohio: "OH", michigan: "MI", georgia: "GA", tennessee: "TN",
  "south carolina": "SC", indiana: "IN", virginia: "VA", maryland: "MD", minnesota: "MN",
};

export function regionMultiplier(location?: string): number {
  if (!location) return 1.0;
  const loc = location.toLowerCase();
  // Match a 2-letter state code
  const codeMatch = loc.match(/\b([a-z]{2})\b/g);
  if (codeMatch) {
    for (const c of codeMatch) {
      const key = c.toUpperCase();
      if (STATE_MULTIPLIERS[key]) return STATE_MULTIPLIERS[key];
    }
  }
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (loc.includes(name) && STATE_MULTIPLIERS[code]) return STATE_MULTIPLIERS[code];
  }
  return 1.0;
}

// ---------------------------------------------------------------------------
// Keyword catalog — realistic per-trade line items (mirrors seeded templates)
// ---------------------------------------------------------------------------
type MeasureKey = "gallons" | "amps" | "sqft" | "feet" | "tons" | "btu" | "rooms";

type CatalogEntry = {
  trades: string[];
  /** Keywords whose presence marks this item as clearly described (high confidence) */
  anchor: string[];
  /** Secondary keywords (medium confidence) */
  also?: string[];
  name: string;
  description: string;
  unit: string;
  cost: number;
  markup: number;
  /** default quantity when the measure isn't extractable */
  qty: number;
  laborPerUnit: number;
  /** measure to extract quantity from */
  measure?: MeasureKey;
  /** baseline for scaling with square footage (unit: sqft) */
  scaleSqft?: number;
  /** baseline for scaling with room count */
  scaleRooms?: number;
  /** spec measure to surface in the item name (gallons/amps/btu/tons) */
  spec?: MeasureKey;
  /** always included when trade matches and no other item of the same family matched */
  fallback?: boolean;
};

const CATALOG: CatalogEntry[] = [
  // ---- Plumbing ----
  { trades: ["plumbing"], anchor: ["water heater", "hot water heater"], also: ["hwh", "40-gallon", "50-gallon"], name: "Water Heater Replacement", description: "Supply & install water heater of the described size with basic fittings", unit: "each", cost: 550, markup: 20, qty: 1, laborPerUnit: 3, spec: "gallons" },
  { trades: ["plumbing"], anchor: ["tankless"], name: "Tankless Water Heater", description: "High-efficiency gas tankless water heater with vent kit", unit: "each", cost: 1200, markup: 20, qty: 1, laborPerUnit: 6 },
  { trades: ["plumbing"], anchor: ["expansion tank"], name: "Expansion Tank", description: "Thermal expansion tank for water heater", unit: "each", cost: 65, markup: 20, qty: 1, laborPerUnit: 0.5 },
  { trades: ["plumbing"], anchor: ["gas line", "run gas", "new gas"], also: ["csst", "gas piping"], name: "Gas Line Installation", description: "New gas line (CSST) with fittings, shutoff valve and pressure test", unit: "ft", cost: 4.75, markup: 20, qty: 15, laborPerUnit: 0.2, measure: "feet" },
  { trades: ["plumbing"], anchor: ["sewer line", "sewer main"], name: "Sewer Line Replacement", description: "Replace main sewer line with Schedule 40 PVC including excavation", unit: "ft", cost: 3.25, markup: 20, qty: 60, laborPerUnit: 0.35, measure: "feet" },
  { trades: ["plumbing"], anchor: ["toilet"], name: "Toilet Replacement", description: "Supply & install standard 1.28 gpf toilet with wax ring", unit: "each", cost: 220, markup: 20, qty: 1, laborPerUnit: 2 },
  { trades: ["plumbing"], anchor: ["faucet", "kitchen sink"], name: "Kitchen Faucet / Sink Install", description: "Supply & install faucet and/or sink with supply lines", unit: "each", cost: 180, markup: 20, qty: 1, laborPerUnit: 2 },
  { trades: ["plumbing"], anchor: ["re-pipe", "repiping", "repipes"], name: "Water Re-Pipe", description: "Replace supply piping (PEX) in the described area", unit: "ft", cost: 6, markup: 20, qty: 100, laborPerUnit: 0.12, measure: "feet" },
  // ---- Electrical ----
  { trades: ["electrical"], anchor: ["panel upgrade", "panel replacement", "upgrade panel", "new panel", "service panel", "panel"], name: "Electrical Panel Upgrade", description: "Replace/upgrade main service panel with breakers", unit: "each", cost: 450, markup: 15, qty: 1, laborPerUnit: 8, spec: "amps" },
  { trades: ["electrical"], anchor: ["ev charger", "level 2 charger", "charger install", "ev charging"], name: "EV Charger Installation", description: "Level 2 EV charger with dedicated 50A circuit", unit: "each", cost: 550, markup: 15, qty: 1, laborPerUnit: 4, spec: "amps" },
  { trades: ["electrical"], anchor: ["rewire", "rewiring"], name: "Whole-House Rewire", description: "Replace wiring (12/2 & 14/2 NM-B), outlets and switches", unit: "sqft", cost: 1.5, markup: 15, qty: 2000, laborPerUnit: 0.06, measure: "sqft", scaleSqft: 2000, scaleRooms: 3 },
  { trades: ["electrical"], anchor: ["outlet", "receptacle", "plug"], also: ["receptacles"], name: "Outlets & Switches", description: "Tamper-resistant outlets and switches", unit: "each", cost: 3.5, markup: 15, qty: 10, laborPerUnit: 0.4, scaleRooms: 5 },
  { trades: ["electrical"], anchor: ["led", "lighting", "recessed", "fixtures"], name: "LED Lighting Retrofit", description: "LED panels/retrofit trims with dimmer switches", unit: "each", cost: 14, markup: 15, qty: 12, laborPerUnit: 0.75, scaleRooms: 4 },
  { trades: ["electrical"], anchor: ["ceiling fan"], name: "Ceiling Fan Installation", description: "Supply & install ceiling fan with remote", unit: "each", cost: 120, markup: 15, qty: 1, laborPerUnit: 2 },
  { trades: ["electrical"], anchor: ["circuit", "new circuit", "dedicated circuit"], name: "New Circuit (Branch)", description: "New branch circuit with breaker and wiring", unit: "each", cost: 250, markup: 15, qty: 1, laborPerUnit: 3, measure: "amps" },
  // ---- HVAC ----
  { trades: ["hvac"], anchor: ["furnace"], name: "Furnace Replacement", description: "Replace furnace (AFUE per description) including line set/vent work", unit: "each", cost: 1200, markup: 20, qty: 1, laborPerUnit: 8, spec: "btu" },
  { trades: ["hvac"], anchor: ["ac", "air conditioner", "condensing unit", "a/c"], name: "Central AC Replacement", description: "Condensing unit and evaporator coil (SEER per description)", unit: "each", cost: 2200, markup: 20, qty: 1, laborPerUnit: 10, spec: "tons" },
  { trades: ["hvac"], anchor: ["heat pump"], name: "Heat Pump Installation", description: "Cold-climate heat pump with air handler and lineset", unit: "each", cost: 3800, markup: 20, qty: 1, laborPerUnit: 12, spec: "tons" },
  { trades: ["hvac"], anchor: ["ductwork", "ducts", "duct "], name: "Ductwork Replacement", description: "Replace ductwork with R-8 flex duct, registers and grilles", unit: "sqft", cost: 4.5, markup: 20, qty: 1500, laborPerUnit: 0.02, measure: "sqft", scaleSqft: 1500 },
  { trades: ["hvac"], anchor: ["thermostat"], name: "Smart Thermostat", description: "Supply & install smart thermostat with wiring", unit: "each", cost: 250, markup: 20, qty: 1, laborPerUnit: 1.5 },
  // ---- Roofing ----
  { trades: ["roofing"], anchor: ["shingle", "re-roof", "re roof", "roofing"], name: "Asphalt Shingle Roof", description: "Architectural shingles per square with underlayment", unit: "sq", cost: 120, markup: 20, qty: 25, laborPerUnit: 3.2, scaleSqft: 2500 },
  { trades: ["roofing"], anchor: ["metal roof", "standing seam"], name: "Standing Seam Metal Roof", description: "16in standing seam panels with underlayment and trim", unit: "sq", cost: 280, markup: 20, qty: 25, laborPerUnit: 3.2, scaleSqft: 2500 },
  { trades: ["roofing"], anchor: ["tpo", "flat roof", "membrane"], name: "Flat / TPO Roof", description: "60-mil TPO membrane over insulation board", unit: "sq", cost: 165, markup: 20, qty: 10, laborPerUnit: 4, scaleSqft: 1000 },
  { trades: ["roofing"], anchor: ["gutter", "downspout"], name: "Gutters & Downspouts", description: "Seamless aluminum gutters with downspouts and hangers", unit: "ft", cost: 4.25, markup: 20, qty: 180, laborPerUnit: 0.07, measure: "feet" },
  { trades: ["roofing"], anchor: ["tear-off", "remove old roof"], name: "Roof Tear-Off & Haul", description: "Remove old roofing and dispose", unit: "sq", cost: 55, markup: 15, qty: 25, laborPerUnit: 1.2, scaleSqft: 2500 },
  // ---- General ----
  { trades: ["general"], anchor: ["kitchen"], name: "Kitchen Remodel", description: "Stock cabinets, quartz counters, LVP flooring, sink & faucet, demo", unit: "lump", cost: 4500, markup: 15, qty: 1, laborPerUnit: 80 },
  { trades: ["general"], anchor: ["bathroom", "bath remodel", "master bath"], name: "Bathroom Remodel", description: "Demo, fixtures, tile, vanity and plumbing rough-in", unit: "lump", cost: 1800, markup: 15, qty: 1, laborPerUnit: 60 },
  { trades: ["general"], anchor: ["basement"], name: "Basement Finish", description: "Drywall, LVP flooring, insulation, electrical rough-in, bath rough-in", unit: "sqft", cost: 6, markup: 15, qty: 1000, laborPerUnit: 0.12, measure: "sqft", scaleSqft: 1000 },
  { trades: ["general"], anchor: ["deck"], name: "Composite Deck Build", description: "Composite decking, PT framing, railing and footings", unit: "sqft", cost: 22, markup: 15, qty: 320, laborPerUnit: 0.2, measure: "sqft", scaleSqft: 320 },
  { trades: ["general"], anchor: ["drywall", "sheetrock"], name: "Drywall & Finish", description: "Drywall install, tape, float and texture", unit: "sqft", cost: 2.2, markup: 15, qty: 1500, laborPerUnit: 0.06, measure: "sqft", scaleSqft: 1500 },
  { trades: ["general"], anchor: ["paint"], name: "Interior Painting", description: "Prime & paint walls and trim", unit: "sqft", cost: 1.8, markup: 15, qty: 2000, laborPerUnit: 0.045, measure: "sqft", scaleSqft: 2000 },
  // ---- Universal fallbacks ----
  { trades: ["plumbing", "electrical", "hvac", "roofing", "general"], anchor: ["permit"], name: "Permit & Inspection", description: "Local permit and inspection fees", unit: "lump", cost: 250, markup: 0, qty: 1, laborPerUnit: 0, fallback: true },
  { trades: ["plumbing", "electrical", "hvac", "roofing", "general"], anchor: ["remove old", "remove existing", "remove the old", "tear out", "demo"], name: "Removal & Disposal", description: "Remove existing equipment/fixtures and haul away", unit: "lump", cost: 200, markup: 10, qty: 1, laborPerUnit: 1, fallback: true },
];

// ---------------------------------------------------------------------------
// Quantity extraction helpers
// ---------------------------------------------------------------------------
const MEASURE_RE: Record<MeasureKey, RegExp> = {
  gallons: /\b(\d{1,3})\s*(?:gal|gallon|gallons)\b/i,
  amps: /\b(\d{2,3})\s*(?:amp|amps|a)\b/i,
  sqft: /\b(\d{1,5}(?:[.,]\d+)?)\s*(?:sq\s*ft|sqft|square\s*feet|square\s*foot|sf)\b/i,
  feet: /\b(\d{1,4})\s*(?:ft|feet|foot)\b/i,
  tons: /\b(\d(?:\.\d)?)\s*[- ]?ton\b/i,
  btu: /\b(\d{2,5}k?)\s*btu\b/i,
  rooms: /\b(\d{1,2})\s*(?:bedroom|room)s?\b/i,
};

function extractMeasure(text: string, key: MeasureKey): number | null {
  const m = text.match(MEASURE_RE[key]);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

// ---------------------------------------------------------------------------
// Prompt template — used today for transparency and as the swap point for a
// real LLM API later. The parser below implements the same contract locally.
// ---------------------------------------------------------------------------
export function estimateFromDescription(description: string, trade: string): string {
  const profile = TRADE_PROFILES[trade] || TRADE_PROFILES.general;
  return [
    `You are a professional ${profile.label.toLowerCase()} estimating assistant for a specialty trade contractor.`,
    ``,
    `TASK: Convert the customer's job description into a structured line-item estimate.`,
    `TRADE: ${profile.label} (labor rate $${profile.laborRate}/hr, typical markup ${profile.defaultMarkup}%).`,
    `COMMON WORK FOR THIS TRADE: ${profile.context}.`,
    `JOB DESCRIPTION: "${description}"`,
    ``,
    `Return ONLY a JSON object with this exact shape:`,
    `{`,
    `  "lineItems": [{ "name": string, "description": string, "quantity": number, "unit": "each|ft|sq|sqft|hour|lump|lb|roll", "unitCost": number, "markup": number, "confidence": "high|medium|low" }],`,
    `  "laborHours": number,`,
    `  "materialsSubtotal": number,`,
    `  "laborSubtotal": number,`,
    `  "recommendedMarkup": number`,
    `}`,
    `Rules: use realistic current-market pricing for the region; include removal/disposal and permits when described; quantity 1 for lump items; round to 2 decimals.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// The smart parser — deterministic extraction + mapping to the catalog
// ---------------------------------------------------------------------------
export function parseEstimateFromDescription(
  description: string,
  trade: string,
  opts: AiParseOptions = {}
): AiEstimateResult {
  const text = ` ${description.toLowerCase()} `;
  const profile = TRADE_PROFILES[trade] || TRADE_PROFILES.general;
  const multiplier = regionMultiplier(opts.location);
  const squareFootage = opts.squareFootage || extractMeasure(text, "sqft") || 0;
  const rooms = opts.rooms || extractMeasure(text, "rooms") || 0;

  const lineItems: AiLineItem[] = [];
  const matched: string[] = [];
  const seenFamilies = new Set<string>();
  const claimedSpecs = new Set<string>();

  for (const entry of CATALOG) {
    if (!entry.trades.includes(trade)) continue;
    const anchored = hasAny(text, entry.anchor);
    const secondary = entry.also ? hasAny(text, entry.also) : false;
    if (!anchored && !secondary) continue;

    // Deduplicate families (e.g., one water-heater item even if both keywords hit)
    const family = entry.name.split(" ").slice(0, 2).join(" ").toLowerCase();
    if (seenFamilies.has(family)) continue;
    seenFamilies.add(family);

    let quantity = entry.qty;
    let confidence: Confidence = anchored ? "high" : "medium";
    let measured = false;
    if (entry.measure) {
      const extracted = extractMeasure(text, entry.measure);
      if (extracted) {
        quantity = extracted;
        confidence = "high";
        measured = true;
      }
    }
    // Scale with square footage / room count only when the description
    // didn't already state the measure explicitly.
    if (!measured) {
      if (entry.scaleSqft && squareFootage > 0) {
        quantity = Math.max(1, Math.round(entry.qty * (squareFootage / entry.scaleSqft)));
      } else if (entry.scaleRooms && rooms > 0) {
        quantity = Math.max(1, Math.round(entry.qty * (rooms / entry.scaleRooms)));
      }
    }

    // Unit cost: supplier catalog override when a name match exists
    let cost = entry.cost;
    let fromCatalog = false;
    const catalog = opts.catalog || [];
    if (catalog.length > 0) {
      const entryWords = entry.name.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      for (const cat of catalog) {
        const catName = (cat.name || "").toLowerCase();
        const hit = entryWords.some((w) => catName.includes(w)) || catName.includes(entry.name.toLowerCase().split(" ")[0]);
        if (hit && cat.unit_cost && cat.unit_cost > 0) {
          cost = cat.unit_cost;
          fromCatalog = true;
          break;
        }
      }
    }
    cost = Math.round(cost * multiplier * 100) / 100;

    let name = entry.name;
    if (entry.spec && !claimedSpecs.has(entry.spec)) {
      const specVal = extractMeasure(text, entry.spec);
      if (specVal) {
        claimedSpecs.add(entry.spec);
        const label =
          entry.spec === "gallons" ? `(${specVal}-Gallon)` :
          entry.spec === "amps" ? `(${specVal}A)` :
          entry.spec === "btu" ? `(${specVal} BTU)` :
          entry.spec === "tons" ? `(${specVal}-Ton)` : "";
        if (label) name = `${name} ${label}`.trim();
      }
    }
    lineItems.push({
      name,
      description: entry.description,
      quantity,
      unit: entry.unit,
      unitCost: cost,
      markup: entry.markup,
      confidence,
      laborPerUnit: entry.laborPerUnit,
    });
    matched.push(entry.name);
  }

  // If nothing matched, provide a sensible generic start so the user can refine
  if (lineItems.length === 0) {
    const genCost = Math.round(45 * multiplier * 100) / 100;
    lineItems.push({
      name: `${profile.label} — Labor & Materials`,
      description: "General labor and materials for the described job",
      quantity: 1,
      unit: "lump",
      unitCost: genCost,
      markup: profile.defaultMarkup,
      confidence: "low",
      laborPerUnit: 4,
    });
    matched.push("general labor");
  }

  const laborHours = Math.round(lineItems.reduce((s, it) => s + it.quantity * it.laborPerUnit, 0) * 10) / 10;
  const materialsSubtotal = Math.round(lineItems.reduce((s, it) => s + it.quantity * it.unitCost, 0) * 100) / 100;
  const laborSubtotal = Math.round(laborHours * profile.laborRate * 100) / 100;
  const recommendedMarkup = lineItems.length > 0 ? Math.max(...lineItems.map((it) => it.markup)) : profile.defaultMarkup;

  const note =
    opts.photoCount && opts.photoCount > 0
      ? `${opts.photoCount} photo(s) attached but not analyzed — this estimate is based on the written description.`
      : "Generated from your description. Adjust quantities and pricing before sending.";

  return {
    lineItems,
    laborHours,
    materialsSubtotal,
    laborSubtotal,
    recommendedMarkup,
    laborRate: profile.laborRate,
    trade,
    location: opts.location || "",
    regionMultiplier: multiplier,
    squareFootage,
    rooms,
    matched,
    note,
  };
}
