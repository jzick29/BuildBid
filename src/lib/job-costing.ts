import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

export const saveActualCosts = makeAuthFn("jobCosting.saveActualCosts", async (args: {
  data: { estimateId: string; items: Array<{ lineItemId?: string; materialCost: number; laborHours: number; laborCost: number; otherCost: number; notes?: string }> }
}, userId: string, pool: Pool) => {
  const tierR = await pool.query("SELECT subscription_tier FROM users WHERE id = $1", [userId]);
  if (tierR.rows[0]?.subscription_tier !== "shop") throw new Error("Shop plan required for job costing");
  const estR = await pool.query("SELECT id FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  if (!estR.rows[0]) throw new Error("Estimate not found");
  let totalMaterial = 0, totalLabor = 0, totalOther = 0;
  await pool.query("DELETE FROM actual_costs WHERE estimate_id = $1", [args.data.estimateId]);
  for (const item of args.data.items) {
    await pool.query(
      "INSERT INTO actual_costs (id, estimate_id, line_item_id, actual_material_cost, actual_labor_hours, actual_labor_cost, actual_other_cost, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [crypto.randomUUID(), args.data.estimateId, item.lineItemId || null, item.materialCost, item.laborHours, item.laborCost, item.otherCost, item.notes || ""]
    );
    totalMaterial += item.materialCost;
    totalLabor += item.laborCost;
    totalOther += item.otherCost;
  }
  await pool.query("UPDATE estimates SET actual_material_cost = $1, actual_labor_cost = $2, actual_other_cost = $3, updated_at = NOW() WHERE id = $4",
    [totalMaterial, totalLabor, totalOther, args.data.estimateId]);
  return { totalMaterial, totalLabor, totalOther };
});

export const getActualCosts = makeAuthFn("jobCosting.getActualCosts", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const costs = (await pool.query("SELECT * FROM actual_costs WHERE estimate_id = $1", [args.data.estimateId])).rows;
  const estR = await pool.query("SELECT actual_material_cost, actual_labor_cost, actual_other_cost FROM estimates WHERE id = $1", [args.data.estimateId]);
  const est = estR.rows[0];
  return { items: costs, totals: est || { actual_material_cost: 0, actual_labor_cost: 0, actual_other_cost: 0 } };
});
