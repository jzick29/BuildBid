import { makeAuthFn, makePublicFn } from "./iso";

export const sendChangeOrder = makeAuthFn("changeOrderWorkflow.sendChangeOrder", async (args: { data: { changeOrderId: string } }, _userId, pool) => {
  await pool.query("UPDATE change_orders SET status = 'sent', updated_at = NOW() WHERE id = $1 AND status = 'draft'", [args.data.changeOrderId]);

  // Fire push notification
  try {
    const coR = await pool.query("SELECT co.title, e.project_name, co.estimate_id FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE co.id = $1", [args.data.changeOrderId]);
    if (coR.rows[0]) {
      const { sendPushNotification } = await import("./push");
      await sendPushNotification(_userId, "Change Order Sent", `${coR.rows[0].title} for ${coR.rows[0].project_name} was sent`, `/estimates/${coR.rows[0].estimate_id}`);
      await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id) VALUES ($1,$2,$3,$4)",
        [crypto.randomUUID(), _userId, "change_order_sent", coR.rows[0].estimate_id]);
    }
  } catch (e) { console.error("[change-order] Notification error:", e); }

  return { success: true };
});

export const getPublicChangeOrder = makePublicFn("changeOrderWorkflow.getPublicChangeOrder", async (args: { data: { id: string } }, pool) => {
  const coR = await pool.query("SELECT co.*, e.project_name, e.customer_name FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE co.id = $1", [args.data.id]);
  if (!coR.rows[0]) throw new Error("Not found");
  const items = (await pool.query("SELECT * FROM change_order_items WHERE change_order_id = $1 ORDER BY sort_order", [args.data.id])).rows;
  return { changeOrder: coR.rows[0], items };
});

export const approveChangeOrder = makePublicFn("changeOrderWorkflow.approveChangeOrder", async (args: { data: { changeOrderId: string; approved: boolean } }, pool) => {
  const status = args.data.approved ? "approved" : "rejected";
  await pool.query("UPDATE change_orders SET status = $1, updated_at = NOW() WHERE id = $2", [status, args.data.changeOrderId]);
  const coR = await pool.query("SELECT co.user_id, co.title, e.project_name, co.estimate_id FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE co.id = $1", [args.data.changeOrderId]);
  const co = coR.rows[0];
  if (co) {
    try {
      const { sendPushNotification } = await import("./push");
      const event = args.data.approved ? "approved" : "rejected";
      await sendPushNotification(co.user_id, `Change Order ${event}`, `${co.title} for ${co.project_name} was ${event} by the customer.`, `/estimates/${co.estimate_id || ''}`);
    } catch {}
  }
  return { status };
});

export const listAllChangeOrders = makeAuthFn("changeOrderWorkflow.listAllChangeOrders", async (_args, userId, pool) => {
  return (await pool.query("SELECT co.*, e.project_name, e.customer_name FROM change_orders co JOIN estimates e ON e.id = co.estimate_id WHERE co.user_id = $1 ORDER BY co.created_at DESC", [userId])).rows;
});
