// SMS notification core — Twilio client wrapper with dry-run mode.
// Production-ready: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER
// env vars to activate real delivery. Without them every message is logged to the
// console + sms_log table as status "dry_run".
import type { Pool } from "@neondatabase/serverless";
import { makeAuthFn } from "./iso";
import {
  SMS_TEMPLATES,
  renderSmsTemplate,
  normalizePhone,
  truncateSms,
} from "./sms-templates";

export interface SmsSendInput {
  /** Recipient phone number (US 10-digit or E.164). */
  to: string;
  /** Template type key from sms-templates.ts (proposal_ready, invoice_due, ...). */
  type?: string;
  /** Raw custom message (used when type is omitted or unknown). */
  message?: string;
  /** Template variables, e.g. { amount: "$2,450.00", date: "Aug 20, 2026" }. */
  vars?: Record<string, string | number>;
}

export interface SmsSendResult {
  success: boolean;
  status: string;
  logId: string;
  message: string;
  truncated: boolean;
  skipped?: string;
}

const TWILIO_CONFIGURED = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);

// ─── Core send — used by vercel-entry /api/call switch + /api/sms/send route ───
export async function sendSms(pool: Pool, userId: string, input: SmsSendInput): Promise<SmsSendResult> {
  const phone = normalizePhone(input.to);
  if (!phone) {
    return { success: false, status: "invalid_phone", logId: "", message: "", truncated: false, skipped: "Invalid phone number" };
  }
  const u = (await pool.query("SELECT sms_enabled, name FROM users WHERE id = $1", [userId])).rows[0];
  if (!u) return { success: false, status: "no_user", logId: "", message: "", truncated: false, skipped: "User not found" };
  if (u.sms_enabled === 0 || u.sms_enabled === false) {
    return { success: false, status: "disabled", logId: "", message: "", truncated: false, skipped: "SMS notifications are disabled for this account" };
  }

  // Compose message: explicit message wins; otherwise render the named template.
  let message = String(input.message || "").trim();
  const type = input.type && SMS_TEMPLATES[input.type] ? input.type : "custom";
  if (!message && type !== "custom") {
    const vars: Record<string, string | number> = {
      businessName: u.name || "BuildBid",
      amount: "",
      link: "",
      date: "",
      time: "",
      address: "",
      invoiceId: "",
      projectName: "",
      customerName: "",
      ...(input.vars || {}),
    };
    message = renderSmsTemplate(type, vars).trim();
  }
  if (!message) {
    return { success: false, status: "no_message", logId: "", message: "", truncated: false, skipped: "No message to send" };
  }

  // Rate limiting: 10 / minute, 100 / day per user.
  const minAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [minR, dayR] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS c FROM sms_log WHERE user_id=$1 AND created_at > $2", [userId, minAgo]),
    pool.query("SELECT COUNT(*)::int AS c FROM sms_log WHERE user_id=$1 AND created_at > $2", [userId, dayAgo]),
  ]);
  if ((minR.rows[0]?.c || 0) >= 10) {
    return { success: false, status: "rate_limited", logId: "", message: "", truncated: false, skipped: "Rate limit: too many messages in the last minute" };
  }
  if ((dayR.rows[0]?.c || 0) >= 100) {
    return { success: false, status: "rate_limited", logId: "", message: "", truncated: false, skipped: "Daily SMS limit reached (100)" };
  }

  const { text, truncated } = truncateSms(message);
  const logId = crypto.randomUUID();

  // Provider: Twilio when configured, otherwise dry-run (log only).
  let status = "dry_run";
  let provider = "dry-run";
  let error = "";
  if (TWILIO_CONFIGURED()) {
    provider = "twilio";
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const auth = process.env.TWILIO_AUTH_TOKEN!;
      const from = process.env.TWILIO_FROM_NUMBER!;
      const form = new URLSearchParams({ To: phone, From: from, Body: text });
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (resp.ok) {
        status = "sent";
      } else {
        status = "failed";
        error = await resp.text();
      }
    } catch (e: any) {
      status = "failed";
      error = e?.message || "Twilio error";
    }
  } else {
    console.log(`[sms:dry-run] → ${phone} (${type}): ${text}`);
  }

  await pool.query(
    "INSERT INTO sms_log (id, user_id, type, to_phone, message, status, provider, error) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [logId, userId, type, phone, text, status, provider, error]
  );
  return { success: status !== "failed", status, logId, message: text, truncated, skipped: error || undefined };
}

/** Look up a customer's phone by name (used when auto-sending on status changes). */
export async function findCustomerPhone(pool: Pool, userId: string, customerName: string): Promise<string> {
  if (!customerName) return "";
  const r = await pool.query(
    "SELECT phone FROM customers WHERE user_id=$1 AND LOWER(name)=LOWER($2) AND phone IS NOT NULL AND phone != '' ORDER BY created_at DESC LIMIT 1",
    [userId, customerName]
  );
  return r.rows[0]?.phone || "";
}

export async function getSmsSettings(pool: Pool, userId: string) {
  const u = (await pool.query("SELECT sms_enabled, name FROM users WHERE id = $1", [userId])).rows[0];
  const live = TWILIO_CONFIGURED();
  return {
    enabled: u ? !(u.sms_enabled === 0 || u.sms_enabled === false) : true,
    businessName: u?.name || "",
    twilioConfigured: live,
    mode: live ? "live" : "dry-run",
    templates: Object.entries(SMS_TEMPLATES).map(([type, t]) => ({ type, ...t })),
  };
}

export async function saveSmsSettings(pool: Pool, userId: string, enabled: boolean) {
  await pool.query("UPDATE users SET sms_enabled=$1 WHERE id=$2", [enabled ? 1 : 0, userId]);
  return { success: true, enabled };
}

export async function getSmsLogs(pool: Pool, userId: string, limit = 50) {
  return (await pool.query("SELECT * FROM sms_log WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2", [userId, limit])).rows;
}

export async function getAdminSmsLogs(pool: Pool, userId: string, limit = 100) {
  const r = await pool.query("SELECT role FROM users WHERE id=$1", [userId]);
  if (r.rows[0]?.role !== "admin") throw new Error("Admin required");
  return (await pool.query(
    "SELECT s.*, u.email AS user_email FROM sms_log s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT $1",
    [limit]
  )).rows;
}

// ─── Isomorphic registry wrappers (dev-mode /api/call via call-registry) ───
// Production dispatch is the inline switch in vercel-entry.ts; these registrations
// make the same functions reachable through src/routes/api/call.ts in dev.
export const smsGetSettings = makeAuthFn("sms.getSettings", async (_args: any, userId: string, pool: Pool) =>
  getSmsSettings(pool, userId));

export const smsSaveSettings = makeAuthFn("sms.saveSettings", async (args: any, userId: string, pool: Pool) =>
  saveSmsSettings(pool, userId, !!args?.data?.enabled));

export const smsSend = makeAuthFn("sms.send", async (args: any, userId: string, pool: Pool) =>
  sendSms(pool, userId, args?.data || {}));

export const smsSendTest = makeAuthFn("sms.sendTest", async (args: any, userId: string, pool: Pool) =>
  sendSms(pool, userId, { to: args?.data?.phone || "", type: "test", vars: args?.data?.vars }));

export const smsGetLogs = makeAuthFn("sms.getLogs", async (args: any, userId: string, pool: Pool) =>
  getSmsLogs(pool, userId, args?.data?.limit || 50));

export const smsAdminGetLogs = makeAuthFn("sms.adminGetLogs", async (args: any, userId: string, pool: Pool) =>
  getAdminSmsLogs(pool, userId, args?.data?.limit || 100));
