import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

export const createChangeOrder = makeAuthFn("changeOrders.createChangeOrder", async (args: { data: { estimateId: string; title: string; description?: string } }, userId: string, pool: Pool) => {
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO change_orders (id, estimate_id, user_id, title, description) VALUES ($1, $2, $3, $4, $5)",
    [id, args.data.estimateId, userId, args.data.title, args.data.description || ""]);
  return { id };
});

export const getChangeOrders = makeAuthFn("changeOrders.getChangeOrders", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const orders = (await pool.query("SELECT * FROM change_orders WHERE estimate_id = $1 ORDER BY created_at DESC", [args.data.estimateId])).rows;
  const result = [];
  for (const co of orders) {
    const items = (await pool.query("SELECT * FROM change_order_items WHERE change_order_id = $1 ORDER BY sort_order", [co.id])).rows;
    const total = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_cost) * (1 + i.markup_percent / 100), 0);
    result.push({ ...co, items, total });
  }
  return result;
});

export const addChangeOrderItem = makeAuthFn("changeOrders.addChangeOrderItem", async (args: { data: { changeOrderId: string; description: string; quantity?: number; unit?: string; unitCost?: number; markupPercent?: number } }, userId: string, pool: Pool) => {
  const id = crypto.randomUUID();
  const maxR = await pool.query("SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM change_order_items WHERE change_order_id = $1", [args.data.changeOrderId]);
  await pool.query("INSERT INTO change_order_items (id, change_order_id, description, quantity, unit, unit_cost, markup_percent, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, args.data.changeOrderId, args.data.description, args.data.quantity || 1, args.data.unit || "each", args.data.unitCost || 0, args.data.markupPercent || 0, maxR.rows[0].next]);
  await pool.query("UPDATE change_orders SET updated_at = NOW() WHERE id = $1", [args.data.changeOrderId]);
  return { id };
});

export const removeChangeOrderItem = makeAuthFn("changeOrders.removeChangeOrderItem", async (args: { data: { id: string } }, userId: string, pool: Pool) => {
  await pool.query("DELETE FROM change_order_items WHERE id = $1", [args.data.id]);
  return { success: true };
});

export const updateChangeOrderStatus = makeAuthFn("changeOrders.updateChangeOrderStatus", async (args: { data: { id: string; status: string } }, userId: string, pool: Pool) => {
  await pool.query("UPDATE change_orders SET status = $1, updated_at = NOW() WHERE id = $2", [args.data.status, args.data.id]);
  return { success: true };
});

export const deleteChangeOrder = makeAuthFn("changeOrders.deleteChangeOrder", async (args: { data: { id: string } }, userId: string, pool: Pool) => {
  await pool.query("DELETE FROM change_orders WHERE id = $1", [args.data.id]);
  return { success: true };
});
