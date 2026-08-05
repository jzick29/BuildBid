import { getPool } from "./pool";
import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

// Token management
export async function getHubspotToken(userId: string) {
  const pool = getPool();
  const r = await pool.query("SELECT * FROM hubspot_tokens WHERE user_id = $1", [userId]);
  return r.rows[0] || null;
}

export async function storeHubspotToken(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const pool = getPool();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const existR = await pool.query("SELECT user_id FROM hubspot_tokens WHERE user_id = $1", [userId]);
  if (existR.rows[0]) {
    await pool.query(
      "UPDATE hubspot_tokens SET access_token=$1, refresh_token=$2, expires_at=$3, updated_at=NOW() WHERE user_id=$4",
      [accessToken, refreshToken, expiresAt, userId]
    );
  } else {
    await pool.query(
      "INSERT INTO hubspot_tokens (user_id, access_token, refresh_token, expires_at) VALUES ($1,$2,$3,$4)",
      [userId, accessToken, refreshToken, expiresAt]
    );
  }
}

async function refreshHubspotToken(token: any): Promise<string> {
  const clientId = process.env.HUBSPOT_CLIENT_ID || "";
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET || "";
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const resp = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const body = (await resp.json()) as any;
  if (!body.access_token) throw new Error("HubSpot token refresh failed");
  await storeHubspotToken(token.user_id, body.access_token, body.refresh_token, body.expires_in || 1800);
  return body.access_token;
}

async function getValidHsToken(userId: string, token: any): Promise<string> {
  if (new Date(token.expires_at) > new Date()) return token.access_token;
  return refreshHubspotToken(token);
}

async function hsApiCall(accessToken: string, path: string, method: string = "GET", body?: any): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const opts: RequestInit = { method, headers };
  if (body && method !== "GET") opts.body = JSON.stringify(body);
  const resp = await fetch(`https://api.hubapi.com${path}`, opts);
  const text = await resp.text();
  if (!resp.ok) {
    if (resp.status === 401) throw new Error("HS_UNAUTHORIZED");
    throw new Error(`HubSpot API error (${resp.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

// Push estimate as HubSpot Deal
export const pushToHubspot = makeAuthFn("hubspot.pushToHubspot", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const token = await getHubspotToken(userId);
  if (!token) throw new Error("HubSpot not connected. Go to Settings to connect.");

  const estR = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  const estimate = estR.rows[0];
  if (!estimate) throw new Error("Estimate not found");
  const lineItems = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.estimateId])).rows;

  let accessToken = await getValidHsToken(userId, token);
  const totalAmount = lineItems.reduce((s: number, i: any) => s + i.quantity * i.unit_cost * (1 + i.markup_percent / 100), 0);

  // Determine pipeline and dealstage — default to "default" pipeline, map status
  const dealstage = estimate.status === "won" ? "closedwon" : estimate.status === "sent" ? "contractsent" : estimate.status === "lost" ? "closedlost" : "appointmentscheduled";

  const dealName = `${estimate.project_name} — ${estimate.customer_name}`;

  const dealProperties: any = {
    dealname: dealName,
    amount: totalAmount.toString(),
    dealstage,
    description: `${estimate.notes || ""}\n\nTrade: ${estimate.trade}\nEstimate ID: ${estimate.id}`,
    closedate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    pipeline: "default",
  };

  // Check if already pushed
  const existingR = await pool.query(
    "SELECT hs_deal_id FROM hubspot_sync WHERE estimate_id = $1 AND user_id = $2 AND hs_deal_id IS NOT NULL LIMIT 1",
    [args.data.estimateId, userId]
  );

  let dealId: string;
  let action: string;

  const doit = async (at: string) => {
    if (existingR.rows[0]?.hs_deal_id) {
      dealId = existingR.rows[0].hs_deal_id;
      await hsApiCall(at, `/crm/v3/objects/deals/${dealId}`, "PATCH", { properties: dealProperties });
      action = "updated";
    } else {
      const result = await hsApiCall(at, "/crm/v3/objects/deals", "POST", { properties: dealProperties });
      if (!result.id) throw new Error(`HubSpot create failed: ${JSON.stringify(result)}`);
      dealId = result.id;
      action = "created";

      await pool.query(
        "INSERT INTO hubspot_sync (id, user_id, estimate_id, hs_deal_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
        [crypto.randomUUID(), userId, args.data.estimateId, dealId, "success", `Deal ${action}: ${dealName}`]
      );

      // Sync contact
      await syncHsContact(accessToken, estimate.customer_name, dealId, userId, args.data.estimateId, pool);
    }
  };

  try {
    await doit(accessToken);
  } catch (e: any) {
    if (e.message === "HS_UNAUTHORIZED") {
      accessToken = await refreshHubspotToken(token);
      await doit(accessToken);
    } else {
      await pool.query(
        "INSERT INTO hubspot_sync (id, user_id, estimate_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,NOW())",
        [crypto.randomUUID(), userId, args.data.estimateId, "failed", e.message]
      );
      throw e;
    }
  }

  if (action === "updated") {
    await pool.query(
      "INSERT INTO hubspot_sync (id, user_id, estimate_id, hs_deal_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
      [crypto.randomUUID(), userId, args.data.estimateId, dealId, "success", `Deal ${action}: ${dealName}`]
    );
  }

  return { dealId, action, dealstage, amount: totalAmount };
});

// Sync contact: create or find HubSpot contact, associate with deal
async function syncHsContact(
  accessToken: string,
  customerName: string,
  dealId: string,
  userId: string,
  estimateId: string,
  pool: Pool
) {
  try {
    // Search for existing contact by name
    const searchBody = {
      filterGroups: [{ filters: [{ propertyName: "firstname", operator: "CONTAINS_TOKEN", value: customerName }] }],
    };
    const searchResp = await hsApiCall(accessToken, "/crm/v3/objects/contacts/search", "POST", searchBody);
    let contactId = searchResp.results?.[0]?.id;

    if (!contactId) {
      // Create contact
      const nameParts = customerName.split(" ");
      const firstname = nameParts[0] || customerName;
      const lastname = nameParts.slice(1).join(" ") || "";
      const createResp = await hsApiCall(accessToken, "/crm/v3/objects/contacts", "POST", {
        properties: { firstname, lastname, company: customerName },
      });
      contactId = createResp.id;
    }

    // Associate contact with deal
    await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });

    await pool.query(
      "INSERT INTO hubspot_sync (id, user_id, estimate_id, hs_deal_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
      [crypto.randomUUID(), userId, estimateId, dealId, "success", `Contact synced: ${customerName} (${contactId})`]
    );
  } catch (e: any) {
    // Non-fatal: contact sync failure shouldn't break deal creation
    await pool.query(
      "INSERT INTO hubspot_sync (id, user_id, estimate_id, hs_deal_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
      [crypto.randomUUID(), userId, estimateId, dealId, "partial", `Contact sync failed: ${e.message}`]
    );
  }
}

// Sync Deal status back to BuildBid
export const syncHsStatus = makeAuthFn("hubspot.syncHsStatus", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const token = await getHubspotToken(userId);
  if (!token) throw new Error("HubSpot not connected.");

  const syncR = await pool.query(
    "SELECT hs_deal_id FROM hubspot_sync WHERE estimate_id = $1 AND user_id = $2 AND hs_deal_id IS NOT NULL ORDER BY synced_at DESC LIMIT 1",
    [args.data.estimateId, userId]
  );
  if (!syncR.rows[0]) throw new Error("Not yet pushed to HubSpot.");

  const dealId = syncR.rows[0].hs_deal_id;
  let accessToken = await getValidHsToken(userId, token);

  let dealData: any;
  try {
    dealData = await hsApiCall(accessToken, `/crm/v3/objects/deals/${dealId}`, "GET");
  } catch (e: any) {
    if (e.message === "HS_UNAUTHORIZED") {
      accessToken = await refreshHubspotToken(token);
      dealData = await hsApiCall(accessToken, `/crm/v3/objects/deals/${dealId}`, "GET");
    } else throw e;
  }

  const hsStage = dealData.properties?.dealstage || "";
  const hsAmount = dealData.properties?.amount || "0";

  // Map HubSpot deal stages to BuildBid statuses
  const stageMap: Record<string, string> = {
    closedwon: "won",
    closedlost: "lost",
    contractsent: "sent",
    appointmentscheduled: "draft",
    qualifiedtobuy: "draft",
    presentationscheduled: "sent",
    decisionmakerboughtin: "draft",
  };
  const newStatus = stageMap[hsStage.toLowerCase()];

  if (newStatus) {
    await pool.query("UPDATE estimates SET status = $1, updated_at = NOW() WHERE id = $2", [newStatus, args.data.estimateId]);
  }

  await pool.query(
    "INSERT INTO hubspot_sync (id, user_id, estimate_id, hs_deal_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
    [crypto.randomUUID(), userId, args.data.estimateId, dealId, "success", `Status synced from HS: ${hsStage} ($${hsAmount})`]
  );

  return { hsStage, hsAmount, newBuildbidStatus: newStatus || null };
});
