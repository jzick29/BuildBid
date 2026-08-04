import { makeAuthFn } from "./iso";

// ─── Seed Data ─────────────────────────────────────────────────────
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

// ─── getTemplates ───────────────────────────────────────────────────
export const getTemplates = makeAuthFn("templates.getTemplates", async (args: any, userId: string, pool: any) => {
  const data = args?.data || {};
  const trade = data.trade;
  const tab = data.tab;

  let query = `SELECT t.*, COALESCE((SELECT COUNT(*) FROM template_line_items WHERE template_id = t.id), 0) as item_count FROM templates t`;
  const params: any[] = [];
  const conditions: string[] = [];

  if (tab === "my") {
    conditions.push(`t.user_id = $${params.length + 1}`);
    params.push(userId);
  } else if (tab === "shared") {
    conditions.push(`t.user_id IS NOT NULL AND t.user_id != $${params.length + 1} AND t.id IN (SELECT template_id FROM template_shares)`);
    params.push(userId);
  } else {
    // "all" — seeded templates (user_id IS NULL) plus current user's templates
    conditions.push(`(t.user_id IS NULL OR t.user_id = $${params.length + 1})`);
    params.push(userId);
  }

  if (trade) {
    conditions.push(`t.trade_type = $${params.length + 1}`);
    params.push(trade);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY t.user_id NULLS FIRST, t.trade_type, t.name";

  const r = await pool.query(query, params);
  return { templates: r.rows };
});

// ─── getTemplate ────────────────────────────────────────────────────
export const getTemplate = makeAuthFn("templates.getTemplate", async (args: { data: { id: string } }, _userId: string, pool: any) => {
  const tpl = await pool.query("SELECT * FROM templates WHERE id = $1", [args.data.id]);
  if (!tpl.rows[0]) throw new Error("Template not found");
  const items = await pool.query("SELECT * FROM template_line_items WHERE template_id = $1 ORDER BY sort_order", [args.data.id]);
  return { template: tpl.rows[0], items: items.rows };
});

// ─── createEstimateFromTemplate ─────────────────────────────────────
export const createEstimateFromTemplate = makeAuthFn("templates.createEstimateFromTemplate", async (args: { data: { templateId: string; projectName: string; customerName: string } }, userId: string, pool: any) => {
  const tpl = await pool.query("SELECT * FROM templates WHERE id = $1", [args.data.templateId]);
  if (!tpl.rows[0]) throw new Error("Template not found");

  const items = await pool.query("SELECT * FROM template_line_items WHERE template_id = $1 ORDER BY sort_order", [args.data.templateId]);

  const estimateId = crypto.randomUUID();
  await pool.query(
    "INSERT INTO estimates (id, user_id, project_name, customer_name, trade) VALUES ($1, $2, $3, $4, $5)",
    [estimateId, userId, args.data.projectName.trim(), args.data.customerName.trim(), tpl.rows[0].trade_type]
  );

  for (const item of items.rows) {
    const liId = crypto.randomUUID();
    await pool.query(
      "INSERT INTO line_items (id, estimate_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [liId, estimateId, item.description, item.quantity, item.unit, item.unit_cost, item.markup_percent, item.sort_order]
    );
  }

  return { id: estimateId };
});

// ─── saveCustomTemplate ─────────────────────────────────────────────
// Two modes:
//   1. From an existing estimate: { estimateId, name }
//   2. From imported JSON: { name, description, trade_type, items }
export const saveCustomTemplate = makeAuthFn("templates.saveCustomTemplate", async (args: { data: { estimateId?: string; name?: string; description?: string; trade_type?: string; items?: any[] } }, userId: string, pool: any) => {
  const d = args.data;
  let templateName = d.name?.trim();
  let templateDesc = d.description || "";
  let tradeType = d.trade_type || "general";
  let items: any[] = [];

  if (d.estimateId) {
    // Mode 1: save from existing estimate
    const est = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [d.estimateId, userId]);
    if (!est.rows[0]) throw new Error("Estimate not found");
    if (!templateName) templateName = est.rows[0].project_name;
    tradeType = est.rows[0].trade;
    const liRows = await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [d.estimateId]);
    items = liRows.rows.map((li: any) => ({
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_cost: li.unit_cost,
      markup_percent: li.markup_percent,
    }));
  } else if (d.items && d.items.length > 0) {
    // Mode 2: from imported JSON
    items = d.items;
    if (!templateName) templateName = "Imported Template";
  } else {
    throw new Error("Either estimateId or items must be provided");
  }

  const tplId = crypto.randomUUID();
  await pool.query(
    "INSERT INTO templates (id, name, trade_type, description, user_id, item_count) VALUES ($1, $2, $3, $4, $5, $6)",
    [tplId, templateName, tradeType, templateDesc, userId, items.length]
  );

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const liId = crypto.randomUUID();
    await pool.query(
      "INSERT INTO template_line_items (id, template_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [liId, tplId, item.description, item.quantity || 1, item.unit || "each", item.unit_cost || 0, item.markup_percent || 0, i]
    );
  }

  return { id: tplId, name: templateName };
});

// ─── seedTemplates ──────────────────────────────────────────────────
export const seedTemplates = makeAuthFn("templates.seedTemplates", async (_args: any, _userId: string, pool: any) => {
  const existing = await pool.query("SELECT COUNT(*) as c FROM templates WHERE user_id IS NULL");
  if (parseInt(existing.rows[0].c) > 0) {
    return { seeded: false, count: parseInt(existing.rows[0].c) };
  }

  for (const t of SEED_TEMPLATES) {
    const tid = crypto.randomUUID();
    await pool.query(
      "INSERT INTO templates (id, name, trade_type, description, item_count) VALUES ($1, $2, $3, $4, $5)",
      [tid, t.name, t.trade_type, t.description, t.items.length]
    );
    for (let i = 0; i < t.items.length; i++) {
      const item = t.items[i];
      await pool.query(
        "INSERT INTO template_line_items (id, template_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [crypto.randomUUID(), tid, item.description, item.quantity, item.unit, item.unit_cost, item.markup_percent, i]
      );
    }
  }

  return { seeded: true, count: SEED_TEMPLATES.length };
});

// ─── updateTemplate ─────────────────────────────────────────────────
export const updateTemplate = makeAuthFn("templates.updateTemplate", async (args: { data: { id: string; name: string; description: string; trade_type: string } }, userId: string, pool: any) => {
  const tpl = await pool.query("SELECT id FROM templates WHERE id = $1 AND user_id = $2", [args.data.id, userId]);
  if (!tpl.rows[0]) throw new Error("Template not found or not yours");

  await pool.query(
    "UPDATE templates SET name = $1, description = $2, trade_type = $3 WHERE id = $4",
    [args.data.name, args.data.description, args.data.trade_type, args.data.id]
  );
  return { success: true };
});

// ─── updateTemplateItem ─────────────────────────────────────────────
export const updateTemplateItem = makeAuthFn("templates.updateTemplateItem", async (args: { data: { id: string; description?: string; quantity?: number; unit?: string; unitCost?: number; markupPercent?: number } }, userId: string, pool: any) => {
  // Verify ownership through template
  const tpl = await pool.query(
    "SELECT t.user_id FROM template_line_items li JOIN templates t ON t.id = li.template_id WHERE li.id = $1",
    [args.data.id]
  );
  if (!tpl.rows[0] || tpl.rows[0].user_id !== userId) throw new Error("Template item not found or not yours");

  const updates: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (args.data.description !== undefined) { updates.push(`description = $${idx++}`); params.push(args.data.description); }
  if (args.data.quantity !== undefined) { updates.push(`quantity = $${idx++}`); params.push(args.data.quantity); }
  if (args.data.unit !== undefined) { updates.push(`unit = $${idx++}`); params.push(args.data.unit); }
  if (args.data.unitCost !== undefined) { updates.push(`unit_cost = $${idx++}`); params.push(args.data.unitCost); }
  if (args.data.markupPercent !== undefined) { updates.push(`markup_percent = $${idx++}`); params.push(args.data.markupPercent); }

  if (updates.length > 0) {
    params.push(args.data.id);
    await pool.query(`UPDATE template_line_items SET ${updates.join(", ")} WHERE id = $${idx}`, params);
  }
  return { success: true };
});

// ─── addTemplateItem ────────────────────────────────────────────────
export const addTemplateItem = makeAuthFn("templates.addTemplateItem", async (args: { data: { templateId: string; description: string; quantity: number; unit: string; unitCost: number; markupPercent: number } }, userId: string, pool: any) => {
  const tpl = await pool.query("SELECT id, item_count FROM templates WHERE id = $1 AND user_id = $2", [args.data.templateId, userId]);
  if (!tpl.rows[0]) throw new Error("Template not found or not yours");

  const maxSort = await pool.query("SELECT COALESCE(MAX(sort_order), -1) as mx FROM template_line_items WHERE template_id = $1", [args.data.templateId]);
  const id = crypto.randomUUID();
  await pool.query(
    "INSERT INTO template_line_items (id, template_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [id, args.data.templateId, args.data.description, args.data.quantity || 1, args.data.unit || "each", args.data.unitCost || 0, args.data.markupPercent || 10, maxSort.rows[0].mx + 1]
  );

  // Update item_count
  await pool.query("UPDATE templates SET item_count = (SELECT COUNT(*) FROM template_line_items WHERE template_id = $1) WHERE id = $1", [args.data.templateId]);

  return { success: true };
});

// ─── removeTemplateItem ─────────────────────────────────────────────
export const removeTemplateItem = makeAuthFn("templates.removeTemplateItem", async (args: { data: { id: string } }, userId: string, pool: any) => {
  const tpl = await pool.query(
    "SELECT t.id as template_id, t.user_id FROM template_line_items li JOIN templates t ON t.id = li.template_id WHERE li.id = $1",
    [args.data.id]
  );
  if (!tpl.rows[0] || tpl.rows[0].user_id !== userId) throw new Error("Template item not found or not yours");

  await pool.query("DELETE FROM template_line_items WHERE id = $1", [args.data.id]);
  await pool.query("UPDATE templates SET item_count = (SELECT COUNT(*) FROM template_line_items WHERE template_id = $1) WHERE id = $1", [tpl.rows[0].template_id]);
  return { success: true };
});

// ─── deleteTemplate ─────────────────────────────────────────────────
export const deleteTemplate = makeAuthFn("templates.deleteTemplate", async (args: { data: { id: string } }, userId: string, pool: any) => {
  const tpl = await pool.query("SELECT id FROM templates WHERE id = $1 AND user_id = $2", [args.data.id, userId]);
  if (!tpl.rows[0]) throw new Error("Template not found or not yours");

  await pool.query("DELETE FROM templates WHERE id = $1", [args.data.id]);
  return { success: true };
});

// ─── shareTemplate ──────────────────────────────────────────────────
export const shareTemplate = makeAuthFn("templates.shareTemplate", async (args: { data: { templateId: string } }, userId: string, pool: any) => {
  const tpl = await pool.query("SELECT id FROM templates WHERE id = $1 AND user_id = $2", [args.data.templateId, userId]);
  if (!tpl.rows[0]) throw new Error("Template not found or not yours");

  // Check if already shared
  const existing = await pool.query("SELECT share_token FROM template_shares WHERE template_id = $1 AND shared_by = $2", [args.data.templateId, userId]);
  if (existing.rows[0]) {
    const url = `https://buildbid.pro/templates/shared/${existing.rows[0].share_token}`;
    return { url };
  }

  const shareToken = crypto.randomUUID();
  const shareId = crypto.randomUUID();
  await pool.query(
    "INSERT INTO template_shares (id, template_id, shared_by, share_token) VALUES ($1, $2, $3, $4)",
    [shareId, args.data.templateId, userId, shareToken]
  );

  const url = `https://buildbid.pro/templates/shared/${shareToken}`;
  return { url };
});
