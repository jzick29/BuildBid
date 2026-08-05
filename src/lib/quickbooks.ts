import { getPool } from "./pool";
import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

// Standalone helpers (used by other modules)
export async function getQboToken(userId: string) {
  const pool = getPool();
  const r = await pool.query("SELECT * FROM qbo_tokens WHERE user_id = $1", [userId]);
  return r.rows[0] || null;
}

export async function storeQboToken(userId: string, accessToken: string, refreshToken: string, realmId: string, expiresIn: number) {
  const pool = getPool();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const existR = await pool.query("SELECT user_id FROM qbo_tokens WHERE user_id = $1", [userId]);
  if (existR.rows[0]) {
    await pool.query("UPDATE qbo_tokens SET access_token=$1, refresh_token=$2, realm_id=$3, expires_at=$4, updated_at=NOW() WHERE user_id=$5", [accessToken, refreshToken, realmId, expiresAt, userId]);
  } else {
    await pool.query("INSERT INTO qbo_tokens (user_id, access_token, refresh_token, realm_id, expires_at) VALUES ($1,$2,$3,$4,$5)", [userId, accessToken, refreshToken, realmId, expiresAt]);
  }
}

export const exportToQuickBooks = makeAuthFn("quickbooks.exportToQuickBooks", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const token = await getQboToken(userId);
  if (!token) throw new Error("QuickBooks not connected. Go to Settings to connect.");
  if (new Date(token.expires_at) < new Date()) throw new Error("QuickBooks token expired. Reconnect in Settings.");
  const estR = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  const estimate = estR.rows[0];
  if (!estimate) throw new Error("Estimate not found");
  const lineItems = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.estimateId])).rows;
  const customerId = await findOrCreateCustomer(token.access_token, token.realm_id, estimate.customer_name);
  const invoiceId = await createQboInvoice(token.access_token, token.realm_id, customerId, estimate, lineItems);

  // Auto-mark estimate as won + link QB invoice to BuildBid invoices
  await pool.query("UPDATE estimates SET status = 'won', updated_at = NOW() WHERE id = $1", [args.data.estimateId]);
  await pool.query("UPDATE invoices SET qbo_invoice_id = $1 WHERE estimate_id = $2 AND qbo_invoice_id IS NULL", [invoiceId, args.data.estimateId]);

  // Log sync event
  await pool.query(
    "INSERT INTO qbo_sync_log (id, user_id, entity_type, entity_id, qbo_id, direction, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())",
    [crypto.randomUUID(), userId, "estimate", args.data.estimateId, invoiceId, "export", "success", "Estimate auto-marked as won after QB export"]
  );

  return { invoiceId, estimateStatus: "won" };
});

async function findOrCreateCustomer(accessToken: string, realmId: string, customerName: string): Promise<string> {
  const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Customer WHERE DisplayName = '${encodeURIComponent(customerName)}'&minorversion=70`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  const body = await resp.json();
  if (body.QueryResponse?.Customer?.length > 0) return body.QueryResponse.Customer[0].Id;
  const createResp = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/customer?minorversion=70`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ DisplayName: customerName }) });
  const createBody = await createResp.json();
  return createBody.Customer.Id;
}

async function createQboInvoice(accessToken: string, realmId: string, customerId: string, estimate: any, lineItems: any[]): Promise<string> {
  const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/invoice?minorversion=70`;
  const lines = lineItems.map((item: any, i: number) => ({ Id: String(i + 1), DetailType: "SalesItemLineDetail", Amount: item.quantity * item.unit_cost * (1 + item.markup_percent / 100), SalesItemLineDetail: { ItemRef: { name: item.description, value: "1" }, UnitPrice: item.unit_cost * (1 + item.markup_percent / 100), Qty: item.quantity } }));
  const invoice = { Line: lines, CustomerRef: { value: customerId }, TxnDate: new Date().toISOString().split("T")[0], DueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0], DocNumber: estimate.project_name };
  const resp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(invoice) });
  const body = await resp.json();
  if (body.Fault) throw new Error(`QBO Error: ${JSON.stringify(body.Fault)}`);
  return body.Invoice.Id;
}
