import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "buildbid_session";

async function requireUser() {
  const db = await (await import("./db.server")).getDb();
  const token = getCookie(SESSION_COOKIE);
  if (!token) throw redirect({ to: "/login" });
  const row = db.query(
    "SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now')"
  ).get(token) as any;
  if (!row) {
    deleteCookie(SESSION_COOKIE, { path: "/" });
    throw redirect({ to: "/login" });
  }
  return row;
}

// Seed data
const SEED_TEMPLATES: Array<{
  name: string; trade_type: string; description: string;
  items: Array<{ description: string; quantity: number; unit: string; unit_cost: number; markup_percent: number }>;
}> = [
  // Electrical
  {
    name: "Residential Panel Upgrade (200A)", trade_type: "electrical",
    description: "Upgrade main service panel to 200 amp with breakers and permit.",
    items: [
      { description: "200A Main Breaker Panel", quantity: 1, unit: "each", unit_cost: 450, markup_percent: 15 },
      { description: "Main Breaker 200A", quantity: 1, unit: "each", unit_cost: 120, markup_percent: 15 },
      { description: "Branch Circuit Breakers (20A)", quantity: 20, unit: "each", unit_cost: 8, markup_percent: 15 },
      { description: "Permit & Inspection Fee", quantity: 1, unit: "lump", unit_cost: 250, markup_percent: 0 },
      { description: "Labor - Panel Upgrade", quantity: 8, unit: "hour", unit_cost: 85, markup_percent: 0 },
    ],
  },
  {
    name: "Service Entrance Replacement", trade_type: "electrical",
    description: "Replace overhead service entrance mast, meter base, and cable.",
    items: [
      { description: "Service Mast 2\" Galvanized", quantity: 1, unit: "each", unit_cost: 85, markup_percent: 15 },
      { description: "Meter Base 200A", quantity: 1, unit: "each", unit_cost: 95, markup_percent: 15 },
      { description: "SE Cable 4/0-4/0-2/0", quantity: 30, unit: "foot", unit_cost: 4.50, markup_percent: 15 },
      { description: "Ground Rods w/ Clamps", quantity: 2, unit: "each", unit_cost: 25, markup_percent: 15 },
      { description: "Weatherhead & Connectors", quantity: 1, unit: "lump", unit_cost: 45, markup_percent: 15 },
      { description: "Labor - Service Entrance", quantity: 6, unit: "hour", unit_cost: 85, markup_percent: 0 },
    ],
  },
  {
    name: "Kitchen Rewire", trade_type: "electrical",
    description: "Full kitchen electrical rough-in including dedicated circuits and GFCI outlets.",
    items: [
      { description: "12/2 Romex NM-B", quantity: 150, unit: "foot", unit_cost: 0.65, markup_percent: 15 },
      { description: "GFCI Receptacles", quantity: 4, unit: "each", unit_cost: 18, markup_percent: 15 },
      { description: "Dedicated Circuit - Fridge", quantity: 1, unit: "each", unit_cost: 120, markup_percent: 15 },
      { description: "Dedicated Circuit - Microwave", quantity: 1, unit: "each", unit_cost: 120, markup_percent: 15 },
      { description: "Lighting Circuits", quantity: 2, unit: "each", unit_cost: 95, markup_percent: 15 },
      { description: "Labor - Per Opening", quantity: 12, unit: "hour", unit_cost: 85, markup_percent: 0 },
    ],
  },
  // HVAC
  {
    name: "Furnace Replacement (80% AFUE)", trade_type: "hvac",
    description: "Replace existing furnace with 80% AFUE gas furnace, including venting and gas line.",
    items: [
      { description: "80% AFUE Gas Furnace 80k BTU", quantity: 1, unit: "each", unit_cost: 1200, markup_percent: 20 },
      { description: "Vent Pipe Kit (PVC)", quantity: 1, unit: "lump", unit_cost: 180, markup_percent: 15 },
      { description: "Gas Line Flex Connector", quantity: 1, unit: "each", unit_cost: 35, markup_percent: 15 },
      { description: "Thermostat (Programmable)", quantity: 1, unit: "each", unit_cost: 65, markup_percent: 15 },
      { description: "Permit & Start-up", quantity: 1, unit: "lump", unit_cost: 200, markup_percent: 0 },
      { description: "Labor - Furnace Replacement", quantity: 8, unit: "hour", unit_cost: 95, markup_percent: 0 },
    ],
  },
  {
    name: "AC Installation (3-Ton)", trade_type: "hvac",
    description: "Install 3-ton split AC system with condenser, coil, and lineset.",
    items: [
      { description: "3-Ton Condenser Unit (14 SEER)", quantity: 1, unit: "each", unit_cost: 1800, markup_percent: 20 },
      { description: "Evaporator Coil Cased", quantity: 1, unit: "each", unit_cost: 350, markup_percent: 20 },
      { description: "Lineset 3/4\" x 3/8\" 25ft", quantity: 1, unit: "each", unit_cost: 120, markup_percent: 15 },
      { description: "Condenser Pad", quantity: 1, unit: "each", unit_cost: 65, markup_percent: 15 },
      { description: "Refrigerant R-410A", quantity: 1, unit: "lump", unit_cost: 180, markup_percent: 15 },
      { description: "Labor - AC Installation", quantity: 10, unit: "hour", unit_cost: 95, markup_percent: 0 },
    ],
  },
  {
    name: "Ductwork (Per Run)", trade_type: "hvac",
    description: "Install flex duct run from plenum to register.",
    items: [
      { description: "Flex Duct 6\" R-6", quantity: 25, unit: "foot", unit_cost: 2.50, markup_percent: 15 },
      { description: "Register Boot", quantity: 1, unit: "each", unit_cost: 18, markup_percent: 15 },
      { description: "Ceiling Register", quantity: 1, unit: "each", unit_cost: 22, markup_percent: 15 },
      { description: "Damper (In-Line)", quantity: 1, unit: "each", unit_cost: 15, markup_percent: 15 },
      { description: "Take-off Collar", quantity: 1, unit: "each", unit_cost: 8, markup_percent: 15 },
      { description: "Labor - Per Duct Run", quantity: 2, unit: "hour", unit_cost: 95, markup_percent: 0 },
    ],
  },
  // Plumbing
  {
    name: "Water Heater Replacement (50-Gal)", trade_type: "plumbing",
    description: "Replace existing 50-gallon electric water heater.",
    items: [
      { description: "50-Gallon Electric Water Heater", quantity: 1, unit: "each", unit_cost: 550, markup_percent: 20 },
      { description: "Expansion Tank (2-gal)", quantity: 1, unit: "each", unit_cost: 55, markup_percent: 15 },
      { description: "Flex Water Lines (pair)", quantity: 1, unit: "lump", unit_cost: 30, markup_percent: 15 },
      { description: "T&P Relief Valve", quantity: 1, unit: "each", unit_cost: 25, markup_percent: 15 },
      { description: "Drain Pan", quantity: 1, unit: "each", unit_cost: 35, markup_percent: 15 },
      { description: "Labor - Water Heater", quantity: 3, unit: "hour", unit_cost: 90, markup_percent: 0 },
    ],
  },
  {
    name: "Bathroom Rough-In", trade_type: "plumbing",
    description: "Rough-in plumbing for a full bathroom (sink, toilet, shower).",
    items: [
      { description: "PVC Drain Pipe 3\"", quantity: 20, unit: "foot", unit_cost: 2.50, markup_percent: 15 },
      { description: "PVC Drain Pipe 2\"", quantity: 15, unit: "foot", unit_cost: 1.80, markup_percent: 15 },
      { description: "PEX Water Lines (hot/cold)", quantity: 40, unit: "foot", unit_cost: 1.20, markup_percent: 15 },
      { description: "Shower Valve Body", quantity: 1, unit: "each", unit_cost: 85, markup_percent: 15 },
      { description: "Toilet Flange", quantity: 1, unit: "each", unit_cost: 12, markup_percent: 15 },
      { description: "Labor - Per Fixture", quantity: 3, unit: "hour", unit_cost: 90, markup_percent: 0 },
    ],
  },
  {
    name: "Sewer Line Replacement", trade_type: "plumbing",
    description: "Replace damaged sewer line from house to main.",
    items: [
      { description: "PVC Sewer Pipe 4\"", quantity: 40, unit: "foot", unit_cost: 3.50, markup_percent: 15 },
      { description: "Primer & Cement", quantity: 1, unit: "lump", unit_cost: 15, markup_percent: 15 },
      { description: "Cleanout Fitting", quantity: 1, unit: "each", unit_cost: 35, markup_percent: 15 },
      { description: "Trench Excavation", quantity: 40, unit: "foot", unit_cost: 12, markup_percent: 0 },
      { description: "Backfill & Compaction", quantity: 40, unit: "foot", unit_cost: 5, markup_percent: 0 },
      { description: "Labor - Sewer Line", quantity: 8, unit: "hour", unit_cost: 90, markup_percent: 0 },
    ],
  },
  // Roofing
  {
    name: "Asphalt Shingle Roof", trade_type: "roofing",
    description: "Install architectural asphalt shingle roof (per square).",
    items: [
      { description: "Architectural Shingles (per sq)", quantity: 1, unit: "sq", unit_cost: 120, markup_percent: 20 },
      { description: "15lb Felt Underlayment (per sq)", quantity: 1, unit: "sq", unit_cost: 25, markup_percent: 15 },
      { description: "Drip Edge (per ft)", quantity: 40, unit: "foot", unit_cost: 1.50, markup_percent: 15 },
      { description: "Starter Shingles (per sq)", quantity: 1, unit: "sq", unit_cost: 35, markup_percent: 15 },
      { description: "Ridge Vent (per ft)", quantity: 20, unit: "foot", unit_cost: 3, markup_percent: 15 },
      { description: "Labor - Per Square", quantity: 4, unit: "hour", unit_cost: 75, markup_percent: 0 },
    ],
  },
  {
    name: "Flat Roof (TPO Membrane)", trade_type: "roofing",
    description: "Install TPO membrane flat roof system (per square).",
    items: [
      { description: "TPO Membrane 60mil (per sq)", quantity: 1, unit: "sq", unit_cost: 180, markup_percent: 20 },
      { description: "ISO Insulation Board (per sq)", quantity: 1, unit: "sq", unit_cost: 65, markup_percent: 15 },
      { description: "Cover Board (per sq)", quantity: 1, unit: "sq", unit_cost: 40, markup_percent: 15 },
      { description: "Fasteners & Plates (per sq)", quantity: 1, unit: "sq", unit_cost: 25, markup_percent: 15 },
      { description: "Metal Flashing (per ft)", quantity: 30, unit: "foot", unit_cost: 8, markup_percent: 15 },
      { description: "Labor - Per Square", quantity: 5, unit: "hour", unit_cost: 75, markup_percent: 0 },
    ],
  },
  {
    name: "Gutter Replacement", trade_type: "roofing",
    description: "Replace seamless aluminum gutters and downspouts.",
    items: [
      { description: "Seamless Aluminum Gutter 5\"", quantity: 60, unit: "foot", unit_cost: 5, markup_percent: 20 },
      { description: "Downspout 2x3\"", quantity: 20, unit: "foot", unit_cost: 4, markup_percent: 15 },
      { description: "Gutter Hangers", quantity: 30, unit: "each", unit_cost: 2, markup_percent: 15 },
      { description: "Downspout Elbows", quantity: 4, unit: "each", unit_cost: 5, markup_percent: 15 },
      { description: "Leaf Guards", quantity: 60, unit: "foot", unit_cost: 3, markup_percent: 15 },
      { description: "Labor - Per Foot", quantity: 60, unit: "foot", unit_cost: 2.50, markup_percent: 0 },
    ],
  },
  // General
  {
    name: "Bathroom Remodel", trade_type: "general",
    description: "Full bathroom remodel including demo, framing, drywall, tile, and fixtures.",
    items: [
      { description: "Demo & Haul Away", quantity: 1, unit: "lump", unit_cost: 800, markup_percent: 10 },
      { description: "Framing & Blocking", quantity: 1, unit: "lump", unit_cost: 400, markup_percent: 15 },
      { description: "Drywall (green board)", quantity: 80, unit: "sqft", unit_cost: 3.50, markup_percent: 15 },
      { description: "Tile Floor 12x12", quantity: 40, unit: "sqft", unit_cost: 8, markup_percent: 20 },
      { description: "Tile Shower Surround", quantity: 60, unit: "sqft", unit_cost: 12, markup_percent: 20 },
      { description: "Vanity w/ Sink", quantity: 1, unit: "each", unit_cost: 450, markup_percent: 15 },
      { description: "Toilet", quantity: 1, unit: "each", unit_cost: 250, markup_percent: 15 },
      { description: "Labor - General", quantity: 40, unit: "hour", unit_cost: 65, markup_percent: 0 },
    ],
  },
  {
    name: "Kitchen Remodel", trade_type: "general",
    description: "Full kitchen remodel with cabinets, countertops, and finishes.",
    items: [
      { description: "Demo & Haul Away", quantity: 1, unit: "lump", unit_cost: 1200, markup_percent: 10 },
      { description: "Cabinets (stock)", quantity: 15, unit: "linear ft", unit_cost: 120, markup_percent: 20 },
      { description: "Countertop Laminate", quantity: 40, unit: "sqft", unit_cost: 35, markup_percent: 20 },
      { description: "Backsplash Tile", quantity: 30, unit: "sqft", unit_cost: 8, markup_percent: 15 },
      { description: "Sink & Faucet", quantity: 1, unit: "lump", unit_cost: 350, markup_percent: 15 },
      { description: "Flooring (LVP)", quantity: 150, unit: "sqft", unit_cost: 5.50, markup_percent: 15 },
      { description: "Labor - General", quantity: 60, unit: "hour", unit_cost: 65, markup_percent: 0 },
    ],
  },
  {
    name: "Deck Build (Pressure Treated)", trade_type: "general",
    description: "Build pressure-treated wood deck (per sqft).",
    items: [
      { description: "Footings (tube & concrete)", quantity: 6, unit: "each", unit_cost: 45, markup_percent: 15 },
      { description: "Pressure Treated Lumber - Framing", quantity: 200, unit: "board ft", unit_cost: 2.50, markup_percent: 15 },
      { description: "Decking Boards 5/4x6", quantity: 200, unit: "sqft", unit_cost: 3.50, markup_percent: 20 },
      { description: "Joist Hangers & Hardware", quantity: 1, unit: "lump", unit_cost: 85, markup_percent: 15 },
      { description: "Railing System", quantity: 40, unit: "ft", unit_cost: 18, markup_percent: 15 },
      { description: "Stairs", quantity: 3, unit: "tread", unit_cost: 35, markup_percent: 15 },
      { description: "Labor - Per Sqft", quantity: 200, unit: "sqft", unit_cost: 8, markup_percent: 0 },
    ],
  },
];

// Seed the database if empty
export const seedTemplates = createServerFn({ method: "POST" }).handler(async () => {
  await requireUser();
  const db = await (await import("./db.server")).getDb();
  const existing = db.query("SELECT COUNT(*) as c FROM templates").get() as any;
  if (existing.c > 0) return { seeded: false, count: existing.c };
  
  const insert = db.transaction(() => {
    for (const t of SEED_TEMPLATES) {
      const tid = crypto.randomUUID();
      db.run("INSERT INTO templates (id, name, trade_type, description) VALUES (?, ?, ?, ?)",
        [tid, t.name, t.trade_type, t.description]);
      t.items.forEach((item, i) => {
        db.run("INSERT INTO template_line_items (id, template_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [crypto.randomUUID(), tid, item.description, item.quantity, item.unit, item.unit_cost, item.markup_percent, i]);
      });
    }
  });
  insert();
  return { seeded: true, count: SEED_TEMPLATES.length };
});

// Get all templates, optionally filtered by trade
export const getTemplates = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { trade?: string } | undefined)
  .handler(async ({ data }) => {
    await requireUser();
    const db = await (await import("./db.server")).getDb();
    const trade = data?.trade;
    let rows: any[];
    if (trade) {
      rows = db.query("SELECT * FROM templates WHERE trade_type = ? ORDER BY name").all(trade) as any[];
    } else {
      rows = db.query("SELECT * FROM templates ORDER BY trade_type, name").all() as any[];
    }
    return { templates: rows };
  });

// Get a template with its line items
export const getTemplate = createServerFn({ method: "GET" })
  .validator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    await requireUser();
    const db = await (await import("./db.server")).getDb();
    const tpl = db.query("SELECT * FROM templates WHERE id = ?").get(data.id) as any;
    if (!tpl) throw new Error("Template not found");
    const items = db.query("SELECT * FROM template_line_items WHERE template_id = ? ORDER BY sort_order").all(data.id) as any[];
    return { template: tpl, items };
  });

// Create an estimate from a template
export const createEstimateFromTemplate = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const v = d as { templateId: string; projectName: string; customerName: string };
    if (!v.templateId) throw new Error("Template ID required");
    if (!v.projectName?.trim()) throw new Error("Project name is required");
    if (!v.customerName?.trim()) throw new Error("Customer name is required");
    return v;
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = await (await import("./db.server")).getDb();
    const mod = await import("./db.server");
    
    const tpl = db.query("SELECT * FROM templates WHERE id = ?").get(data.templateId) as any;
    if (!tpl) throw new Error("Template not found");
    
    const items = db.query("SELECT * FROM template_line_items WHERE template_id = ? ORDER BY sort_order").all(data.templateId) as any[];
    
    const estimateId = mod.createEstimate(user.id, data.projectName.trim(), data.customerName.trim(), tpl.trade_type);
    
    for (const item of items) {
      mod.addLineItem(estimateId, {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_cost: item.unit_cost,
        markup_percent: item.markup_percent,
      });
    }
    
    return { id: estimateId };
  });