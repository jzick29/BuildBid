import { getPool } from "./pool";
import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

// Token management
export async function getXeroToken(userId: string) {
  const pool = getPool();
  const r = await pool.query("SELECT * FROM xero_tokens WHERE user_id = $1", [userId]);
  return r.rows[0] || null;
}

export async function storeXeroToken(
  userId: string,
  accessToken: string,
  refreshToken: string,
  tenantId: string,
  expiresIn: number
) {
  const pool = getPool();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const existR = await pool.query("SELECT user_id FROM xero_tokens WHERE user_id = $1", [userId]);
  if (existR.rows[0]) {
    await pool.query(
      "UPDATE xero_tokens SET access_token=$1, refresh_token=$2, tenant_id=$3, expires_at=$4, updated_at=NOW() WHERE user_id=$5",
      [accessToken, refreshToken, tenantId, expiresAt, userId]
    );
  } else {
    await pool.query(
      "INSERT INTO xero_tokens (user_id, access_token, refresh_token, tenant_id, expires_at) VALUES ($1,$2,$3,$4,$5)",
      [userId, accessToken, refreshToken, tenantId, expiresAt]
    );
  }
}

async function refreshXeroToken(token: any): Promise<string> {
  const clientId = process.env.XERO_CLIENT_ID || "";
  const clientSecret = process.env.XERO_CLIENT_SECRET || "";
  const resp = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });
  const body = (await resp.json()) as any;
  if (!body.access_token) throw new Error("Xero token refresh failed");
  await storeXeroToken(token.user_id, body.access_token, body.refresh_token, token.tenant_id, body.expires_in || 1800);
  return body.access_token;
}

async function getValidAccessToken(userId: string, token: any): Promise<string> {
  if (new Date(token.expires_at) > new Date()) return token.access_token;
  return refreshXeroToken(token);
}

// Main export function — creates a Xero invoice from an estimate
export const exportToXero = makeAuthFn("xero.exportToXero", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const token = await getXeroToken(userId);
  if (!token) throw new Error("Xero not connected. Go to Settings to connect.");
  const estR = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  const estimate = estR.rows[0];
  if (!estimate) throw new Error("Estimate not found");
  const lineItems = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.estimateId])).rows;

  const accessToken = await getValidAccessToken(userId, token);

  const contactId = await findOrCreateXeroContact(accessToken, token.tenant_id, estimate.customer_name);
  const invoiceId = await createXeroInvoice(accessToken, token.tenant_id, contactId, estimate, lineItems);

  // Auto-mark estimate as won + link invoice
  await pool.query("UPDATE estimates SET status = 'won', updated_at = NOW() WHERE id = $1", [args.data.estimateId]);
  await pool.query("UPDATE invoices SET xero_invoice_id = $1 WHERE estimate_id = $2 AND xero_invoice_id IS NULL", [invoiceId, args.data.estimateId]);

  // Log sync event
  await pool.query(
    "INSERT INTO xero_sync_log (id, user_id, entity_type, entity_id, xero_id, direction, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())",
    [crypto.randomUUID(), userId, "estimate", args.data.estimateId, invoiceId, "export", "success", "Estimate auto-marked as won after Xero export"]
  );

  return { invoiceId, estimateStatus: "won" };
});

// Sync actual costs from Xero (pulls tracked costs for won estimates)
export const syncCostsFromXero = makeAuthFn("xero.syncCostsFromXero", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const token = await getXeroToken(userId);
  if (!token) throw new Error("Xero not connected.");
  const accessToken = await getValidAccessToken(userId, token);

  const estR = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  const estimate = estR.rows[0];
  if (!estimate) throw new Error("Estimate not found");

  // Look up the Xero invoice ID from our invoices table
  const invR = await pool.query(
    "SELECT xero_invoice_id FROM invoices WHERE estimate_id = $1 AND xero_invoice_id IS NOT NULL LIMIT 1",
    [args.data.estimateId]
  );
  const xeroInvoiceId = invR.rows[0]?.xero_invoice_id;
  if (!xeroInvoiceId) throw new Error("No Xero invoice linked to this estimate. Export first.");

  // Fetch invoice from Xero
  const invoiceResp = await fetch(
    `https://api.xero.com/api.xro/2.0/Invoices/${xeroInvoiceId}`,
    { headers: { Authorization: `Bearer ${accessToken}`, "Xero-tenant-id": token.tenant_id, Accept: "application/json" } }
  );
  if (!invoiceResp.ok) throw new Error(`Failed to fetch Xero invoice: ${invoiceResp.status}`);
  const invBody = (await invoiceResp.json()) as any;
  const xeroInvoice = invBody.Invoices?.[0];
  if (!xeroInvoice) throw new Error("Invoice not found in Xero");

  const total = xeroInvoice.Total || 0;
  const amountPaid = xeroInvoice.AmountPaid || 0;
  const status = xeroInvoice.Status || "DRAFT";

  // Update actual costs
  await pool.query(
    "INSERT INTO actual_costs (id, estimate_id, actual_material_cost, actual_other_cost, notes, created_at) VALUES ($1,$2,$3,$4,$5,NOW())",
    [crypto.randomUUID(), args.data.estimateId, total, 0, `Synced from Xero invoice ${xeroInvoice.InvoiceNumber || xeroInvoiceId}. Status: ${status}, Paid: ${amountPaid}`]
  );

  // Update estimate status based on invoice status
  if (status === "PAID" || status === "AUTHORISED") {
    await pool.query("UPDATE estimates SET status = 'won', updated_at = NOW() WHERE id = $1", [args.data.estimateId]);
  }

  // Log sync
  await pool.query(
    "INSERT INTO xero_sync_log (id, user_id, entity_type, entity_id, xero_id, direction, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())",
    [crypto.randomUUID(), userId, "costs", args.data.estimateId, xeroInvoiceId, "import", "success", `Synced costs: total=${total}, paid=${amountPaid}, status=${status}`]
  );

  return { total, amountPaid, xeroStatus: status };
});

// Import Xero items as materials
export const importXeroItems = makeAuthFn("xero.importXeroItems", async (_args: { data: {} }, userId: string, pool: Pool) => {
  const token = await getXeroToken(userId);
  if (!token) throw new Error("Xero not connected.");
  const accessToken = await getValidAccessToken(userId, token);

  const resp = await fetch(
    "https://api.xero.com/api.xro/2.0/Items",
    { headers: { Authorization: `Bearer ${accessToken}`, "Xero-tenant-id": token.tenant_id, Accept: "application/json" } }
  );
  if (!resp.ok) throw new Error(`Failed to fetch Xero items: ${resp.status}`);
  const body = (await resp.json()) as any;
  const items = body.Items || [];
  let imported = 0;

  for (const item of items) {
    const sku = item.Code || "";
    const name = item.Name || item.Description || "Xero Item";
    const unitCost = item.SalesDetails?.UnitPrice || 0;
    const description = item.Description || "";

    // Deduplicate by SKU
    const existR = await pool.query("SELECT id FROM materials WHERE user_id = $1 AND sku = $2", [userId, sku]);
    if (!existR.rows[0] && sku.trim()) {
      await pool.query(
        "INSERT INTO materials (id, user_id, name, description, unit, unit_cost, trade, supplier, sku, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())",
        [crypto.randomUUID(), userId, name, description, "each", unitCost, "", "Xero", sku]
      );
      imported++;
    }
  }

  await pool.query(
    "INSERT INTO xero_sync_log (id, user_id, entity_type, direction, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
    [crypto.randomUUID(), userId, "items", "import", "success", `Imported ${imported} of ${items.length} Xero items as materials`]
  );

  return { imported, total: items.length };
});

// --- Internal helpers ---

async function findOrCreateXeroContact(accessToken: string, tenantId: string, customerName: string): Promise<string> {
  // Search for existing contact
  const searchUrl = `https://api.xero.com/api.xro/2.0/Contacts?where=Name==${encodeURIComponent(`"${customerName}"`)}`;
  const searchResp = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, "Xero-tenant-id": tenantId, Accept: "application/json" },
  });
  const searchBody = (await searchResp.json()) as any;
  if (searchBody.Contacts?.length > 0) return searchBody.Contacts[0].ContactID;

  // Create new contact
  const createResp = await fetch("https://api.xero.com/api.xro/2.0/Contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ Name: customerName }),
  });
  const createBody = (await createResp.json()) as any;
  if (!createBody.Contacts?.[0]) throw new Error(`Failed to create Xero contact: ${JSON.stringify(createBody)}`);
  return createBody.Contacts[0].ContactID;
}

async function createXeroInvoice(
  accessToken: string,
  tenantId: string,
  contactId: string,
  estimate: any,
  lineItems: any[]
): Promise<string> {
  const lines = lineItems.map((item: any) => {
    const unitAmount = item.unit_cost * (1 + item.markup_percent / 100);
    return {
      Description: item.description,
      Quantity: item.quantity,
      UnitAmount: unitAmount,
      AccountCode: "200", // Default sales account
    };
  });

  const invoice = {
    Type: "ACCREC",
    Contact: { ContactID: contactId },
    Date: new Date().toISOString().split("T")[0],
    DueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    LineItems: lines,
    Reference: estimate.project_name,
    Status: "AUTHORISED",
  };

  const resp = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(invoice),
  });
  const body = (await resp.json()) as any;
  if (body.Status === "ERROR" || !body.Invoices?.[0]) {
    throw new Error(`Xero Error: ${JSON.stringify(body)}`);
  }
  return body.Invoices[0].InvoiceID;
}
