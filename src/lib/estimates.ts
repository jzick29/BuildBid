import { makeAuthFn } from "./iso";

// ─── listEstimates ─────────────────────────────────────────────────
export const listEstimates = makeAuthFn("estimates.listEstimates", async (_args: any, userId: string, pool: any) => {
  const r = await pool.query(
    `SELECT e.*, COALESCE(SUM(li.quantity * li.unit_cost * (1 + li.markup_percent / 100)), 0) as total
     FROM estimates e
     LEFT JOIN line_items li ON li.estimate_id = e.id
     WHERE e.user_id = $1
     GROUP BY e.id
     ORDER BY e.updated_at DESC`,
    [userId]
  );
  return { estimates: r.rows };
});

// ─── getEstimate ───────────────────────────────────────────────────
export const getEstimate = makeAuthFn("estimates.getEstimate", async (args: { data: { id: string } }, userId: string, pool: any) => {
  const r = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [args.data.id, userId]);
  if (!r.rows[0]) throw new Error("Estimate not found");
  const items = await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.id]);
  return { estimate: r.rows[0], lineItems: items.rows };
});

// ─── createEstimate ────────────────────────────────────────────────
export const createEstimate = makeAuthFn("estimates.createEstimate", async (args: { data: { projectName: string; customerName: string; trade: string } }, userId: string, pool: any) => {
  const id = crypto.randomUUID();
  await pool.query(
    "INSERT INTO estimates (id, user_id, project_name, customer_name, trade) VALUES ($1, $2, $3, $4, $5)",
    [id, userId, args.data.projectName.trim(), args.data.customerName.trim(), args.data.trade]
  );
  return { id };
});

// ─── addLineItem ───────────────────────────────────────────────────
export const addLineItem = makeAuthFn("estimates.addLineItem", async (args: { data: { estimateId: string; description: string; quantity: number; unit: string; unitCost: number; markupPercent: number } }, userId: string, pool: any) => {
  // Verify estimate ownership
  const est = await pool.query("SELECT id FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  if (!est.rows[0]) throw new Error("Estimate not found");

  const maxSort = await pool.query("SELECT COALESCE(MAX(sort_order), -1) as mx FROM line_items WHERE estimate_id = $1", [args.data.estimateId]);
  const id = crypto.randomUUID();
  await pool.query(
    "INSERT INTO line_items (id, estimate_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [id, args.data.estimateId, args.data.description.trim(), args.data.quantity || 1, args.data.unit || "each", args.data.unitCost || 0, args.data.markupPercent || 0, maxSort.rows[0].mx + 1]
  );
  await pool.query("UPDATE estimates SET updated_at = NOW() WHERE id = $1", [args.data.estimateId]);
  return { success: true };
});

// ─── removeLineItem ────────────────────────────────────────────────
export const removeLineItem = makeAuthFn("estimates.removeLineItem", async (args: { data: { id: string } }, userId: string, pool: any) => {
  // Verify ownership via estimate
  const li = await pool.query(
    "SELECT e.user_id FROM line_items l JOIN estimates e ON e.id = l.estimate_id WHERE l.id = $1",
    [args.data.id]
  );
  if (!li.rows[0] || li.rows[0].user_id !== userId) throw new Error("Line item not found");

  const estId = (await pool.query("SELECT estimate_id FROM line_items WHERE id = $1", [args.data.id])).rows[0]?.estimate_id;
  await pool.query("DELETE FROM line_items WHERE id = $1", [args.data.id]);
  if (estId) await pool.query("UPDATE estimates SET updated_at = NOW() WHERE id = $1", [estId]);
  return { success: true };
});

// ─── updateLineItemQty ─────────────────────────────────────────────
export const updateLineItemQty = makeAuthFn("estimates.updateLineItemQty", async (args: { data: { id: string; quantity: number } }, userId: string, pool: any) => {
  const li = await pool.query(
    "SELECT e.id as estimate_id, e.user_id FROM line_items l JOIN estimates e ON e.id = l.estimate_id WHERE l.id = $1",
    [args.data.id]
  );
  if (!li.rows[0] || li.rows[0].user_id !== userId) throw new Error("Line item not found");

  await pool.query("UPDATE line_items SET quantity = $1 WHERE id = $2", [args.data.quantity, args.data.id]);
  await pool.query("UPDATE estimates SET updated_at = NOW() WHERE id = $1", [li.rows[0].estimate_id]);
  return { success: true };
});

// ─── updateLineItemCost ────────────────────────────────────────────
export const updateLineItemCost = makeAuthFn("estimates.updateLineItemCost", async (args: { data: { id: string; unitCost: number } }, userId: string, pool: any) => {
  const li = await pool.query(
    "SELECT e.id as estimate_id, e.user_id FROM line_items l JOIN estimates e ON e.id = l.estimate_id WHERE l.id = $1",
    [args.data.id]
  );
  if (!li.rows[0] || li.rows[0].user_id !== userId) throw new Error("Line item not found");

  await pool.query("UPDATE line_items SET unit_cost = $1 WHERE id = $2", [args.data.unitCost, args.data.id]);
  await pool.query("UPDATE estimates SET updated_at = NOW() WHERE id = $1", [li.rows[0].estimate_id]);
  return { success: true };
});

// ─── updateLineItemMarkup ──────────────────────────────────────────
export const updateLineItemMarkup = makeAuthFn("estimates.updateLineItemMarkup", async (args: { data: { id: string; markupPercent: number } }, userId: string, pool: any) => {
  const li = await pool.query(
    "SELECT e.id as estimate_id, e.user_id FROM line_items l JOIN estimates e ON e.id = l.estimate_id WHERE l.id = $1",
    [args.data.id]
  );
  if (!li.rows[0] || li.rows[0].user_id !== userId) throw new Error("Line item not found");

  await pool.query("UPDATE line_items SET markup_percent = $1 WHERE id = $2", [args.data.markupPercent, args.data.id]);
  await pool.query("UPDATE estimates SET updated_at = NOW() WHERE id = $1", [li.rows[0].estimate_id]);
  return { success: true };
});

// ─── updateTaxRate ─────────────────────────────────────────────────
export const updateTaxRate = makeAuthFn("estimates.updateTaxRate", async (args: { data: { id: string; taxRate: number } }, userId: string, pool: any) => {
  const est = await pool.query("SELECT id FROM estimates WHERE id = $1 AND user_id = $2", [args.data.id, userId]);
  if (!est.rows[0]) throw new Error("Estimate not found");

  await pool.query("UPDATE estimates SET tax_rate = $1, updated_at = NOW() WHERE id = $2", [args.data.taxRate, args.data.id]);
  return { success: true };
});

// ─── updateEstimateStatus (bulk) ───────────────────────────────────
export const updateEstimateStatus = makeAuthFn("estimates.updateEstimateStatus", async (args: { data: { ids: string[]; status: string } }, userId: string, pool: any) => {
  const ids = args.data.ids;
  if (!ids || ids.length === 0) throw new Error("No IDs provided");
  const placeholders = ids.map((_, i) => `$${i + 2}`);
  await pool.query(
    `UPDATE estimates SET status = $1, updated_at = NOW() WHERE id IN (${placeholders.join(",")}) AND user_id = $${ids.length + 2}`,
    [args.data.status, ...ids, userId]
  );
  return { success: true };
});

// ─── bulkDelete ────────────────────────────────────────────────────
export const bulkDelete = makeAuthFn("estimates.bulkDelete", async (args: { data: { ids: string[] } }, userId: string, pool: any) => {
  const ids = args.data.ids;
  if (!ids || ids.length === 0) throw new Error("No IDs provided");
  const placeholders = ids.map((_, i) => `$${i + 2}`);
  await pool.query(
    `DELETE FROM estimates WHERE id IN (${placeholders.join(",")}) AND user_id = $${ids.length + 2}`,
    [...ids, userId]
  );
  return { success: true };
});

// ─── deleteEstimate ────────────────────────────────────────────────
export const deleteEstimate = makeAuthFn("estimates.deleteEstimate", async (args: { data: { id: string } }, userId: string, pool: any) => {
  await pool.query("DELETE FROM estimates WHERE id = $1 AND user_id = $2", [args.data.id, userId]);
  return { success: true };
});

// ─── saveVersion ───────────────────────────────────────────────────
export const saveVersion = makeAuthFn("estimates.saveVersion", async (args: { data: { estimateId: string } }, userId: string, pool: any) => {
  const est = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  if (!est.rows[0]) throw new Error("Estimate not found");

  const items = await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.estimateId]);

  // Get next version number
  const maxV = await pool.query(
    "SELECT COALESCE(MAX(version_number), 0) as mx FROM estimate_versions WHERE estimate_id = $1",
    [args.data.estimateId]
  );
  const nextVersion = maxV.rows[0].mx + 1;

  const snapshot = JSON.stringify({ estimate: est.rows[0], lineItems: items.rows });
  const id = crypto.randomUUID();
  await pool.query(
    "INSERT INTO estimate_versions (id, estimate_id, version_number, snapshot) VALUES ($1, $2, $3, $4)",
    [id, args.data.estimateId, nextVersion, snapshot]
  );
  return { versionNumber: nextVersion };
});

// ─── getVersions ───────────────────────────────────────────────────
export const getVersions = makeAuthFn("estimates.getVersions", async (args: { data: { estimateId: string } }, userId: string, pool: any) => {
  const est = await pool.query("SELECT id FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  if (!est.rows[0]) throw new Error("Estimate not found");

  const versions = await pool.query(
    "SELECT id, version_number, created_at FROM estimate_versions WHERE estimate_id = $1 ORDER BY version_number DESC",
    [args.data.estimateId]
  );
  return { versions: versions.rows };
});
