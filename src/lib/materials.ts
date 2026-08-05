import { makeAuthFn, makePublicFn } from "./iso";
import { getCatalogForTrade, searchCatalog, getAvailableTrades, getAvailableSuppliers } from "./supplier-catalog";

export const listMaterials = makeAuthFn("materials.listMaterials", async (args: { data?: { trade?: string } }, userId, pool) => {
  const trade = args.data?.trade;
  if (trade) return (await pool.query("SELECT * FROM materials WHERE user_id = $1 AND trade = $2 ORDER BY trade, name", [userId, trade])).rows;
  return (await pool.query("SELECT * FROM materials WHERE user_id = $1 ORDER BY trade, name", [userId])).rows;
});

export const importMaterials = makeAuthFn("materials.importMaterials", async (args: { data: { items: Array<{ name: string; description?: string; unit?: string; unit_cost?: number; trade?: string; supplier?: string }> } }, userId, pool) => {
  let count = 0;
  for (const item of args.data.items) {
    if (!item.name?.trim()) continue;
    await pool.query("INSERT INTO materials (id, user_id, name, description, unit, unit_cost, trade, supplier) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [crypto.randomUUID(), userId, item.name.trim(), item.description || "", item.unit || "each", item.unit_cost || 0, item.trade || "", item.supplier || ""]);
    count++;
  }
  return { imported: count };
});

// ─── Supplier Catalog API ──────────────────────────────────────────────────

export const searchSupplierCatalog = makeAuthFn("materials.searchSupplierCatalog", async (args: { data: { query: string } }) => {
  return searchCatalog(args.data.query);
});

export const getCatalogTrades = makeAuthFn("materials.getCatalogTrades", async () => {
  return { trades: getAvailableTrades(), suppliers: getAvailableSuppliers() };
});

export const importFromCatalog = makeAuthFn("materials.importFromCatalog", async (args: { data: { trade: string } }, userId, pool) => {
  const items = getCatalogForTrade(args.data.trade);
  let count = 0;
  for (const item of items) {
    await pool.query(
      "INSERT INTO materials (id, user_id, name, description, unit, unit_cost, trade, supplier) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
      [crypto.randomUUID(), userId, item.name, `${item.sku} — ${item.description}`, item.unit, item.unit_cost, item.trade, item.supplier]
    );
    count++;
  }
  return { imported: count, total: items.length };
});

export const saveSignature = makeAuthFn("materials.saveSignature", async (args: { data: { estimateId: string; signatureData: string } }, _userId, pool) => {
  await pool.query("UPDATE estimates SET signature_data = $1, updated_at = NOW() WHERE id = $2", [args.data.signatureData, args.data.estimateId]);
  return { success: true };
});

export const getPublicEstimate = makePublicFn("materials.getPublicEstimate", async (args: { data: { id: string } }, pool) => {
  const estR = await pool.query("SELECT id, project_name, customer_name, trade, signature_data FROM estimates WHERE id = $1", [args.data.id]);
  const est = estR.rows[0];
  if (!est) throw new Error("Not found");
  const items = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.id])).rows;
  return { estimate: est, items };
});

export const savePublicSignature = makePublicFn("materials.savePublicSignature", async (args: { data: { estimateId: string; signatureData: string } }, pool) => {
  await pool.query("UPDATE estimates SET signature_data = $1, updated_at = NOW() WHERE id = $2", [args.data.signatureData, args.data.estimateId]);
  const estR = await pool.query("SELECT user_id, project_name FROM estimates WHERE id = $1", [args.data.estimateId]);
  const est = estR.rows[0];
  if (est) {
    try {
      const { sendPushNotification } = await import("./push");
      await sendPushNotification(est.user_id, "Proposal Signed!", `${est.project_name} was just signed by the customer.`, `/estimates/${args.data.estimateId}`);
    } catch {}
  }
  return { success: true };
});
