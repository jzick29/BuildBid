import { getPool } from "./pool";
import { makeAuthFn } from "./iso";
import type { Pool } from "@neondatabase/serverless";

// Token management
export async function getSfToken(userId: string) {
  const pool = getPool();
  const r = await pool.query("SELECT * FROM salesforce_tokens WHERE user_id = $1", [userId]);
  return r.rows[0] || null;
}

export async function storeSfToken(
  userId: string,
  accessToken: string,
  refreshToken: string,
  instanceUrl: string
) {
  const pool = getPool();
  const existR = await pool.query("SELECT user_id FROM salesforce_tokens WHERE user_id = $1", [userId]);
  if (existR.rows[0]) {
    await pool.query(
      "UPDATE salesforce_tokens SET access_token=$1, refresh_token=$2, instance_url=$3, updated_at=NOW() WHERE user_id=$4",
      [accessToken, refreshToken, instanceUrl, userId]
    );
  } else {
    await pool.query(
      "INSERT INTO salesforce_tokens (user_id, access_token, refresh_token, instance_url) VALUES ($1,$2,$3,$4)",
      [userId, accessToken, refreshToken, instanceUrl]
    );
  }
}

async function refreshSfToken(token: any): Promise<string> {
  const clientId = process.env.SF_CLIENT_ID || "";
  const clientSecret = process.env.SF_CLIENT_SECRET || "";
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const resp = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const body = (await resp.json()) as any;
  if (!body.access_token) throw new Error("Salesforce token refresh failed");
  await storeSfToken(token.user_id, body.access_token, body.refresh_token || token.refresh_token, body.instance_url || token.instance_url);
  return body.access_token;
}

async function getValidSfAccessToken(userId: string, token: any): Promise<{ accessToken: string; instanceUrl: string }> {
  // Salesforce access tokens expire, but the refresh flow gets a new one
  // We try the current token; if it fails with 401, refresh
  return { accessToken: token.access_token, instanceUrl: token.instance_url };
}

async function sfApiCall(instanceUrl: string, accessToken: string, path: string, method: string = "GET", body?: any): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const opts: RequestInit = { method, headers };
  if (body && method !== "GET") opts.body = JSON.stringify(body);
  const resp = await fetch(`${instanceUrl}/services/data/v59.0${path}`, opts);
  const text = await resp.text();
  if (!resp.ok) {
    // Try refresh on 401
    if (resp.status === 401) throw new Error("SF_UNAUTHORIZED");
    throw new Error(`Salesforce API error (${resp.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

// Push estimate as Salesforce Opportunity
export const pushToSalesforce = makeAuthFn("salesforce.pushToSalesforce", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const token = await getSfToken(userId);
  if (!token) throw new Error("Salesforce not connected. Go to Settings to connect.");

  const estR = await pool.query("SELECT * FROM estimates WHERE id = $1 AND user_id = $2", [args.data.estimateId, userId]);
  const estimate = estR.rows[0];
  if (!estimate) throw new Error("Estimate not found");
  const lineItems = (await pool.query("SELECT * FROM line_items WHERE estimate_id = $1 ORDER BY sort_order", [args.data.estimateId])).rows;

  let accessToken = token.access_token;
  const instanceUrl = token.instance_url;

  const totalAmount = lineItems.reduce((s: number, i: any) => s + i.quantity * i.unit_cost * (1 + i.markup_percent / 100), 0);

  // Build Opportunity name from project_name and customer_name
  const oppName = `${estimate.project_name} — ${estimate.customer_name}`;
  const closeDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const stageName = estimate.status === "won" ? "Closed Won" : estimate.status === "sent" ? "Proposal/Price Quote" : "Prospecting";

  const oppBody: any = {
    Name: oppName,
    StageName: stageName,
    CloseDate: closeDate,
    Amount: totalAmount,
    Description: `${estimate.notes || ""}\n\nTrade: ${estimate.trade}\nEstimate ID: ${estimate.id}`,
  };

  // Check if already pushed (has sf_opportunity_id)
  const existingR = await pool.query(
    "SELECT sf_opportunity_id FROM salesforce_sync WHERE estimate_id = $1 AND user_id = $2 AND sf_opportunity_id IS NOT NULL LIMIT 1",
    [args.data.estimateId, userId]
  );

  let oppId: string;
  let action: string;

  try {
    if (existingR.rows[0]?.sf_opportunity_id) {
      // Update existing Opportunity
      oppId = existingR.rows[0].sf_opportunity_id;
      await sfApiCall(instanceUrl, accessToken, `/sobjects/Opportunity/${oppId}`, "PATCH", oppBody);
      action = "updated";
    } else {
      // Create new Opportunity
      const result = await sfApiCall(instanceUrl, accessToken, "/sobjects/Opportunity", "POST", oppBody);
      if (!result.id) throw new Error(`Salesforce create failed: ${JSON.stringify(result)}`);
      oppId = result.id;
      action = "created";

      // Store the mapping
      await pool.query(
        "INSERT INTO salesforce_sync (id, user_id, estimate_id, sf_opportunity_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
        [crypto.randomUUID(), userId, args.data.estimateId, oppId, "success", `Opportunity ${action}: ${oppName}`]
      );
    }
  } catch (e: any) {
    if (e.message === "SF_UNAUTHORIZED") {
      accessToken = await refreshSfToken(token);
      // Retry once
      if (existingR.rows[0]?.sf_opportunity_id) {
        oppId = existingR.rows[0].sf_opportunity_id;
        await sfApiCall(instanceUrl, accessToken, `/sobjects/Opportunity/${oppId}`, "PATCH", oppBody);
        action = "updated";
      } else {
        const result = await sfApiCall(instanceUrl, accessToken, "/sobjects/Opportunity", "POST", oppBody);
        oppId = result.id;
        action = "created";
        await pool.query(
          "INSERT INTO salesforce_sync (id, user_id, estimate_id, sf_opportunity_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
          [crypto.randomUUID(), userId, args.data.estimateId, oppId, "success", `Opportunity ${action}: ${oppName}`]
        );
      }
    } else {
      // Log failure
      await pool.query(
        "INSERT INTO salesforce_sync (id, user_id, estimate_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,NOW())",
        [crypto.randomUUID(), userId, args.data.estimateId, "failed", e.message]
      );
      throw e;
    }
  }

  // Log sync for successful update case (create already logged above)
  if (action === "updated") {
    await pool.query(
      "INSERT INTO salesforce_sync (id, user_id, estimate_id, sf_opportunity_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
      [crypto.randomUUID(), userId, args.data.estimateId, oppId, "success", `Opportunity ${action}: ${oppName}`]
    );
  }

  return { opportunityId: oppId, action, stageName, amount: totalAmount };
});

// Sync Opportunity status back to BuildBid
export const syncSfStatus = makeAuthFn("salesforce.syncSfStatus", async (args: { data: { estimateId: string } }, userId: string, pool: Pool) => {
  const token = await getSfToken(userId);
  if (!token) throw new Error("Salesforce not connected.");

  const syncR = await pool.query(
    "SELECT sf_opportunity_id FROM salesforce_sync WHERE estimate_id = $1 AND user_id = $2 AND sf_opportunity_id IS NOT NULL ORDER BY synced_at DESC LIMIT 1",
    [args.data.estimateId, userId]
  );
  if (!syncR.rows[0]) throw new Error("Not yet pushed to Salesforce.");

  const oppId = syncR.rows[0].sf_opportunity_id;
  let accessToken = token.access_token;
  const instanceUrl = token.instance_url;

  let oppData: any;
  try {
    oppData = await sfApiCall(instanceUrl, accessToken, `/sobjects/Opportunity/${oppId}`, "GET");
  } catch (e: any) {
    if (e.message === "SF_UNAUTHORIZED") {
      accessToken = await refreshSfToken(token);
      oppData = await sfApiCall(instanceUrl, accessToken, `/sobjects/Opportunity/${oppId}`, "GET");
    } else throw e;
  }

  const sfStage = oppData.StageName || "";
  const sfAmount = oppData.Amount || 0;

  // Map Salesforce stages to BuildBid statuses
  let newStatus = estimateStatusFromSfStage(sfStage);

  if (newStatus) {
    await pool.query("UPDATE estimates SET status = $1, updated_at = NOW() WHERE id = $2", [newStatus, args.data.estimateId]);
  }

  await pool.query(
    "INSERT INTO salesforce_sync (id, user_id, estimate_id, sf_opportunity_id, status, message, synced_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
    [crypto.randomUUID(), userId, args.data.estimateId, oppId, "success", `Status synced from SF: ${sfStage} ($${sfAmount})`]
  );

  return { sfStage, sfAmount, newBuildbidStatus: newStatus };
});

function estimateStatusFromSfStage(sfStage: string): string | null {
  const lowered = sfStage.toLowerCase();
  if (lowered.includes("closed won")) return "won";
  if (lowered.includes("closed lost")) return "lost";
  if (lowered.includes("proposal") || lowered.includes("negotiation")) return "sent";
  if (lowered.includes("prospecting") || lowered.includes("qualification")) return "draft";
  return null; // No mapping
}
