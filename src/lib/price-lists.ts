import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

export const uploadPriceList = makeAuthFn("priceLists.uploadPriceList", async (args: { data: { supplier: string; items: Array<{ name: string; unit: string; unit_cost: number; trade?: string }> } }, userId: string, pool: Pool) => {
  for (const item of args.data.items) {
    const existR = await pool.query("SELECT id, unit_cost FROM materials WHERE name = $1 AND user_id = $2 AND supplier = $3", [item.name, userId, args.data.supplier]);
    if (existR.rows[0]) {
      await pool.query("UPDATE materials SET unit_cost = $1, unit = $2, trade = COALESCE($3, trade), updated_at = NOW() WHERE id = $4", [item.unit_cost, item.unit, item.trade || null, existR.rows[0].id]);
    } else {
      await pool.query("INSERT INTO materials (id, user_id, name, unit, unit_cost, trade, supplier) VALUES ($1,$2,$3,$4,$5,$6,$7)", [crypto.randomUUID(), userId, item.name, item.unit, item.unit_cost, item.trade || "", args.data.supplier]);
    }
  }
  await pool.query("INSERT INTO price_lists (supplier, user_id, item_count, updated_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (supplier, user_id) DO UPDATE SET item_count = $3, updated_at = NOW()", [args.data.supplier, userId, args.data.items.length]);
  return { count: args.data.items.length };
});

export const getPriceLists = makeAuthFn("priceLists.getPriceLists", async (_args: any, userId: string, pool: Pool) => {
  return (await pool.query("SELECT supplier, item_count, updated_at FROM price_lists WHERE user_id = $1 ORDER BY updated_at DESC", [userId])).rows;
});

export const getMaterialsBySupplier = makeAuthFn("priceLists.getMaterialsBySupplier", async (args: { data: { supplier: string } }, userId: string, pool: Pool) => {
  return (await pool.query("SELECT * FROM materials WHERE user_id = $1 AND supplier = $2 ORDER BY trade, name", [userId, args.data.supplier])).rows;
});

export const refreshEstimatePrices = makeAuthFn("priceLists.refreshEstimatePrices", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const items = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.estimateId])).rows;
  const materials = (await pool.query("SELECT name, unit_cost FROM materials WHERE user_id = $1", [userId])).rows;
  const priceMap: Record<string, number> = {};
  for (const m of materials) priceMap[m.name.toLowerCase()] = m.unit_cost;
  let updatedCount = 0;
  for (const item of items) {
    const desc = item.description.toLowerCase();
    const match = Object.entries(priceMap).find(([name]) => desc.includes(name));
    if (match && match[1] !== item.unit_cost) {
      await pool.query("UPDATE line_items SET unit_cost = $1 WHERE id = $2", [match[1], item.id]);
      updatedCount++;
    }
  }
  await pool.query("UPDATE estimates SET updated_at = NOW() WHERE id = $1", [args.data.estimateId]);
  return { updatedCount };
});

export const getPriceFreshness = makeAuthFn("priceLists.getPriceFreshness", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const estR = await pool.query("SELECT updated_at FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  const latestR = await pool.query("SELECT MAX(updated_at) as latest FROM price_lists WHERE user_id = $1", [userId]);
  const estUpdated = estR.rows[0]?.updated_at || null;
  const latest = latestR.rows[0]?.latest || null;
  return { estimateUpdated: estUpdated, latestPriceList: latest, stale: latest && estUpdated && latest > estUpdated };
});

export const linkLineItemToMaterial = makeAuthFn("priceLists.linkLineItemToMaterial", async (args: { data: { lineItemId: string; materialId: string } }, userId: string, pool: Pool) => {
  const materialR = await pool.query("SELECT unit_cost FROM materials WHERE id = $1 AND user_id = $2", [args.data.materialId, userId]);
  if (!materialR.rows[0]) throw new Error("Material not found");
  await pool.query("UPDATE line_items SET unit_cost = $1, material_id = $2 WHERE id = $3", [materialR.rows[0].unit_cost, args.data.materialId, args.data.lineItemId]);
  return { success: true };
});
