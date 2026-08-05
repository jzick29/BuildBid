import { makeAuthFn, makeAuthFnFull } from "./iso";

export const createInvoice = makeAuthFnFull("invoices.createInvoice", async (args: { data: { estimateId: string } }, user, pool) => {
  const estR = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, user.id]);
  if (!estR.rows[0]) throw new Error("Estimate not found");
  const items = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.estimateId])).rows;
  const total = items.reduce((s: number, i: any) => s + i.quantity * i.unit_cost * (1 + i.markup_percent / 100), 0);
  const maxR = await pool.query("SELECT COALESCE(MAX(invoice_number), 1000) as mx FROM invoices WHERE user_id = $1", [user.id]);
  const invNum = parseInt(maxR.rows[0].mx) + 1;
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO invoices (id, estimate_id, user_id, invoice_number, status, due_date, total) VALUES ($1,$2,$3,$4,$5,$6,$7)", [id, args.data.estimateId, user.id, invNum, "draft", dueDate, total]);

  // Fire push notification
  try {
    const { sendPushNotification } = await import("./push");
    await sendPushNotification(user.id, "Invoice Created", `Invoice #${invNum} created for ${estR.rows[0].project_name}`, `/invoices/${id}`);
    await pool.query("INSERT INTO automation_logs (id, user_id, type, estimate_id) VALUES ($1,$2,$3,$4)",
      [crypto.randomUUID(), user.id, "invoice_created", args.data.estimateId]);
  } catch (e) { console.error("[invoices] Notification error:", e); }

  return { id, invoiceNumber: invNum };
});

export const listInvoices = makeAuthFn("invoices.listInvoices", async (_args, userId, pool) => {
  return (await pool.query("SELECT i.*, e.project_name, e.customer_name FROM invoices i JOIN estimates e ON e.id = i.estimate_id WHERE i.user_id = $1 ORDER BY i.created_at DESC", [userId])).rows;
});

export const getInvoice = makeAuthFn("invoices.getInvoice", async (args: { data: { id: string } }, userId, pool) => {
  const invR = await pool.query("SELECT i.*, e.project_name, e.customer_name FROM invoices i JOIN estimates e ON e.id = i.estimate_id WHERE i.id = $1 AND i.user_id = $2", [args.data.id, userId]);
  if (!invR.rows[0]) throw new Error("Not found");
  const items = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [invR.rows[0].estimate_id])).rows;
  return { invoice: invR.rows[0], items };
});

export const updateInvoiceStatus = makeAuthFn("invoices.updateInvoiceStatus", async (args: { data: { id: string; status: string } }, userId, pool) => {
  if (args.data.status === "paid") {
    await pool.query("UPDATE invoices SET status = $1, paid_at = NOW(), updated_at = NOW() WHERE id = $2 AND user_id = $3", [args.data.status, args.data.id, userId]);
  } else {
    await pool.query("UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [args.data.status, args.data.id, userId]);
  }
  return { success: true };
});
