import { makeAuthFn } from "./iso";
import crypto from "crypto";

// ─── Webhook / Zapier integration hub ────────────────────────────────
// API keys for external access + outbound webhooks (HMAC-signed) fired
// on key events (estimate.sent, estimate.won, invoice.paid,
// job.scheduled, job.completed) + Zapier app manifest.
//
// Tier gate: Pro = 3 webhook endpoints, Shop = unlimited.
// (Starter/trial users can generate API keys but cannot create endpoints.)

export const WEBHOOK_EVENTS = [
  { id: "estimate.sent", label: "Estimate sent" },
  { id: "estimate.won", label: "Estimate won" },
  { id: "invoice.paid", label: "Invoice paid" },
  { id: "job.scheduled", label: "Job scheduled" },
  { id: "job.completed", label: "Job completed" },
] as const;

const MAX_PRO_WEBHOOKS = 3;

function normalizeUrl(u: string): string {
  const url = String(u || "").trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("Webhook URL must start with http:// or https://");
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("Invalid webhook URL"); }
  return parsed.toString();
}

function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function signPayload(secret: string, payload: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// ─── Plain helper — fire a webhook event for a user (used by vercel-entry) ──
export async function fireWebhook(pool: any, userId: string, event: string, data: any): Promise<void> {
  try {
    const endpoints = (await pool.query(
      "SELECT * FROM webhook_endpoints WHERE user_id = $1 AND active = 1 AND events LIKE $2",
      [userId, `%${event}%`]
    )).rows;
    if (endpoints.length === 0) return;
    const payload = JSON.stringify({ event, timestamp: new Date().toISOString(), data });
    for (const ep of endpoints) {
      const logId = crypto.randomUUID();
      const started = Date.now();
      let status = 0;
      let respText = "";
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "BuildBid-Webhook/1.0",
            "X-BuildBid-Event": event,
            "X-BuildBid-Delivery": logId,
            "X-BuildBid-Signature": signPayload(ep.secret, payload),
          },
          body: payload,
          signal: controller.signal,
        });
        clearTimeout(timer);
        status = resp.status;
        respText = (await resp.text()).slice(0, 2000);
      } catch (e: any) {
        respText = `Delivery error: ${e?.message || e}`;
      }
      await pool.query(
        "INSERT INTO webhook_logs (id, endpoint_id, user_id, event, payload, status_code, response, duration_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [logId, ep.id, userId, event, payload, status, respText, Date.now() - started]
      );
    }
  } catch (e: any) {
    console.error(`[webhooks] fire ${event} failed:`, e?.message || e);
  }
}

// ─── API keys ─────────────────────────────────────────────────────────

// webhooks.listApiKeys
export const listApiKeys = makeAuthFn("webhooks.listApiKeys", async (_args, userId, pool) => {
  const keys = (await pool.query(
    "SELECT id, name, key_prefix, created_at, last_used_at, revoked FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  )).rows;
  return { keys };
});

// webhooks.createApiKey
export const createApiKey = makeAuthFn("webhooks.createApiKey", async (args: { data: { name?: string } }, userId, pool) => {
  const name = String(args.data?.name || "").trim() || "API Key";
  if (name.length > 80) throw new Error("Name too long (max 80 chars)");
  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(24).toString("base64url");
  const prefix = "bb_" + secret.slice(0, 10);
  await pool.query(
    "INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash) VALUES ($1,$2,$3,$4,$5)",
    [id, userId, name, prefix, hashSecret(secret)]
  );
  // Full key shown exactly once
  return { success: true, id, key: `${prefix}.${secret}` };
});

// webhooks.revokeApiKey
export const revokeApiKey = makeAuthFn("webhooks.revokeApiKey", async (args: { data: { id: string } }, userId, pool) => {
  const r = await pool.query("UPDATE api_keys SET revoked = 1 WHERE id = $1 AND user_id = $2", [args.data?.id, userId]);
  if (r.rowCount === 0) throw new Error("API key not found");
  return { success: true };
});

// webhooks.verifyApiKey — used by /api/v1 endpoints; returns user id or null
export async function verifyApiKey(pool: any, key: string): Promise<string | null> {
  const parts = String(key || "").split(".");
  if (parts.length !== 2) return null;
  const [prefix, secret] = parts;
  const r = await pool.query(
    "SELECT id, user_id FROM api_keys WHERE key_prefix = $1 AND key_hash = $2 AND revoked = 0",
    [prefix, hashSecret(secret)]
  );
  if (!r.rows[0]) return null;
  await pool.query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", [r.rows[0].id]);
  return r.rows[0].user_id;
}

// ─── Webhook endpoints ────────────────────────────────────────────────

// webhooks.listEndpoints
export const listWebhooks = makeAuthFn("webhooks.listEndpoints", async (_args, userId, pool) => {
  const endpoints = (await pool.query(
    "SELECT id, name, url, events, active, created_at, updated_at FROM webhook_endpoints WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  )).rows;
  const tierR = await pool.query("SELECT subscription_tier FROM users WHERE id = $1", [userId]);
  const tier = tierR.rows[0]?.subscription_tier || "trial";
  const limit = tier === "shop" ? null : tier === "pro" ? MAX_PRO_WEBHOOKS : 0;
  return { endpoints, limit, tier };
});

// webhooks.createEndpoint
export const createWebhook = makeAuthFn("webhooks.createEndpoint", async (args: { data: { name?: string; url: string; events: string[] } }, userId, pool) => {
  const tierR = await pool.query("SELECT subscription_tier FROM users WHERE id = $1", [userId]);
  const tier = tierR.rows[0]?.subscription_tier || "trial";
  const limit = tier === "shop" ? null : tier === "pro" ? MAX_PRO_WEBHOOKS : 0;
  if (limit === 0) throw new Error("Webhooks require the Pro or Shop plan");
  const count = (await pool.query("SELECT COUNT(*)::int as c FROM webhook_endpoints WHERE user_id = $1", [userId])).rows[0].c;
  if (limit !== null && count >= limit) throw new Error(`Pro plan allows ${limit} webhooks — upgrade to Shop for unlimited`);

  const d = args.data || {};
  const url = normalizeUrl(d.url);
  const events = (Array.isArray(d.events) ? d.events : []).filter((e) => WEBHOOK_EVENTS.some((w) => w.id === e));
  if (events.length === 0) throw new Error("Select at least one event");
  const name = String(d.name || "").trim() || url;
  const secret = crypto.randomBytes(24).toString("base64url");
  const id = crypto.randomUUID();
  await pool.query(
    "INSERT INTO webhook_endpoints (id, user_id, name, url, events, secret) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, userId, name.slice(0, 120), url, JSON.stringify(events), secret]
  );
  return { success: true, id, secret }; // secret shown once for HMAC verification
});

// webhooks.updateEndpoint
export const updateWebhook = makeAuthFn("webhooks.updateEndpoint", async (args: { data: { id: string; name?: string; url?: string; events?: string[]; active?: boolean } }, userId, pool) => {
  const d = args.data || {};
  const own = await pool.query("SELECT id FROM webhook_endpoints WHERE id = $1 AND user_id = $2", [d.id, userId]);
  if (!own.rows[0]) throw new Error("Webhook not found");
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.name !== undefined) { fields.push("name=$" + (vals.length + 1)); vals.push(String(d.name).slice(0, 120)); }
  if (d.url !== undefined) { fields.push("url=$" + (vals.length + 1)); vals.push(normalizeUrl(d.url)); }
  if (d.events !== undefined) {
    const events = (Array.isArray(d.events) ? d.events : []).filter((e) => WEBHOOK_EVENTS.some((w) => w.id === e));
    if (events.length === 0) throw new Error("Select at least one event");
    fields.push("events=$" + (vals.length + 1)); vals.push(JSON.stringify(events));
  }
  if (d.active !== undefined) { fields.push("active=$" + (vals.length + 1)); vals.push(d.active ? 1 : 0); }
  if (fields.length === 0) return { success: true };
  fields.push("updated_at = NOW()");
  vals.push(d.id, userId);
  await pool.query("UPDATE webhook_endpoints SET " + fields.join(", ") + " WHERE id=$" + (vals.length - 1) + " AND user_id=$" + vals.length, vals);
  return { success: true };
});

// webhooks.deleteEndpoint
export const deleteWebhook = makeAuthFn("webhooks.deleteEndpoint", async (args: { data: { id: string } }, userId, pool) => {
  const r = await pool.query("DELETE FROM webhook_endpoints WHERE id = $1 AND user_id = $2", [args.data?.id, userId]);
  if (r.rowCount === 0) throw new Error("Webhook not found");
  return { success: true };
});

// webhooks.testFire — send a test event to an endpoint
export const testFireWebhook = makeAuthFn("webhooks.testFire", async (args: { data: { id: string } }, userId, pool) => {
  const ep = (await pool.query("SELECT * FROM webhook_endpoints WHERE id = $1 AND user_id = $2", [args.data?.id, userId])).rows[0];
  if (!ep) throw new Error("Webhook not found");
  const event = "test";
  const payload = JSON.stringify({ event, timestamp: new Date().toISOString(), data: { message: "Test delivery from BuildBid", userId } });
  let status = 0;
  let respText = "";
  const started = Date.now();
  try {
    const resp = await fetch(ep.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "BuildBid-Webhook/1.0", "X-BuildBid-Event": "test", "X-BuildBid-Signature": signPayload(ep.secret, payload) },
      body: payload,
    });
    status = resp.status;
    respText = (await resp.text()).slice(0, 1000);
  } catch (e: any) {
    respText = `Delivery error: ${e?.message || e}`;
  }
  await pool.query(
    "INSERT INTO webhook_logs (id, endpoint_id, user_id, event, payload, status_code, response, duration_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [crypto.randomUUID(), ep.id, userId, "test", payload, status, respText, Date.now() - started]
  );
  return { success: status >= 200 && status < 300, statusCode: status, response: respText };
});

// webhooks.getLogs
export const getWebhookLogs = makeAuthFn("webhooks.getLogs", async (args: { data?: { endpointId?: string; limit?: number } }, userId, pool) => {
  const limit = Math.min(Math.max(parseInt(String(args.data?.limit)) || 50, 1), 200);
  let sql = "SELECT * FROM webhook_logs WHERE user_id = $1";
  const params: any[] = [userId];
  if (args.data?.endpointId) { sql += " AND endpoint_id = $2"; params.push(args.data.endpointId); }
  sql += " ORDER BY created_at DESC LIMIT $" + (params.length + 1);
  params.push(limit);
  const logs = (await pool.query(sql, params)).rows;
  return { logs };
});

// webhooks.getManifest — Zapier app definition JSON
export const getZapierManifest = makeAuthFn("webhooks.getManifest", async (_args, userId, pool) => {
  const manifest = {
    name: "BuildBid",
    description: "Estimating, proposals, and job tracking for trade contractors.",
    version: "1.0.0",
    platformVersion: "2.0.0",
    appUrl: "https://buildbid.pro",
    auth: { type: "apiKey", test: { url: "https://buildbid.pro/api/v1/me", method: "GET", headers: { "X-API-Key": "{{bundle.authData.apiKey}}" } }, fields: [{ key: "apiKey", label: "API Key", type: "string", helpText: "Create an API key in BuildBid → Settings → API Keys" }] },
    triggers: [
      { key: "estimate_won", noun: "Estimate Won", display: { label: "Estimate Won", description: "Triggers when an estimate is marked won." }, operation: { perform: { url: "https://buildbid.pro/api/v1/webhook-pull?event=estimate.won", method: "GET", headers: { "X-API-Key": "{{bundle.authData.apiKey}}" } }, sample: { id: "est_1", project_name: "Kitchen Rewire", customer_name: "Acme Homes", total: 12400 } } },
      { key: "estimate_sent", noun: "Estimate Sent", display: { label: "Estimate Sent", description: "Triggers when an estimate proposal is sent." }, operation: { perform: { url: "https://buildbid.pro/api/v1/webhook-pull?event=estimate.sent", method: "GET", headers: { "X-API-Key": "{{bundle.authData.apiKey}}" } }, sample: { id: "est_1", project_name: "Kitchen Rewire", customer_name: "Acme Homes" } } },
      { key: "invoice_paid", noun: "Invoice Paid", display: { label: "Invoice Paid", description: "Triggers when an invoice is marked paid." }, operation: { perform: { url: "https://buildbid.pro/api/v1/webhook-pull?event=invoice.paid", method: "GET", headers: { "X-API-Key": "{{bundle.authData.apiKey}}" } }, sample: { id: "inv_1", invoice_number: "INV-0001", total: 4200 } } },
    ],
    actions: [
      { key: "create_estimate", noun: "Estimate", display: { label: "Create Estimate", description: "Creates a new estimate." }, operation: { perform: { url: "https://buildbid.pro/api/v1/estimates", method: "POST", headers: { "X-API-Key": "{{bundle.authData.apiKey}}" } }, inputFields: [{ key: "project_name", label: "Project Name", type: "string", required: true }, { key: "customer_name", label: "Customer Name", type: "string", required: true }, { key: "trade", label: "Trade", type: "string" }], sample: { id: "est_1", project_name: "Kitchen Rewire", customer_name: "Acme Homes", trade: "electrical" } } },
    ],
    resources: {},
  };
  return { manifest };
});
